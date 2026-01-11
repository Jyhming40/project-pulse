import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Info,
  Settings2,
} from 'lucide-react';

interface ExtractedDate {
  type: 'submission' | 'issue' | 'unknown';
  date: string;
  context: string;
  confidence: number;
}

interface OcrResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedDates: ExtractedDate[];
  fullText: string;
  currentSubmittedAt: string | null;
  currentIssuedAt: string | null;
  onConfirm: (submittedAt: string | null, issuedAt: string | null) => void;
  isUpdating: boolean;
}

interface OcrSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxPages: number;
  onMaxPagesChange: (pages: number) => void;
  onStartOcr: () => void;
  isLoading: boolean;
}

export function OcrSettingsDialog({
  open,
  onOpenChange,
  maxPages,
  onMaxPagesChange,
  onStartOcr,
  isLoading,
}: OcrSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            OCR 辨識設定
          </DialogTitle>
          <DialogDescription>
            設定辨識參數後開始擷取文件日期
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="max-pages">辨識頁數</Label>
            <Select
              value={maxPages.toString()}
              onValueChange={(value) => onMaxPagesChange(parseInt(value))}
            >
              <SelectTrigger id="max-pages">
                <SelectValue placeholder="選擇頁數" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">僅第 1 頁（建議）</SelectItem>
                <SelectItem value="2">前 2 頁</SelectItem>
                <SelectItem value="3">前 3 頁</SelectItem>
                <SelectItem value="5">前 5 頁</SelectItem>
                <SelectItem value="0">全部頁面</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              函文重點通常在第一頁，建議只辨識第一頁以節省時間與資源
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button onClick={onStartOcr} disabled={isLoading}>
            {isLoading ? '辨識中...' : '開始辨識'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OcrResultDialog({
  open,
  onOpenChange,
  extractedDates,
  fullText,
  currentSubmittedAt,
  currentIssuedAt,
  onConfirm,
  isUpdating,
}: OcrResultDialogProps) {
  // Find suggested dates from OCR
  const suggestedSubmission = extractedDates.find(d => d.type === 'submission');
  const suggestedIssue = extractedDates.find(d => d.type === 'issue');
  const unknownDates = extractedDates.filter(d => d.type === 'unknown');

  // State for user-selected dates
  const [selectedSubmittedAt, setSelectedSubmittedAt] = useState<string>(
    suggestedSubmission?.date || currentSubmittedAt?.split('T')[0] || ''
  );
  const [selectedIssuedAt, setSelectedIssuedAt] = useState<string>(
    suggestedIssue?.date || currentIssuedAt?.split('T')[0] || ''
  );

  const handleConfirm = () => {
    onConfirm(
      selectedSubmittedAt || null,
      selectedIssuedAt || null
    );
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'submission': return '送件日';
      case 'issue': return '核發日';
      default: return '未知類型';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'submission': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'issue': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            OCR 辨識結果
          </DialogTitle>
          <DialogDescription>
            請確認辨識結果並選擇要套用的日期
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Extracted Dates Summary */}
            {extractedDates.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  偵測到 {extractedDates.length} 個日期
                </div>

                {/* All detected dates */}
                <div className="space-y-3">
                  {extractedDates.map((dateInfo, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg bg-muted/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono font-medium">{dateInfo.date}</span>
                          <Badge className={getTypeBadgeColor(dateInfo.type)}>
                            {getTypeLabel(dateInfo.type)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          信心度: {formatConfidence(dateInfo.confidence)}
                        </span>
                      </div>
                      {dateInfo.context && (
                        <p className="text-xs text-muted-foreground line-clamp-2 bg-background p-2 rounded">
                          ...{dateInfo.context}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                未偵測到日期資訊
              </div>
            )}

            <Separator />

            {/* Date Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="w-4 h-4 text-blue-500" />
                選擇要套用的日期
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ocr-submitted-at">
                    送件日
                    {suggestedSubmission && (
                      <span className="ml-2 text-xs text-green-600">
                        (建議: {suggestedSubmission.date})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="ocr-submitted-at"
                    type="date"
                    value={selectedSubmittedAt}
                    onChange={(e) => setSelectedSubmittedAt(e.target.value)}
                  />
                  {currentSubmittedAt && (
                    <p className="text-xs text-muted-foreground">
                      目前值: {currentSubmittedAt.split('T')[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ocr-issued-at">
                    核發日
                    {suggestedIssue && (
                      <span className="ml-2 text-xs text-green-600">
                        (建議: {suggestedIssue.date})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="ocr-issued-at"
                    type="date"
                    value={selectedIssuedAt}
                    onChange={(e) => setSelectedIssuedAt(e.target.value)}
                  />
                  {currentIssuedAt && (
                    <p className="text-xs text-muted-foreground">
                      目前值: {currentIssuedAt.split('T')[0]}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick apply buttons for unknown dates */}
              {unknownDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    其他偵測到的日期 (點擊套用):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unknownDates.map((dateInfo, index) => (
                      <div key={index} className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSubmittedAt(dateInfo.date)}
                        >
                          {dateInfo.date} → 送件日
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedIssuedAt(dateInfo.date)}
                        >
                          {dateInfo.date} → 核發日
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* OCR Text Preview with ScrollArea */}
            {fullText && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">OCR 辨識文字</p>
                  <ScrollArea className="h-48 w-full rounded-lg border bg-muted/30">
                    <div className="p-3 text-xs font-mono whitespace-pre-wrap">
                      {fullText}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    共 {fullText.length} 字
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isUpdating || (!selectedSubmittedAt && !selectedIssuedAt)}
          >
            {isUpdating ? '更新中...' : '確認套用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
