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

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Contains user_id and redirect_url
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(`授權失敗: ${error}`, { status: 400 });
    }

    if (!code || !state) {
      return new Response('缺少必要參數', { status: 400 });
    }

    // Parse state
    let stateData: { userId: string; redirectUrl: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response('無效的 state 參數', { status: 400 });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return new Response('未設定 Google OAuth 憑證', { status: 500 });
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

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(`Token 交換失敗: ${errorText}`, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Store tokens in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: upsertError } = await supabase
      .from('user_drive_tokens')
      .upsert({
        user_id: stateData.userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      return new Response('儲存 Token 失敗', { status: 500 });
    }

    console.log('Tokens stored successfully for user:', stateData.userId);

    // Redirect back to app
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
