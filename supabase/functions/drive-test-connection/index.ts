import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  console.log('[DEBUG] Refreshing access token...');
  
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
    console.error('[DEBUG] Token refresh failed:', errorText);
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const data = await response.json();
  console.log('[DEBUG] Token refreshed successfully');
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function getValidAccessToken(supabase: any, userId: string): Promise<{ accessToken: string; googleEmail: string | null; refreshToken: string }> {
  console.log('[DEBUG] Fetching token data for user:', userId);
  
  const { data: tokenData, error } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    console.error('[DEBUG] Token fetch error:', error);
    throw new Error('未找到 Drive 授權，請先連結 Google Drive');
  }

  console.log('[DEBUG] Token data found:');
  console.log('  - google_email:', tokenData.google_email || '(NULL)');
  console.log('  - token_expires_at:', tokenData.token_expires_at);
  console.log('  - has_refresh_token:', !!tokenData.refresh_token);

  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();

  let accessToken = tokenData.access_token;

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('[DEBUG] Token expired or expiring soon, refreshing...');
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
  console.log('[DEBUG] Fetching Google email from userinfo API...');
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const data = await response.json();
      console.log('[DEBUG] Userinfo response:', JSON.stringify(data));
      return data.email || null;
    } else {
      const errorText = await response.text();
      console.error('[DEBUG] Userinfo API error:', response.status, errorText);
    }
  } catch (err) {
    console.error('[DEBUG] Failed to fetch Google email:', err);
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

    // ========== DEBUG INFO ==========
    console.log('');
    console.log('==========================================');
    console.log('=== DRIVE TEST CONNECTION DEBUG START ===');
    console.log('==========================================');
    console.log('[ENV] SUPABASE_URL:', supabaseUrl);
    console.log('[ENV] GOOGLE_DRIVE_ROOT_FOLDER_ID:', rootFolderId || '(NOT SET - will skip root folder test)');
    console.log('[PARAM] userId:', userId);
    console.log('');

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

    console.log('');
    console.log('=== AUTHORIZED ACCOUNT INFO ===');
    console.log('[AUTH] google_email:', actualEmail || '(UNKNOWN - failed to fetch)');
    console.log('[AUTH] user_id:', userId);
    console.log('[AUTH] access_token (first 20 chars):', accessToken?.substring(0, 20) + '...');
    console.log('');

    const debugInfo: any = {
      authorizedEmail: actualEmail,
      rootFolderId: rootFolderId || null,
      apiCalls: [],
    };

    // Test 1: List files in root (general access test)
    console.log('=== TEST 1: files.list (general) ===');
    const listParams = {
      pageSize: '5',
      fields: 'files(id,name,mimeType)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    };
    const listUrl = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams(listParams).toString()}`;
    
    console.log('[API] Endpoint: files.list');
    console.log('[API] Full URL:', listUrl);
    console.log('[API] Parameters:');
    console.log('  - pageSize:', listParams.pageSize);
    console.log('  - fields:', listParams.fields);
    console.log('  - supportsAllDrives:', listParams.supportsAllDrives);
    console.log('  - includeItemsFromAllDrives:', listParams.includeItemsFromAllDrives);
    
    const listResponse = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const listResponseText = await listResponse.text();
    let listData: any = null;
    
    console.log('[API] Response Status:', listResponse.status);
    console.log('[API] Response Body:', listResponseText);

    debugInfo.apiCalls.push({
      endpoint: 'files.list',
      params: listParams,
      status: listResponse.status,
      response: listResponseText,
    });

    if (!listResponse.ok) {
      console.error('[ERROR] files.list failed!');
      
      // Parse error for details
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(listResponseText);
      } catch {}
      
      console.error('[ERROR] Full error JSON:', JSON.stringify(errorJson, null, 2));
      
      await supabase
        .from('user_drive_tokens')
        .update({ google_error: listResponseText })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Drive API 錯誤 (files.list)`,
          errorStatus: listResponse.status,
          errorResponse: errorJson || listResponseText,
          debug: debugInfo,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      listData = JSON.parse(listResponseText);
    } catch {}
    console.log('[API] files.list SUCCESS - found', listData?.files?.length || 0, 'files');
    console.log('');

    // Test 2: Access root folder specifically (if configured)
    let rootFolderAccess = false;
    let rootFolderError = null;
    let rootFolderErrorJson = null;
    let rootFolderData: any = null;
    let sharedDriveId: string | null = null;
    
    if (rootFolderId) {
      console.log('=== TEST 2: files.get (root folder) ===');
      
      const getParams = {
        supportsAllDrives: 'true',
        fields: 'id,name,mimeType,capabilities,driveId,parents',
      };
      const getUrl = `https://www.googleapis.com/drive/v3/files/${rootFolderId}?${new URLSearchParams(getParams).toString()}`;
      
      console.log('[API] Endpoint: files.get');
      console.log('[API] Full URL:', getUrl);
      console.log('[API] Target Folder ID:', rootFolderId);
      console.log('[API] Parameters:');
      console.log('  - supportsAllDrives:', getParams.supportsAllDrives);
      console.log('  - fields:', getParams.fields);
      
      const getResponse = await fetch(getUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const getResponseText = await getResponse.text();
      console.log('[API] Response Status:', getResponse.status);
      console.log('[API] Response Body:', getResponseText);

      debugInfo.apiCalls.push({
        endpoint: 'files.get (root folder)',
        folderId: rootFolderId,
        params: getParams,
        status: getResponse.status,
        response: getResponseText,
      });

      if (getResponse.ok) {
        rootFolderData = JSON.parse(getResponseText);
        console.log('[API] files.get SUCCESS');
        console.log('[API] Folder Name:', rootFolderData.name);
        console.log('[API] Folder driveId (Shared Drive):', rootFolderData.driveId || '(NOT in Shared Drive)');
        console.log('[API] Folder Capabilities:', JSON.stringify(rootFolderData.capabilities));
        rootFolderAccess = true;
        
        // Check if it's in a Shared Drive
        if (rootFolderData.driveId) {
          sharedDriveId = rootFolderData.driveId;
          console.log('[SHARED DRIVE] Detected Shared Drive ID:', sharedDriveId);
        }
        
        // Test 3: List files in root folder (with Shared Drive params if applicable)
        console.log('');
        console.log('=== TEST 3: files.list (in root folder) ===');
        
        let listInFolderParams: Record<string, string>;
        
        if (sharedDriveId) {
          // Use Shared Drive specific params
          listInFolderParams = {
            q: `'${rootFolderId}' in parents`,
            pageSize: '10',
            fields: 'files(id,name,mimeType,driveId)',
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
            corpora: 'drive',
            driveId: sharedDriveId,
          };
          console.log('[API] Using Shared Drive params');
        } else {
          // Regular My Drive params
          listInFolderParams = {
            q: `'${rootFolderId}' in parents`,
            pageSize: '10',
            fields: 'files(id,name,mimeType)',
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
          };
          console.log('[API] Using regular Drive params');
        }
        
        const listInFolderUrl = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams(listInFolderParams).toString()}`;
        
        console.log('[API] Endpoint: files.list');
        console.log('[API] Full URL:', listInFolderUrl);
        console.log('[API] Parameters:', JSON.stringify(listInFolderParams, null, 2));
        
        const listInFolderResponse = await fetch(listInFolderUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const listInFolderText = await listInFolderResponse.text();
        console.log('[API] Response Status:', listInFolderResponse.status);
        console.log('[API] Response Body:', listInFolderText);

        debugInfo.apiCalls.push({
          endpoint: 'files.list (in root folder)',
          folderId: rootFolderId,
          params: listInFolderParams,
          status: listInFolderResponse.status,
          response: listInFolderText,
        });

        if (listInFolderResponse.ok) {
          const folderFiles = JSON.parse(listInFolderText);
          console.log('[API] files.list in folder SUCCESS - found', folderFiles.files?.length || 0, 'files');
        } else {
          console.error('[ERROR] files.list in folder FAILED');
          // Parse and log the error
          try {
            const listError = JSON.parse(listInFolderText);
            console.error('[ERROR] List Error JSON:', JSON.stringify(listError, null, 2));
          } catch {}
        }
      } else {
        console.error('[ERROR] files.get FAILED for root folder!');
        rootFolderError = getResponseText;
        
        try {
          rootFolderErrorJson = JSON.parse(getResponseText);
          console.error('[ERROR] Error Code:', rootFolderErrorJson?.error?.code);
          console.error('[ERROR] Error Message:', rootFolderErrorJson?.error?.message);
          console.error('[ERROR] Error Reason:', rootFolderErrorJson?.error?.errors?.[0]?.reason);
          console.error('[ERROR] Error Domain:', rootFolderErrorJson?.error?.errors?.[0]?.domain);
          console.error('[ERROR] Full Error JSON:', JSON.stringify(rootFolderErrorJson, null, 2));
        } catch {
          console.error('[ERROR] Raw error text:', getResponseText);
        }
      }
    } else {
      console.log('[SKIP] No GOOGLE_DRIVE_ROOT_FOLDER_ID configured, skipping root folder tests');
    }

    console.log('');
    console.log('=== TEST SUMMARY ===');
    console.log('Authorized Email:', actualEmail);
    console.log('Root Folder ID:', rootFolderId || '(NOT SET)');
    console.log('Shared Drive ID:', sharedDriveId || '(Not in Shared Drive)');
    console.log('General Drive Access: SUCCESS');
    console.log('Root Folder Access:', rootFolderAccess ? 'SUCCESS' : (rootFolderId ? 'FAILED' : 'SKIPPED'));
    if (rootFolderError) {
      console.log('Root Folder Error:', rootFolderError);
    }
    console.log('==========================================');
    console.log('=== DRIVE TEST CONNECTION DEBUG END ===');
    console.log('==========================================');
    console.log('');

    // Clear any previous error on success
    await supabase
      .from('user_drive_tokens')
      .update({ google_error: rootFolderError || null })
      .eq('user_id', userId);

    // Add Shared Drive info to debug
    debugInfo.sharedDriveId = sharedDriveId;
    debugInfo.rootFolderName = rootFolderData?.name || null;

    const result = {
      success: true,
      message: rootFolderAccess ? '連線成功！已驗證 Root Folder 存取權限' : 
               (rootFolderId ? '連線成功，但無法存取 Root Folder' : '連線成功（一般 Drive 存取）'),
      googleEmail: actualEmail,
      rootFolderId: rootFolderId || null,
      rootFolderName: rootFolderData?.name || null,
      sharedDriveId,
      rootFolderAccess,
      rootFolderError: rootFolderErrorJson || rootFolderError,
      files: listData?.files || [],
      fileCount: listData?.files?.length || 0,
      debug: debugInfo,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[FATAL ERROR]:', error.message);
    console.error('[STACK]:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
