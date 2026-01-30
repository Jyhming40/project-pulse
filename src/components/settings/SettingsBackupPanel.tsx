import { useState } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Download,
  Trash2,
  CloudUpload,
  Clock,
  HardDrive,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  FileSpreadsheet,
  FileJson,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettingsBackup } from '@/hooks/useSettingsBackup';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parseBackupDate(timestamp: string): Date | null {
  // Format: 2024-01-30T12-30-45
  try {
    const dateStr = timestamp.replace(/-/g, (m, i) => (i > 9 ? ':' : m)).replace('T', 'T');
    return new Date(dateStr.slice(0, 10) + 'T' + dateStr.slice(11).replace(/-/g, ':'));
  } catch {
    return null;
  }
}

const TABLE_LABELS: Record<string, string> = {
  system_options: 'Codebook 選項',
  document_type_config: '文件類型設定',
  departments: '部門設定',
  process_stages: '流程階段',
  stage_responsibilities: '階段責任分配',
  progress_milestones: '進度里程碑',
  progress_settings: '進度設定',
  quote_engineering_presets: '報價工程預設',
  system_tariff_rates: '電價費率',
  deletion_policies: '刪除策略',
  app_settings: '系統品牌設定',
  document_tags: '文件標籤',
  payment_milestones: '付款里程碑',
  project_custom_fields: '專案自訂欄位',
  project_field_config: '專案欄位設定',
  milestone_notification_settings: '里程碑通知設定',
  ai_settings: 'AI 設定',
};

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backup: { timestamp: string; json_file: string | null } | null;
  onRestore: (filePath: string, tables?: string[]) => void;
  isRestoring: boolean;
  previewBackup: (filePath: string) => Promise<any>;
}

function RestoreDialog({ open, onOpenChange, backup, onRestore, isRestoring, previewBackup }: RestoreDialogProps) {
  const [preview, setPreview] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  const handleOpen = async (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && backup?.json_file) {
      setIsLoadingPreview(true);
      const data = await previewBackup(backup.json_file);
      setPreview(data);
      if (data?.tables) {
        setSelectedTables(data.tables.map((t: any) => t.name));
      }
      setIsLoadingPreview(false);
    } else {
      setPreview(null);
      setSelectedTables([]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked && preview?.tables) {
      setSelectedTables(preview.tables.map((t: any) => t.name));
    } else {
      setSelectedTables([]);
    }
  };

  const handleTableToggle = (tableName: string, checked: boolean) => {
    if (checked) {
      setSelectedTables(prev => [...prev, tableName]);
    } else {
      setSelectedTables(prev => prev.filter(t => t !== tableName));
      setSelectAll(false);
    }
  };

  const handleRestore = () => {
    if (backup?.json_file) {
      onRestore(backup.json_file, selectAll ? undefined : selectedTables);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            還原系統設定
          </DialogTitle>
          <DialogDescription>
            從備份還原系統設定資料。此操作將覆蓋現有設定。
          </DialogDescription>
        </DialogHeader>

        {isLoadingPreview ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : preview ? (
          <div className="space-y-4 py-4">
            {/* Backup Info */}
            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
              <p><strong>備份時間：</strong>{format(new Date(preview.backup_info.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</p>
              <p><strong>建立者：</strong>{preview.backup_info.created_by}</p>
              <p><strong>資料筆數：</strong>{Object.values(preview.backup_info.record_counts as Record<string, number>).reduce((a, b) => a + b, 0)} 筆</p>
            </div>

            {/* Table Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-medium">全部選取</Label>
              </div>

              <ScrollArea className="h-64 border rounded-lg p-3">
                <div className="space-y-2">
                  {preview.tables.map((table: { name: string; count: number }) => (
                    <div key={table.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={table.name}
                          checked={selectedTables.includes(table.name)}
                          onCheckedChange={(checked) => handleTableToggle(table.name, !!checked)}
                        />
                        <Label htmlFor={table.name} className="text-sm">
                          {TABLE_LABELS[table.name] || table.name}
                        </Label>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {table.count} 筆
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-5 h-5 mt-0.5 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">注意事項</p>
                <p className="text-muted-foreground">
                  還原操作將會刪除所選資料表的現有資料，並以備份資料取代。此操作無法復原。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            無法載入備份內容
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRestoring}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleRestore}
            disabled={isRestoring || !preview || selectedTables.length === 0}
          >
            {isRestoring ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                還原中...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                確認還原 ({selectedTables.length} 個資料表)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsBackupPanel() {
  const {
    backups,
    schedule,
    isLoadingBackups,
    isLoadingSchedule,
    isDownloading,
    createBackup,
    deleteBackup,
    updateSchedule,
    downloadBackup,
    previewBackup,
    restoreBackup,
    refetchBackups,
  } = useSettingsBackup();

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<any>(null);

  const handleScheduleChange = (value: string) => {
    updateSchedule.mutate(value as 'manual' | 'daily' | 'weekly');
  };

  const handleOpenRestore = (backup: any) => {
    setSelectedBackup(backup);
    setRestoreDialogOpen(true);
  };

  const handleRestore = (filePath: string, tables?: string[]) => {
    restoreBackup.mutate(
      { filePath, tables },
      {
        onSuccess: () => {
          setRestoreDialogOpen(false);
          setSelectedBackup(null);
        },
      }
    );
  };

  const frequencyLabels: Record<string, string> = {
    manual: '僅手動備份',
    daily: '每日自動備份',
    weekly: '每週自動備份',
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            系統設定備份
          </CardTitle>
          <CardDescription>
            定期備份系統設定資料，防止資料遺失。系統最多保留 3 份最新備份。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={() => createBackup.mutate('manual')}
              disabled={createBackup.isPending}
            >
              {createBackup.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4 mr-2" />
              )}
              立即備份
            </Button>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">排程：</span>
              {isLoadingSchedule ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <Select
                  value={schedule?.frequency || 'manual'}
                  onValueChange={handleScheduleChange}
                  disabled={updateSchedule.isPending}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">僅手動備份</SelectItem>
                    <SelectItem value="daily">每日自動備份</SelectItem>
                    <SelectItem value="weekly">每週自動備份</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchBackups()}
              disabled={isLoadingBackups}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingBackups ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Backup Info */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p>備份內容包含：Codebook 選項、文件類型設定、部門設定、流程階段、責任分配、進度里程碑、報價預設值、電價設定等所有系統設定資料。</p>
              <p className="mt-1">每次備份會同時產生 <Badge variant="outline" className="mx-1"><FileSpreadsheet className="w-3 h-3 inline mr-1" />Excel</Badge> 和 <Badge variant="outline" className="mx-1"><FileJson className="w-3 h-3 inline mr-1" />JSON</Badge> 兩種格式。</p>
              {schedule?.frequency !== 'manual' && (
                <p className="mt-1">
                  <Badge variant="outline" className="mr-1">
                    {frequencyLabels[schedule?.frequency || 'manual']}
                  </Badge>
                  自動備份將在凌晨 3:00 執行
                </p>
              )}
            </div>
          </div>

          {/* Backup List */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              現有備份（最多保留 3 份）
            </h4>

            {isLoadingBackups ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>尚無備份檔案</p>
                <p className="text-sm">點擊「立即備份」建立第一份備份</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>備份時間</TableHead>
                    <TableHead>檔案大小</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup, index) => {
                    const backupDate = parseBackupDate(backup.timestamp);
                    return (
                      <TableRow key={backup.timestamp}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {index === 0 && (
                              <Badge variant="secondary" className="text-xs">
                                最新
                              </Badge>
                            )}
                            {backupDate
                              ? format(backupDate, 'yyyy/MM/dd HH:mm', { locale: zhTW })
                              : backup.timestamp}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-3">
                            {backup.excel_file && (
                              <span className="flex items-center gap-1">
                                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                {formatFileSize(backup.excel_size)}
                              </span>
                            )}
                            {backup.json_file && (
                              <span className="flex items-center gap-1">
                                <FileJson className="w-4 h-4 text-blue-600" />
                                {formatFileSize(backup.json_size)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* Download Excel */}
                            {backup.excel_file && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadBackup(backup.excel_file!)}
                                disabled={isDownloading}
                                title="下載 Excel"
                              >
                                <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
                                Excel
                              </Button>
                            )}

                            {/* Download JSON */}
                            {backup.json_file && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadBackup(backup.json_file!)}
                                disabled={isDownloading}
                                title="下載 JSON"
                              >
                                <FileJson className="w-4 h-4 mr-1 text-blue-600" />
                                JSON
                              </Button>
                            )}

                            {/* Restore */}
                            {backup.can_restore && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRestore(backup)}
                                className="text-primary"
                                title="還原此備份"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                還原
                              </Button>
                            )}

                            {/* Delete */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確定要刪除此備份？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    此操作無法復原。刪除後將無法還原此時間點的設定資料。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteBackup.mutate(backup.excel_file || backup.json_file!)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    確定刪除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        backup={selectedBackup}
        onRestore={handleRestore}
        isRestoring={restoreBackup.isPending}
        previewBackup={previewBackup}
      />
    </>
  );
}
