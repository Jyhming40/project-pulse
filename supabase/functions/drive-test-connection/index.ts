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
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function getValidAccessToken(supabase: any, userId: string): Promise<{ accessToken: string; googleEmail: string | null }> {
  const { data: tokenData, error } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
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

  return { accessToken, googleEmail: tokenData.google_email };
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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: '缺少 userId 參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log environment configuration
    console.log('=== Drive Test Connection ===');
    console.log('Root Folder ID from env:', rootFolderId || '(NOT SET)');

    // Get valid access token and email
    const { accessToken, googleEmail } = await getValidAccessToken(supabase, userId);

    // Fetch actual email from Google if not stored
    let actualEmail = googleEmail;
    if (!actualEmail) {
      actualEmail = await fetchGoogleEmail(accessToken);
      console.log('Fetched Google email from API:', actualEmail);
      
      // Update email in database
      if (actualEmail) {
        await supabase
          .from('user_drive_tokens')
          .update({ google_email: actualEmail })
          .eq('user_id', userId);
      }
    }

    console.log('=== OAuth Info ===');
    console.log('Authorized Google Email:', actualEmail || '(Unknown)');
    console.log('User ID:', userId);

    // Test 1: List files in root (general access test)
    console.log('=== Test 1: List files (general) ===');
    const listParams = {
      pageSize: '5',
      fields: 'files(id,name,mimeType)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    };
    console.log('API Params:', JSON.stringify(listParams));
    
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams(listParams).toString()}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Drive API list error:', errorText);
      
      await supabase
        .from('user_drive_tokens')
        .update({ google_error: errorText })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Drive API 錯誤: ${errorText}`,
          googleEmail: actualEmail,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listData = await listResponse.json();
    console.log('List files result:', listData.files?.length || 0, 'files');

    // Test 2: Access root folder specifically (if configured)
    let rootFolderAccess = false;
    let rootFolderError = null;
    
    if (rootFolderId) {
      console.log('=== Test 2: Access Root Folder ===');
      console.log('Testing access to folder ID:', rootFolderId);
      
      const getParams = {
        supportsAllDrives: 'true',
        fields: 'id,name,mimeType,capabilities',
      };
      console.log('API Params:', JSON.stringify(getParams));
      
      const getResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${rootFolderId}?${new URLSearchParams(getParams).toString()}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (getResponse.ok) {
        const folderData = await getResponse.json();
        console.log('Root folder info:', JSON.stringify(folderData));
        rootFolderAccess = true;
        
        // Test 3: List files in root folder
        console.log('=== Test 3: List files in Root Folder ===');
        const listInFolderParams = {
          q: `'${rootFolderId}' in parents`,
          pageSize: '10',
          fields: 'files(id,name,mimeType)',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        };
        console.log('API Params:', JSON.stringify(listInFolderParams));
        
        const listInFolderResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?${new URLSearchParams(listInFolderParams).toString()}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (listInFolderResponse.ok) {
          const folderFiles = await listInFolderResponse.json();
          console.log('Files in root folder:', folderFiles.files?.length || 0);
        } else {
          const folderListError = await listInFolderResponse.text();
          console.error('List in folder error:', folderListError);
        }
      } else {
        rootFolderError = await getResponse.text();
        console.error('Root folder access error:', rootFolderError);
        console.error('Status:', getResponse.status);
      }
    }

    // Clear any previous error on success
    await supabase
      .from('user_drive_tokens')
      .update({ google_error: null })
      .eq('user_id', userId);

    const result = {
      success: true,
      message: rootFolderAccess ? '連線成功！已驗證 Root Folder 存取權限' : '連線成功（一般 Drive 存取）',
      googleEmail: actualEmail,
      rootFolderId: rootFolderId || null,
      rootFolderAccess,
      rootFolderError,
      files: listData.files || [],
      fileCount: listData.files?.length || 0,
    };

    console.log('=== Test Result ===');
    console.log('Success:', result.success);
    console.log('Root Folder Access:', result.rootFolderAccess);
    if (result.rootFolderError) {
      console.log('Root Folder Error:', result.rootFolderError);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
