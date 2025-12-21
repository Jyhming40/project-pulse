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
}

// Get valid access token for user
async function getValidAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<string> {
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

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token still valid
    return tokenData.access_token;
  }

  // Token expired, refresh it
  console.log('Token expired, refreshing...');
  const { accessToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
  
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

  return accessToken;
}

// Create a folder in Google Drive
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

  // Add supportsAllDrives for Shared Drive compatibility
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,webViewLink&supportsAllDrives=true',
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

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, userId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: '缺少 projectId 參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: '缺少 userId 參數' }),
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

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Create main project folder
    const folderName = sanitizeFolderName(`${project.project_code}_${project.project_name}`);
    console.log('Creating main folder:', folderName);
    
    const mainFolder = await createFolder(accessToken, folderName, rootFolderId);
    console.log('Main folder created:', mainFolder.id);

    // Create subfolders
    for (const subfolderName of SUBFOLDER_TEMPLATE) {
      console.log('Creating subfolder:', subfolderName);
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
