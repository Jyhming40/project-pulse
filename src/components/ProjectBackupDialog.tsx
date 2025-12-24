import { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  SkipForward,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useProjectBackup, ImportMode, ImportError } from '@/hooks/useProjectBackup';

interface ProjectBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ProjectBackupDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ProjectBackupDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('upsert');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    isProcessing,
    progress,
    importSummary,
    exportFullBackup,
    downloadTemplate,
    importFullBackup,
    downloadErrorReport,
    clearSummary,
  } = useProjectBackup();

  const handleExport = async () => {
    await exportFullBackup();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      await importFullBackup(selectedFile, importMode);
      onImportComplete();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setSelectedFile(null);
    clearSummary();
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
    clearSummary();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getErrorTypeBadge = (errorType: ImportError['errorType']) => {
    const labels: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
      unique_constraint: { label: '重複', variant: 'destructive' },
      foreign_key: { label: '關聯', variant: 'destructive' },
      validation: { label: '驗證', variant: 'secondary' },
      data_type: { label: '格式', variant: 'secondary' },
      not_found: { label: '找不到', variant: 'destructive' },
      unknown: { label: '未知', variant: 'outline' },
    };
    const config = labels[errorType] || labels.unknown;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>案場資料完整備份 / 還原</DialogTitle>
          <DialogDescription>
            匯出所有案場資料（含歷程、文件）或從備份檔還原
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="mt-4 flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2" disabled={isProcessing}>
              <Download className="w-4 h-4" />
              完整匯出
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2" disabled={isProcessing}>
              <Upload className="w-4 h-4" />
              還原匯入
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-4">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  將匯出包含以下工作表的 Excel 檔案：
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li><strong>案場主表</strong>：所有案場基本資料與欄位</li>
                    <li><strong>狀態歷程</strong>：專案狀態變更紀錄</li>
                    <li><strong>施工歷程</strong>：施工狀態變更紀錄</li>
                    <li><strong>文件</strong>：文件資料（不含附件檔案）</li>
                    <li><strong>文件附件</strong>：附件清單（檔案需另行備份）</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert variant="default" className="bg-info/10 border-info/30">
                <AlertCircle className="h-4 w-4 text-info" />
                <AlertDescription className="text-sm">
                  日期格式統一為 <code className="bg-muted px-1 rounded">YYYY-MM-DD</code>（ISO 格式），便於跨系統匯入。
                </AlertDescription>
              </Alert>

              {isProcessing && progress.phase === 'exporting' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>正在匯出：{progress.currentSheet}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                取消
              </Button>
              <Button onClick={handleExport} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    匯出中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    匯出完整備份
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 mt-4 flex-1 overflow-hidden flex flex-col">
            {importSummary ? (
              // Import Result View
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Result Summary by Category */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-success">
                      {importSummary.projects.inserted + importSummary.statusHistory.inserted + importSummary.constructionHistory.inserted + importSummary.documents.inserted}
                    </p>
                    <p className="text-xs text-muted-foreground">新增成功</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-info">
                      {importSummary.projects.updated + importSummary.statusHistory.updated + importSummary.constructionHistory.updated + importSummary.documents.updated}
                    </p>
                    <p className="text-xs text-muted-foreground">更新成功</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-warning">
                      {importSummary.projects.skipped + importSummary.statusHistory.skipped + importSummary.constructionHistory.skipped + importSummary.documents.skipped}
                    </p>
                    <p className="text-xs text-muted-foreground">略過</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-destructive">
                      {importSummary.projects.errors + importSummary.statusHistory.errors + importSummary.constructionHistory.errors + importSummary.documents.errors}
                    </p>
                    <p className="text-xs text-muted-foreground">失敗</p>
                  </div>
                </div>

                {/* Breakdown by Sheet */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="border rounded p-2">
                    <p className="font-medium mb-1">案場</p>
                    <p className="text-success">+{importSummary.projects.inserted}</p>
                    <p className="text-info">↻{importSummary.projects.updated}</p>
                    <p className="text-destructive">✗{importSummary.projects.errors}</p>
                  </div>
                  <div className="border rounded p-2">
                    <p className="font-medium mb-1">狀態歷程</p>
                    <p className="text-success">+{importSummary.statusHistory.inserted}</p>
                    <p className="text-info">↻{importSummary.statusHistory.updated}</p>
                    <p className="text-destructive">✗{importSummary.statusHistory.errors}</p>
                  </div>
                  <div className="border rounded p-2">
                    <p className="font-medium mb-1">施工歷程</p>
                    <p className="text-success">+{importSummary.constructionHistory.inserted}</p>
                    <p className="text-info">↻{importSummary.constructionHistory.updated}</p>
                    <p className="text-destructive">✗{importSummary.constructionHistory.errors}</p>
                  </div>
                  <div className="border rounded p-2">
                    <p className="font-medium mb-1">文件</p>
                    <p className="text-success">+{importSummary.documents.inserted}</p>
                    <p className="text-info">↻{importSummary.documents.updated}</p>
                    <p className="text-destructive">✗{importSummary.documents.errors}</p>
                  </div>
                </div>

                {/* Error List */}
                {importSummary.errorList.length > 0 && (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <Label>錯誤明細（共 {importSummary.errorList.length} 筆）</Label>
                      <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                        <FileDown className="w-4 h-4 mr-1" />
                        下載錯誤報告
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 border rounded-lg">
                      <div className="p-2 space-y-1">
                        {importSummary.errorList.slice(0, 100).map((err, i) => (
                          <div 
                            key={i} 
                            className="flex items-center gap-2 p-2 rounded text-sm bg-destructive/10"
                          >
                            <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                            <Badge variant="outline" className="text-xs">
                              {err.sheet}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground w-14 flex-shrink-0">
                              第{err.row}行
                            </span>
                            {err.code && (
                              <span className="font-medium truncate max-w-[100px]" title={err.code}>
                                {err.code}
                              </span>
                            )}
                            {err.field && (
                              <Badge variant="secondary" className="text-xs font-mono">
                                {err.field}
                              </Badge>
                            )}
                            {getErrorTypeBadge(err.errorType)}
                            <span className="text-muted-foreground flex-1 truncate" title={err.message}>
                              {err.message}
                            </span>
                          </div>
                        ))}
                        {importSummary.errorList.length > 100 && (
                          <p className="text-center text-sm text-muted-foreground py-2">
                            顯示前 100 筆，共 {importSummary.errorList.length} 筆錯誤
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    關閉
                  </Button>
                  <Button variant="secondary" onClick={handleReset}>
                    重新匯入
                  </Button>
                </div>
              </div>
            ) : !selectedFile ? (
              // File Selection View
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>匯入模式說明：</strong>
                    <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                      <li><strong>Upsert（推薦）</strong>：有則更新、無則新增</li>
                      <li><strong>Insert</strong>：僅新增，重複資料會報錯</li>
                      <li><strong>Skip</strong>：重複資料自動跳過</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Label>選擇匯入模式</Label>
                  <RadioGroup 
                    value={importMode} 
                    onValueChange={(v) => setImportMode(v as ImportMode)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="upsert" id="upsert" />
                      <Label htmlFor="upsert" className="cursor-pointer">
                        Upsert（有則更新）
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="insert" id="insert" />
                      <Label htmlFor="insert" className="cursor-pointer">
                        Insert（僅新增）
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="skip" id="skip" />
                      <Label htmlFor="skip" className="cursor-pointer">
                        Skip（跳過重複）
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    選擇備份 Excel 檔案（.xlsx）
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    選擇檔案
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>需要範本？</span>
                  <Button variant="link" className="h-auto p-0" onClick={downloadTemplate}>
                    下載匯入範本
                  </Button>
                </div>
              </>
            ) : (
              // File Selected - Confirmation View
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="gap-1">
                    <FileSpreadsheet className="w-3 h-3" />
                    {selectedFile.name}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleReset}
                    disabled={isProcessing}
                  >
                    重新選擇
                  </Button>
                </div>

                <Alert variant="default" className="bg-warning/10 border-warning/30">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription>
                    <strong>即將以「{importMode === 'upsert' ? 'Upsert' : importMode === 'insert' ? 'Insert' : 'Skip'}」模式匯入。</strong>
                    <br />
                    {importMode === 'upsert' && '現有資料若ID或編號相符將會被更新。'}
                    {importMode === 'insert' && '重複資料將會報錯，不會覆蓋現有資料。'}
                    {importMode === 'skip' && '重複資料將自動跳過，僅新增不存在的資料。'}
                  </AlertDescription>
                </Alert>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        正在匯入：{progress.currentSheet}
                      </span>
                      <span>{progress.current}/{progress.total}</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                    取消
                  </Button>
                  <Button onClick={handleImport} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        匯入中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        開始匯入
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
