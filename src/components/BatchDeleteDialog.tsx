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
import { Loader2, AlertTriangle, Cloud } from 'lucide-react';

interface BatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  itemLabel?: string;
  requireReason?: boolean;
  onConfirm: (reason?: string, deleteDriveFiles?: boolean) => Promise<void>;
  isLoading?: boolean;
  /** Number of items that have associated Drive files */
  driveFileCount?: number;
}

export function BatchDeleteDialog({
  open,
  onOpenChange,
  selectedCount,
  itemLabel = '筆資料',
  requireReason = false,
  onConfirm,
  isLoading = false,
  driveFileCount = 0,
}: BatchDeleteDialogProps) {
  const [reason, setReason] = useState('');
  const [deleteDriveFiles, setDeleteDriveFiles] = useState(true);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDeleteDriveFiles(true);
    }
  }, [open]);

  const handleConfirm = async () => {
    await onConfirm(reason || undefined, driveFileCount > 0 ? deleteDriveFiles : undefined);
    setReason('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setReason('');
    setDeleteDriveFiles(true);
    onOpenChange(false);
  };

  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            確認批次刪除
          </AlertDialogTitle>
          <AlertDialogDescription>
            您確定要刪除選取的 <strong>{selectedCount}</strong> {itemLabel}嗎？此操作無法復原。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireReason && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="reason">刪除原因 *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請輸入刪除原因..."
              rows={3}
            />
          </div>
        )}

        {driveFileCount > 0 && (
          <div className="flex items-start space-x-3 bg-muted/50 rounded-lg p-3">
            <Checkbox
              id="delete-drive-files"
              checked={deleteDriveFiles}
              onCheckedChange={(checked) => setDeleteDriveFiles(checked === true)}
            />
            <div className="space-y-1">
              <Label 
                htmlFor="delete-drive-files" 
                className="flex items-center gap-2 cursor-pointer font-medium"
              >
                <Cloud className="h-4 w-4 text-blue-500" />
                同時刪除 Google Drive 檔案
              </Label>
              <p className="text-xs text-muted-foreground">
                {deleteDriveFiles 
                  ? `將刪除 ${driveFileCount} 個雲端檔案`
                  : '雲端檔案將被保留，僅刪除系統紀錄'}
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            確認刪除 ({selectedCount} 筆)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
