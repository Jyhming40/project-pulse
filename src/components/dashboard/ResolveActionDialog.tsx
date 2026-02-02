import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import type { ResolutionType } from '@/hooks/useActionItemResolutions';

interface ResolveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
  isLoading?: boolean;
  projectName: string;
  resolutionType: ResolutionType;
}

const typeLabels: Record<ResolutionType, string> = {
  risk: '風險案場',
  pending: '待補件',
  stuck: '超時未更新',
};

export function ResolveActionDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  projectName,
  resolutionType,
}: ResolveActionDialogProps) {
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    onConfirm(note);
    setNote('');
  };

  const handleClose = () => {
    setNote('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            確認已處理
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                確認將 <span className="font-medium text-foreground">{projectName}</span> 從
                「{typeLabels[resolutionType]}」清單標記為已處理？
              </p>
              <p className="text-xs">
                處理完成後，此項目將移至「歷史記錄」分頁。
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="resolution-note">處理備註（選填）</Label>
          <Textarea
            id="resolution-note"
            placeholder="說明處理方式或結果..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '處理中...' : '確認完成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
