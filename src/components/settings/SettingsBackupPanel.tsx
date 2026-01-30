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
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsBackup } from '@/hooks/useSettingsBackup';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parseBackupDate(fileName: string): Date | null {
  // Format: settings_backup_2024-01-30T12-30-45.json
  const match = fileName.match(/settings_backup_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.json/);
  if (!match) return null;
  const dateStr = match[1].replace(/-/g, (m, i) => (i > 9 ? ':' : m)).replace('T', 'T');
  return new Date(dateStr.slice(0, 10) + 'T' + dateStr.slice(11).replace(/-/g, ':'));
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
    refetchBackups,
  } = useSettingsBackup();

  const [selectedFrequency, setSelectedFrequency] = useState<string>(
    schedule?.frequency || 'manual'
  );

  const handleScheduleChange = (value: string) => {
    setSelectedFrequency(value);
    updateSchedule.mutate(value as 'manual' | 'daily' | 'weekly');
  };

  const frequencyLabels: Record<string, string> = {
    manual: '僅手動備份',
    daily: '每日自動備份',
    weekly: '每週自動備份',
  };

  return (
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
                  const backupDate = parseBackupDate(backup.name);
                  return (
                    <TableRow key={backup.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              最新
                            </Badge>
                          )}
                          {backupDate
                            ? format(backupDate, 'yyyy/MM/dd HH:mm', { locale: zhTW })
                            : backup.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(backup.size)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadBackup(backup.name)}
                            disabled={isDownloading}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            下載
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                刪除
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
                                  onClick={() => deleteBackup.mutate(backup.name)}
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
  );
}
