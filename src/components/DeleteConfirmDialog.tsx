import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Trash2, AlertTriangle, Cloud } from 'lucide-react';
import { useEffectivePolicy, type SoftDeleteTable } from '@/hooks/useDeletionPolicy';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string, deleteDriveFile?: boolean) => Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  tableName: SoftDeleteTable;
  isPending?: boolean;
  /** If the item has an associated Drive file */
  hasDriveFile?: boolean;
  /** Default state for Drive sync checkbox */
  defaultDeleteDrive?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = '確認刪除',
  description,
  itemName,
  tableName,
  isPending = false,
  hasDriveFile = false,
  defaultDeleteDrive = true,
}: DeleteConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDriveFile, setDeleteDriveFile] = useState(defaultDeleteDrive);
  const policy = useEffectivePolicy(tableName);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDeleteDriveFile(defaultDeleteDrive);
    }
  }, [open, defaultDeleteDrive]);

  const isSoftDelete = policy.deletionMode === 'soft_delete';
  const requireReason = policy.requireDeleteReason;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onConfirm(reason || undefined, hasDriveFile ? deleteDriveFile : undefined);
      setReason('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
      setDeleteDriveFile(defaultDeleteDrive);
    }
    onOpenChange(newOpen);
  };

  const defaultDescription = isSoftDelete
    ? `「${itemName || '此項目'}」將被移至回收區，您可以隨時復原。`
    : `「${itemName || '此項目'}」將被永久刪除，此操作無法復原。`;

  const isLoading = isPending || isSubmitting;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isSoftDelete ? (
              <Trash2 className="h-5 w-5 text-warning" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireReason && (
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-reason">
              刪除原因 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="delete-reason"
              placeholder="請說明刪除原因..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
            {requireReason && !reason.trim() && (
              <p className="text-xs text-muted-foreground">
                此資料表的刪除政策要求填寫刪除原因
              </p>
            )}
          </div>
        )}

        {hasDriveFile && (
          <div className="flex items-start space-x-3 bg-muted/50 rounded-lg p-3">
            <Checkbox
              id="delete-drive-file"
              checked={deleteDriveFile}
              onCheckedChange={(checked) => setDeleteDriveFile(checked === true)}
            />
            <div className="space-y-1">
              <Label 
                htmlFor="delete-drive-file" 
                className="flex items-center gap-2 cursor-pointer font-medium"
              >
                <Cloud className="h-4 w-4 text-blue-500" />
                同時刪除 Google Drive 檔案
              </Label>
              <p className="text-xs text-muted-foreground">
                {deleteDriveFile 
                  ? '雲端檔案將與紀錄一起刪除' 
                  : '雲端檔案將被保留，僅刪除系統紀錄'}
              </p>
            </div>
          </div>
        )}

        {isSoftDelete && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p>💡 此資料將保留 {policy.retentionDays} 天，期間可在回收區中復原</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isLoading || (requireReason && !reason.trim())}
            className={isSoftDelete 
              ? 'bg-warning text-warning-foreground hover:bg-warning/90' 
              : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            }
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSoftDelete ? '移至回收區' : '確認刪除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
