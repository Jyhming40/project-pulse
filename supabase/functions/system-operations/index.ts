import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reset scope configurations - whitelist approach
const RESET_SCOPES: Record<string, string[]> = {
  demo: [
    "document_files",
    "documents",
    "project_construction_assignments",
    "construction_status_history",
    "project_status_history",
    "project_milestones",
    "projects",
  ],
  business: [
    "document_files",
    "documents",
    "project_construction_assignments",
    "construction_status_history",
    "project_status_history",
    "project_milestones",
    "projects",
    "investor_contacts",
    "investor_payment_methods",
    "investors",
    "partner_contacts",
    "partners",
    "investor_year_counters",
  ],
  factory: [
    "document_files",
    "documents",
    "project_construction_assignments",
    "construction_status_history",
    "project_status_history",
    "project_milestones",
    "projects",
    "investor_contacts",
    "investor_payment_methods",
    "investors",
    "partner_contacts",
    "partners",
    "investor_year_counters",
    "audit_logs",
    "module_permissions",
    "progress_milestones",
    "progress_settings",
  ],
};

// Cooldown period in milliseconds (10 minutes)
const COOLDOWN_MS = 10 * 60 * 1000;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "未授權" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client for user verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "無效的認證" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role server-side (critical security check)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("Role check failed:", roleError, roleData);
      return new Response(
        JSON.stringify({ success: false, error: "需要管理員權限" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[System Operations] Action: ${action}, User: ${user.email}`);

    switch (action) {
      case "get-table-stats":
        return await handleGetTableStats(supabaseAdmin, corsHeaders);

      case "check-integrity":
        return await handleCheckIntegrity(supabaseAdmin, corsHeaders);

      case "db-reset":
        return await handleDatabaseReset(supabaseAdmin, user, params, corsHeaders);

      case "check-cooldown":
        return await handleCheckCooldown(supabaseAdmin, params, corsHeaders);

      default:
        return new Response(
          JSON.stringify({ success: false, error: `未知的操作: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("[System Operations] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Get table statistics
async function handleGetTableStats(supabase: any, corsHeaders: Record<string, string>) {
  const tables = [
    "projects",
    "documents",
    "document_files",
    "investors",
    "investor_contacts",
    "investor_payment_methods",
    "partners",
    "partner_contacts",
    "project_construction_assignments",
    "project_status_history",
    "construction_status_history",
    "project_milestones",
    "progress_milestones",
    "progress_settings",
    "system_options",
    "deletion_policies",
    "audit_logs",
    "profiles",
    "user_roles",
    "module_permissions",
    "user_preferences",
  ];

  const stats: Record<string, { count: number; deletedCount?: number }> = {};

  for (const table of tables) {
    try {
      // Get total count
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      stats[table] = { count: count || 0 };

      // For soft-delete tables, get deleted count
      if (["projects", "documents", "document_files", "investors", "investor_contacts", 
           "investor_payment_methods", "partners", "partner_contacts", 
           "project_construction_assignments"].includes(table)) {
        const { count: deletedCount } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("is_deleted", true);

        stats[table].deletedCount = deletedCount || 0;
      }
    } catch (err) {
      console.error(`Error getting stats for ${table}:`, err);
      stats[table] = { count: -1 };
    }
  }

  return new Response(
    JSON.stringify({ success: true, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Check data integrity - comprehensive checks for all major tables
async function handleCheckIntegrity(supabase: any, corsHeaders: Record<string, string>) {
  const issues: Array<{ table: string; issue: string; count: number; severity: string }> = [];

  // ========== 1. Core Business Data Checks ==========

  // Check for orphaned documents (documents without valid project_id)
  const { data: orphanedDocs } = await supabase
    .from("documents")
    .select("id, project_id")
    .is("project_id", null)
    .eq("is_deleted", false);

  if (orphanedDocs?.length > 0) {
    issues.push({
      table: "documents",
      issue: "缺少 project_id 的文件",
      count: orphanedDocs.length,
      severity: "warning",
    });
  }

  // Check for orphaned document_files (files without valid document)
  const { count: orphanedFiles } = await supabase
    .from("document_files")
    .select("id, documents!inner(id)", { count: "exact", head: true })
    .is("document_id", null)
    .eq("is_deleted", false);

  if (orphanedFiles && orphanedFiles > 0) {
    issues.push({
      table: "document_files",
      issue: "缺少有效 document_id 的檔案",
      count: orphanedFiles,
      severity: "warning",
    });
  }

  // Check for investor_contacts without valid investor
  const { count: orphanedInvContacts } = await supabase
    .from("investor_contacts")
    .select("*", { count: "exact", head: true })
    .is("investor_id", null)
    .eq("is_deleted", false);

  if (orphanedInvContacts && orphanedInvContacts > 0) {
    issues.push({
      table: "investor_contacts",
      issue: "缺少有效 investor_id 的聯絡人",
      count: orphanedInvContacts,
      severity: "warning",
    });
  }

  // Check for partner_contacts without valid partner
  const { count: orphanedPartnerContacts } = await supabase
    .from("partner_contacts")
    .select("*", { count: "exact", head: true })
    .is("partner_id", null)
    .eq("is_deleted", false);

  if (orphanedPartnerContacts && orphanedPartnerContacts > 0) {
    issues.push({
      table: "partner_contacts",
      issue: "缺少有效 partner_id 的聯絡人",
      count: orphanedPartnerContacts,
      severity: "warning",
    });
  }

  // Check for projects without investor
  const { count: projectsWithoutInvestor } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .is("investor_id", null)
    .eq("is_deleted", false);

  if (projectsWithoutInvestor && projectsWithoutInvestor > 0) {
    issues.push({
      table: "projects",
      issue: "未指派投資人的專案",
      count: projectsWithoutInvestor,
      severity: "info",
    });
  }

  // ========== 2. Governance Layer Checks ==========

  // Check for project_issues referencing non-existent projects
  const { data: allIssues } = await supabase
    .from("project_issues")
    .select("id, project_id");
  
  if (allIssues?.length > 0) {
    const { data: validProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("is_deleted", false);
    
    const validProjectIds = new Set(validProjects?.map((p: any) => p.id) || []);
    const orphanedIssues = allIssues.filter((i: any) => !validProjectIds.has(i.project_id));
    
    if (orphanedIssues.length > 0) {
      issues.push({
        table: "project_issues",
        issue: "關聯至已刪除專案的問題記錄",
        count: orphanedIssues.length,
        severity: "warning",
      });
    }
  }

  // Check for stage_responsibilities referencing inactive departments or stages
  const { data: responsibilities } = await supabase
    .from("stage_responsibilities")
    .select("id, department_id, stage_id");
  
  if (responsibilities?.length > 0) {
    const { data: activeDepts } = await supabase
      .from("departments")
      .select("id")
      .eq("is_active", true);
    
    const { data: activeStages } = await supabase
      .from("process_stages")
      .select("id")
      .eq("is_active", true);
    
    const deptIds = new Set(activeDepts?.map((d: any) => d.id) || []);
    const stageIds = new Set(activeStages?.map((s: any) => s.id) || []);
    
    const orphanedResp = responsibilities.filter(
      (r: any) => !deptIds.has(r.department_id) || !stageIds.has(r.stage_id)
    );
    
    if (orphanedResp.length > 0) {
      issues.push({
        table: "stage_responsibilities",
        issue: "關聯至已停用部門或流程階段的責任設定",
        count: orphanedResp.length,
        severity: "warning",
      });
    }
  }

  // ========== 3. Quote System Checks ==========

  // Check for orphaned quote_modules
  const { data: quoteModules } = await supabase
    .from("quote_modules")
    .select("id, quote_id");
  
  if (quoteModules?.length > 0) {
    const { data: validQuotes } = await supabase
      .from("project_quotes")
      .select("id");
    
    const validQuoteIds = new Set(validQuotes?.map((q: any) => q.id) || []);
    const orphanedModules = quoteModules.filter((m: any) => !validQuoteIds.has(m.quote_id));
    
    if (orphanedModules.length > 0) {
      issues.push({
        table: "quote_modules",
        issue: "關聯至已刪除報價的模組設備",
        count: orphanedModules.length,
        severity: "warning",
      });
    }
  }

  // Check for orphaned quote_inverters
  const { data: quoteInverters } = await supabase
    .from("quote_inverters")
    .select("id, quote_id");
  
  if (quoteInverters?.length > 0) {
    const { data: validQuotes } = await supabase
      .from("project_quotes")
      .select("id");
    
    const validQuoteIds = new Set(validQuotes?.map((q: any) => q.id) || []);
    const orphanedInverters = quoteInverters.filter((i: any) => !validQuoteIds.has(i.quote_id));
    
    if (orphanedInverters.length > 0) {
      issues.push({
        table: "quote_inverters",
        issue: "關聯至已刪除報價的變流器設備",
        count: orphanedInverters.length,
        severity: "warning",
      });
    }
  }

  // ========== 4. Soft-Delete Retention Checks ==========

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const softDeleteTables = [
    "projects", "documents", "document_files", 
    "investors", "investor_contacts", "investor_payment_methods",
    "partners", "partner_contacts", "project_construction_assignments"
  ];
  
  for (const table of softDeleteTables) {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", true)
      .lt("deleted_at", thirtyDaysAgo.toISOString());

    if (count && count > 0) {
      issues.push({
        table,
        issue: "超過 30 天保留期限的已刪除項目",
        count,
        severity: "info",
      });
    }
  }

  // ========== 5. User & Permission Checks ==========

  // Check for profiles without user_roles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id");
  
  if (profiles?.length > 0) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id");
    
    const userIdsWithRoles = new Set(roles?.map((r: any) => r.user_id) || []);
    const profilesWithoutRoles = profiles.filter((p: any) => !userIdsWithRoles.has(p.id));
    
    if (profilesWithoutRoles.length > 0) {
      issues.push({
        table: "profiles",
        issue: "缺少角色設定的使用者",
        count: profilesWithoutRoles.length,
        severity: "warning",
      });
    }
  }

  // Check for pending users (not yet approved)
  const { count: pendingUsers } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (pendingUsers && pendingUsers > 0) {
    issues.push({
      table: "user_roles",
      issue: "待審核的使用者帳號",
      count: pendingUsers,
      severity: "info",
    });
  }

  // ========== 6. Data Consistency Checks ==========

  // Check for duplicate investor codes
  const { data: investors } = await supabase
    .from("investors")
    .select("investor_code")
    .eq("is_deleted", false);

  if (investors) {
    const codeCounts: Record<string, number> = {};
    for (const inv of investors) {
      codeCounts[inv.investor_code] = (codeCounts[inv.investor_code] || 0) + 1;
    }
    const duplicates = Object.entries(codeCounts).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      issues.push({
        table: "investors",
        issue: `重複的投資人代碼: ${duplicates.map(([code]) => code).join(", ")}`,
        count: duplicates.length,
        severity: "error",
      });
    }
  }

  // Check for duplicate department codes
  const { data: departments } = await supabase
    .from("departments")
    .select("code")
    .eq("is_active", true);

  if (departments) {
    const deptCodeCounts: Record<string, number> = {};
    for (const dept of departments) {
      deptCodeCounts[dept.code] = (deptCodeCounts[dept.code] || 0) + 1;
    }
    const deptDuplicates = Object.entries(deptCodeCounts).filter(([_, count]) => count > 1);
    if (deptDuplicates.length > 0) {
      issues.push({
        table: "departments",
        issue: `重複的部門代碼: ${deptDuplicates.map(([code]) => code).join(", ")}`,
        count: deptDuplicates.length,
        severity: "error",
      });
    }
  }

  // Check for duplicate process stage codes
  const { data: stages } = await supabase
    .from("process_stages")
    .select("code")
    .eq("is_active", true);

  if (stages) {
    const stageCodeCounts: Record<string, number> = {};
    for (const stage of stages) {
      stageCodeCounts[stage.code] = (stageCodeCounts[stage.code] || 0) + 1;
    }
    const stageDuplicates = Object.entries(stageCodeCounts).filter(([_, count]) => count > 1);
    if (stageDuplicates.length > 0) {
      issues.push({
        table: "process_stages",
        issue: `重複的流程階段代碼: ${stageDuplicates.map(([code]) => code).join(", ")}`,
        count: stageDuplicates.length,
        severity: "error",
      });
    }
  }

  // ========== 7. Telemetry Health Check ==========

  // Check for excessive error events in the last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { count: recentErrors } = await supabase
    .from("user_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "error")
    .gte("created_at", oneDayAgo.toISOString());

  if (recentErrors && recentErrors > 50) {
    issues.push({
      table: "user_events",
      issue: "過去 24 小時內錯誤事件數量過多",
      count: recentErrors,
      severity: "warning",
    });
  } else if (recentErrors && recentErrors > 0) {
    issues.push({
      table: "user_events",
      issue: "過去 24 小時內的錯誤事件",
      count: recentErrors,
      severity: "info",
    });
  }

  return new Response(
    JSON.stringify({ success: true, issues }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Check cooldown for reset operations
async function handleCheckCooldown(
  supabase: any,
  params: { environment_id: string },
  corsHeaders: Record<string, string>
) {
  const { environment_id } = params;

  // Check last reset time for this environment
  const { data: lastReset } = await supabase
    .from("audit_logs")
    .select("created_at")
    .eq("action", "DB_RESET")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastReset) {
    const lastResetTime = new Date(lastReset.created_at).getTime();
    const now = Date.now();
    const remaining = COOLDOWN_MS - (now - lastResetTime);

    if (remaining > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          canReset: false,
          cooldownRemaining: remaining,
          cooldownMinutes: Math.ceil(remaining / 60000),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true, canReset: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Handle database reset
async function handleDatabaseReset(
  supabase: any,
  user: any,
  params: {
    scope: string;
    reason: string;
    environment_id: string;
    backup_file_id?: string;
    delete_cloud_files?: boolean;
  },
  corsHeaders: Record<string, string>
) {
  const { scope, reason, environment_id, backup_file_id, delete_cloud_files } = params;

  // Validate scope
  if (!RESET_SCOPES[scope]) {
    return new Response(
      JSON.stringify({ success: false, error: `無效的重置範圍: ${scope}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate required parameters
  if (!reason || reason.length < 10) {
    return new Response(
      JSON.stringify({ success: false, error: "請提供有效的重置原因（至少 10 個字元）" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!environment_id) {
    return new Response(
      JSON.stringify({ success: false, error: "請提供環境識別碼" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check backup requirement
  if (!backup_file_id) {
    return new Response(
      JSON.stringify({ success: false, error: "重置前必須先完成備份" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check cooldown
  const { data: lastReset } = await supabase
    .from("audit_logs")
    .select("created_at")
    .eq("action", "DB_RESET")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastReset) {
    const lastResetTime = new Date(lastReset.created_at).getTime();
    const now = Date.now();
    if (now - lastResetTime < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastResetTime)) / 60000);
      return new Response(
        JSON.stringify({
          success: false,
          error: `冷卻時間尚未結束，請等待 ${remaining} 分鐘後再試`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const tables = RESET_SCOPES[scope];
  const deletedCounts: Record<string, number> = {};
  const errors: string[] = [];

  console.log(`[DB Reset] Starting reset for scope: ${scope}, tables: ${tables.join(", ")}`);

  // Delete in order (respects foreign key constraints)
  for (const table of tables) {
    try {
      // Get count before deletion
      const { count: beforeCount } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      // Delete all records
      const { error } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) {
        console.error(`[DB Reset] Error deleting from ${table}:`, error);
        errors.push(`${table}: ${error.message}`);
      } else {
        deletedCounts[table] = beforeCount || 0;
        console.log(`[DB Reset] Deleted ${beforeCount} records from ${table}`);
      }
    } catch (err) {
      console.error(`[DB Reset] Exception for ${table}:`, err);
      errors.push(`${table}: ${(err as Error).message}`);
    }
  }

  // Log the reset action to audit_logs
  const { error: auditError } = await supabase.from("audit_logs").insert({
    table_name: "system",
    record_id: crypto.randomUUID(),
    action: "DB_RESET",
    actor_user_id: user.id,
    reason: reason,
    new_data: {
      scope,
      environment_id,
      backup_file_id,
      affected_tables: tables,
      deleted_counts: deletedCounts,
      delete_cloud_files: delete_cloud_files || false,
    },
  });

  if (auditError) {
    console.error("[DB Reset] Audit log error:", auditError);
  }

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "部分資料表刪除失敗",
        errors,
        deletedCounts,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "資料庫重置完成",
      scope,
      deletedCounts,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
