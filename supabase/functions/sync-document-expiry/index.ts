import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExpiryRule {
  id: string;
  source_doc_type_code: string;
  base_field: string;
  default_validity_days: number | null;
  supersede_doc_type_code: string | null;
  supersede_action: string | null;
  supersede_field: string | null;
  supersede_days: number | null;
}

interface Document {
  id: string;
  project_id: string;
  doc_type_code: string | null;
  issued_at: string | null;
  submitted_at: string | null;
  due_at: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting document expiry sync...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body for optional parameters
    let documentId: string | undefined;
    let projectId: string | undefined;
    let dryRun = false;

    try {
      const body = await req.json();
      documentId = body.documentId;
      projectId = body.projectId;
      dryRun = body.dryRun === true;
    } catch {
      // No body or invalid JSON, process all
    }

    // Fetch active expiry rules
    const { data: rules, error: rulesError } = await supabase
      .from("document_expiry_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) {
      console.error("Error fetching expiry rules:", rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active expiry rules", updates: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${rules.length} active expiry rules`);

    // Build query for source documents
    let docsQuery = supabase
      .from("documents")
      .select("id, project_id, doc_type_code, issued_at, submitted_at, due_at")
      .eq("is_deleted", false)
      .in("doc_type_code", rules.map((r: ExpiryRule) => r.source_doc_type_code));

    if (documentId) {
      docsQuery = docsQuery.eq("id", documentId);
    } else if (projectId) {
      docsQuery = docsQuery.eq("project_id", projectId);
    }

    const { data: sourceDocs, error: docsError } = await docsQuery;

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      throw docsError;
    }

    console.log(`Found ${sourceDocs?.length || 0} source documents to process`);

    const updates: { docId: string; oldDueAt: string | null; newDueAt: string | null; reason: string }[] = [];

    for (const doc of sourceDocs || []) {
      const rule = rules.find((r: ExpiryRule) => r.source_doc_type_code === doc.doc_type_code);
      if (!rule) continue;

      // Get base date
      const baseDate = doc[rule.base_field as keyof Document] as string | null;
      if (!baseDate) continue;

      let newDueAt: string | null = null;
      let reason = "";

      // Check if supersede document exists
      if (rule.supersede_doc_type_code) {
        const { data: supersedeDocs } = await supabase
          .from("documents")
          .select("id, issued_at, submitted_at, due_at")
          .eq("project_id", doc.project_id)
          .eq("doc_type_code", rule.supersede_doc_type_code)
          .eq("is_deleted", false)
          .not("issued_at", "is", null)
          .order("issued_at", { ascending: false })
          .limit(1);

        if (supersedeDocs && supersedeDocs.length > 0) {
          const supersedeDoc = supersedeDocs[0];
          
          if (rule.supersede_action === "clear") {
            newDueAt = null;
            reason = `已取得 ${rule.supersede_doc_type_code}，清除到期日`;
          } else if (rule.supersede_action === "inherit_field") {
            const inheritValue = supersedeDoc[rule.supersede_field as keyof typeof supersedeDoc];
            newDueAt = inheritValue ? String(inheritValue) : null;
            reason = `繼承 ${rule.supersede_doc_type_code} 的 ${rule.supersede_field}`;
          } else if (rule.supersede_action === "extend_days" && rule.supersede_days) {
            const supersedeDate = supersedeDoc.issued_at || supersedeDoc.submitted_at;
            if (supersedeDate) {
              const extendedDate = new Date(supersedeDate);
              extendedDate.setDate(extendedDate.getDate() + rule.supersede_days);
              newDueAt = extendedDate.toISOString().split("T")[0];
              reason = `從 ${rule.supersede_doc_type_code} 延長 ${rule.supersede_days} 天`;
            }
          }
        } else if (rule.default_validity_days) {
          // No supersede doc, apply default validity
          const expiryDate = new Date(baseDate);
          expiryDate.setDate(expiryDate.getDate() + rule.default_validity_days);
          newDueAt = expiryDate.toISOString().split("T")[0];
          reason = `預設效期 ${rule.default_validity_days} 天`;
        }
      } else if (rule.default_validity_days) {
        // No supersede rule, just apply default validity
        const expiryDate = new Date(baseDate);
        expiryDate.setDate(expiryDate.getDate() + rule.default_validity_days);
        newDueAt = expiryDate.toISOString().split("T")[0];
        reason = `預設效期 ${rule.default_validity_days} 天`;
      }

      // Only update if due_at changed
      if (doc.due_at !== newDueAt) {
        updates.push({
          docId: doc.id,
          oldDueAt: doc.due_at,
          newDueAt,
          reason,
        });

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("documents")
            .update({ due_at: newDueAt, updated_at: new Date().toISOString() })
            .eq("id", doc.id);

          if (updateError) {
            console.error(`Error updating document ${doc.id}:`, updateError);
          } else {
            console.log(`Updated document ${doc.id}: due_at = ${newDueAt} (${reason})`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: dryRun ? "Dry run completed" : `Updated ${updates.length} documents`,
        rulesCount: rules.length,
        documentsProcessed: sourceDocs?.length || 0,
        updates,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in sync-document-expiry function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
