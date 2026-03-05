import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reset scope configurations - whitelist approach
const RESET_SCOPES: Record<string, string[]> = {
  demo: [
    // Quote子表（先刪子表）
    "quote_financial_projections",
    "quote_engineering_items",
    "quote_line_items",
    "quote_schedules",
    "quote_modules",
    "quote_inverters",
    // Payment
    "project_payments",
    // Documents子表
    "document_tag_assignments",
    "document_files",
    "documents",
    // Project子表
    "project_construction_assignments",
    "project_milestones",
    "project_stages",
    "project_issues",
    "project_custom_field_values",
    "project_epc_financial_metrics",
    "action_item_resolutions",
    "construction_status_history",
    "project_status_history",
    "milestone_notification_logs",
    // Memos
    "memos",
    // O&M
    "om_ac_tests",
    "om_dc_tests",
    "om_cleaning_reports",
    "om_incident_reports",
    "om_inspections",
    "om_personnel_rosters",
    "om_site_access_requests",
    "om_toolbox_meetings",
    // Quote主表
    "project_quotes",
    // Project主表
    "projects",
  ],
  business: [
    // Quote子表
    "quote_financial_projections",
    "quote_engineering_items",
    "quote_line_items",
    "quote_schedules",
    "quote_modules",
    "quote_inverters",
    // Payment
    "project_payments",
    // Documents子表
    "document_tag_assignments",
    "document_files",
    "documents",
    // Project子表
    "project_construction_assignments",
    "project_milestones",
    "project_stages",
    "project_issues",
    "project_custom_field_values",
    "project_epc_financial_metrics",
    "action_item_resolutions",
    "construction_status_history",
    "project_status_history",
    "milestone_notification_logs",
    // Memos
    "memos",
    // O&M
    "om_ac_tests",
    "om_dc_tests",
    "om_cleaning_reports",
    "om_incident_reports",
    "om_inspections",
    "om_personnel_rosters",
    "om_site_access_requests",
    "om_toolbox_meetings",
    // Duplicate
    "duplicate_ignore_pairs",
    "duplicate_reviews",
    // Quote主表
    "project_quotes",
    // Project主表
    "projects",
    // Investor
    "investor_contacts",
    "investor_payment_methods",
    "investors",
    "investor_year_counters",
    // Partner
    "partner_contacts",
    "partners",
  ],
  factory: [
    // Quote子表
    "quote_financial_projections",
    "quote_engineering_items",
    "quote_line_items",
    "quote_schedules",
    "quote_modules",
    "quote_inverters",
    // Payment
    "project_payments",
    // Documents子表
    "document_tag_assignments",
    "document_files",
    "documents",
    // Project子表
    "project_construction_assignments",
    "project_milestones",
    "project_stages",
    "project_issues",
    "project_custom_field_values",
    "project_epc_financial_metrics",
    "action_item_resolutions",
    "construction_status_history",
    "project_status_history",
    "milestone_notification_logs",
    // Memos
    "memos",
    "memo_tags",
    // O&M
    "om_ac_tests",
    "om_dc_tests",
    "om_cleaning_reports",
    "om_incident_reports",
    "om_inspections",
    "om_personnel_rosters",
    "om_site_access_requests",
    "om_toolbox_meetings",
    // Duplicate
    "duplicate_ignore_pairs",
    "duplicate_reviews",
    // Quote主表
    "project_quotes",
    // Project主表
    "projects",
    // Investor
    "investor_contacts",
    "investor_payment_methods",
    "investors",
    "investor_year_counters",
    // Partner
    "partner_contacts",
    "partners",
    // Audit & system
    "audit_logs",
    "module_permissions",
    "progress_milestones",
    "progress_settings",
    // User events
    "user_events",
    "user_milestone_order",
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

// Get table statistics — covers ALL tables
async function handleGetTableStats(supabase: any, corsHeaders: Record<string, string>) {
  const tables = [
    // Core business
    "projects",
    "documents",
    "document_files",
    "document_tags",
    "document_tag_assignments",
    "document_type_config",
    "document_linkage_rules",
    "document_expiry_rules",
    // Investors
    "investors",
    "investor_contacts",
    "investor_payment_methods",
    "investor_year_counters",
    // Partners
    "partners",
    "partner_contacts",
    // Project sub-tables
    "project_construction_assignments",
    "project_milestones",
    "project_stages",
    "project_issues",
    "project_payments",
    "project_custom_fields",
    "project_custom_field_values",
    "project_field_config",
    "project_epc_financial_metrics",
    "project_status_history",
    "construction_status_history",
    // Quotes
    "project_quotes",
    "quote_modules",
    "quote_inverters",
    "quote_engineering_items",
    "quote_engineering_presets",
    "quote_engineering_templates",
    "quote_line_items",
    "quote_financial_projections",
    "quote_schedules",
    // Payments & milestones
    "payment_milestones",
    "progress_milestones",
    "progress_settings",
    "milestone_notification_settings",
    "milestone_notification_logs",
    // Memos
    "memos",
    "memo_tags",
    // O&M
    "om_ac_tests",
    "om_dc_tests",
    "om_cleaning_reports",
    "om_incident_reports",
    "om_inspections",
    "om_personnel_rosters",
    "om_site_access_requests",
    "om_toolbox_meetings",
    // Governance
    "departments",
    "process_stages",
    "stage_responsibilities",
    "action_item_resolutions",
    // Duplicate management
    "duplicate_ignore_pairs",
    "duplicate_reviews",
    // System config
    "system_options",
    "system_tariff_rates",
    "deletion_policies",
    "app_settings",
    "ai_settings",
    "company_bank_accounts",
    // User & permissions
    "profiles",
    "user_roles",
    "user_security",
    "user_preferences",
    "user_drive_tokens",
    "user_milestone_order",
    "user_events",
    "module_permissions",
    // Audit
    "audit_logs",
  ];

  // Tables with soft-delete (is_deleted column)
  const softDeleteTables = new Set([
    "projects", "documents", "document_files",
    "investors", "investor_contacts", "investor_payment_methods",
    "partners", "partner_contacts",
    "project_construction_assignments",
    "memos",
  ]);

  const stats: Record<string, { count: number; deletedCount?: number }> = {};

  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      stats[table] = { count: count || 0 };

      if (softDeleteTables.has(table)) {
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

  // Get valid quote IDs once for all quote sub-table checks
  const { data: validQuotes } = await supabase
    .from("project_quotes")
    .select("id");
  const validQuoteIds = new Set(validQuotes?.map((q: any) => q.id) || []);

  const quoteSubTables = [
    { table: "quote_modules", label: "模組設備" },
    { table: "quote_inverters", label: "變流器設備" },
    { table: "quote_engineering_items", label: "工程項目" },
    { table: "quote_line_items", label: "報價細項" },
    { table: "quote_financial_projections", label: "財務預測" },
    { table: "quote_schedules", label: "時程安排" },
  ];

  for (const { table, label } of quoteSubTables) {
    const { data: rows } = await supabase.from(table).select("id, quote_id");
    if (rows?.length > 0) {
      const orphaned = rows.filter((r: any) => !validQuoteIds.has(r.quote_id));
      if (orphaned.length > 0) {
        issues.push({
          table,
          issue: `關聯至已刪除報價的${label}`,
          count: orphaned.length,
          severity: "warning",
        });
      }
    }
  }

  // ========== 4. Payment & Milestone Checks ==========

  // Check for project_payments referencing deleted projects
  const { data: payments } = await supabase
    .from("project_payments")
    .select("id, project_id");
  if (payments?.length > 0) {
    const { data: vp } = await supabase.from("projects").select("id").eq("is_deleted", false);
    const vpIds = new Set(vp?.map((p: any) => p.id) || []);
    const orphanedPayments = payments.filter((p: any) => !vpIds.has(p.project_id));
    if (orphanedPayments.length > 0) {
      issues.push({
        table: "project_payments",
        issue: "關聯至已刪除專案的付款記錄",
        count: orphanedPayments.length,
        severity: "warning",
      });
    }
  }

  // Check for action_item_resolutions referencing deleted projects
  const { data: resolutions } = await supabase
    .from("action_item_resolutions")
    .select("id, project_id");
  if (resolutions?.length > 0) {
    const { data: vp } = await supabase.from("projects").select("id").eq("is_deleted", false);
    const vpIds = new Set(vp?.map((p: any) => p.id) || []);
    const orphanedRes = resolutions.filter((r: any) => !vpIds.has(r.project_id));
    if (orphanedRes.length > 0) {
      issues.push({
        table: "action_item_resolutions",
        issue: "關聯至已刪除專案的處理紀錄",
        count: orphanedRes.length,
        severity: "warning",
      });
    }
  }

  // ========== 5. O&M Checks ==========

  const omTables = [
    { table: "om_ac_tests", label: "AC 測試" },
    { table: "om_dc_tests", label: "DC 測試" },
    { table: "om_cleaning_reports", label: "清潔報告" },
    { table: "om_incident_reports", label: "事件報告" },
    { table: "om_inspections", label: "巡檢紀錄" },
    { table: "om_personnel_rosters", label: "人員名冊" },
    { table: "om_site_access_requests", label: "入場申請" },
    { table: "om_toolbox_meetings", label: "工具箱會議" },
  ];

  for (const { table, label } of omTables) {
    const { data: rows } = await supabase.from(table).select("id, project_id");
    if (rows?.length > 0) {
      const withProject = rows.filter((r: any) => r.project_id);
      if (withProject.length > 0) {
        const { data: vp } = await supabase.from("projects").select("id").eq("is_deleted", false);
        const vpIds = new Set(vp?.map((p: any) => p.id) || []);
        const orphaned = withProject.filter((r: any) => !vpIds.has(r.project_id));
        if (orphaned.length > 0) {
          issues.push({
            table,
            issue: `關聯至已刪除專案的${label}`,
            count: orphaned.length,
            severity: "warning",
          });
        }
      }
    }
  }

  // ========== 6. Memo Checks ==========

  const { data: allMemos } = await supabase
    .from("memos")
    .select("id, project_id")
    .eq("is_deleted", false)
    .not("project_id", "is", null);

  if (allMemos?.length > 0) {
    const { data: vp } = await supabase.from("projects").select("id").eq("is_deleted", false);
    const vpIds = new Set(vp?.map((p: any) => p.id) || []);
    const orphanedMemos = allMemos.filter((m: any) => !vpIds.has(m.project_id));
    if (orphanedMemos.length > 0) {
      issues.push({
        table: "memos",
        issue: "關聯至已刪除專案的備忘錄",
        count: orphanedMemos.length,
        severity: "warning",
      });
    }
  }

  // ========== 7. Soft-Delete Retention Checks ==========

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const softDeleteTables = [
    "projects", "documents", "document_files", 
    "investors", "investor_contacts", "investor_payment_methods",
    "partners", "partner_contacts", "project_construction_assignments",
    "memos",
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

  // ========== 8. User & Permission Checks ==========

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

  // ========== 9. Data Consistency Checks ==========

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

  // ========== 10. Telemetry Health Check ==========

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
      const { count: beforeCount } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      const { error } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

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
