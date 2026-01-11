import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import type { OcrTask, BatchOcrProgress } from '@/hooks/useBatchOcr';

interface BatchOcrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: OcrTask[];
  progress: BatchOcrProgress;
  isRunning: boolean;
  onCancel: () => void;
  onClose: () => void;
}

export function BatchOcrDialog({
  open,
  onOpenChange,
  tasks,
  progress,
  isRunning,
  onCancel,
  onClose,
}: BatchOcrDialogProps) {
  const progressPercent = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  const getStatusIcon = (status: OcrTask['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'skipped':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'review':
        return <HelpCircle className="w-4 h-4 text-orange-500" />;
    }
  };

  const getStatusBadge = (status: OcrTask['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">等待中</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">處理中</Badge>;
      case 'success':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">成功</Badge>;
      case 'error':
        return <Badge variant="destructive">失敗</Badge>;
      case 'skipped':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">已跳過</Badge>;
      case 'review':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">需確認</Badge>;
    }
  };

  const handleClose = () => {
    if (isRunning) {
      onCancel();
    }
    onClose();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            批次 OCR 辨識
          </DialogTitle>
          <DialogDescription>
            {isRunning 
              ? '正在處理文件，請稍候...' 
              : progress.completed > 0 
                ? '處理完成' 
                : '準備開始處理'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Section */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>進度: {progress.completed} / {progress.total}</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-2 text-center text-sm">
            <div className="p-2 rounded-lg bg-muted">
              <p className="text-lg font-bold">{progress.total}</p>
              <p className="text-xs text-muted-foreground">總計</p>
            </div>
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{progress.success}</p>
              <p className="text-xs text-green-600 dark:text-green-400">成功</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{progress.review}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400">需確認</p>
            </div>
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{progress.error}</p>
              <p className="text-xs text-red-600 dark:text-red-400">失敗</p>
            </div>
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{progress.skipped}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">跳過</p>
            </div>
          </div>
        </div>

        {/* Task List - Fixed height with scrollbar */}
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
          <ScrollArea className="h-[280px]">
            <div className="p-2 space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.documentId}
                  className={`flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                    task.status === 'processing' 
                      ? 'bg-blue-50 dark:bg-blue-900/20' 
                      : task.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/10'
                        : task.status === 'error'
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : task.status === 'review'
                            ? 'bg-orange-50 dark:bg-orange-900/10'
                            : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.documentTitle}</p>
                      <p className="text-xs text-muted-foreground">{task.projectCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.extractedDates && (task.extractedDates.submittedAt || task.extractedDates.issuedAt) && (
                      <span className="text-xs text-green-600">
                        {task.extractedDates.submittedAt && '送件日 '}
                        {task.extractedDates.issuedAt && '核發日'}
                      </span>
                    )}
                    {task.error && task.status === 'error' && (
                      <span className="text-xs text-destructive truncate max-w-32" title={task.error}>
                        {task.error}
                      </span>
                    )}
                    {getStatusBadge(task.status)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          {isRunning ? (
            <Button variant="destructive" onClick={onCancel}>
              取消處理
            </Button>
          ) : (
            <Button onClick={handleClose}>
              關閉
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
