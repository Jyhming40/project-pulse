import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Download, Loader2, CheckCircle2, FileCode2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Define known tables with their Chinese labels
const KNOWN_TABLES = [
  // ── 核心案場 ──
  { name: 'projects', label: '案場' },
  { name: 'project_status_history', label: '案場狀態歷程' },
  { name: 'project_milestones', label: '案場里程碑' },
  { name: 'project_stages', label: '案場階段' },
  { name: 'project_issues', label: '案場議題' },
  { name: 'project_custom_fields', label: '專案自訂欄位' },
  { name: 'project_custom_field_values', label: '專案自訂欄位值' },
  { name: 'project_field_config', label: '專案欄位設定' },
  { name: 'project_epc_financial_metrics', label: 'EPC 財務指標' },
  // ── 施工 ──
  { name: 'project_construction_assignments', label: '施工分派' },
  { name: 'construction_status_history', label: '施工狀態歷程' },
  // ── 文件 ──
  { name: 'documents', label: '文件' },
  { name: 'document_files', label: '文件檔案' },
  { name: 'document_tags', label: '文件標籤' },
  { name: 'document_tag_assignments', label: '文件標籤關聯' },
  { name: 'document_type_config', label: '文件類型設定' },
  { name: 'document_expiry_rules', label: '文件到期規則' },
  { name: 'document_linkage_rules', label: '文件連動規則' },
  // ── 投資人 ──
  { name: 'investors', label: '投資人' },
  { name: 'investor_contacts', label: '投資人聯絡人' },
  { name: 'investor_payment_methods', label: '投資人付款方式' },
  { name: 'investor_year_counters', label: '投資人年度計數器' },
  // ── 協力廠商 ──
  { name: 'partners', label: '協力廠商' },
  { name: 'partner_contacts', label: '協力廠商聯絡人' },
  // ── 報價 ──
  { name: 'project_quotes', label: '報價單' },
  { name: 'quote_engineering_items', label: '報價工程項目' },
  { name: 'quote_engineering_presets', label: '工程預設項目' },
  { name: 'quote_engineering_templates', label: '工程範本' },
  { name: 'quote_modules', label: '報價模組' },
  { name: 'quote_inverters', label: '報價變流器' },
  { name: 'quote_line_items', label: '報價明細' },
  { name: 'quote_financial_projections', label: '財務預測' },
  { name: 'quote_schedules', label: '報價排程' },
  // ── 付款 ──
  { name: 'project_payments', label: '專案付款' },
  { name: 'payment_milestones', label: '付款里程碑' },
  // ── 進度 ──
  { name: 'progress_milestones', label: '進度里程碑定義' },
  { name: 'progress_settings', label: '進度設定' },
  { name: 'process_stages', label: '流程階段' },
  { name: 'stage_responsibilities', label: '階段責任歸屬' },
  // ── 維運 (O&M) ──
  { name: 'om_inspections', label: 'O&M 巡檢' },
  { name: 'om_dc_tests', label: 'O&M DC測試' },
  { name: 'om_ac_tests', label: 'O&M AC測試' },
  { name: 'om_cleaning_reports', label: 'O&M 清洗報告' },
  { name: 'om_incident_reports', label: 'O&M 事故報告' },
  { name: 'om_site_access_requests', label: 'O&M 入場申請' },
  { name: 'om_personnel_rosters', label: 'O&M 人員名冊' },
  { name: 'om_toolbox_meetings', label: 'O&M 工具箱會議' },
  // ── 備忘錄 ──
  { name: 'memos', label: '備忘錄' },
  { name: 'memo_tags', label: '備忘錄標籤' },
  // ── 里程碑通知 ──
  { name: 'milestone_notification_logs', label: '里程碑通知紀錄' },
  { name: 'milestone_notification_settings', label: '里程碑通知設定' },
  // ── 重複掃描 ──
  { name: 'duplicate_ignore_pairs', label: '重複忽略配對' },
  { name: 'duplicate_reviews', label: '重複審查' },
  // ── 行動項目 ──
  { name: 'action_item_resolutions', label: '行動項目解決紀錄' },
  // ── 系統設定 ──
  { name: 'system_options', label: '系統選項' },
  { name: 'system_tariff_rates', label: '躉購費率' },
  { name: 'deletion_policies', label: '刪除政策' },
  { name: 'app_settings', label: '系統設定' },
  { name: 'ai_settings', label: 'AI 設定' },
  { name: 'departments', label: '部門' },
  { name: 'company_bank_accounts', label: '公司銀行帳戶' },
  // ── 使用者 ──
  { name: 'profiles', label: '使用者資料' },
  { name: 'user_roles', label: '使用者角色' },
  { name: 'user_security', label: '使用者安全設定' },
  { name: 'user_preferences', label: '使用者偏好' },
  { name: 'user_drive_tokens', label: '雲端硬碟權杖' },
  { name: 'user_events', label: '使用者事件' },
  { name: 'user_milestone_order', label: '使用者里程碑排序' },
  { name: 'module_permissions', label: '模組權限' },
  { name: 'audit_logs', label: '稽核日誌' },
] as const;

// Use string type to avoid TS deep instantiation errors with large union
type TableName = string;

export function SchemaExportPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSqlExporting, setIsSqlExporting] = useState(false);
  const [sqlExportComplete, setSqlExportComplete] = useState(false);

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
          const { data, error } = await supabase
            .from(table.name as any)
            .select('*')
            .limit(1);

          if (error) continue;

          let columnNames: string[] = [];
          if (data && data.length > 0) {
            columnNames = Object.keys(data[0]);
          }
          if (columnNames.length === 0) continue;

          processedTables.push({ name: table.name, label: table.label, columns: columnNames });
          summaryData.push({ '資料表名稱': table.name, '中文名稱': table.label, '欄位數量': columnNames.length });
        } catch (err) {
          console.warn(`Error processing table ${table.name}:`, err);
        }
      }

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '資料表總覽');

      for (const table of processedTables) {
        const sheetData = table.columns.map(colName => ({ '欄位名稱': colName, '備註': '' }));
        const sheet = XLSX.utils.json_to_sheet(sheetData);
        const sheetName = table.name.substring(0, 31).replace(/[\\/*?[\]:]/g, '_');
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      }

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

  const handleSqlDump = async () => {
    setIsSqlExporting(true);
    setSqlExportComplete(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/export-schema-sql`, {
        headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const sqlText = await res.text();
      const blob = new Blob([sqlText], { type: 'text/sql; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mqtsolar-schema-dump-${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSqlExportComplete(true);
      toast.success('完整 SQL Schema Dump 已下載');
    } catch (err) {
      console.error('SQL dump error:', err);
      toast.error('SQL Dump 匯出失敗：' + (err as Error).message);
    } finally {
      setIsSqlExporting(false);
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
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={handleExport} disabled={isExporting} variant="outline">
            {isExporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />匯出中 ({progress}%)</>
            ) : exportComplete ? (
              <><CheckCircle2 className="mr-2 h-4 w-4" />匯出完成</>
            ) : (
              <><Download className="mr-2 h-4 w-4" />匯出欄位清單 (Excel)</>
            )}
          </Button>
          {exportComplete && <span className="text-sm text-muted-foreground">Excel 檔案已下載</span>}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-1">完整 SQL Schema Dump（Self-Host 遷移用）</p>
          <p className="text-xs text-muted-foreground mb-3">
            包含 Enums、Tables、PK/FK/Unique/Check Constraints、Indexes、Views、Functions、Triggers、RLS Policies、Storage Buckets
          </p>
          <div className="flex items-center gap-4">
            <Button onClick={handleSqlDump} disabled={isSqlExporting}>
              {isSqlExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />匯出中...</>
              ) : sqlExportComplete ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />SQL Dump 已下載</>
              ) : (
                <><FileCode2 className="mr-2 h-4 w-4" />匯出完整 SQL Dump</>
              )}
            </Button>
            {sqlExportComplete && <span className="text-sm text-muted-foreground">.sql 檔案已下載</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}