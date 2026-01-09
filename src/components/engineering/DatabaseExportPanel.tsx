import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { tableDisplayNames } from '@/hooks/useDeletionPolicy';

interface ExportMeta {
  table_name: string;
  sheet_name: string;
  total_count: number;
  exported_count: number;
  columns: string[];
}

// Tables to export (all public schema business tables)
const EXPORT_TABLES = [
  // Core business tables
  'projects',
  'documents',
  'document_files',
  'document_tags',
  'document_tag_assignments',
  // Investor tables
  'investors',
  'investor_contacts',
  'investor_payment_methods',
  'investor_year_counters',
  // Partner tables
  'partners',
  'partner_contacts',
  // Project related
  'project_construction_assignments',
  'project_status_history',
  'construction_status_history',
  'project_milestones',
  'project_custom_fields',
  'project_custom_field_values',
  'project_field_config',
  // Progress & milestones
  'progress_milestones',
  'progress_settings',
  // Duplicate management
  'duplicate_ignore_pairs',
  'duplicate_reviews',
  // System config
  'system_options',
  'deletion_policies',
  'app_settings',
  // User & permissions
  'user_roles',
  'user_security',
  'user_preferences',
  'user_drive_tokens',
  'module_permissions',
  // Audit
  'audit_logs',
];

// Excel sheet name max length is 31 characters
function sanitizeSheetName(name: string): string {
  const sanitized = name.replace(/[\\/*?[\]:]/g, '_');
  return sanitized.length > 31 ? sanitized.substring(0, 31) : sanitized;
}

export function DatabaseExportPanel({ onExportComplete }: { onExportComplete?: (fileId: string) => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    meta: ExportMeta[];
    fileId?: string;
    errors?: string[];
  } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportResult(null);

    const meta: ExportMeta[] = [];
    const errors: string[] = [];
    const workbook = XLSX.utils.book_new();

    try {
      for (let i = 0; i < EXPORT_TABLES.length; i++) {
        const table = EXPORT_TABLES[i];
        setCurrentTable(tableDisplayNames[table] || table);
        setProgress(((i + 1) / EXPORT_TABLES.length) * 100);

        try {
          // Get total count first
          const { count: totalCount, error: countError } = await supabase
            .from(table as any)
            .select('*', { count: 'exact', head: true });

          if (countError) {
            errors.push(`${table}: 無法取得記錄數 - ${countError.message}`);
            continue;
          }

          // Fetch all data (handle pagination for large tables)
          let allData: any[] = [];
          const pageSize = 1000;
          let page = 0;
          let hasMore = true;

          while (hasMore) {
            const { data, error } = await supabase
              .from(table as any)
              .select('*')
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
              errors.push(`${table}: 資料取得失敗 - ${error.message}`);
              break;
            }

            if (data && data.length > 0) {
              allData = [...allData, ...data];
              page++;
              hasMore = data.length === pageSize;
            } else {
              hasMore = false;
            }
          }

          // Create worksheet
          const sheetName = sanitizeSheetName(table);
          const worksheet = XLSX.utils.json_to_sheet(allData);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

          // Record metadata
          const columns = allData.length > 0 ? Object.keys(allData[0]) : [];
          meta.push({
            table_name: table,
            sheet_name: sheetName,
            total_count: totalCount || 0,
            exported_count: allData.length,
            columns,
          });

          // Verify count matches
          if (allData.length !== (totalCount || 0)) {
            errors.push(`${table}: 匯出筆數 (${allData.length}) 與資料庫筆數 (${totalCount}) 不符`);
          }
        } catch (err) {
          errors.push(`${table}: ${(err as Error).message}`);
        }
      }

      // Create __meta sheet as the first sheet
      const metaSheet = XLSX.utils.json_to_sheet(meta);
      XLSX.utils.book_append_sheet(workbook, metaSheet, '__meta');

      // Move __meta to be the first sheet
      const sheetOrder = workbook.SheetNames;
      const metaIndex = sheetOrder.indexOf('__meta');
      if (metaIndex > 0) {
        sheetOrder.splice(metaIndex, 1);
        sheetOrder.unshift('__meta');
        workbook.SheetNames = sheetOrder;
      }

      // Generate file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `mqtsolar-backup-${timestamp}.xlsx`;
      const fileId = `backup-${Date.now()}`;

      XLSX.writeFile(workbook, fileName);

      // Check for any count mismatches
      const hasCountMismatch = meta.some(m => m.exported_count !== m.total_count);

      setExportResult({
        success: !hasCountMismatch && errors.length === 0,
        meta,
        fileId,
        errors: errors.length > 0 ? errors : undefined,
      });

      if (!hasCountMismatch && errors.length === 0) {
        toast.success('資料庫匯出成功');
        onExportComplete?.(fileId);
      } else {
        toast.warning('匯出完成但有警告，請檢查匯出結果');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('匯出失敗：' + (err as Error).message);
      setExportResult({
        success: false,
        meta,
        errors: [...errors, (err as Error).message],
      });
    } finally {
      setIsExporting(false);
      setProgress(100);
      setCurrentTable('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">資料庫匯出</h3>
          <p className="text-sm text-muted-foreground">
            匯出所有資料表為 Excel 檔案，每個表格一個工作表
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isExporting ? '匯出中...' : '開始匯出'}
        </Button>
      </div>

      {isExporting && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>正在匯出: {currentTable}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {exportResult && (
        <Card className={exportResult.success ? 'border-green-500' : 'border-amber-500'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {exportResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              匯出結果
            </CardTitle>
            <CardDescription>
              {exportResult.success ? '所有資料已成功匯出' : '匯出完成但有警告'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">資料表數</p>
                <p className="text-xl font-bold">{exportResult.meta.length}</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">總筆數</p>
                <p className="text-xl font-bold">
                  {exportResult.meta.reduce((sum, m) => sum + m.exported_count, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Errors */}
            {exportResult.errors && exportResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>匯出警告</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-2">
                    {exportResult.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Meta details */}
            <div className="space-y-2">
              <p className="text-sm font-medium">匯出明細</p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {exportResult.meta.map((m) => (
                  <div
                    key={m.table_name}
                    className="flex items-center justify-between p-2 rounded border bg-card text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                      <span>{tableDisplayNames[m.table_name] || m.table_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={m.exported_count === m.total_count ? 'secondary' : 'destructive'}
                      >
                        {m.exported_count} / {m.total_count}
                      </Badge>
                      {m.exported_count === m.total_count && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {exportResult.success && exportResult.fileId && (
              <Alert>
                <Database className="w-4 h-4" />
                <AlertTitle>備份 ID</AlertTitle>
                <AlertDescription className="font-mono text-xs">
                  {exportResult.fileId}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
