import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Search for folders by name
async function searchFoldersByName(
  accessToken: string, 
  name: string
): Promise<Array<{ id: string; name: string; webViewLink: string }>> {
  const query = `name contains '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,webViewLink)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    pageSize: '20',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Search folder failed:', errorText);
    throw new Error('搜尋資料夾失敗');
  }

  const data = await response.json();
  return data.files || [];
}

// Create a folder in Google Drive root
async function createRootFolder(
  accessToken: string,
  name: string
): Promise<{ id: string; name: string; webViewLink: string }> {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const params = new URLSearchParams({
    fields: 'id,name,webViewLink',
    supportsAllDrives: 'true',
  });

  console.log('Creating root folder:', name);

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

  return response.json();
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

    // Check role - only admin can manage root folder
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '權限不足：只有管理員可以設定根資料夾' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, folderName, folderId } = await req.json();

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

    if (action === 'search') {
      // Search for folders by name
      const searchName = folderName || 'MQ-Documents';
      console.log('Searching for folders:', searchName);
      const folders = await searchFoldersByName(accessToken, searchName);
      
      return new Response(
        JSON.stringify({ folders }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    
    if (action === 'create') {
      // Create new root folder
      const newFolderName = folderName || 'MQ-Documents';
      console.log('Creating root folder:', newFolderName);
      const folder = await createRootFolder(accessToken, newFolderName);
      
      return new Response(
        JSON.stringify({ folder }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-current') {
      // Return the currently configured root folder ID
      const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') || null;
      
      return new Response(
        JSON.stringify({ rootFolderId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: '無效的操作' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error:', err);
    const error = err as Error;
    return new Response(
      JSON.stringify({ error: error.message || '發生未知錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
