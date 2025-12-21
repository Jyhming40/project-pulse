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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('Callback received - code:', !!code, 'state:', !!state, 'error:', error);

    if (error) {
      console.error('OAuth error:', error, errorDescription);
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
      console.error('Missing code or state');
      return new Response('缺少必要參數', { status: 400 });
    }

    // Parse state
    let stateData: { userId: string; redirectUrl: string };
    try {
      stateData = JSON.parse(atob(state));
      console.log('State parsed - userId:', stateData.userId);
    } catch (e) {
      console.error('Invalid state:', e);
      return new Response('無效的 state 參數', { status: 400 });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${stateData.redirectUrl}?drive_auth=error&error=${encodeURIComponent('未設定 Google OAuth 憑證')}`,
        },
      });
    }

    // Get the function URL for redirect_uri
    const functionUrl = `${supabaseUrl}/functions/v1/drive-auth-callback`;

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
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
    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenText);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${stateData.redirectUrl}?drive_auth=error&error=${encodeURIComponent('Token 交換失敗: ' + tokenText)}`,
        },
      });
    }

    const tokenData = JSON.parse(tokenText);
    console.log('Token exchange successful, has refresh_token:', !!tokenData.refresh_token);

    // Get user email from Google
    let googleEmail = null;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        googleEmail = userInfo.email;
        console.log('Google email retrieved:', googleEmail);
      }
    } catch (e) {
      console.error('Failed to get user email:', e);
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Store tokens in database
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
      console.error('Failed to store tokens:', upsertError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${stateData.redirectUrl}?drive_auth=error&error=${encodeURIComponent('儲存 Token 失敗')}`,
        },
      });
    }

    console.log('Tokens stored successfully for user:', stateData.userId);

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${stateData.redirectUrl}?drive_auth=success`,
      },
    });

  } catch (err) {
    const error = err as Error;
    console.error('Callback error:', error);
    return new Response(`錯誤: ${error.message}`, { status: 500 });
  }
});
