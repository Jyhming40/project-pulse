import { AlertTriangle, DollarSign, Wrench, FileCheck } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface CancellationWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  hasAdminCost: boolean;
  hasEngineeringCost: boolean;
  adminMilestone: string | null;
  engineeringMilestones: string[];
  projectName?: string;
  isCostFree?: boolean;
}

export function CancellationWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  hasAdminCost,
  hasEngineeringCost,
  adminMilestone,
  engineeringMilestones,
  projectName,
  isCostFree = false,
}: CancellationWarningDialogProps) {
  const [reason, setReason] = useState('');
  
  const hasCost = hasAdminCost || hasEngineeringCost;

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasCost ? (
              <>
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="text-destructive">取消案件警告</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span>確認取消案件</span>
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {projectName && (
                <p className="font-medium text-foreground">{projectName}</p>
              )}
              
              {hasCost ? (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
                  <div className="flex items-center gap-2 text-destructive font-medium">
                    <DollarSign className="w-4 h-4" />
                    此操作將產生費用
                  </div>
                  
                  {hasAdminCost && adminMilestone && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileCheck className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">行政費用：</span>
                        <Badge variant="outline" className="ml-1">{adminMilestone}</Badge>
                        <span className="text-muted-foreground ml-1">已完成</span>
                      </div>
                    </div>
                  )}
                  
                  {hasEngineeringCost && engineeringMilestones.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Wrench className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">工程費用：</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {engineeringMilestones.map(m => (
                            <Badge key={m} variant="outline">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  此案件尚未達到費用產生門檻，可以自由取消。
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="cancel-reason">
                  取消原因 {hasCost && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="請說明取消原因..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                取消後，行政流程與工程流程將同步標記為「取消」狀態。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>返回</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={hasCost && !reason.trim()}
            className={hasCost ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {hasCost ? '確認取消（將產生費用）' : '確認取消'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
