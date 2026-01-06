import { useState } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeftRight,
  Calendar,
  FileText,
  User,
  MessageSquare,
  Plus,
  Minus,
  Equal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentVersion {
  id: string;
  version: number | null;
  doc_type: string;
  title: string | null;
  note: string | null;
  submitted_at: string | null;
  issued_at: string | null;
  due_at: string | null;
  created_at: string;
  is_current: boolean | null;
  owner?: { full_name?: string } | null;
}

interface DocumentVersionCompareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DocumentVersion[];
}

type CompareResult = 'added' | 'removed' | 'changed' | 'unchanged';

interface FieldComparison {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  oldValue: string;
  newValue: string;
  result: CompareResult;
}

export function DocumentVersionCompare({
  open,
  onOpenChange,
  versions,
}: DocumentVersionCompareProps) {
  const [leftVersionId, setLeftVersionId] = useState<string>('');
  const [rightVersionId, setRightVersionId] = useState<string>('');

  const leftVersion = versions.find(v => v.id === leftVersionId);
  const rightVersion = versions.find(v => v.id === rightVersionId);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'yyyy/MM/dd', { locale: zhTW });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: zhTW });
  };

  const getCompareResult = (oldVal: string, newVal: string): CompareResult => {
    if (oldVal === '-' && newVal !== '-') return 'added';
    if (oldVal !== '-' && newVal === '-') return 'removed';
    if (oldVal !== newVal) return 'changed';
    return 'unchanged';
  };

  const getComparisonData = (): FieldComparison[] => {
    if (!leftVersion || !rightVersion) return [];

    const fields: FieldComparison[] = [
      {
        label: '標題',
        icon: FileText,
        oldValue: leftVersion.title || '-',
        newValue: rightVersion.title || '-',
        result: getCompareResult(leftVersion.title || '-', rightVersion.title || '-'),
      },
      {
        label: '送件日',
        icon: Calendar,
        oldValue: formatDate(leftVersion.submitted_at),
        newValue: formatDate(rightVersion.submitted_at),
        result: getCompareResult(
          formatDate(leftVersion.submitted_at),
          formatDate(rightVersion.submitted_at)
        ),
      },
      {
        label: '核發日',
        icon: Calendar,
        oldValue: formatDate(leftVersion.issued_at),
        newValue: formatDate(rightVersion.issued_at),
        result: getCompareResult(
          formatDate(leftVersion.issued_at),
          formatDate(rightVersion.issued_at)
        ),
      },
      {
        label: '到期日',
        icon: Calendar,
        oldValue: formatDate(leftVersion.due_at),
        newValue: formatDate(rightVersion.due_at),
        result: getCompareResult(
          formatDate(leftVersion.due_at),
          formatDate(rightVersion.due_at)
        ),
      },
      {
        label: '備註',
        icon: MessageSquare,
        oldValue: leftVersion.note || '-',
        newValue: rightVersion.note || '-',
        result: getCompareResult(leftVersion.note || '-', rightVersion.note || '-'),
      },
      {
        label: '負責人',
        icon: User,
        oldValue: leftVersion.owner?.full_name || '-',
        newValue: rightVersion.owner?.full_name || '-',
        result: getCompareResult(
          leftVersion.owner?.full_name || '-',
          rightVersion.owner?.full_name || '-'
        ),
      },
      {
        label: '建立時間',
        icon: Calendar,
        oldValue: formatDateTime(leftVersion.created_at),
        newValue: formatDateTime(rightVersion.created_at),
        result: 'unchanged', // Always different for versions
      },
    ];

    return fields;
  };

  const getResultIcon = (result: CompareResult) => {
    switch (result) {
      case 'added':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-destructive" />;
      case 'changed':
        return <ArrowLeftRight className="w-4 h-4 text-yellow-500" />;
      default:
        return <Equal className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getResultBadge = (result: CompareResult) => {
    switch (result) {
      case 'added':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">新增</Badge>;
      case 'removed':
        return <Badge variant="destructive">移除</Badge>;
      case 'changed':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">變更</Badge>;
      default:
        return null;
    }
  };

  const changedCount = getComparisonData().filter(f => f.result !== 'unchanged').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            版本比較
          </DialogTitle>
          <DialogDescription>
            選擇兩個版本進行差異比較
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">舊版本</label>
            <Select value={leftVersionId} onValueChange={setLeftVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇版本..." />
              </SelectTrigger>
              <SelectContent>
                {versions
                  .filter(v => v.id !== rightVersionId)
                  .map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      版本 {v.version || 1}{' '}
                      <span className="text-muted-foreground">
                        ({formatDateTime(v.created_at)})
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">新版本</label>
            <Select value={rightVersionId} onValueChange={setRightVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇版本..." />
              </SelectTrigger>
              <SelectContent>
                {versions
                  .filter(v => v.id !== leftVersionId)
                  .map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      版本 {v.version || 1}
                      {v.is_current && ' (目前)'}{' '}
                      <span className="text-muted-foreground">
                        ({formatDateTime(v.created_at)})
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {leftVersion && rightVersion ? (
          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">比較結果</span>
                <Badge variant="outline">
                  {changedCount > 0
                    ? `${changedCount} 處差異`
                    : '無差異'}
                </Badge>
              </div>

              <div className="space-y-2">
                {getComparisonData().map((field, index) => {
                  const Icon = field.icon;
                  const hasChange = field.result !== 'unchanged';

                  return (
                    <div
                      key={index}
                      className={cn(
                        'grid grid-cols-[120px_1fr_auto_1fr] gap-3 p-3 rounded-lg border',
                        hasChange ? 'bg-muted/30' : 'bg-background'
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        {field.label}
                      </div>

                      <div
                        className={cn(
                          'text-sm p-2 rounded bg-muted/50 break-words',
                          field.result === 'removed' && 'line-through text-muted-foreground',
                          field.result === 'changed' && 'border-l-2 border-yellow-400'
                        )}
                      >
                        {field.oldValue}
                      </div>

                      <div className="flex items-center justify-center w-8">
                        {getResultIcon(field.result)}
                      </div>

                      <div
                        className={cn(
                          'text-sm p-2 rounded bg-muted/50 break-words',
                          field.result === 'added' && 'bg-green-50 dark:bg-green-950/30',
                          field.result === 'changed' && 'border-l-2 border-green-400 bg-green-50 dark:bg-green-950/30'
                        )}
                      >
                        {field.newValue}
                        {getResultBadge(field.result) && (
                          <span className="ml-2 inline-block">
                            {getResultBadge(field.result)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            請選擇兩個版本進行比較
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
