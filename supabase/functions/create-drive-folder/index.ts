import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sub-folder template
const SUBFOLDER_TEMPLATE = [
  '01_合約與往來文件',
  '02_圖說與簽證',
  '03_送審與函文',
  '04_施工與照片',
  '05_竣工與掛表',
  '06_維運保養',
  '99_其他',
];

// Sanitize folder name - remove illegal characters for Google Drive
function sanitizeFolderName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim();
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

interface DriveToken {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  google_email: string | null;
}

// Fetch user's Google email using userinfo API
async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const data = await response.json();
      return data.email || null;
    }
  } catch (err) {
    console.error('Failed to fetch Google email:', err);
  }
  return null;
}

// Get valid access token for user
async function getValidAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<{ accessToken: string; googleEmail: string | null }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Fetch user's tokens
  const { data, error: tokenError } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (tokenError || !data) {
    throw new Error('NEED_AUTH'); // Special error to indicate user needs to authorize
  }

  const tokenData = data as unknown as DriveToken;

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  let accessToken = tokenData.access_token;

  if (expiresAt.getTime() - now.getTime() <= bufferMs) {
    // Token expired, refresh it
    console.log('Token expired, refreshing...');
    const { accessToken: newToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
    accessToken = newToken;
    
    // Update token in database
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);
    await supabase
      .from('user_drive_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('user_id', userId);
  }

  // Fetch email if not stored
  let googleEmail = tokenData.google_email;
  if (!googleEmail) {
    googleEmail = await fetchGoogleEmail(accessToken);
    if (googleEmail) {
      await supabase
        .from('user_drive_tokens')
        .update({ google_email: googleEmail })
        .eq('user_id', userId);
    }
  }

  return { accessToken, googleEmail };
}

// Create a folder in Google Drive with full Shared Drive support
async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  // Full Shared Drive support parameters
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
  return result;
}

// Verify access to root folder
async function verifyRootFolderAccess(accessToken: string, folderId: string): Promise<{ success: boolean; error?: string; folderName?: string }> {
  const params = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,capabilities',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?${params.toString()}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Root folder access failed:', errorText);
    return { success: false, error: errorText };
  }

  const data = await response.json();
  return { success: true, folderName: data.name };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract userId from JWT token instead of request body
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

    // Verify the JWT and get the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: '未授權：無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Authorization check: Only admin and staff can create drive folders
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

    // Get projectId from request body (safe - we've verified the user)
    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: '缺少 projectId 參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if (!rootFolderId) {
      console.error('Missing GOOGLE_DRIVE_ROOT_FOLDER_ID');
      return new Response(
        JSON.stringify({ error: '未設定 Google Drive 根資料夾 ID' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating Drive folder for project:', projectId, 'by user:', userId);

    // Fetch project info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_code, project_name, drive_folder_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project fetch error:', projectError);
      return new Response(
        JSON.stringify({ error: '找不到案場資料' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If folder already exists, return it
    if (project.drive_folder_id) {
      console.log('Folder already exists:', project.drive_folder_id);
      return new Response(
        JSON.stringify({ 
          message: '資料夾已存在',
          folderId: project.drive_folder_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token for user
    let accessToken: string;
    let googleEmail: string | null;
    try {
      const tokenResult = await getValidAccessToken(supabaseUrl, supabaseServiceKey, userId);
      accessToken = tokenResult.accessToken;
      googleEmail = tokenResult.googleEmail;
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

    console.log('Using Google account:', googleEmail);

    // Verify root folder access first
    const rootAccess = await verifyRootFolderAccess(accessToken, rootFolderId);
    if (!rootAccess.success) {
      const errorMsg = `無法存取根資料夾。請確認授權帳號 (${googleEmail || 'Unknown'}) 對 Shared Drive 具有 Content Manager 或以上權限。錯誤: ${rootAccess.error}`;
      console.error(errorMsg);
      
      // Update project with error
      await supabase
        .from('projects')
        .update({
          folder_status: 'failed',
          folder_error: errorMsg,
        })
        .eq('id', projectId);

      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          googleEmail,
          rootFolderId,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create main project folder
    const folderName = sanitizeFolderName(`${project.project_code}_${project.project_name}`);
    console.log('Creating main folder:', folderName);
    
    const mainFolder = await createFolder(accessToken, folderName, rootFolderId);
    console.log('Main folder created:', mainFolder.id);

    // Create subfolders
    for (const subfolderName of SUBFOLDER_TEMPLATE) {
      await createFolder(accessToken, subfolderName, mainFolder.id);
    }

    // Update project with folder info
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        drive_folder_id: mainFolder.id,
        drive_folder_url: mainFolder.webViewLink,
        folder_status: 'created',
        folder_error: null,
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project:', updateError);
      throw new Error('資料夾建立成功，但更新資料庫失敗');
    }

    console.log('Project folder created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        folderId: mainFolder.id,
        folderUrl: mainFolder.webViewLink,
        googleEmail,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error creating folder:', error);
    
    const errorMessage = error?.message || '未知錯誤';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
