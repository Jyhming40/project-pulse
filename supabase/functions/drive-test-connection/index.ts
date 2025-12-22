import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

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
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function getValidAccessToken(supabase: any, userId: string): Promise<{ accessToken: string; googleEmail: string | null; refreshToken: string }> {
  const { data: tokenData, error } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    console.error('Token fetch error:', error);
    throw new Error('未找到 Drive 授權，請先連結 Google Drive');
  }

  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();

  let accessToken = tokenData.access_token;

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...');
    const refreshed = await refreshAccessToken(tokenData.refresh_token);
    accessToken = refreshed.accessToken;
    
    // Update token in database
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
    await supabase
      .from('user_drive_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  return { accessToken, googleEmail: tokenData.google_email, refreshToken: tokenData.refresh_token };
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract userId from JWT token instead of request body
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權：缺少認證標頭' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: '未授權：無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    console.log('Testing Drive connection for user:', userId);

    // Get valid access token and email
    const { accessToken, googleEmail, refreshToken } = await getValidAccessToken(supabase, userId);

    // Fetch actual email from Google if not stored
    let actualEmail = googleEmail;
    if (!actualEmail) {
      actualEmail = await fetchGoogleEmail(accessToken);
      
      // Update email in database
      if (actualEmail) {
        await supabase
          .from('user_drive_tokens')
          .update({ google_email: actualEmail })
          .eq('user_id', userId);
      }
    }

    console.log('Authorized email:', actualEmail);

    // Test 1: List files in root (general access test)
    const listParams = {
      pageSize: '5',
      fields: 'files(id,name,mimeType)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    };
    const listUrl = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams(listParams).toString()}`;
    
    const listResponse = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const listResponseText = await listResponse.text();
    let listData: any = null;

    if (!listResponse.ok) {
      console.error('files.list failed:', listResponseText);
      
      await supabase
        .from('user_drive_tokens')
        .update({ google_error: listResponseText })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Drive API 錯誤 (files.list)`,
          errorStatus: listResponse.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      listData = JSON.parse(listResponseText);
    } catch {}

    // Test 2: Access root folder specifically (if configured)
    let rootFolderAccess = false;
    let rootFolderError = null;
    let rootFolderData: any = null;
    let sharedDriveId: string | null = null;
    
    if (rootFolderId) {
      const getParams = {
        supportsAllDrives: 'true',
        fields: 'id,name,mimeType,capabilities,driveId,parents',
      };
      const getUrl = `https://www.googleapis.com/drive/v3/files/${rootFolderId}?${new URLSearchParams(getParams).toString()}`;
      
      const getResponse = await fetch(getUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const getResponseText = await getResponse.text();

      if (getResponse.ok) {
        rootFolderData = JSON.parse(getResponseText);
        rootFolderAccess = true;
        
        if (rootFolderData.driveId) {
          sharedDriveId = rootFolderData.driveId;
        }
      } else {
        console.error('Root folder access failed:', getResponseText);
        rootFolderError = getResponseText;
      }
    }

    // Clear any previous error on success
    await supabase
      .from('user_drive_tokens')
      .update({ google_error: rootFolderError || null })
      .eq('user_id', userId);

    const result = {
      success: true,
      message: rootFolderAccess ? '連線成功！已驗證 Root Folder 存取權限' : 
               (rootFolderId ? '連線成功，但無法存取 Root Folder' : '連線成功（一般 Drive 存取）'),
      googleEmail: actualEmail,
      rootFolderId: rootFolderId || null,
      rootFolderName: rootFolderData?.name || null,
      sharedDriveId,
      rootFolderAccess,
      files: listData?.files || [],
      fileCount: listData?.files?.length || 0,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
