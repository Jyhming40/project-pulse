import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default sub-folder template
const DEFAULT_SUBFOLDER_TEMPLATE = [
  { code: 'RELATED', folder: '00-相關資料' },
  { code: 'SYSTEM_DIAGRAM', folder: '01-系統圖' },
  { code: 'TPC', folder: '02-台電' },
  { code: 'ENERGY_BUREAU', folder: '03-能源署' },
  { code: 'BUILDING_AUTH', folder: '04-建管單位' },
  { code: 'COMPLETION_MANUAL', folder: '05-完工手冊' },
  { code: 'SITE_PHOTO', folder: '06-現勘照片' },
  { code: 'CONSTRUCTION_PHOTO', folder: '07-施工照片' },
  { code: 'GREEN_PERMISSION', folder: '08-綠能容許' },
  { code: 'OFFICIAL_DOC', folder: '09-公文回函' },
  { code: 'HANDOVER', folder: '10-業務轉工程' },
];

// Doc type to subfolder mapping
const DOC_TYPE_TO_SUBFOLDER: Record<string, string> = {
  '台電審查意見書': 'TPC',
  '台電報竣掛表': 'TPC',
  '台電躉售合約': 'TPC',
  '台電正式躉售': 'TPC',
  '台電派員訪查併聯函': 'TPC',
  '能源署同意備案': 'ENERGY_BUREAU',
  '能源局同意備案': 'ENERGY_BUREAU',
  '能源署設備登記': 'ENERGY_BUREAU',
  '結構技師簽證': 'RELATED',
  '結構簽證': 'RELATED',
  '電機技師簽證': 'RELATED',
  '承裝業簽證': 'RELATED',
  '躉售合約': 'TPC',
  '報竣掛表': 'TPC',
  '設備登記': 'ENERGY_BUREAU',
  '免雜執照同意備案': 'BUILDING_AUTH',
  '免雜執照完竣': 'BUILDING_AUTH',
  '附屬綠能設施同意函': 'GREEN_PERMISSION',
  '最終掛表期限': 'TPC',
  '其他': 'RELATED',
};

// Document type code to milestone code mapping
const DOC_TYPE_CODE_TO_MILESTONE: Record<string, string> = {
  // 台電相關
  'TPC_REVIEW': 'ADMIN_03_TAIPOWER_OPINION',      // 審查意見書 -> 取得台電審查意見書
  'TPC_NEGOTIATION': 'ADMIN_06_TAIPOWER_DETAIL',  // 細部協商 -> 台電細部協商完成
  'TPC_CONTRACT': 'ADMIN_07_PPA_SIGNED',          // 躉售合約 -> 躉售合約完成
  'TPC_METER': 'ADMIN_08_METER_INSTALLED',        // 報竣掛表 -> 報竣掛表完成
  // 能源署相關
  'MOEA_CONSENT': 'ADMIN_04_ENERGY_APPROVAL',     // 同意備案 -> 能源署同意備案
  'MOEA_REGISTER': 'ADMIN_09_EQUIPMENT_REG',      // 設備登記 -> 能源署設備登記完成
  // 建管相關
  'BUILD_EXEMPT_COMP': 'ADMIN_05_MISC_EXEMPT',    // 免雜項竣工 -> 免雜項執照完成/回函
};

// Also map by doc_type label for legacy support
const DOC_TYPE_LABEL_TO_MILESTONE: Record<string, string> = {
  '審查意見書': 'ADMIN_03_TAIPOWER_OPINION',
  '台電審查意見書': 'ADMIN_03_TAIPOWER_OPINION',
  '細部協商': 'ADMIN_06_TAIPOWER_DETAIL',
  '台電細部協商': 'ADMIN_06_TAIPOWER_DETAIL',
  '躉售合約': 'ADMIN_07_PPA_SIGNED',
  '台電躉售合約': 'ADMIN_07_PPA_SIGNED',
  '報竣掛表': 'ADMIN_08_METER_INSTALLED',
  '台電報竣掛表': 'ADMIN_08_METER_INSTALLED',
  '同意備案': 'ADMIN_04_ENERGY_APPROVAL',
  '能源署同意備案': 'ADMIN_04_ENERGY_APPROVAL',
  '能源局同意備案': 'ADMIN_04_ENERGY_APPROVAL',
  '設備登記': 'ADMIN_09_EQUIPMENT_REG',
  '能源署設備登記': 'ADMIN_09_EQUIPMENT_REG',
  '免雜項竣工': 'ADMIN_05_MISC_EXEMPT',
  '免雜執照完竣': 'ADMIN_05_MISC_EXEMPT',
};

// Refresh access token
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Token 刷新失敗');
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// Get valid access token
async function getValidAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('NEED_AUTH');
  }

  const tokenData = data as { access_token: string; refresh_token: string; token_expires_at: string };
  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();

  let accessToken = tokenData.access_token;

  if (expiresAt.getTime() - now.getTime() <= 5 * 60 * 1000) {
    const { accessToken: newToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
    accessToken = newToken;
    
    await supabase
      .from('user_drive_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
      .eq('user_id', userId);
  }

  return accessToken;
}

// Get drive settings
async function getDriveSettings(supabaseUrl: string, supabaseServiceKey: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: settings } = await supabase
    .from('system_options')
    .select('value, label')
    .eq('category', 'drive_settings')
    .eq('is_active', true);

  if (settings && settings.length > 0) {
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.value] = s.label;
    }

    if (settingsMap['subfolders']) {
      try {
        return { subfolders: JSON.parse(settingsMap['subfolders']) };
      } catch {
        // Fall through to default
      }
    }
  }
  
  return { subfolders: DEFAULT_SUBFOLDER_TEMPLATE };
}

// Find folder by name
async function findFolderByName(
  accessToken: string, 
  name: string, 
  parentId: string
): Promise<{ id: string; webViewLink: string } | null> {
  const query = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,webViewLink)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.files?.[0] || null;
}

// Upload file to Drive using multipart upload
async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  fileContent: Uint8Array,
  mimeType: string,
  parentFolderId: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  // Build multipart body
  const metadataString = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  
  const parts = [
    encoder.encode(delimiter),
    encoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
    encoder.encode(metadataString),
    encoder.encode(delimiter),
    encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`),
    fileContent,
    encoder.encode(closeDelimiter),
  ];

  // Combine all parts
  let totalLength = 0;
  for (const part of parts) {
    totalLength += part.length;
  }
  
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,webViewLink',
    supportsAllDrives: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Upload failed:', errorText);
    throw new Error(`上傳失敗: ${response.status}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'staff'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: '權限不足' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const projectId = formData.get('projectId') as string;
    const documentType = formData.get('documentType') as string;
    const title = formData.get('title') as string;
    const file = formData.get('file') as File;
    // Optional: allow manual subfolder override from batch upload
    const manualSubfolderCode = formData.get('subfolderCode') as string | null;

    if (!projectId || !documentType || !title || !file) {
      return new Response(
        JSON.stringify({ error: '缺少必要參數：projectId, documentType, title, file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_code, project_name, drive_folder_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: '找不到案場資料' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project.drive_folder_id) {
      return new Response(
        JSON.stringify({ error: '案場尚未建立 Drive 資料夾，請先建立資料夾結構' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseUrl, supabaseServiceKey, user.id);
    } catch (err) {
      const error = err as Error;
      if (error.message === 'NEED_AUTH') {
        return new Response(
          JSON.stringify({ error: 'NEED_AUTH' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

    // Find the correct subfolder
    // Use manual override if provided, otherwise use doc type mapping
    const driveSettings = await getDriveSettings(supabaseUrl, supabaseServiceKey);
    const subfolderCode = manualSubfolderCode || DOC_TYPE_TO_SUBFOLDER[documentType] || 'OFFICIAL_DOC';
    const subfolderConfig = driveSettings.subfolders.find((sf: { code: string; folder: string }) => sf.code === subfolderCode);
    
    if (!subfolderConfig) {
      return new Response(
        JSON.stringify({ error: '找不到對應的子資料夾設定' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the subfolder in Drive
    const subfolder = await findFolderByName(accessToken, subfolderConfig.folder, project.drive_folder_id);
    
    if (!subfolder) {
      return new Response(
        JSON.stringify({ error: `找不到子資料夾: ${subfolderConfig.folder}，請先建立資料夾結構` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileContent = new Uint8Array(fileBuffer);

    // Get file extension from original filename
    const fileExt = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    // Use encoded title as the filename in Drive
    const driveFileName = title.endsWith(fileExt) ? title : title + fileExt;

    // Upload to Drive with encoded title as filename
    console.log(`Uploading ${driveFileName} (original: ${file.name}) to folder ${subfolder.id}`);
    const uploadResult = await uploadFileToDrive(
      accessToken,
      driveFileName,
      fileContent,
      file.type || 'application/octet-stream',
      subfolder.id
    );

    // Build the path
    const drivePath = `${project.project_code}/${subfolderConfig.folder}/${driveFileName}`;

    // Create or version the document record
    // First, get the maximum version for this project_id + doc_type combination
    const { data: allDocs } = await supabase
      .from('documents')
      .select('id, version, is_current')
      .eq('project_id', projectId)
      .eq('doc_type', documentType)
      .eq('is_deleted', false)
      .order('version', { ascending: false });

    // Calculate new version from MAX existing version
    let newVersion = 1;
    if (allDocs && allDocs.length > 0) {
      const maxVersion = Math.max(...allDocs.map(d => d.version || 0));
      newVersion = maxVersion + 1;
      
      // Mark ALL current documents with this project_id + doc_type as not current
      // to satisfy the unique constraint documents_one_current_per_key
      const currentDocs = allDocs.filter(d => d.is_current);
      if (currentDocs.length > 0) {
        await supabase
          .from('documents')
          .update({ is_current: false })
          .eq('project_id', projectId)
          .eq('doc_type', documentType)
          .eq('is_current', true);
      }
    }

    // Insert new document record
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        doc_type: documentType,
        doc_status: 'draft',
        title: title,
        version: newVersion,
        is_current: true,
        drive_file_id: uploadResult.id,
        drive_web_view_link: uploadResult.webViewLink,
        drive_path: drivePath,
        drive_parent_folder_id: subfolder.id,
        created_by: user.id,
        owner_user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert document:', insertError);
      throw new Error('文件上傳成功，但記錄建立失敗');
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'CREATE' as const,
      record_id: newDoc.id,
      table_name: 'documents',
      actor_user_id: user.id,
      new_data: {
        action_type: newVersion > 1 ? 'DOCUMENT_VERSION' : 'DOCUMENT_UPLOAD',
        version: newVersion,
        drive_file_id: uploadResult.id,
        title: title,
        document_type: documentType,
      },
    });

    // Auto-sync milestone completion based on document type
    // First try to get doc_type_code from document_type_config
    let milestoneCode: string | null = null;
    
    const { data: docTypeConfig } = await supabase
      .from('document_type_config')
      .select('code')
      .eq('label', documentType)
      .eq('is_active', true)
      .maybeSingle();
    
    if (docTypeConfig?.code && DOC_TYPE_CODE_TO_MILESTONE[docTypeConfig.code]) {
      milestoneCode = DOC_TYPE_CODE_TO_MILESTONE[docTypeConfig.code];
    } else if (DOC_TYPE_LABEL_TO_MILESTONE[documentType]) {
      // Fallback to label-based mapping
      milestoneCode = DOC_TYPE_LABEL_TO_MILESTONE[documentType];
    }

    if (milestoneCode) {
      console.log(`Auto-completing milestone: ${milestoneCode} for project ${projectId}`);
      
      // Check if milestone already exists
      const { data: existingMilestone } = await supabase
        .from('project_milestones')
        .select('id, is_completed')
        .eq('project_id', projectId)
        .eq('milestone_code', milestoneCode)
        .maybeSingle();

      if (existingMilestone) {
        // Update if not already completed
        if (!existingMilestone.is_completed) {
          await supabase
            .from('project_milestones')
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              completed_by: user.id,
              note: `透過文件上傳自動完成 (${title})`,
            })
            .eq('id', existingMilestone.id);
        }
      } else {
        // Insert new milestone record
        await supabase
          .from('project_milestones')
          .insert({
            project_id: projectId,
            milestone_code: milestoneCode,
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user.id,
            note: `透過文件上傳自動完成 (${title})`,
          });
      }

      // Trigger progress recalculation
      try {
        const progressResponse = await fetch(
          `${supabaseUrl}/functions/v1/recalculate-project-progress`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ project_id: projectId }),
          }
        );
        
        if (progressResponse.ok) {
          const progressResult = await progressResponse.json();
          console.log('Progress recalculated:', progressResult);
        }
      } catch (progressErr) {
        console.error('Failed to recalculate progress:', progressErr);
        // Don't fail the upload just because progress recalculation failed
      }
    }

    // Auto-extract approval_date from "同意備案" document title
    // Title format example: 2024YF003-2024_MOEA_同意備案_20241210_v01_FINAL
    if (documentType === '同意備案' || documentType === '能源署同意備案' || documentType === '能源局同意備案') {
      // Try to extract date from title (format: YYYYMMDD)
      const dateMatch = title.match(/_(\d{8})_/);
      if (dateMatch) {
        const dateStr = dateMatch[1]; // e.g., "20241210"
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const approvalDate = `${year}-${month}-${day}`; // Convert to ISO format
        
        console.log(`Auto-setting approval_date: ${approvalDate} for project ${projectId}`);
        
        // Only update if approval_date is not already set
        const { data: projectData } = await supabase
          .from('projects')
          .select('approval_date')
          .eq('id', projectId)
          .single();
        
        if (!projectData?.approval_date) {
          await supabase
            .from('projects')
            .update({ approval_date: approvalDate })
            .eq('id', projectId);
          
          console.log(`Approval date set to ${approvalDate}`);
        } else {
          console.log(`Approval date already set: ${projectData.approval_date}, skipping auto-update`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document: newDoc,
        driveFile: {
          id: uploadResult.id,
          webViewLink: uploadResult.webViewLink,
          path: drivePath,
          parentFolderId: subfolder.id,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Upload error:', error);
    
    return new Response(
      JSON.stringify({ error: error?.message || '未知錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
