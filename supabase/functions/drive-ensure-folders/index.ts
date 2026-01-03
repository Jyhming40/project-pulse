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
  { code: 'ENERGY_BUREAU', folder: '03-能源局' },
  { code: 'BUILDING_AUTH', folder: '04-建管單位' },
  { code: 'COMPLETION_MANUAL', folder: '05-完工手冊' },
  { code: 'SITE_PHOTO', folder: '06-現勘照片' },
  { code: 'CONSTRUCTION_PHOTO', folder: '07-施工照片' },
  { code: 'GREEN_PERMISSION', folder: '08-綠能容許' },
  { code: 'OFFICIAL_DOC', folder: '09-公文回函' },
  { code: 'HANDOVER', folder: '10-業務轉工程' },
];

// Sanitize folder name - remove illegal characters for Google Drive
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('未設定 Google OAuth 憑證');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token refresh failed:', errorText);
    throw new Error('Token 刷新失敗，請重新授權 Google Drive');
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

interface SubfolderConfig {
  code: string;
  folder: string;
}

// Get valid access token for user
async function getValidAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error: tokenError } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (tokenError || !data) {
    throw new Error('NEED_AUTH');
  }

  const tokenData = data as { access_token: string; refresh_token: string; token_expires_at: string };

  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  let accessToken = tokenData.access_token;

  if (expiresAt.getTime() - now.getTime() <= bufferMs) {
    console.log('Token expired, refreshing...');
    const { accessToken: newToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
    accessToken = newToken;
    
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);
    await supabase
      .from('user_drive_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  return accessToken;
}

// Get Drive settings from system_options
async function getDriveSettings(supabaseUrl: string, supabaseServiceKey: string): Promise<{
  subfolders: SubfolderConfig[];
}> {
  try {
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

      let subfolders = DEFAULT_SUBFOLDER_TEMPLATE;
      if (settingsMap['subfolders']) {
        try {
          subfolders = JSON.parse(settingsMap['subfolders']);
        } catch {
          console.log('Failed to parse subfolders, using defaults');
        }
      }

      return { subfolders };
    }
  } catch (err) {
    console.log('Failed to fetch drive settings, using defaults:', err);
  }
  
  return { subfolders: DEFAULT_SUBFOLDER_TEMPLATE };
}

// Search for folder by name in parent
async function findFolderByName(
  accessToken: string, 
  name: string, 
  parentId: string
): Promise<{ id: string; webViewLink: string } | null> {
  const query = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,webViewLink)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error('Search folder failed:', await response.text());
    return null;
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, webViewLink: data.files[0].webViewLink };
  }
  return null;
}

// Get folder info including parents
async function getFolderInfo(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string; parents: string[]; webViewLink: string } | null> {
  const params = new URLSearchParams({
    fields: 'id,name,parents,webViewLink',
    supportsAllDrives: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error('Get folder info failed:', await response.text());
    return null;
  }

  return response.json();
}

// Move folder to new parent
async function moveFolder(
  accessToken: string,
  folderId: string,
  newParentId: string,
  oldParentId: string
): Promise<{ id: string; webViewLink: string }> {
  const params = new URLSearchParams({
    addParents: newParentId,
    removeParents: oldParentId,
    fields: 'id,webViewLink',
    supportsAllDrives: 'true',
  });

  console.log(`Moving folder ${folderId} from ${oldParentId} to ${newParentId}`);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Move folder failed:', errorText);
    throw new Error(`移動資料夾失敗: ${errorText}`);
  }

  const result = await response.json();
  console.log('Folder moved successfully');
  return { id: result.id, webViewLink: result.webViewLink };
}

// Create a folder in Google Drive (idempotent - checks if exists first)
async function ensureFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<{ id: string; webViewLink: string; created: boolean }> {
  // First check if folder already exists
  const existing = await findFolderByName(accessToken, name, parentId);
  if (existing) {
    console.log(`Folder already exists: ${name} (${existing.id})`);
    return { ...existing, created: false };
  }

  // Create new folder
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };

  const params = new URLSearchParams({
    fields: 'id,webViewLink',
    supportsAllDrives: 'true',
  });

  console.log('Creating folder:', name);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Create folder failed:', errorText);
    throw new Error(`建立資料夾失敗: ${errorText}`);
  }

  const result = await response.json();
  console.log('Folder created:', result.id);
  return { id: result.id, webViewLink: result.webViewLink, created: true };
}

// Ensure project folder is in correct parent (investor folder), move if necessary
async function ensureProjectFolderInCorrectParent(
  accessToken: string,
  existingFolderId: string,
  expectedParentId: string
): Promise<{ id: string; webViewLink: string; moved: boolean }> {
  const folderInfo = await getFolderInfo(accessToken, existingFolderId);
  
  if (!folderInfo) {
    throw new Error('無法取得現有資料夾資訊');
  }

  const currentParents = folderInfo.parents || [];
  
  // Check if folder is already in correct parent
  if (currentParents.includes(expectedParentId)) {
    console.log('Folder already in correct parent');
    return { id: folderInfo.id, webViewLink: folderInfo.webViewLink, moved: false };
  }

  // Move folder to correct parent
  if (currentParents.length > 0) {
    const result = await moveFolder(accessToken, existingFolderId, expectedParentId, currentParents[0]);
    return { ...result, moved: true };
  }

  // No parent found, add new parent
  const params = new URLSearchParams({
    addParents: expectedParentId,
    fields: 'id,webViewLink',
    supportsAllDrives: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existingFolderId}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('無法設定資料夾父層');
  }

  const result = await response.json();
  return { id: result.id, webViewLink: result.webViewLink, moved: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權：缺少認證標頭' }),
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
        JSON.stringify({ error: '未授權：無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Check role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!userRole || !['admin', 'staff'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: '權限不足：只有管理員和員工可以建立資料夾' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: '缺少 projectId 參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get root folder ID from system_options (REQUIRED - no fallback)
    console.log('Fetching root folder ID from system_options...');
    
    const { data: rootSetting, error: rootError } = await supabase
      .from('system_options')
      .select('label')
      .eq('category', 'drive_settings')
      .eq('value', 'root_folder_id')
      .eq('is_active', true)
      .single();
    
    console.log('Root setting query result:', { rootSetting, rootError });
    
    const rootFolderId = rootSetting?.label;
    
    if (!rootFolderId) {
      console.error('Root folder ID not configured in system_options');
      return new Response(
        JSON.stringify({ 
          error: '未設定 Google Drive 根資料夾 (MQ-Documents)。請先到「整合設定」→「Drive 資料夾設定」中設定根資料夾 ID。',
          code: 'ROOT_FOLDER_NOT_CONFIGURED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Using root folder ID:', rootFolderId);

    // Get project with investor info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_code, project_name, drive_folder_id, investor_drive_folder_id, investor_id, investors(id, company_name)')
      .eq('id', projectId)
      .single() as { data: { 
        id: string; 
        project_code: string; 
        project_name: string; 
        drive_folder_id: string | null;
        investor_drive_folder_id: string | null;
        investor_id: string | null;
        investors: { id: string; company_name: string } | null;
      } | null; error: unknown };

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: '找不到案場資料' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const investor = project.investors;
    if (!investor?.company_name) {
      return new Response(
        JSON.stringify({ error: '案場尚未關聯投資方，請先設定投資方' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseUrl, supabaseServiceKey, userId);
    } catch (err) {
      const error = err as Error;
      if (error.message === 'NEED_AUTH') {
        return new Response(
          JSON.stringify({ error: 'NEED_AUTH', message: '請先授權 Google Drive' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

    console.log('Ensuring folder structure for project:', project.project_code);

    // Step 1: Ensure Investor folder under Root
    const investorFolderName = sanitizeFolderName(investor.company_name);
    const investorFolder = await ensureFolder(accessToken, investorFolderName, rootFolderId);
    console.log('Investor folder:', investorFolder.id);

    // Step 2: Handle Project folder - check if existing folder needs to be moved
    const projectFolderName = sanitizeFolderName(`${project.project_code} ${project.project_name}`);
    let projectFolder: { id: string; webViewLink: string };
    let folderMoved = false;

    if (project.drive_folder_id) {
      // Existing folder - check if it's in the correct parent (investor folder)
      console.log('Existing project folder found, checking parent...');
      try {
        const result = await ensureProjectFolderInCorrectParent(
          accessToken,
          project.drive_folder_id,
          investorFolder.id
        );
        projectFolder = { id: result.id, webViewLink: result.webViewLink };
        folderMoved = result.moved;
        if (folderMoved) {
          console.log('Project folder moved to correct investor parent');
        }
      } catch (moveErr) {
        console.error('Failed to move existing folder, creating new one:', moveErr);
        // If move fails, create new folder under investor
        const newFolder = await ensureFolder(accessToken, projectFolderName, investorFolder.id);
        projectFolder = { id: newFolder.id, webViewLink: newFolder.webViewLink };
      }
    } else {
      // No existing folder - create new one under investor folder
      const newFolder = await ensureFolder(accessToken, projectFolderName, investorFolder.id);
      projectFolder = { id: newFolder.id, webViewLink: newFolder.webViewLink };
    }
    console.log('Project folder:', projectFolder.id);

    // Step 3: Get subfolder config and ensure all subfolders exist
    const driveSettings = await getDriveSettings(supabaseUrl, supabaseServiceKey);
    const childFolders: Record<string, { id: string; webViewLink: string }> = {};

    for (const subfolder of driveSettings.subfolders) {
      const result = await ensureFolder(accessToken, subfolder.folder, projectFolder.id);
      childFolders[subfolder.code] = { id: result.id, webViewLink: result.webViewLink };
    }

    // Step 4: Update project record
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        drive_folder_id: projectFolder.id,
        drive_folder_url: projectFolder.webViewLink,
        investor_drive_folder_id: investorFolder.id,
        folder_status: 'created',
        folder_error: null,
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project:', updateError);
      throw new Error('資料夾建立成功，但更新資料庫失敗');
    }

    // Step 5: Log audit action
    await supabase.from('audit_logs').insert({
      action: 'CREATE' as const,
      record_id: projectId,
      table_name: 'projects',
      actor_user_id: userId,
      new_data: {
        action_type: 'FOLDER_ENSURE',
        investor_folder_id: investorFolder.id,
        investor_folder_name: investorFolderName,
        project_folder_id: projectFolder.id,
        project_folder_name: projectFolderName,
        folder_moved: folderMoved,
        child_folders: childFolders,
      },
    });

    console.log('Folder structure ensured successfully');

    return new Response(
      JSON.stringify({
        success: true,
        investorFolder: {
          id: investorFolder.id,
          url: investorFolder.webViewLink,
          name: investorFolderName,
        },
        projectFolder: {
          id: projectFolder.id,
          url: projectFolder.webViewLink,
          name: projectFolderName,
        },
        childFolders,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error ensuring folders:', error);
    
    return new Response(
      JSON.stringify({ error: error?.message || '未知錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
