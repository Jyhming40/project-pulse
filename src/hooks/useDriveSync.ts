import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    const { data, error } = await supabase.functions.invoke('drive-delete-file', {
      body: { documentId },
    });

    if (error) {
      console.error('Drive delete error:', error);
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
    console.error('Drive delete exception:', err);
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

/**
 * Show confirmation dialog for Drive sync deletion
 */
export function showDriveSyncConfirmation(
  onConfirm: () => void,
  onCancel: () => void,
  documentTitle?: string
) {
  toast.info(
    documentTitle 
      ? `確定要同時刪除「${documentTitle}」的雲端檔案嗎？`
      : '確定要同時刪除雲端檔案嗎？',
    {
      description: '此操作會將 Google Drive 上的檔案一併刪除',
      duration: 10000,
      action: {
        label: '確認刪除',
        onClick: onConfirm,
      },
      cancel: {
        label: '保留雲端',
        onClick: onCancel,
      },
    }
  );
}
