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

    // Create Supabase client with user's token to verify admin status
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '未授權的請求' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin using service role to avoid RLS issues
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
    const { userId, role } = await req.json();

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: '缺少必要參數 userId 或 role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['admin', 'staff', 'viewer'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: '無效的角色值' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get old role for audit log
    const { data: oldRoleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const oldRole = oldRoleData?.role || 'viewer';

    // Use upsert to update or insert the role
    const { error: updateError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role
      }, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (updateError) {
      console.error('Error updating role:', updateError);
      return new Response(
        JSON.stringify({ error: '更新角色失敗: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the update was successful (write-then-read)
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (verifyError || verifyData?.role !== role) {
      console.error('Role verification failed:', verifyError, verifyData);
      return new Response(
        JSON.stringify({ error: '角色更新驗證失敗，請重試' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit entry
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        table_name: 'user_roles',
        record_id: userId,
        action: 'ROLE_UPDATE',
        actor_user_id: user.id,
        old_data: { role: oldRole },
        new_data: { role: role },
        reason: `管理員 ${user.email} 將角色從 ${oldRole} 更新為 ${role}`
      });

    console.log(`Role updated: user ${userId} from ${oldRole} to ${role} by admin ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        old_role: oldRole,
        new_role: role,
        message: role !== oldRole ? '角色已更新，被更改的使用者需重新登入才會完全生效' : '角色未變更'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-update-role:', error);
    const errorMessage = error instanceof Error ? error.message : '伺服器錯誤';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
