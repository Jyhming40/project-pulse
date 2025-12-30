import { useState } from 'react';
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
import { Loader2, AlertTriangle } from 'lucide-react';

interface BatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  itemLabel?: string;
  requireReason?: boolean;
  onConfirm: (reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function BatchDeleteDialog({
  open,
  onOpenChange,
  selectedCount,
  itemLabel = '筆資料',
  requireReason = false,
  onConfirm,
  isLoading = false,
}: BatchDeleteDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    await onConfirm(reason || undefined);
    setReason('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setReason('');
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
