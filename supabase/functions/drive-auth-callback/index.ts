import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('');
  console.log('==========================================');
  console.log('=== DRIVE AUTH CALLBACK DEBUG START ===');
  console.log('==========================================');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[ENV] SUPABASE_URL:', supabaseUrl);
  console.log('[ENV] GOOGLE_DRIVE_ROOT_FOLDER_ID:', rootFolderId || '(NOT SET)');

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('[OAUTH] Callback received:');
    console.log('  - has code:', !!code);
    console.log('  - has state:', !!state);
    console.log('  - error:', error || '(none)');
    console.log('  - error_description:', errorDescription || '(none)');

    if (error) {
      console.error('[OAUTH ERROR]:', error, errorDescription);
      // Parse state to get redirect URL even on error
      let redirectUrl = '/settings';
      try {
        if (state) {
          const stateData = JSON.parse(atob(state));
          redirectUrl = stateData.redirectUrl || '/settings';
        }
      } catch {}
      
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${redirectUrl}?drive_auth=error&error=${encodeURIComponent(errorDescription || error)}`,
        },
      });
    }

    if (!code || !state) {
      console.error('[ERROR] Missing code or state');
      return new Response('缺少必要參數', { status: 400 });
    }

    // Parse state
    let stateData: { userId: string; redirectUrl: string };
    try {
      stateData = JSON.parse(atob(state));
      console.log('[STATE] Parsed successfully:');
      console.log('  - userId:', stateData.userId);
      console.log('  - redirectUrl:', stateData.redirectUrl);
    } catch (e) {
      console.error('[ERROR] Invalid state:', e);
      return new Response('無效的 state 參數', { status: 400 });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    console.log('[ENV] GOOGLE_CLIENT_ID:', clientId ? clientId.substring(0, 20) + '...' : '(NOT SET)');
    console.log('[ENV] GOOGLE_CLIENT_SECRET:', clientSecret ? '(SET - hidden)' : '(NOT SET)');

    if (!clientId || !clientSecret) {
      console.error('[ERROR] Missing Google OAuth credentials');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${stateData.redirectUrl}?drive_auth=error&error=${encodeURIComponent('未設定 Google OAuth 憑證')}`,
        },
      });
    }

    // Get the function URL for redirect_uri
    const functionUrl = `${supabaseUrl}/functions/v1/drive-auth-callback`;
    console.log('[OAUTH] redirect_uri:', functionUrl);

    // Exchange code for tokens
    console.log('[OAUTH] Exchanging code for tokens...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: functionUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenText = await tokenResponse.text();
    console.log('[OAUTH] Token response status:', tokenResponse.status);
    console.log('[OAUTH] Token response body:', tokenText);

    if (!tokenResponse.ok) {
      console.error('[ERROR] Token exchange failed');
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(tokenText);
        console.error('[ERROR] Error JSON:', JSON.stringify(errorJson, null, 2));
      } catch {}
      
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${stateData.redirectUrl}?drive_auth=error&error=${encodeURIComponent('Token 交換失敗: ' + tokenText)}`,
        },
      });
    }

    const tokenData = JSON.parse(tokenText);
    console.log('[OAUTH] Token exchange successful:');
    console.log('  - has access_token:', !!tokenData.access_token);
    console.log('  - has refresh_token:', !!tokenData.refresh_token);
    console.log('  - expires_in:', tokenData.expires_in);
    console.log('  - scope:', tokenData.scope);
    console.log('  - token_type:', tokenData.token_type);

    // Get user email from Google
    let googleEmail = null;
    console.log('[USERINFO] Fetching user email from Google...');
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      const userInfoText = await userInfoResponse.text();
      console.log('[USERINFO] Response status:', userInfoResponse.status);
      console.log('[USERINFO] Response body:', userInfoText);
      
      if (userInfoResponse.ok) {
        const userInfo = JSON.parse(userInfoText);
        googleEmail = userInfo.email;
        console.log('[USERINFO] Google email:', googleEmail);
      } else {
        console.error('[USERINFO] Failed to get user info');
      }
    } catch (e) {
      console.error('[USERINFO] Error:', e);
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    console.log('[DB] Token expires at:', expiresAt.toISOString());

    // Store tokens in database
    console.log('[DB] Storing tokens for user:', stateData.userId);
    const { error: upsertError } = await supabase
      .from('user_drive_tokens')
      .upsert({
        user_id: stateData.userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        google_email: googleEmail,
        google_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[DB ERROR] Failed to store tokens:', upsertError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${stateData.redirectUrl}?drive_auth=error&error=${encodeURIComponent('儲存 Token 失敗: ' + JSON.stringify(upsertError))}`,
        },
      });
    }

    console.log('[DB] Tokens stored successfully');
    console.log('');
    console.log('=== AUTH SUMMARY ===');
    console.log('User ID:', stateData.userId);
    console.log('Google Email:', googleEmail);
    console.log('Token Expires:', expiresAt.toISOString());
    console.log('Root Folder ID (for reference):', rootFolderId || '(NOT SET)');
    console.log('==========================================');
    console.log('=== DRIVE AUTH CALLBACK DEBUG END ===');
    console.log('==========================================');
    console.log('');

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${stateData.redirectUrl}?drive_auth=success`,
      },
    });

  } catch (err) {
    const error = err as Error;
    console.error('[FATAL ERROR]:', error.message);
    console.error('[STACK]:', error.stack);
    return new Response(`錯誤: ${error.message}`, { status: 500 });
  }
});
