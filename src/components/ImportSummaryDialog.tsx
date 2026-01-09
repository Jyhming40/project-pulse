import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, FileText, Building2 } from 'lucide-react';
import { AGENCY_CODE_TO_LABEL, getDocTypeLabelByCode } from '@/lib/docTypeMapping';
import type { ImportFileItem } from '@/hooks/useImportBatch';

interface ImportSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ImportFileItem[];
  onClear: () => void;
}

interface DocTypeStats {
  code: string;
  label: string;
  agencyCode: string;
  agencyLabel: string;
  successCount: number;
  errorCount: number;
}

export function ImportSummaryDialog({
  open,
  onOpenChange,
  items,
  onClear,
}: ImportSummaryDialogProps) {
  const summary = useMemo(() => {
    const successItems = items.filter(i => i.status === 'success');
    const errorItems = items.filter(i => i.status === 'error');
    
    // Group by doc type code
    const byDocType: Record<string, DocTypeStats> = {};
    
    [...successItems, ...errorItems].forEach(item => {
      const code = item.docTypeCode || 'OTHER_MISC';
      if (!byDocType[code]) {
        const agencyCode = item.agencyCode || 'OTHER';
        byDocType[code] = {
          code,
          label: getDocTypeLabelByCode(code),
          agencyCode,
          agencyLabel: AGENCY_CODE_TO_LABEL[agencyCode as keyof typeof AGENCY_CODE_TO_LABEL] || agencyCode,
          successCount: 0,
          errorCount: 0,
        };
      }
      
      if (item.status === 'success') {
        byDocType[code].successCount++;
      } else {
        byDocType[code].errorCount++;
      }
    });
    
    // Group stats by agency
    const byAgency: Record<string, DocTypeStats[]> = {};
    Object.values(byDocType).forEach(stat => {
      if (!byAgency[stat.agencyCode]) {
        byAgency[stat.agencyCode] = [];
      }
      byAgency[stat.agencyCode].push(stat);
    });
    
    return {
      total: items.length,
      successCount: successItems.length,
      errorCount: errorItems.length,
      byDocType: Object.values(byDocType),
      byAgency,
      errorItems,
    };
  }, [items]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleClearAndClose = () => {
    onClear();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            匯入完成
          </DialogTitle>
          <DialogDescription>
            共處理 {summary.total} 份檔案
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="w-8 h-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{summary.successCount}</p>
                <p className="text-sm text-muted-foreground">成功上傳</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{summary.errorCount}</p>
                <p className="text-sm text-muted-foreground">上傳失敗</p>
              </div>
            </div>
          </div>

          {/* By Document Type */}
          {summary.byDocType.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                各類型統計
              </h4>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {Object.entries(summary.byAgency).map(([agencyCode, stats]) => (
                    <div key={agencyCode} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {AGENCY_CODE_TO_LABEL[agencyCode as keyof typeof AGENCY_CODE_TO_LABEL] || agencyCode}
                      </p>
                      {stats.map(stat => (
                        <div
                          key={stat.code}
                          className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50"
                        >
                          <span className="text-sm">{stat.label}</span>
                          <div className="flex items-center gap-2">
                            {stat.successCount > 0 && (
                              <Badge variant="outline" className="text-success border-success/30">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {stat.successCount}
                              </Badge>
                            )}
                            {stat.errorCount > 0 && (
                              <Badge variant="outline" className="text-destructive border-destructive/30">
                                <XCircle className="w-3 h-3 mr-1" />
                                {stat.errorCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Error Details */}
          {summary.errorItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive">失敗項目</h4>
              <ScrollArea className="max-h-[120px]">
                <div className="space-y-1">
                  {summary.errorItems.map(item => (
                    <div
                      key={item.id}
                      className="text-xs p-2 rounded bg-destructive/5 border border-destructive/10"
                    >
                      <p className="font-medium truncate">{item.originalName}</p>
                      <p className="text-muted-foreground">{item.error || '發生未知錯誤'}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            保留清單
          </Button>
          <Button onClick={handleClearAndClose}>
            清除並關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}