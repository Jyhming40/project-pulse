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
import { Loader2, Archive } from 'lucide-react';

interface BatchArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  itemLabel?: string;
  onConfirm: (reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function BatchArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  itemLabel = '筆文件',
  onConfirm,
  isLoading = false,
}: BatchArchiveDialogProps) {
  const [reason, setReason] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  const handleConfirm = async () => {
    await onConfirm(reason || undefined);
    setReason('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-blue-600" />
            確認批次歸檔
          </AlertDialogTitle>
          <AlertDialogDescription>
            您確定要歸檔選取的 <strong>{selectedCount}</strong> {itemLabel}嗎？
            <br />
            <span className="text-muted-foreground text-xs mt-1 block">
              歸檔後的文件將不會出現在待處理清單中，但可透過篩選器查看。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="archive-reason">歸檔原因（選填）</Label>
          <Textarea
            id="archive-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：案場已結案、文件已過期..."
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            確認歸檔 ({selectedCount} 筆)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
