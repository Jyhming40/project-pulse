import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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

      case "restore-backup":
        return await handleRestoreBackup(supabaseAdmin, user, body.file_path, body.tables, corsHeaders);

      case "preview-backup":
        return await handlePreviewBackup(supabaseAdmin, body.file_path, corsHeaders);

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
  
  // Create Excel workbook
  const workbook = XLSX.utils.book_new();
  
  // Add metadata sheet
  const metadataSheet = XLSX.utils.json_to_sheet([{
    created_at: now.toISOString(),
    created_by: user.email,
    backup_type: backupType,
    total_tables: SETTINGS_TABLES.length,
    total_records: Object.values(recordCounts).reduce((a, b) => a + b, 0),
  }]);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, "_備份資訊");
  
  // Add each table as a sheet
  for (const table of SETTINGS_TABLES) {
    const data = backupData[table];
    if (data.length > 0) {
      // Flatten nested objects for Excel
      const flattenedData = data.map(row => flattenObject(row));
      const sheet = XLSX.utils.json_to_sheet(flattenedData);
      // Truncate sheet name to 31 chars (Excel limit)
      const sheetName = table.length > 31 ? table.substring(0, 31) : table;
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    } else {
      // Add empty sheet with headers placeholder
      const sheet = XLSX.utils.aoa_to_sheet([["(無資料)"]]);
      const sheetName = table.length > 31 ? table.substring(0, 31) : table;
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    }
  }
  
  // Generate Excel buffer
  const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const excelFileName = `settings_backup_${timestamp}.xlsx`;
  
  // Also create JSON backup for restore functionality
  const jsonContent = JSON.stringify({
    backup_info: {
      created_at: now.toISOString(),
      created_by: user.email,
      backup_type: backupType,
      tables: SETTINGS_TABLES,
      record_counts: recordCounts,
    },
    data: backupData,
  }, null, 2);
  const jsonFileName = `settings_backup_${timestamp}.json`;

  // Upload Excel to storage
  const { error: excelUploadError } = await supabase.storage
    .from("settings-backups")
    .upload(excelFileName, excelBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  if (excelUploadError) {
    console.error("[Backup] Excel upload error:", excelUploadError);
    return new Response(
      JSON.stringify({ success: false, error: `Excel 上傳失敗: ${excelUploadError.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Upload JSON to storage (for restore)
  const { error: jsonUploadError } = await supabase.storage
    .from("settings-backups")
    .upload(jsonFileName, jsonContent, {
      contentType: "application/json",
      upsert: false,
    });

  if (jsonUploadError) {
    console.error("[Backup] JSON upload error:", jsonUploadError);
    // Continue even if JSON fails, Excel is the main backup
  }

  console.log("[Backup] Backup created:", excelFileName);

  // Clean up old backups (keep only MAX_BACKUPS sets)
  await cleanupOldBackups(supabase);

  return new Response(
    JSON.stringify({
      success: true,
      message: "備份成功",
      excel_file: excelFileName,
      json_file: jsonFileName,
      record_counts: recordCounts,
      total_records: Object.values(recordCounts).reduce((a, b) => a + b, 0),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Flatten nested objects for Excel export
function flattenObject(obj: any, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
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

  // Group backups by timestamp (Excel + JSON pairs)
  const backupMap = new Map<string, { excel?: any; json?: any; timestamp: string }>();
  
  for (const file of files || []) {
    if (!file.name.startsWith("settings_backup_")) continue;
    
    // Extract timestamp from filename
    const match = file.name.match(/settings_backup_(.+)\.(xlsx|json)$/);
    if (!match) continue;
    
    const timestamp = match[1];
    const ext = match[2];
    
    if (!backupMap.has(timestamp)) {
      backupMap.set(timestamp, { timestamp });
    }
    
    const entry = backupMap.get(timestamp)!;
    if (ext === "xlsx") {
      entry.excel = file;
    } else if (ext === "json") {
      entry.json = file;
    }
  }

  // Convert to array and format
  const backups = Array.from(backupMap.values())
    .filter(b => b.excel || b.json) // At least one file exists
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map(b => ({
      timestamp: b.timestamp,
      excel_file: b.excel?.name,
      json_file: b.json?.name,
      excel_size: b.excel?.metadata?.size || 0,
      json_size: b.json?.metadata?.size || 0,
      created_at: b.excel?.created_at || b.json?.created_at,
      can_restore: !!b.json, // Can only restore if JSON exists
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

  // Extract timestamp to delete both Excel and JSON
  const match = filePath.match(/settings_backup_(.+)\.(xlsx|json)$/);
  if (!match) {
    return new Response(
      JSON.stringify({ success: false, error: "無效的檔案名稱" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  const timestamp = match[1];
  const filesToDelete = [
    `settings_backup_${timestamp}.xlsx`,
    `settings_backup_${timestamp}.json`,
  ];

  const { error } = await supabase.storage
    .from("settings-backups")
    .remove(filesToDelete);

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

async function handlePreviewBackup(
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

  // Download JSON file
  const { data, error } = await supabase.storage
    .from("settings-backups")
    .download(filePath);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: `下載失敗: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const text = await data.text();
  const backup = JSON.parse(text);

  return new Response(
    JSON.stringify({
      success: true,
      backup_info: backup.backup_info,
      tables: Object.keys(backup.data).map(table => ({
        name: table,
        count: backup.data[table]?.length || 0,
      })),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRestoreBackup(
  supabase: any,
  user: any,
  filePath: string,
  selectedTables: string[] | undefined,
  corsHeaders: Record<string, string>
) {
  if (!filePath) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少備份檔案路徑" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("[Restore] Starting restore from:", filePath);

  // Download JSON backup
  const { data, error: downloadError } = await supabase.storage
    .from("settings-backups")
    .download(filePath);

  if (downloadError) {
    return new Response(
      JSON.stringify({ success: false, error: `下載備份失敗: ${downloadError.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const text = await data.text();
  const backup = JSON.parse(text);
  
  if (!backup.data) {
    return new Response(
      JSON.stringify({ success: false, error: "備份檔案格式無效" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const tablesToRestore = selectedTables && selectedTables.length > 0 
    ? selectedTables 
    : Object.keys(backup.data);

  const results: Record<string, { success: boolean; count: number; error?: string }> = {};

  for (const table of tablesToRestore) {
    const tableData = backup.data[table];
    
    if (!tableData || tableData.length === 0) {
      results[table] = { success: true, count: 0 };
      continue;
    }

    try {
      // Delete existing data first
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (deleteError) {
        console.error(`[Restore] Delete error for ${table}:`, deleteError);
        results[table] = { success: false, count: 0, error: deleteError.message };
        continue;
      }

      // Insert backup data
      const { error: insertError } = await supabase
        .from(table)
        .insert(tableData);

      if (insertError) {
        console.error(`[Restore] Insert error for ${table}:`, insertError);
        results[table] = { success: false, count: 0, error: insertError.message };
      } else {
        results[table] = { success: true, count: tableData.length };
        console.log(`[Restore] Restored ${tableData.length} rows to ${table}`);
      }
    } catch (err) {
      console.error(`[Restore] Exception for ${table}:`, err);
      results[table] = { success: false, count: 0, error: (err as Error).message };
    }
  }

  // Log the restore action
  try {
    await supabase.from("audit_logs").insert({
      table_name: "system",
      record_id: crypto.randomUUID(),
      action: "RESTORE",
      actor_user_id: user.id,
      reason: `從備份還原系統設定: ${filePath}`,
      new_data: {
        backup_file: filePath,
        tables_restored: tablesToRestore,
        results,
      },
    });
  } catch (e) {
    console.error("[Restore] Audit log error:", e);
  }

  const successCount = Object.values(results).filter(r => r.success).length;
  const failCount = Object.values(results).filter(r => !r.success).length;

  return new Response(
    JSON.stringify({
      success: failCount === 0,
      message: failCount === 0 
        ? `還原成功！已還原 ${successCount} 個資料表` 
        : `部分還原成功：${successCount} 成功，${failCount} 失敗`,
      results,
    }),
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

    // Group by timestamp
    const timestamps = new Set<string>();
    for (const file of files) {
      const match = file.name.match(/settings_backup_(.+)\.(xlsx|json)$/);
      if (match) timestamps.add(match[1]);
    }

    const sortedTimestamps = Array.from(timestamps).sort().reverse();
    
    // Delete backups beyond MAX_BACKUPS
    if (sortedTimestamps.length > MAX_BACKUPS) {
      const toDeleteTimestamps = sortedTimestamps.slice(MAX_BACKUPS);
      const filesToDelete: string[] = [];
      
      for (const ts of toDeleteTimestamps) {
        filesToDelete.push(`settings_backup_${ts}.xlsx`);
        filesToDelete.push(`settings_backup_${ts}.json`);
      }
      
      console.log("[Backup] Cleaning up old backups:", filesToDelete);
      await supabase.storage.from("settings-backups").remove(filesToDelete);
    }
  } catch (err) {
    console.error("[Backup] Cleanup error:", err);
  }
}
