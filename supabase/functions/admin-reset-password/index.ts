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

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '僅管理員可以執行此操作' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { targetUserId, resetMode, reason, newPassword } = await req.json();

    if (!targetUserId || !resetMode) {
      return new Response(
        JSON.stringify({ error: '缺少必要參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user info for logging
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    const targetEmail = targetUser?.user?.email || 'unknown';

    let actionResult = '';

    if (resetMode === 'send_email') {
      // Send password reset email
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetEmail,
      });

      if (resetError) {
        console.error('Error sending reset email:', resetError);
        return new Response(
          JSON.stringify({ error: '發送密碼重設郵件失敗: ' + resetError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      actionResult = '已發送密碼重設郵件';

    } else if (resetMode === 'force_change') {
      // Set must_change_password flag
      const { error: updateError } = await supabaseAdmin
        .from('user_security')
        .upsert({
          user_id: targetUserId,
          must_change_password: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (updateError) {
        console.error('Error setting force change flag:', updateError);
        return new Response(
          JSON.stringify({ error: '設定強制更改密碼失敗: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      actionResult = '已設定使用者下次登入時須變更密碼';

    } else if (resetMode === 'set_password') {
      // Directly set new password (requires reason)
      if (!newPassword || !reason) {
        return new Response(
          JSON.stringify({ error: '直接設定密碼需要提供新密碼及原因' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password: newPassword }
      );

      if (passwordError) {
        console.error('Error setting password:', passwordError);
        return new Response(
          JSON.stringify({ error: '設定密碼失敗: ' + passwordError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also set must_change_password flag for security
      await supabaseAdmin
        .from('user_security')
        .upsert({
          user_id: targetUserId,
          must_change_password: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      actionResult = '已重設密碼，使用者下次登入時須再次變更密碼';

    } else {
      return new Response(
        JSON.stringify({ error: '無效的重設模式' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit entry
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        table_name: 'user_security',
        record_id: targetUserId,
        action: 'PASSWORD_RESET',
        actor_user_id: user.id,
        old_data: null,
        new_data: { reset_mode: resetMode, target_email: targetEmail },
        reason: reason || `管理員 ${user.email} 重設 ${targetEmail} 的密碼 (模式: ${resetMode})`
      });

    console.log(`Password reset: ${targetEmail} by admin ${user.email}, mode: ${resetMode}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: actionResult,
        target_user_id: targetUserId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-password:', error);
    const errorMessage = error instanceof Error ? error.message : '伺服器錯誤';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
