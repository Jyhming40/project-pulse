import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExpiringDocument {
  id: string;
  doc_type: string;
  title: string | null;
  due_at: string;
  project: {
    project_code: string;
    project_name: string;
  };
  owner: {
    email: string | null;
    full_name: string | null;
  } | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting document expiry check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body for optional parameters
    let daysAhead = 14; // Default: check documents expiring in 14 days
    let sendEmails = true;
    
    try {
      const body = await req.json();
      if (body.daysAhead) daysAhead = body.daysAhead;
      if (body.sendEmails !== undefined) sendEmails = body.sendEmails;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Calculate date range
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    console.log(`Checking documents expiring between ${todayStr} and ${futureDateStr}`);

    // Find documents expiring soon
    const { data: expiringDocs, error } = await supabase
      .from("documents")
      .select(`
        id,
        doc_type,
        title,
        due_at,
        projects!inner(project_code, project_name),
        owner:profiles!documents_owner_user_id_fkey(email, full_name)
      `)
      .eq("is_deleted", false)
      .gte("due_at", todayStr)
      .lte("due_at", futureDateStr)
      .order("due_at", { ascending: true });

    if (error) {
      console.error("Error fetching expiring documents:", error);
      throw error;
    }

    console.log(`Found ${expiringDocs?.length || 0} expiring documents`);

    if (!expiringDocs || expiringDocs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No expiring documents found",
          count: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Group documents by owner email
    const docsByOwner = new Map<string, ExpiringDocument[]>();
    
    for (const doc of expiringDocs) {
      const typedDoc: ExpiringDocument = {
        id: doc.id,
        doc_type: doc.doc_type,
        title: doc.title,
        due_at: doc.due_at,
        project: doc.projects as any,
        owner: doc.owner as any,
      };

      const ownerEmail = typedDoc.owner?.email;
      if (ownerEmail) {
        if (!docsByOwner.has(ownerEmail)) {
          docsByOwner.set(ownerEmail, []);
        }
        docsByOwner.get(ownerEmail)!.push(typedDoc);
      }
    }

    // Also get admin emails to CC
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id, profiles!user_roles_user_id_profiles_fkey(email)")
      .eq("role", "admin")
      .eq("status", "active");

    const adminEmails = admins
      ?.map((a: any) => a.profiles?.email)
      .filter(Boolean) || [];

    console.log(`Found ${adminEmails.length} admin emails`);

    // Send notification emails
    const emailResults: any[] = [];

    if (sendEmails && docsByOwner.size > 0) {
      for (const [email, docs] of docsByOwner.entries()) {
        const ownerName = docs[0].owner?.full_name || "使用者";
        
        // Build email content
        const docRows = docs.map(doc => {
          const dueDate = new Date(doc.due_at);
          const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const urgency = daysUntilDue <= 3 ? "🔴" : daysUntilDue <= 7 ? "🟡" : "🟢";
          
          return `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${urgency} ${doc.project.project_code}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${doc.project.project_name}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${doc.doc_type}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${doc.title || "-"}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${doc.due_at}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${daysUntilDue} 天</td>
            </tr>
          `;
        }).join("");

        const html = `
          <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto;">
            <h2 style="color: #333;">📋 文件到期提醒</h2>
            <p>您好 ${ownerName}，</p>
            <p>以下文件即將於 ${daysAhead} 天內到期，請盡快處理：</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">案場編號</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">案場名稱</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">文件類型</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">標題</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">到期日</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">剩餘天數</th>
                </tr>
              </thead>
              <tbody>
                ${docRows}
              </tbody>
            </table>
            
            <p style="color: #666; font-size: 14px;">
              🔴 = 3天內到期 &nbsp; 🟡 = 7天內到期 &nbsp; 🟢 = 7天以上
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              此郵件由光電專案管理系統自動發送，請勿直接回覆。
            </p>
          </div>
        `;

        try {
          const result = await resend.emails.send({
            from: "PULSE 系統通知 <onboarding@resend.dev>",
            to: [email],
            cc: adminEmails.filter(e => e !== email),
            subject: `📋 文件到期提醒：您有 ${docs.length} 份文件即將到期`,
            html,
          });
          
          emailResults.push({ email, success: true, result });
          console.log(`Email sent to ${email}`);
        } catch (emailError: any) {
          console.error(`Failed to send email to ${email}:`, emailError);
          emailResults.push({ email, success: false, error: emailError.message });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${expiringDocs.length} expiring documents`,
        count: expiringDocs.length,
        documentsByOwner: Object.fromEntries(
          Array.from(docsByOwner.entries()).map(([email, docs]) => [
            email,
            docs.map(d => ({
              projectCode: d.project.project_code,
              docType: d.doc_type,
              dueAt: d.due_at,
            })),
          ])
        ),
        emailsSent: emailResults.filter(r => r.success).length,
        emailResults: sendEmails ? emailResults : "Emails disabled",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-document-expiry function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
