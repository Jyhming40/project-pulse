import { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  SkipForward
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
import { useDataExport } from '@/hooks/useDataExport';
import { useDataImport, ImportStrategy } from '@/hooks/useDataImport';
import { ImportConstraintsInfo, ImportType, ImportResult, ImportRowResult } from '@/components/ImportConstraintsInfo';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  investors?: { company_name: string } | null;
};
type Investor = Database['public']['Tables']['investors']['Row'];
type Document = Database['public']['Tables']['documents']['Row'] & {
  projects?: { project_name: string; project_code: string } | null;
  profiles?: { full_name: string } | null;
};

interface ImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'projects' | 'investors' | 'documents';
  data: Project[] | Investor[] | Document[];
  onImportComplete: () => void;
}

export function ImportExportDialog({
  open,
  onOpenChange,
  type,
  data,
  onImportComplete,
}: ImportExportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('skip');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { exportProjects, exportInvestors, exportDocuments, downloadTemplate } = useDataExport();
  const { 
    isProcessing, 
    projectPreview, 
    investorPreview,
    documentPreview,
    previewProjects,
    previewInvestors,
    previewDocuments,
    importProjects,
    importInvestors,
    importDocuments,
    clearPreview,
  } = useDataImport();

  const preview = type === 'projects' ? projectPreview : type === 'investors' ? investorPreview : documentPreview;
  const title = type === 'projects' ? '案場' : type === 'investors' ? '投資方' : '文件';
  const constraintType: ImportType = type;

  const handleExport = () => {
    if (type === 'projects') {
      exportProjects(data as Project[], exportFormat);
    } else if (type === 'investors') {
      exportInvestors(data as Investor[], exportFormat);
    } else {
      exportDocuments(data as Document[], exportFormat);
    }
    onOpenChange(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);
    
    try {
      if (type === 'projects') {
        await previewProjects(file);
      } else if (type === 'investors') {
        await previewInvestors(file);
      } else {
        await previewDocuments(file);
      }
    } catch (error) {
      toast.error('檔案解析失敗', { 
        description: error instanceof Error ? error.message : '請確認檔案格式正確' 
      });
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    try {
      let result: ImportResult | undefined;
      if (type === 'projects' && projectPreview) {
        result = await importProjects(projectPreview.data, importStrategy, projectPreview.duplicates);
      } else if (type === 'investors' && investorPreview) {
        result = await importInvestors(investorPreview.data, importStrategy, investorPreview.duplicates);
      } else if (documentPreview) {
        result = await importDocuments(documentPreview.data, importStrategy, documentPreview.duplicates);
      }

      if (result) {
        setImportResult(result);
        
        const messages: string[] = [];
        if (result.inserted > 0) messages.push(`新增 ${result.inserted} 筆`);
        if (result.updated > 0) messages.push(`更新 ${result.updated} 筆`);
        if (result.skipped > 0) messages.push(`略過 ${result.skipped} 筆`);
        if (result.errors > 0) messages.push(`失敗 ${result.errors} 筆`);
        
        if (result.errors > 0) {
          toast.warning('匯入完成（部分失敗）', { description: messages.join('，') });
        } else {
          toast.success('匯入完成', { description: messages.join('，') || '無資料變更' });
        }
        
        onImportComplete();
      }
    } catch (error) {
      toast.error('匯入失敗', { 
        description: error instanceof Error ? error.message : '請稍後再試' 
      });
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    clearPreview();
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    downloadTemplate(type, exportFormat);
  };

  const getStatusIcon = (status: ImportRowResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'skipped':
        return <SkipForward className="w-4 h-4 text-warning" />;
    }
  };

  const getErrorTypeBadge = (errorType?: ImportRowResult['errorType']) => {
    if (!errorType) return null;
    const labels: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
      unique_constraint: { label: '唯一鍵', variant: 'destructive' },
      foreign_key: { label: '外鍵', variant: 'destructive' },
      validation: { label: '驗證', variant: 'secondary' },
      data_type: { label: '格式', variant: 'secondary' },
      unknown: { label: '未知', variant: 'outline' },
    };
    const config = labels[errorType] || labels.unknown;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}資料匯入/匯出</DialogTitle>
          <DialogDescription>
            匯出現有資料或從 Excel/CSV 檔案匯入資料
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="mt-4 flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="w-4 h-4" />
              匯出
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="w-4 h-4" />
              匯入
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>選擇匯出格式</Label>
              <RadioGroup 
                value={exportFormat} 
                onValueChange={(v) => setExportFormat(v as 'xlsx' | 'csv')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="xlsx" id="xlsx" />
                  <Label htmlFor="xlsx" className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-success" />
                    Excel (.xlsx)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-info" />
                    CSV (.csv)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                將匯出 {data.length} 筆{title}資料
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                匯出資料
              </Button>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 mt-4 flex-1 overflow-hidden flex flex-col">
            {/* Constraints Info */}
            <ImportConstraintsInfo type={constraintType} />

            {importResult ? (
              // Import Result View
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Result Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-success">{importResult.inserted}</p>
                    <p className="text-xs text-muted-foreground">新增成功</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-info">{importResult.updated}</p>
                    <p className="text-xs text-muted-foreground">更新成功</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{importResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">略過</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{importResult.errors}</p>
                    <p className="text-xs text-muted-foreground">失敗</p>
                  </div>
                </div>

                {/* Detailed Results */}
                {importResult.rowResults.length > 0 && (
                  <div className="flex-1 overflow-hidden">
                    <Label className="mb-2 block">匯入結果明細</Label>
                    <ScrollArea className="h-[200px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {importResult.rowResults.map((row, i) => (
                          <div 
                            key={i} 
                            className={`flex items-center gap-3 p-2 rounded text-sm ${
                              row.status === 'error' ? 'bg-destructive/10' : 
                              row.status === 'skipped' ? 'bg-warning/10' : 
                              'bg-success/10'
                            }`}
                          >
                            {getStatusIcon(row.status)}
                            <span className="font-mono text-xs text-muted-foreground w-16">
                              第 {row.row} 行
                            </span>
                            <span className="font-medium truncate max-w-[120px]" title={row.code}>
                              {row.code}
                            </span>
                            {row.field && (
                              <Badge variant="outline" className="text-xs font-mono">
                                {row.field}
                              </Badge>
                            )}
                            {getErrorTypeBadge(row.errorType)}
                            <span className="text-muted-foreground flex-1 truncate" title={row.message}>
                              {row.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    關閉
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setSelectedFile(null);
                      setImportResult(null);
                      clearPreview();
                    }}
                  >
                    重新匯入
                  </Button>
                </div>
              </div>
            ) : !preview ? (
              // File Upload View
              <>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    選擇 Excel 或 CSV 檔案
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        處理中...
                      </>
                    ) : (
                      '選擇檔案'
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>需要範本？</span>
                  <Button variant="link" className="h-auto p-0" onClick={handleDownloadTemplate}>
                    下載匯入範本
                  </Button>
                </div>
              </>
            ) : (
              // Preview View
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Preview Summary */}
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="gap-1">
                    <FileSpreadsheet className="w-3 h-3" />
                    {selectedFile?.name}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      clearPreview();
                    }}
                  >
                    重新選擇
                  </Button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-success">{preview.data.length}</p>
                    <p className="text-xs text-muted-foreground">有效資料</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-warning">{preview.duplicates.length}</p>
                    <p className="text-xs text-muted-foreground">重複資料</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{preview.errors.length}</p>
                    <p className="text-xs text-muted-foreground">驗證錯誤</p>
                  </div>
                </div>

                {/* Errors */}
                {preview.errors.length > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">以下資料有驗證錯誤，將不會匯入：</p>
                      <ScrollArea className="h-20">
                        <ul className="text-xs space-y-1">
                          {preview.errors.map((err, i) => (
                            <li key={i}>{err.message}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Import Strategy Selection */}
                <div className="space-y-3">
                  <Label>匯入模式</Label>
                  <RadioGroup 
                    value={importStrategy} 
                    onValueChange={(v) => setImportStrategy(v as ImportStrategy)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-3">
                      <RadioGroupItem value="insert_only" id="insert_only" />
                      <Label htmlFor="insert_only" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">僅新增 (Insert Only)</p>
                          <Badge variant="outline" className="text-xs">嚴格模式</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          遇到重複資料視為錯誤，不進行任何寫入
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3">
                      <RadioGroupItem value="skip" id="skip" />
                      <Label htmlFor="skip" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">略過重複 (Skip Duplicates)</p>
                          <Badge variant="secondary" className="text-xs">安全模式</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          保留現有資料，只新增不重複的項目
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3">
                      <RadioGroupItem value="update" id="update" />
                      <Label htmlFor="update" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">更新現有 (Upsert)</p>
                          <Badge variant="outline" className="text-xs text-warning border-warning">覆寫模式</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          以匯入資料覆蓋現有的重複項目
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Duplicates Preview */}
                {preview.duplicates.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <Label>偵測到 {preview.duplicates.length} 筆重複資料</Label>
                    </div>
                    <ScrollArea className="h-20 border rounded-lg p-2">
                      <div className="space-y-1">
                        {preview.duplicates.map((dup, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <AlertCircle className="w-3 h-3 text-warning" />
                            <span className="font-mono">第 {dup.row} 行</span>
                            <span className="font-medium">{dup.code}</span>
                            <span className="text-muted-foreground">已存在於系統中</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Import button */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    取消
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={isProcessing || preview.data.length === 0}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        匯入中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        確認匯入
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
