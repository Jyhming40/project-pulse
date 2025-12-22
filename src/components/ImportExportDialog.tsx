import { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2
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
import { useDataImport, ImportStrategy, ImportPreview } from '@/hooks/useDataImport';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  investors?: { company_name: string } | null;
};
type Investor = Database['public']['Tables']['investors']['Row'];

interface ImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'projects' | 'investors';
  data: Project[] | Investor[];
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

  const { exportProjects, exportInvestors, downloadTemplate } = useDataExport();
  const { 
    isProcessing, 
    projectPreview, 
    investorPreview,
    previewProjects,
    previewInvestors,
    importProjects,
    importInvestors,
    clearPreview,
  } = useDataImport();

  const preview = type === 'projects' ? projectPreview : investorPreview;
  const title = type === 'projects' ? '案場' : '投資方';

  const handleExport = () => {
    if (type === 'projects') {
      exportProjects(data as Project[], exportFormat);
    } else {
      exportInvestors(data as Investor[], exportFormat);
    }
    onOpenChange(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    try {
      if (type === 'projects') {
        await previewProjects(file);
      } else {
        await previewInvestors(file);
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
      let result;
      if (type === 'projects' && projectPreview) {
        result = await importProjects(projectPreview.data, importStrategy, projectPreview.duplicates);
      } else if (investorPreview) {
        result = await importInvestors(investorPreview.data, importStrategy, investorPreview.duplicates);
      }

      if (result) {
        const messages: string[] = [];
        if (result.inserted > 0) messages.push(`新增 ${result.inserted} 筆`);
        if (result.updated > 0) messages.push(`更新 ${result.updated} 筆`);
        
        toast.success('匯入完成', { description: messages.join('，') || '無資料變更' });
        onImportComplete();
        handleClose();
      }
    } catch (error) {
      toast.error('匯入失敗', { 
        description: error instanceof Error ? error.message : '請稍後再試' 
      });
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    clearPreview();
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    downloadTemplate(type, exportFormat);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}資料匯入/匯出</DialogTitle>
          <DialogDescription>
            匯出現有資料或從 Excel/CSV 檔案匯入資料
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="mt-4">
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
          <TabsContent value="import" className="space-y-4 mt-4">
            {!preview ? (
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
              <div className="space-y-4">
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
                    <p className="text-xs text-muted-foreground">錯誤</p>
                  </div>
                </div>

                {/* Errors */}
                {preview.errors.length > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">以下資料有錯誤，將不會匯入：</p>
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

                {/* Duplicates handling */}
                {preview.duplicates.length > 0 && (
                  <div className="space-y-3">
                    <Label>重複資料處理方式</Label>
                    <RadioGroup 
                      value={importStrategy} 
                      onValueChange={(v) => setImportStrategy(v as ImportStrategy)}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-3">
                        <RadioGroupItem value="skip" id="skip" />
                        <Label htmlFor="skip" className="flex-1 cursor-pointer">
                          <p className="font-medium">跳過重複</p>
                          <p className="text-xs text-muted-foreground">
                            保留現有資料，只新增不重複的項目
                          </p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-3">
                        <RadioGroupItem value="update" id="update" />
                        <Label htmlFor="update" className="flex-1 cursor-pointer">
                          <p className="font-medium">更新現有</p>
                          <p className="text-xs text-muted-foreground">
                            以匯入資料覆蓋現有的重複項目
                          </p>
                        </Label>
                      </div>
                    </RadioGroup>
                    
                    <ScrollArea className="h-20 border rounded-lg p-2">
                      <div className="space-y-1">
                        {preview.duplicates.map((dup, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <AlertCircle className="w-3 h-3 text-warning" />
                            <span>第 {dup.row} 行：{dup.code} 已存在</span>
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
