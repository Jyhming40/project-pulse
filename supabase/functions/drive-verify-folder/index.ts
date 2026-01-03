import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('未設定 Google OAuth 憑證');
  }

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
    console.error('Token refresh failed:', errorText);
    throw new Error('Token 刷新失敗，請重新授權 Google Drive');
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// Get valid access token for user
async function getValidAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error: tokenError } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (tokenError || !data) {
    throw new Error('NEED_AUTH');
  }

  const tokenData = data as { access_token: string; refresh_token: string; token_expires_at: string };

  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  let accessToken = tokenData.access_token;

  if (expiresAt.getTime() - now.getTime() <= bufferMs) {
    console.log('Token expired, refreshing...');
    const { accessToken: newToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
    accessToken = newToken;
    
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);
    await supabase
      .from('user_drive_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  return accessToken;
}

// Check if a folder exists in Google Drive
async function checkFolderExists(
  accessToken: string,
  folderId: string
): Promise<{ exists: boolean; trashed: boolean; name?: string }> {
  const params = new URLSearchParams({
    fields: 'id,name,trashed',
    supportsAllDrives: 'true',
  });

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.status === 404) {
      console.log(`Folder ${folderId} not found (404)`);
      return { exists: false, trashed: false };
    }

    if (!response.ok) {
      console.error('Check folder exists failed:', await response.text());
      return { exists: false, trashed: false };
    }

    const data = await response.json();
    return { exists: true, trashed: data.trashed === true, name: data.name };
  } catch (err) {
    console.error('Check folder exists error:', err);
    return { exists: false, trashed: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權：缺少認證標頭' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '未授權：無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Check role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!userRole || !['admin', 'staff'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: '權限不足：只有管理員和員工可以驗證資料夾' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { projectId, action } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: '缺少 projectId 參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_code, project_name, drive_folder_id, drive_folder_url, investor_drive_folder_id, folder_status')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: '找不到案場資料' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: reset - just clear the drive folder records without checking
    if (action === 'reset') {
      console.log('Resetting drive folder records for project:', projectId);
      
      const oldData = {
        drive_folder_id: project.drive_folder_id,
        drive_folder_url: project.drive_folder_url,
        investor_drive_folder_id: project.investor_drive_folder_id,
        folder_status: project.folder_status,
      };

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          drive_folder_id: null,
          drive_folder_url: null,
          investor_drive_folder_id: null,
          folder_status: 'pending',
          folder_error: null,
        })
        .eq('id', projectId);

      if (updateError) {
        throw new Error('重置資料夾記錄失敗');
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'UPDATE' as const,
        record_id: projectId,
        table_name: 'projects',
        actor_user_id: userId,
        old_data: oldData,
        new_data: {
          action_type: 'FOLDER_RESET_MANUAL',
          drive_folder_id: null,
          folder_status: 'pending',
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          action: 'reset',
          message: 'Drive 資料夾記錄已重置',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: verify - check if folder exists in Drive
    if (!project.drive_folder_id) {
      return new Response(
        JSON.stringify({
          success: true,
          exists: false,
          message: '此案場尚未建立 Drive 資料夾',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token to check Drive
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseUrl, supabaseServiceKey, userId);
    } catch (err) {
      const error = err as Error;
      if (error.message === 'NEED_AUTH') {
        return new Response(
          JSON.stringify({ error: 'NEED_AUTH', message: '請先授權 Google Drive' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

    // Check if folder exists
    const folderCheck = await checkFolderExists(accessToken, project.drive_folder_id);
    console.log('Folder check result:', folderCheck);

    if (!folderCheck.exists || folderCheck.trashed) {
      // Folder doesn't exist - clear database records
      console.log('Folder not found or trashed, clearing records...');
      
      const oldData = {
        drive_folder_id: project.drive_folder_id,
        drive_folder_url: project.drive_folder_url,
        investor_drive_folder_id: project.investor_drive_folder_id,
        folder_status: project.folder_status,
      };

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          drive_folder_id: null,
          drive_folder_url: null,
          investor_drive_folder_id: null,
          folder_status: 'pending',
          folder_error: null,
        })
        .eq('id', projectId);

      if (updateError) {
        throw new Error('清除資料夾記錄失敗');
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'UPDATE' as const,
        record_id: projectId,
        table_name: 'projects',
        actor_user_id: userId,
        old_data: oldData,
        new_data: {
          action_type: 'FOLDER_VERIFIED_NOT_FOUND',
          reason: folderCheck.trashed ? 'Folder was trashed' : 'Folder was deleted',
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          exists: false,
          cleared: true,
          message: folderCheck.trashed 
            ? 'Drive 資料夾已被移至垃圾桶，記錄已清除'
            : 'Drive 資料夾已被刪除，記錄已清除',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Folder exists
    return new Response(
      JSON.stringify({
        success: true,
        exists: true,
        folderName: folderCheck.name,
        folderId: project.drive_folder_id,
        folderUrl: project.drive_folder_url,
        message: 'Drive 資料夾存在且正常',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error verifying folder:', error);
    
    return new Response(
      JSON.stringify({ error: error?.message || '未知錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
