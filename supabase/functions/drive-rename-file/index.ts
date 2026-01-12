import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('[DriveRename] Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[DriveRename] Token refresh error:', error);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '驗證失敗' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { driveFileId, newName } = await req.json();

    if (!driveFileId) {
      return new Response(
        JSON.stringify({ error: '缺少 Drive 檔案 ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newName) {
      return new Response(
        JSON.stringify({ error: '缺少新檔名' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DriveRename] Renaming file ${driveFileId} to "${newName}"`);

    // Get user's Drive token
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_drive_tokens')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: '未連結 Google Drive 帳號，請先授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.access_token;
    const tokenExpires = new Date(tokenData.token_expires_at);
    
    if (tokenExpires < new Date()) {
      console.log('[DriveRename] Token expired, refreshing...');
      const newToken = await refreshAccessToken(tokenData.refresh_token);
      
      if (!newToken) {
        return new Response(
          JSON.stringify({ error: 'Google Drive 授權已過期，請重新授權' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      accessToken = newToken;
      
      // Update token in database
      await supabase
        .from('user_drive_tokens')
        .update({
          access_token: newToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Rename file in Google Drive using PATCH request
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DriveRename] Google API error:', response.status, errorText);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: '找不到此檔案，可能已被刪除或移動' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: '無權限重新命名此檔案' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Google Drive API 錯誤: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log(`[DriveRename] File renamed successfully: ${result.name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        newName: result.name,
        message: `檔案已重新命名為「${result.name}」`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DriveRename] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '處理失敗' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
