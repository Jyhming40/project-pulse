import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權的請求' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '未授權的請求' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: '密碼至少需要 6 個字元' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password using user's token
    const { error: updateError } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: '更新密碼失敗: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for updating user_security
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get password policy
    const { data: policyData } = await supabaseAdmin
      .from('progress_settings')
      .select('setting_value')
      .eq('setting_key', 'password_policy')
      .single();

    const policy = policyData?.setting_value as { password_expires_days?: number } || { password_expires_days: 90 };
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (policy.password_expires_days || 90));

    // Update user_security record
    const { error: securityError } = await supabaseAdmin
      .from('user_security')
      .upsert({
        user_id: user.id,
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
        password_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (securityError) {
      console.error('Error updating user_security:', securityError);
      // Continue anyway - password was updated successfully
    }

    // Log audit entry
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        table_name: 'user_security',
        record_id: user.id,
        action: 'PASSWORD_POLICY_UPDATE',
        actor_user_id: user.id,
        old_data: null,
        new_data: { password_changed: true },
        reason: '使用者變更密碼'
      });

    console.log(`Password changed for user ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '密碼已更新',
        password_expires_at: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in user-change-password:', error);
    const errorMessage = error instanceof Error ? error.message : '伺服器錯誤';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
