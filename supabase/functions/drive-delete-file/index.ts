import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh access token
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Token 刷新失敗');
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// Get valid access token
async function getValidAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error } = await supabase
    .from('user_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('NEED_AUTH');
  }

  const tokenData = data as { access_token: string; refresh_token: string; token_expires_at: string };
  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();

  let accessToken = tokenData.access_token;

  if (expiresAt.getTime() - now.getTime() <= 5 * 60 * 1000) {
    const { accessToken: newToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
    accessToken = newToken;
    
    await supabase
      .from('user_drive_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
      .eq('user_id', userId);
  }

  return accessToken;
}

// Delete file from Drive
async function deleteFileFromDrive(accessToken: string, fileId: string): Promise<boolean> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 204 = success, 404 = already deleted (still ok)
  if (response.status === 204 || response.status === 404) {
    return true;
  }

  const errorText = await response.text();
  console.error('Drive delete failed:', errorText);
  throw new Error(`刪除 Drive 檔案失敗: ${response.status}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權' }),
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
        JSON.stringify({ error: '無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'staff'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: '權限不足' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { documentId, driveFileId } = body;

    if (!documentId && !driveFileId) {
      return new Response(
        JSON.stringify({ error: '需要 documentId 或 driveFileId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let fileIdToDelete = driveFileId;

    // If documentId is provided, fetch the drive_file_id from the document
    if (documentId && !driveFileId) {
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('drive_file_id, title, doc_type')
        .eq('id', documentId)
        .single();

      if (docError || !doc) {
        return new Response(
          JSON.stringify({ error: '找不到文件' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!doc.drive_file_id) {
        // No Drive file to delete, just return success
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: '文件沒有關聯的雲端檔案',
            driveDeleted: false 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      fileIdToDelete = doc.drive_file_id;
    }

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseUrl, supabaseServiceKey, user.id);
    } catch (err) {
      const error = err as Error;
      if (error.message === 'NEED_AUTH') {
        return new Response(
          JSON.stringify({ error: 'NEED_AUTH', message: '需要授權 Google Drive' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

    // Delete from Drive
    console.log(`Deleting file ${fileIdToDelete} from Drive`);
    await deleteFileFromDrive(accessToken, fileIdToDelete);

    // Clear drive fields from document record if documentId provided
    if (documentId) {
      await supabase
        .from('documents')
        .update({
          drive_file_id: null,
          drive_web_view_link: null,
          drive_path: null,
          drive_parent_folder_id: null,
        })
        .eq('id', documentId);
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'DELETE' as const,
      record_id: documentId || fileIdToDelete,
      table_name: 'documents',
      actor_user_id: user.id,
      new_data: {
        action_type: 'DRIVE_FILE_DELETE',
        drive_file_id: fileIdToDelete,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: '雲端檔案已刪除',
        driveDeleted: true,
        deletedFileId: fileIdToDelete,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Delete error:', error);
    
    return new Response(
      JSON.stringify({ error: error?.message || '未知錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
