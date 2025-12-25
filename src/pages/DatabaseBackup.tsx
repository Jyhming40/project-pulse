import { useState, useRef, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDatabaseBackup, ImportMode, TableInfo } from '@/hooks/useDatabaseBackup';
import { toast } from 'sonner';

export default function DatabaseBackup() {
  const {
    isProcessing,
    tables,
    exportProgress,
    importProgress,
    importResults,
    discoverSchema,
    toggleTableSelection,
    selectAllTables,
    exportToExcel,
    importFromFile,
    parseImportFile,
    downloadErrorReport,
    getUpsertKeySuggestion,
    resetProgress,
    UPSERT_KEY_SUGGESTIONS
  } = useDatabaseBackup();

  const [importMode, setImportMode] = useState<ImportMode>('upsert');
  const [upsertKeys, setUpsertKeys] = useState<Record<string, string>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ sheets: Record<string, any[]>; meta: any } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load schema on mount
  useEffect(() => {
    discoverSchema();
  }, [discoverSchema]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    
    try {
      const preview = await parseImportFile(file);
      setImportPreview(preview);
      
      // Initialize upsert keys with suggestions
      const keys: Record<string, string> = {};
      for (const tableName of Object.keys(preview.sheets)) {
        if (tableName !== '__meta') {
          keys[tableName] = getUpsertKeySuggestion(tableName);
        }
      }
      setUpsertKeys(keys);
      
      setShowImportDialog(true);
    } catch (err) {
      toast.error('無法解析檔案');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setShowImportDialog(false);
    await importFromFile(importFile, importMode, upsertKeys);
    
    // Refresh schema to update row counts
    await discoverSchema();
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setImportFile(null);
    setImportPreview(null);
  };

  const selectedCount = tables.filter(t => t.selected).length;
  const totalRows = tables.filter(t => t.selected).reduce((sum, t) => sum + t.row_count, 0);
  const allSelected = tables.length > 0 && tables.every(t => t.selected);

  const exportPercentage = exportProgress.rows_total > 0 
    ? Math.round((exportProgress.rows_done / exportProgress.rows_total) * 100) 
    : 0;
  
  const importPercentage = importProgress.rows_total > 0 
    ? Math.round((importProgress.rows_done / importProgress.rows_total) * 100) 
    : 0;

  const totalErrors = importResults.reduce((sum, r) => sum + r.errors.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Database className="w-6 h-6" />
          資料庫匯出/匯入
        </h1>
        <p className="text-muted-foreground mt-1">完整資料庫備份與還原（Admin 專用）</p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
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
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>選擇要匯出的資料表</span>
                <Button variant="outline" size="sm" onClick={() => discoverSchema()} disabled={isProcessing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                  重新整理
                </Button>
              </CardTitle>
              <CardDescription>
                勾選要匯出的資料表，每個表將成為 Excel 中的一個工作表
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select All */}
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                  onClick={() => selectAllTables(!allSelected)}
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {allSelected ? '取消全選' : '全選'}
                </button>
                <Badge variant="secondary">
                  已選 {selectedCount} 個表，共 {totalRows.toLocaleString()} 筆
                </Badge>
              </div>

              <Separator />

              {/* Table List */}
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>資料表名稱</TableHead>
                      <TableHead className="text-right">資料筆數</TableHead>
                      <TableHead>欄位數</TableHead>
                      <TableHead>建議 Upsert Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.map((table) => (
                      <TableRow key={table.table_name}>
                        <TableCell>
                          <Checkbox
                            checked={table.selected}
                            onCheckedChange={() => toggleTableSelection(table.table_name)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{table.table_name}</TableCell>
                        <TableCell className="text-right">{table.row_count.toLocaleString()}</TableCell>
                        <TableCell>{table.columns.length}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {UPSERT_KEY_SUGGESTIONS[table.table_name] || 'id'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {tables.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {isProcessing ? '正在讀取資料庫結構...' : '沒有資料表'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Export Progress */}
              {exportProgress.phase !== 'idle' && (
                <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {exportProgress.phase === 'discovering' && '正在讀取資料庫結構...'}
                      {exportProgress.phase === 'exporting' && `正在匯出 ${exportProgress.current_table}...`}
                      {exportProgress.phase === 'complete' && '匯出完成！'}
                    </span>
                    <span>{exportPercentage}%</span>
                  </div>
                  <Progress value={exportPercentage} />
                  <p className="text-xs text-muted-foreground">
                    {exportProgress.tables_done} / {exportProgress.tables_total} 表，
                    {exportProgress.rows_done.toLocaleString()} / {exportProgress.rows_total.toLocaleString()} 筆
                  </p>
                </div>
              )}

              {/* Export Button */}
              <div className="flex gap-2">
                <Button 
                  onClick={exportToExcel} 
                  disabled={isProcessing || selectedCount === 0}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  匯出為 Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>匯入資料</CardTitle>
              <CardDescription>
                從 Excel 檔案匯入資料，支援多個工作表同時匯入
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Import Mode */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>匯入模式</Label>
                  <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insert">Insert（僅新增）</SelectItem>
                      <SelectItem value="upsert">Upsert（新增或更新）</SelectItem>
                      <SelectItem value="skip">Skip Duplicates（跳過重複）</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {importMode === 'insert' && '僅新增資料，遇到重複 key 會報錯'}
                    {importMode === 'upsert' && '若 key 已存在則更新，否則新增'}
                    {importMode === 'skip' && '若 key 已存在則跳過，否則新增'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* File Upload */}
              <div className="space-y-2">
                <Label>選擇 Excel 檔案</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  支援 .xlsx / .xls 格式，每個工作表名稱需對應資料表名稱
                </p>
              </div>

              {/* Import Progress */}
              {importProgress.phase !== 'idle' && (
                <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {importProgress.phase === 'validating' && '正在驗證資料...'}
                      {importProgress.phase === 'importing' && `正在匯入 ${importProgress.current_table}...`}
                      {importProgress.phase === 'complete' && '匯入完成！'}
                    </span>
                    <span>{importPercentage}%</span>
                  </div>
                  <Progress value={importPercentage} />
                  <p className="text-xs text-muted-foreground">
                    {importProgress.tables_done} / {importProgress.tables_total} 表，
                    {importProgress.rows_done.toLocaleString()} / {importProgress.rows_total.toLocaleString()} 筆
                  </p>
                </div>
              )}

              {/* Import Results */}
              {importResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">匯入結果</h4>
                    {totalErrors > 0 && (
                      <Button variant="outline" size="sm" onClick={downloadErrorReport} className="gap-2">
                        <FileDown className="w-4 h-4" />
                        下載錯誤報告 ({totalErrors})
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>資料表</TableHead>
                          <TableHead className="text-right">新增</TableHead>
                          <TableHead className="text-right">更新</TableHead>
                          <TableHead className="text-right">略過</TableHead>
                          <TableHead className="text-right">錯誤</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResults.map((result) => (
                          <TableRow key={result.table}>
                            <TableCell className="font-mono text-sm">{result.table}</TableCell>
                            <TableCell className="text-right text-success">{result.inserted}</TableCell>
                            <TableCell className="text-right text-primary">{result.updated}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{result.skipped}</TableCell>
                            <TableCell className="text-right">
                              {result.errors.length > 0 ? (
                                <Badge variant="destructive">{result.errors.length}</Badge>
                              ) : (
                                <Badge variant="secondary">0</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>匯入說明</AlertTitle>
            <AlertDescription className="space-y-2">
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Excel 中每個工作表名稱需與資料表名稱完全一致（如 projects、investors）</li>
                <li>第一列為欄位名稱，須與資料庫欄位名稱一致</li>
                <li>日期欄位請使用 YYYY-MM-DD 格式</li>
                <li>匯入前建議先匯出現有資料作為備份</li>
                <li>系統會自動批次處理，避免超時問題</li>
              </ul>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>確認匯入</DialogTitle>
            <DialogDescription>
              請確認以下資料表和設定
            </DialogDescription>
          </DialogHeader>

          {importPreview && (
            <div className="space-y-4">
              {/* Meta Info */}
              {importPreview.meta && (
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertTitle>檔案資訊</AlertTitle>
                  <AlertDescription className="text-xs">
                    匯出時間：{importPreview.meta.export_time || '未知'}
                    <br />
                    Schema 版本：{importPreview.meta.schema_version || '未知'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Tables to Import */}
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>工作表</TableHead>
                      <TableHead className="text-right">資料筆數</TableHead>
                      <TableHead>Upsert Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(importPreview.sheets)
                      .filter(([name]) => name !== '__meta')
                      .map(([sheetName, rows]) => (
                        <TableRow key={sheetName}>
                          <TableCell className="font-mono text-sm">{sheetName}</TableCell>
                          <TableCell className="text-right">{rows.length}</TableCell>
                          <TableCell>
                            <Input
                              value={upsertKeys[sheetName] || 'id'}
                              onChange={(e) => setUpsertKeys(prev => ({
                                ...prev,
                                [sheetName]: e.target.value
                              }))}
                              className="h-8 w-32"
                              disabled={importMode === 'insert'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Mode Reminder */}
              <Alert variant={importMode === 'insert' ? 'default' : 'default'}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>匯入模式：{
                  importMode === 'insert' ? 'Insert（僅新增）' :
                  importMode === 'upsert' ? 'Upsert（新增或更新）' :
                  'Skip Duplicates（跳過重複）'
                }</AlertTitle>
                <AlertDescription className="text-xs">
                  {importMode === 'insert' && '若有重複資料將會報錯'}
                  {importMode === 'upsert' && '依據 Upsert Key 判斷是否為重複資料，重複則更新'}
                  {importMode === 'skip' && '依據 Upsert Key 判斷是否為重複資料，重複則跳過'}
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={isProcessing} className="gap-2">
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              開始匯入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
