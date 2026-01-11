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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  CheckCheck,
} from 'lucide-react';
import { useState } from 'react';
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
  const [showAlreadyProcessed, setShowAlreadyProcessed] = useState(false);
  
  // Separate tasks into pending/processing and already processed
  const pendingTasks = tasks.filter(t => t.status !== 'already_processed');
  const alreadyProcessedTasks = tasks.filter(t => t.status === 'already_processed');
  
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
      case 'already_processed':
        return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
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
      case 'already_processed':
        return <Badge variant="outline" className="text-muted-foreground">已辨識</Badge>;
    }
  };

  const handleClose = () => {
    if (isRunning) {
      onCancel();
    }
    onClose();
    onOpenChange(false);
  };

  const renderTaskItem = (task: OcrTask) => (
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
                : task.status === 'already_processed'
                  ? 'bg-muted/30'
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
        {/* Show extracted data for successful tasks */}
        {task.extractedDates && (task.extractedDates.submittedAt || task.extractedDates.issuedAt || task.extractedDates.meterDate) && (
          <span className="text-xs text-green-600">
            {task.extractedDates.submittedAt && '送件日 '}
            {task.extractedDates.issuedAt && '核發日 '}
            {task.extractedDates.meterDate && '掛表日'}
          </span>
        )}
        {task.extractedPvId && (
          <span className="text-xs text-blue-600">
            PV編號
          </span>
        )}
        {/* Show existing data for already processed tasks */}
        {task.status === 'already_processed' && task.existingData && (
          <span className="text-xs text-muted-foreground">
            {task.existingData.submittedAt && '送件日 '}
            {task.existingData.issuedAt && '核發日 '}
            {task.existingData.pvId && 'PV編號'}
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
  );

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
                : alreadyProcessedTasks.length > 0 && pendingTasks.length === 0
                  ? '所有文件已經辨識過'
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
              <p className="text-xs text-muted-foreground">待處理</p>
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
            <div className="p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold text-muted-foreground">{alreadyProcessedTasks.length}</p>
              <p className="text-xs text-muted-foreground">已辨識</p>
            </div>
          </div>
        </div>

        {/* Task List - Fixed height with scrollbar */}
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
          <ScrollArea className="h-[280px]">
            <div className="p-2 space-y-1">
              {/* Pending/Processing Tasks */}
              {pendingTasks.length > 0 && (
                <div className="space-y-1">
                  {pendingTasks.map(renderTaskItem)}
                </div>
              )}
              
              {/* Already Processed Tasks - Collapsible */}
              {alreadyProcessedTasks.length > 0 && (
                <Collapsible open={showAlreadyProcessed} onOpenChange={setShowAlreadyProcessed}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors">
                      {showAlreadyProcessed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <CheckCheck className="w-4 h-4" />
                      <span>已辨識的文件 ({alreadyProcessedTasks.length})</span>
                      <span className="text-xs ml-auto">已跳過處理</span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-1">
                    {alreadyProcessedTasks.map(renderTaskItem)}
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Empty state */}
              {tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>沒有可處理的文件</p>
                </div>
              )}
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