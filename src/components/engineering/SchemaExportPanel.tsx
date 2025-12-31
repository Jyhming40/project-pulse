import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Define known tables with their Chinese labels
const KNOWN_TABLES = [
  { name: 'projects', label: '案場' },
  { name: 'investors', label: '投資人' },
  { name: 'investor_contacts', label: '投資人聯絡人' },
  { name: 'investor_payment_methods', label: '投資人付款方式' },
  { name: 'partners', label: '協力廠商' },
  { name: 'partner_contacts', label: '協力廠商聯絡人' },
  { name: 'documents', label: '文件' },
  { name: 'document_files', label: '文件檔案' },
  { name: 'project_milestones', label: '案場里程碑' },
  { name: 'progress_milestones', label: '進度里程碑定義' },
  { name: 'project_construction_assignments', label: '施工分派' },
  { name: 'project_status_history', label: '案場狀態歷程' },
  { name: 'construction_status_history', label: '施工狀態歷程' },
  { name: 'system_options', label: '系統選項' },
  { name: 'profiles', label: '使用者資料' },
  { name: 'user_roles', label: '使用者角色' },
  { name: 'user_preferences', label: '使用者偏好' },
  { name: 'module_permissions', label: '模組權限' },
  { name: 'deletion_policies', label: '刪除政策' },
  { name: 'audit_logs', label: '稽核日誌' },
  { name: 'app_settings', label: '系統設定' },
  { name: 'duplicate_ignore_pairs', label: '重複忽略配對' },
  { name: 'duplicate_reviews', label: '重複審查' },
  { name: 'investor_year_counters', label: '投資人年度計數器' },
  { name: 'user_drive_tokens', label: '雲端硬碟權杖' },
  { name: 'progress_settings', label: '進度設定' },
] as const;

type TableName = typeof KNOWN_TABLES[number]['name'];

export function SchemaExportPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);
    setProgress(0);

    try {
      const workbook = XLSX.utils.book_new();
      const summaryData: { 資料表名稱: string; 中文名稱: string; 欄位數量: number }[] = [];
      const processedTables: { name: string; label: string; columns: string[] }[] = [];

      for (let i = 0; i < KNOWN_TABLES.length; i++) {
        const table = KNOWN_TABLES[i];
        setProgress(Math.round(((i + 1) / KNOWN_TABLES.length) * 100));

        try {
          // Fetch one row to get column names
          const { data, error } = await supabase
            .from(table.name as TableName)
            .select('*')
            .limit(1);

          if (error) {
            console.warn(`Cannot access table ${table.name}:`, error.message);
            continue;
          }

          // Get column names from the response
          let columnNames: string[] = [];
          if (data && data.length > 0) {
            columnNames = Object.keys(data[0]);
          }

          if (columnNames.length === 0) {
            continue;
          }

          processedTables.push({
            name: table.name,
            label: table.label,
            columns: columnNames
          });

          summaryData.push({
            '資料表名稱': table.name,
            '中文名稱': table.label,
            '欄位數量': columnNames.length
          });
        } catch (err) {
          console.warn(`Error processing table ${table.name}:`, err);
        }
      }

      // Add summary sheet first
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '資料表總覽');

      // Add individual table sheets
      for (const table of processedTables) {
        const sheetData = table.columns.map(colName => ({
          '欄位名稱': colName,
          '備註': ''
        }));

        const sheet = XLSX.utils.json_to_sheet(sheetData);
        const sheetName = table.name.substring(0, 31).replace(/[\\/*?[\]:]/g, '_');
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      }

      // Generate and download file
      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `database_schema_${timestamp}.xlsx`);

      setExportComplete(true);
      toast.success(`資料庫結構匯出成功，共 ${processedTables.length} 個資料表`);
    } catch (err) {
      console.error('Schema export error:', err);
      toast.error('匯出失敗');
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          資料庫結構匯出
        </CardTitle>
        <CardDescription>
          匯出所有資料表的欄位定義，方便查閱與文件化
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Button
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                匯出中 ({progress}%)
              </>
            ) : exportComplete ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                匯出完成
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                匯出資料庫結構
              </>
            )}
          </Button>
          {exportComplete && (
            <span className="text-sm text-muted-foreground">
              Excel 檔案已下載
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
