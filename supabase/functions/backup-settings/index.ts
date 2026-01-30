import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All settings tables to backup
const SETTINGS_TABLES = [
  "system_options",
  "document_type_config",
  "departments",
  "process_stages",
  "stage_responsibilities",
  "progress_milestones",
  "progress_settings",
  "quote_engineering_presets",
  "system_tariff_rates",
  "deletion_policies",
  "app_settings",
  "document_tags",
  "payment_milestones",
  "project_custom_fields",
  "project_field_config",
  "milestone_notification_settings",
  "ai_settings",
];

const MAX_BACKUPS = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "未授權" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "無效的認證" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "需要管理員權限" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create-backup":
        return await handleCreateBackup(supabaseAdmin, user, body.backup_type || "manual", corsHeaders);

      case "list-backups":
        return await handleListBackups(supabaseAdmin, corsHeaders);

      case "delete-backup":
        return await handleDeleteBackup(supabaseAdmin, body.file_path, corsHeaders);

      case "get-schedule":
        return await handleGetSchedule(supabaseAdmin, corsHeaders);

      case "update-schedule":
        return await handleUpdateSchedule(supabaseAdmin, body.frequency, corsHeaders);

      default:
        return new Response(
          JSON.stringify({ success: false, error: `未知的操作: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("[Backup Settings] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleCreateBackup(
  supabase: any,
  user: any,
  backupType: string,
  corsHeaders: Record<string, string>
) {
  console.log("[Backup] Starting backup...");

  const backupData: Record<string, any[]> = {};
  const recordCounts: Record<string, number> = {};

  // Fetch all settings tables data
  for (const table of SETTINGS_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.error(`[Backup] Error fetching ${table}:`, error);
        backupData[table] = [];
        recordCounts[table] = 0;
      } else {
        backupData[table] = data || [];
        recordCounts[table] = data?.length || 0;
      }
    } catch (err) {
      console.error(`[Backup] Exception for ${table}:`, err);
      backupData[table] = [];
      recordCounts[table] = 0;
    }
  }

  // Generate timestamp for filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `settings_backup_${timestamp}.json`;

  // Create JSON backup content
  const backupContent = JSON.stringify({
    backup_info: {
      created_at: now.toISOString(),
      created_by: user.email,
      backup_type: backupType,
      tables: SETTINGS_TABLES,
      record_counts: recordCounts,
    },
    data: backupData,
  }, null, 2);

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("settings-backups")
    .upload(fileName, backupContent, {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) {
    console.error("[Backup] Upload error:", uploadError);
    return new Response(
      JSON.stringify({ success: false, error: `上傳失敗: ${uploadError.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("[Backup] Backup created:", fileName);

  // Clean up old backups (keep only MAX_BACKUPS)
  await cleanupOldBackups(supabase);

  return new Response(
    JSON.stringify({
      success: true,
      message: "備份成功",
      file_path: fileName,
      record_counts: recordCounts,
      total_records: Object.values(recordCounts).reduce((a, b) => a + b, 0),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleListBackups(supabase: any, corsHeaders: Record<string, string>) {
  const { data: files, error } = await supabase.storage
    .from("settings-backups")
    .list("", {
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Filter only JSON backup files
  const backups = (files || [])
    .filter((f: any) => f.name.startsWith("settings_backup_") && f.name.endsWith(".json"))
    .map((f: any) => ({
      name: f.name,
      size: f.metadata?.size || 0,
      created_at: f.created_at,
    }));

  return new Response(
    JSON.stringify({ success: true, backups }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDeleteBackup(
  supabase: any,
  filePath: string,
  corsHeaders: Record<string, string>
) {
  if (!filePath) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少檔案路徑" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error } = await supabase.storage
    .from("settings-backups")
    .remove([filePath]);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "備份已刪除" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleGetSchedule(supabase: any, corsHeaders: Record<string, string>) {
  const { data, error } = await supabase
    .from("progress_settings")
    .select("setting_value")
    .eq("setting_key", "backup_schedule")
    .single();

  if (error) {
    // Return default schedule if not found
    return new Response(
      JSON.stringify({
        success: true,
        schedule: { frequency: "manual", last_backup_at: null, max_backups: 3 },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, schedule: data.setting_value }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleUpdateSchedule(
  supabase: any,
  frequency: string,
  corsHeaders: Record<string, string>
) {
  if (!["manual", "daily", "weekly"].includes(frequency)) {
    return new Response(
      JSON.stringify({ success: false, error: "無效的備份頻率" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error } = await supabase
    .from("progress_settings")
    .upsert({
      setting_key: "backup_schedule",
      setting_value: { frequency, last_backup_at: null, max_backups: MAX_BACKUPS },
      description: "系統設定備份排程",
    }, { onConflict: "setting_key" });

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "備份排程已更新" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function cleanupOldBackups(supabase: any) {
  try {
    const { data: files, error } = await supabase.storage
      .from("settings-backups")
      .list("", { sortBy: { column: "created_at", order: "desc" } });

    if (error || !files) return;

    const backups = files.filter(
      (f: any) => f.name.startsWith("settings_backup_") && f.name.endsWith(".json")
    );

    // Delete backups beyond MAX_BACKUPS
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS).map((f: any) => f.name);
      console.log("[Backup] Cleaning up old backups:", toDelete);
      await supabase.storage.from("settings-backups").remove(toDelete);
    }
  } catch (err) {
    console.error("[Backup] Cleanup error:", err);
  }
}
