import { supabase } from '@/integrations/supabase/client';

interface DriveDeleteResult {
  success: boolean;
  driveDeleted: boolean;
  message?: string;
}

/**
 * Delete a file from Google Drive associated with a document
 */
export async function deleteDriveFile(documentId: string): Promise<DriveDeleteResult> {
  try {
    console.log('[useDriveSync] Calling drive-delete-file for documentId:', documentId);
    
    const { data, error } = await supabase.functions.invoke('drive-delete-file', {
      body: { documentId },
    });

    console.log('[useDriveSync] Edge function response:', { data, error });

    if (error) {
      console.error('[useDriveSync] Drive delete error:', error);
      return { success: false, driveDeleted: false, message: error.message };
    }

    if (data?.error === 'NEED_AUTH') {
      return { success: false, driveDeleted: false, message: '需要授權 Google Drive' };
    }

    return {
      success: data?.success || false,
      driveDeleted: data?.driveDeleted || false,
      message: data?.message,
    };
  } catch (err) {
    console.error('[useDriveSync] Drive delete exception:', err);
    return { success: false, driveDeleted: false, message: '刪除雲端檔案時發生錯誤' };
  }
}

/**
 * Check if a document has an associated Drive file
 */
export async function hasAssociatedDriveFile(documentId: string): Promise<boolean> {
  const { data } = await supabase
    .from('documents')
    .select('drive_file_id')
    .eq('id', documentId)
    .single();

  return !!(data?.drive_file_id);
}
