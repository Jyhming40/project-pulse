import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權的請求' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '未授權的請求' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role, status')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin' || roleData?.status !== 'active') {
      return new Response(
        JSON.stringify({ error: '僅管理員可以執行此操作' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const targetUserId = body.targetUserId || body.userId;
    const { action, role, reason } = body;

    if (!targetUserId || !action) {
      return new Response(
        JSON.stringify({ error: '缺少必要參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let updateData: Record<string, unknown> = {};
    let auditAction = '';

    switch (action) {
      case 'approve':
        updateData = {
          status: 'active',
          role: role || 'viewer',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          rejected_at: null,
          rejected_by: null,
          reject_reason: null
        };
        auditAction = 'USER_APPROVE';
        break;
      case 'reject':
        updateData = {
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          reject_reason: reason || null
        };
        auditAction = 'USER_REJECT';
        break;
      case 'disable':
        updateData = {
          status: 'disabled',
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          reject_reason: reason || '管理員停用'
        };
        auditAction = 'USER_DISABLE';
        break;
      default:
        return new Response(
          JSON.stringify({ error: '無效的操作' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Update user role
    const { error: updateError } = await supabaseAdmin
      .from('user_roles')
      .update(updateData)
      .eq('user_id', targetUserId);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to audit
    const { error: auditError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        table_name: 'user_roles',
        record_id: targetUserId,
        action: auditAction,
        actor_user_id: user.id,
        reason: reason || null,
        new_data: updateData
      });

    if (auditError) {
      console.error('Error logging audit:', auditError);
    }

    console.log(`User ${targetUserId} ${action} by admin ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, action }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-approve-user:', error);
    const errorMessage = error instanceof Error ? error.message : '伺服器錯誤';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
