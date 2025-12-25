import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export interface TableInfo {
  table_name: string;
  row_count: number;
  columns: ColumnInfo[];
  primary_key?: string[];
  unique_keys?: string[][];
  selected?: boolean;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  ordinal_position?: number;
}

export interface ImportError {
  row: number;
  column?: string;
  reason: string;
}

export interface ImportResult {
  table: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface ExportProgress {
  phase: 'idle' | 'discovering' | 'exporting' | 'complete' | 'error';
  current_table?: string;
  tables_done: number;
  tables_total: number;
  rows_done: number;
  rows_total: number;
  error_message?: string;
}

export interface ImportProgress {
  phase: 'idle' | 'validating' | 'importing' | 'complete';
  current_table?: string;
  tables_done: number;
  tables_total: number;
  rows_done: number;
  rows_total: number;
}

export type ImportMode = 'insert' | 'upsert' | 'skip';

// Known tables and their column definitions
const TABLE_COLUMNS: Record<string, string[]> = {
  'construction_status_history': ['id', 'project_id', 'status', 'changed_by', 'changed_at', 'note'],
  'document_files': ['id', 'document_id', 'original_name', 'storage_path', 'mime_type', 'file_size', 'uploaded_by', 'uploaded_at'],
  'documents': ['id', 'project_id', 'doc_type', 'doc_status', 'submitted_at', 'issued_at', 'due_at', 'owner_user_id', 'note', 'created_at', 'updated_at', 'created_by'],
  'investor_contacts': ['id', 'investor_id', 'contact_name', 'title', 'department', 'phone', 'mobile', 'email', 'line_id', 'role_tags', 'is_primary', 'is_active', 'note', 'created_at', 'updated_at', 'created_by'],
  'investor_payment_methods': ['id', 'investor_id', 'method_type', 'bank_name', 'bank_code', 'branch_name', 'account_name', 'account_number', 'is_default', 'note', 'created_at', 'updated_at', 'created_by'],
  'investor_year_counters': ['id', 'year', 'investor_code', 'last_seq', 'created_at', 'updated_at'],
  'investors': ['id', 'investor_code', 'company_name', 'investor_type', 'owner_name', 'owner_title', 'tax_id', 'address', 'phone', 'email', 'contact_person', 'note', 'created_at', 'updated_at', 'created_by'],
  'partners': ['id', 'name', 'partner_type', 'contact_person', 'contact_phone', 'email', 'address', 'is_active', 'note', 'created_at', 'updated_at', 'created_by'],
  'profiles': ['id', 'email', 'full_name', 'avatar_url', 'created_at', 'updated_at'],
  'project_construction_assignments': ['id', 'project_id', 'partner_id', 'construction_work_type', 'assignment_status', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'note', 'created_at', 'updated_at', 'created_by'],
  'project_status_history': ['id', 'project_id', 'status', 'changed_by', 'changed_at', 'note', 'attachment_path'],
  'projects': ['id', 'project_code', 'project_name', 'status', 'investor_id', 'capacity_kwp', 'actual_installed_capacity', 'city', 'district', 'address', 'coordinates', 'land_owner', 'land_owner_contact', 'contact_person', 'contact_phone', 'installation_type', 'grid_connection_type', 'power_phase_type', 'power_voltage', 'pole_status', 'construction_status', 'feeder_code', 'taipower_pv_id', 'fiscal_year', 'intake_year', 'seq', 'site_code_display', 'approval_date', 'drive_folder_id', 'drive_folder_url', 'folder_status', 'folder_error', 'note', 'created_at', 'updated_at', 'created_by'],
  'system_options': ['id', 'category', 'value', 'label', 'sort_order', 'is_active', 'created_at', 'updated_at', 'created_by'],
  'user_drive_tokens': ['id', 'user_id', 'access_token', 'refresh_token', 'token_expires_at', 'google_email', 'google_error', 'created_at', 'updated_at'],
  'user_roles': ['id', 'user_id', 'role', 'created_at']
};

// Order columns for consistent ordering
const TABLE_ORDER_BY: Record<string, string> = {
  'construction_status_history': 'changed_at',
  'document_files': 'uploaded_at',
  'documents': 'created_at',
  'investor_contacts': 'created_at',
  'investor_payment_methods': 'created_at',
  'investor_year_counters': 'created_at',
  'investors': 'created_at',
  'partners': 'created_at',
  'profiles': 'created_at',
  'project_construction_assignments': 'created_at',
  'project_status_history': 'changed_at',
  'projects': 'created_at',
  'system_options': 'created_at',
  'user_drive_tokens': 'created_at',
  'user_roles': 'created_at'
};

// Suggested upsert keys for known tables
const UPSERT_KEY_SUGGESTIONS: Record<string, string> = {
  projects: 'project_code',
  investors: 'investor_code',
  partners: 'id',
  documents: 'id',
  system_options: 'id',
  profiles: 'id',
  user_roles: 'id',
  investor_contacts: 'id',
  investor_payment_methods: 'id',
  project_status_history: 'id',
  construction_status_history: 'id',
  project_construction_assignments: 'id',
  document_files: 'id',
  investor_year_counters: 'id',
  user_drive_tokens: 'id'
};

// Fetch all records from a table with pagination
async function fetchAllRecords(
  tableName: string,
  orderBy: string = 'created_at'
): Promise<{ data: any[]; error: Error | null }> {
  const records: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      // Use any type to bypass strict table name checking
      const { data, error } = await (supabase.from(tableName as any) as any)
        .select('*')
        .order(orderBy, { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        // Try without ordering
        const fallback = await (supabase.from(tableName as any) as any)
          .select('*')
          .range(offset, offset + pageSize - 1);
        
        if (fallback.error) throw fallback.error;
        
        if (!fallback.data || fallback.data.length === 0) {
          hasMore = false;
        } else {
          records.push(...fallback.data);
          offset += pageSize;
          if (fallback.data.length < pageSize) hasMore = false;
        }
      } else {
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          records.push(...data);
          offset += pageSize;
          if (data.length < pageSize) hasMore = false;
        }
      }
    }
    return { data: records, error: null };
  } catch (err) {
    return { data: records, error: err as Error };
  }
}

// Get row count for a table
async function getTableCount(tableName: string): Promise<number> {
  const { count, error } = await (supabase.from(tableName as any) as any)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(`Count error for ${tableName}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export function useDatabaseBackup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    phase: 'idle',
    tables_done: 0,
    tables_total: 0,
    rows_done: 0,
    rows_total: 0
  });
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'idle',
    tables_done: 0,
    tables_total: 0,
    rows_done: 0,
    rows_total: 0
  });
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  const discoverSchema = useCallback(async () => {
    setIsProcessing(true);
    setExportProgress({ phase: 'discovering', tables_done: 0, tables_total: 0, rows_done: 0, rows_total: 0 });
    
    try {
      const tableNames = Object.keys(TABLE_COLUMNS);
      const discoveredTables: TableInfo[] = [];

      for (const tableName of tableNames) {
        const count = await getTableCount(tableName);
        const columns = TABLE_COLUMNS[tableName].map((col, idx) => ({
          column_name: col,
          data_type: 'text',
          is_nullable: true,
          column_default: null,
          ordinal_position: idx + 1
        }));

        discoveredTables.push({
          table_name: tableName,
          row_count: count,
          columns,
          primary_key: ['id'],
          selected: true
        });
      }

      setTables(discoveredTables);
      setExportProgress({ phase: 'idle', tables_done: 0, tables_total: 0, rows_done: 0, rows_total: 0 });
      return discoveredTables;
    } catch (err) {
      console.error('Schema discovery error:', err);
      toast.error('無法讀取資料庫結構');
      setExportProgress({ phase: 'idle', tables_done: 0, tables_total: 0, rows_done: 0, rows_total: 0 });
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const toggleTableSelection = useCallback((tableName: string) => {
    setTables(prev => prev.map(t => 
      t.table_name === tableName ? { ...t, selected: !t.selected } : t
    ));
  }, []);

  const selectAllTables = useCallback((selected: boolean) => {
    setTables(prev => prev.map(t => ({ ...t, selected })));
  }, []);

  const exportToExcel = useCallback(async () => {
    const selectedTables = tables.filter(t => t.selected);
    if (selectedTables.length === 0) {
      toast.error('請至少選擇一個資料表');
      return;
    }

    setIsProcessing(true);
    
    // Calculate expected total rows
    const expectedTotalRows = selectedTables.reduce((sum, t) => sum + t.row_count, 0);
    setExportProgress({
      phase: 'exporting',
      tables_done: 0,
      tables_total: selectedTables.length,
      rows_done: 0,
      rows_total: expectedTotalRows
    });

    try {
      const workbook = XLSX.utils.book_new();
      const exportTime = new Date().toISOString();

      // Track export results for __meta
      interface TableExportResult {
        table_name: string;
        sheet_name: string;
        row_count: number;
        total_count: number;
        column_count: number;
        columns: string[];
        status: 'success' | 'incomplete' | 'error';
        error_message?: string;
      }
      const tableExportResults: TableExportResult[] = [];
      
      let rowsDone = 0;
      let hasIncomplete = false;

      // Export each table directly using Supabase client (like useProjectBackup)
      for (let i = 0; i < selectedTables.length; i++) {
        const table = selectedTables[i];
        setExportProgress(prev => ({
          ...prev,
          current_table: table.table_name,
          tables_done: i
        }));

        const orderBy = TABLE_ORDER_BY[table.table_name] || 'created_at';
        const columnNames = TABLE_COLUMNS[table.table_name] || [];
        
        // Truncate sheet name to 31 chars (Excel limit)
        const sheetName = table.table_name.substring(0, 31);

        try {
          // Fetch all records using pagination
          const { data: allRows, error } = await fetchAllRecords(table.table_name, orderBy);
          
          if (error) {
            console.error(`Export error for ${table.table_name}:`, error);
            tableExportResults.push({
              table_name: table.table_name,
              sheet_name: sheetName,
              row_count: 0,
              total_count: table.row_count,
              column_count: columnNames.length,
              columns: columnNames,
              status: 'error',
              error_message: error.message
            });
            hasIncomplete = true;

            // Still create empty sheet with headers
            const emptySheet = XLSX.utils.aoa_to_sheet([columnNames]);
            XLSX.utils.book_append_sheet(workbook, emptySheet, sheetName);
            continue;
          }

          // Format rows with consistent column order
          const formattedRows = allRows.map(row => {
            const formatted: Record<string, any> = {};
            for (const colName of columnNames) {
              const value = row[colName];
              if (value === null || value === undefined) {
                formatted[colName] = '';
              } else if (value instanceof Date) {
                formatted[colName] = value.toISOString().split('T')[0];
              } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                formatted[colName] = value;
              } else if (Array.isArray(value)) {
                formatted[colName] = JSON.stringify(value);
              } else if (typeof value === 'object') {
                formatted[colName] = JSON.stringify(value);
              } else {
                formatted[colName] = value;
              }
            }
            return formatted;
          });

          // Create sheet - ALWAYS include headers even for empty tables
          let sheet: XLSX.WorkSheet;
          if (formattedRows.length === 0) {
            sheet = XLSX.utils.aoa_to_sheet([columnNames]);
          } else {
            sheet = XLSX.utils.json_to_sheet(formattedRows, { header: columnNames });
          }
          
          // Set column widths
          const colWidths = columnNames.map(col => ({
            wch: Math.max(col.length + 2, 12)
          }));
          sheet['!cols'] = colWidths;
          
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

          // Check if export is complete
          const isComplete = allRows.length === table.row_count;
          if (!isComplete) {
            hasIncomplete = true;
          }

          rowsDone += allRows.length;
          setExportProgress(prev => ({
            ...prev,
            rows_done: rowsDone
          }));

          tableExportResults.push({
            table_name: table.table_name,
            sheet_name: sheetName,
            row_count: allRows.length,
            total_count: table.row_count,
            column_count: columnNames.length,
            columns: columnNames,
            status: isComplete ? 'success' : 'incomplete'
          });

        } catch (err) {
          console.error(`Unexpected error for ${table.table_name}:`, err);
          tableExportResults.push({
            table_name: table.table_name,
            sheet_name: sheetName,
            row_count: 0,
            total_count: table.row_count,
            column_count: columnNames.length,
            columns: columnNames,
            status: 'error',
            error_message: err instanceof Error ? err.message : 'Unknown error'
          });
          hasIncomplete = true;

          // Create empty sheet with headers
          const emptySheet = XLSX.utils.aoa_to_sheet([columnNames]);
          XLSX.utils.book_append_sheet(workbook, emptySheet, sheetName);
        }
      }

      // Create __meta sheet with all required fields
      const metaHeaders = ['資料表名稱', 'Sheet名稱', '匯出筆數', '資料庫總筆數', '欄位數', '狀態', '建議Upsert鍵', '欄位列表'];
      const metaRows: any[][] = [metaHeaders];
      
      // Add summary row
      const totalExported = tableExportResults.reduce((sum, t) => sum + t.row_count, 0);
      const totalInDB = tableExportResults.reduce((sum, t) => sum + t.total_count, 0);
      const allComplete = tableExportResults.every(t => t.status === 'success');
      
      metaRows.push([
        '【匯出摘要】',
        '',
        totalExported,
        totalInDB,
        tableExportResults.length,
        allComplete ? '全部完整' : '有未完整',
        '',
        `匯出時間: ${exportTime}`
      ]);

      // Add each table's info
      for (const result of tableExportResults) {
        metaRows.push([
          result.table_name,
          result.sheet_name,
          result.row_count,
          result.total_count,
          result.column_count,
          result.status === 'success' ? '完整' : (result.status === 'incomplete' ? '未完整' : '錯誤'),
          UPSERT_KEY_SUGGESTIONS[result.table_name] || 'id',
          result.columns.join(', ')
        ]);
      }

      const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
      metaSheet['!cols'] = [
        { wch: 35 },  // 資料表名稱
        { wch: 35 },  // Sheet名稱
        { wch: 12 },  // 匯出筆數
        { wch: 14 },  // 資料庫總筆數
        { wch: 10 },  // 欄位數
        { wch: 12 },  // 狀態
        { wch: 20 },  // 建議Upsert鍵
        { wch: 80 }   // 欄位列表
      ];
      
      // Insert __meta at the beginning
      const existingSheets = workbook.SheetNames.slice();
      workbook.SheetNames = ['__meta', ...existingSheets];
      workbook.Sheets['__meta'] = metaSheet;

      // Generate and download file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `database_backup_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, filename);

      // Final status
      if (hasIncomplete) {
        setExportProgress({
          phase: 'error',
          tables_done: selectedTables.length,
          tables_total: selectedTables.length,
          rows_done: totalExported,
          rows_total: totalInDB,
          error_message: `部分資料表匯出不完整 (${totalExported}/${totalInDB})`
        });
        toast.warning(`匯出完成但有不完整的資料表，請檢查 __meta 工作表`);
      } else {
        setExportProgress({
          phase: 'complete',
          tables_done: selectedTables.length,
          tables_total: selectedTables.length,
          rows_done: totalExported,
          rows_total: totalInDB
        });
        toast.success(`已完整匯出 ${selectedTables.length} 個資料表，共 ${totalExported} 筆資料`);
      }
    } catch (err) {
      console.error('Export error:', err);
      setExportProgress(prev => ({
        ...prev,
        phase: 'error',
        error_message: '匯出失敗'
      }));
      toast.error('匯出失敗');
    } finally {
      setIsProcessing(false);
    }
  }, [tables]);

  const parseImportFile = useCallback(async (file: File) => {
    return new Promise<{ sheets: Record<string, any[]>; meta: any; sheetToTableMap: Record<string, string> }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          
          const sheets: Record<string, any[]> = {};
          let meta: any = null;
          const sheetToTableMap: Record<string, string> = {};

          // First, parse __meta to get sheet-to-table mapping
          if (workbook.SheetNames.includes('__meta')) {
            const metaSheet = workbook.Sheets['__meta'];
            const metaData = XLSX.utils.sheet_to_json(metaSheet, { raw: false });
            
            for (const row of metaData as any[]) {
              if (row['資料表名稱'] && row['資料表名稱'] !== '【匯出摘要】') {
                const tableName = row['資料表名稱'];
                const sheetName = row['Sheet名稱'] || tableName.substring(0, 31);
                sheetToTableMap[sheetName] = tableName;
              }
            }
            
            const summaryRow = (metaData as any[]).find(r => r['資料表名稱'] === '【匯出摘要】');
            if (summaryRow) {
              meta = {
                exported_at: summaryRow['欄位列表']?.replace('匯出時間: ', ''),
                total_rows: summaryRow['匯出筆數'],
                total_tables: summaryRow['欄位數']
              };
            }
          }

          // Parse all other sheets
          for (const sheetName of workbook.SheetNames) {
            if (sheetName === '__meta') continue;
            
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
            
            const tableName = sheetToTableMap[sheetName] || sheetName;
            sheets[tableName] = jsonData;
          }

          resolve({ sheets, meta, sheetToTableMap });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const importFromFile = useCallback(async (
    file: File, 
    mode: ImportMode,
    upsertKeys: Record<string, string>
  ) => {
    setIsProcessing(true);
    setImportResults([]);
    
    try {
      const { sheets } = await parseImportFile(file);
      const tableNames = Object.keys(sheets).filter(n => n !== '__meta');
      
      const totalRows = tableNames.reduce((sum, t) => sum + sheets[t].length, 0);
      setImportProgress({
        phase: 'validating',
        tables_done: 0,
        tables_total: tableNames.length,
        rows_done: 0,
        rows_total: totalRows
      });

      const results: ImportResult[] = [];
      let rowsDone = 0;

      for (let i = 0; i < tableNames.length; i++) {
        const tableName = tableNames[i];
        const rows = sheets[tableName];
        
        setImportProgress(prev => ({
          ...prev,
          phase: 'importing',
          current_table: tableName,
          tables_done: i
        }));

        const tableResult: ImportResult = {
          table: tableName,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: []
        };

        const upsertKey = upsertKeys[tableName] || UPSERT_KEY_SUGGESTIONS[tableName] || 'id';

        // Process rows in batches
        const batchSize = 100;
        for (let j = 0; j < rows.length; j += batchSize) {
          const batch = rows.slice(j, j + batchSize);
          
          for (let k = 0; k < batch.length; k++) {
            const row = batch[k];
            const rowIndex = j + k + 2; // +2 for 1-based + header

            try {
              // Clean data
              const cleanData = { ...row };
              for (const [key, value] of Object.entries(cleanData)) {
                if (value === '') {
                  cleanData[key] = null;
                }
              }

              if (mode === 'insert') {
                const { error } = await (supabase.from(tableName as any) as any).insert(cleanData);
                if (error) {
                  if (error.code === '23505') {
                    tableResult.errors.push({ row: rowIndex, reason: `重複鍵: ${error.message}` });
                  } else {
                    tableResult.errors.push({ row: rowIndex, reason: error.message });
                  }
                } else {
                  tableResult.inserted++;
                }
              } else if (mode === 'upsert') {
                const { error } = await (supabase.from(tableName as any) as any).upsert(cleanData, { onConflict: upsertKey });
                if (error) {
                  tableResult.errors.push({ row: rowIndex, reason: error.message });
                } else {
                  tableResult.updated++;
                }
              } else if (mode === 'skip') {
                const keyValue = cleanData[upsertKey];
                if (keyValue) {
                  const { data: existing } = await (supabase.from(tableName as any) as any).select('id').eq(upsertKey, keyValue).maybeSingle();
                  if (existing) {
                    tableResult.skipped++;
                    continue;
                  }
                }
                const { error } = await (supabase.from(tableName as any) as any).insert(cleanData);
                if (error) {
                  if (error.code === '23505') {
                    tableResult.skipped++;
                  } else {
                    tableResult.errors.push({ row: rowIndex, reason: error.message });
                  }
                } else {
                  tableResult.inserted++;
                }
              }
            } catch (err) {
              tableResult.errors.push({ 
                row: rowIndex, 
                reason: err instanceof Error ? err.message : 'Unknown error' 
              });
            }
          }

          rowsDone += batch.length;
          setImportProgress(prev => ({ ...prev, rows_done: rowsDone }));
        }

        results.push(tableResult);
      }

      setImportResults(results);
      setImportProgress({
        phase: 'complete',
        tables_done: tableNames.length,
        tables_total: tableNames.length,
        rows_done: totalRows,
        rows_total: totalRows
      });

      const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
      const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      if (totalErrors > 0) {
        toast.warning(`匯入完成：新增 ${totalInserted}，更新 ${totalUpdated}，略過 ${totalSkipped}，錯誤 ${totalErrors}`);
      } else {
        toast.success(`匯入成功：新增 ${totalInserted}，更新 ${totalUpdated}，略過 ${totalSkipped}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('匯入失敗');
    } finally {
      setIsProcessing(false);
    }
  }, [parseImportFile]);

  const downloadErrorReport = useCallback(() => {
    if (importResults.length === 0) return;

    const allErrors: Array<{ table: string; row: number; column?: string; reason: string }> = [];
    for (const result of importResults) {
      for (const error of result.errors) {
        allErrors.push({ table: result.table, ...error });
      }
    }

    if (allErrors.length === 0) {
      toast.info('沒有錯誤需要匯出');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(allErrors);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Errors');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    XLSX.writeFile(workbook, `import_errors_${timestamp}.xlsx`);
    
    toast.success('已下載錯誤報告');
  }, [importResults]);

  const getUpsertKeySuggestion = useCallback((tableName: string) => {
    return UPSERT_KEY_SUGGESTIONS[tableName] || 'id';
  }, []);

  const resetProgress = useCallback(() => {
    setExportProgress({ phase: 'idle', tables_done: 0, tables_total: 0, rows_done: 0, rows_total: 0 });
    setImportProgress({ phase: 'idle', tables_done: 0, tables_total: 0, rows_done: 0, rows_total: 0 });
    setImportResults([]);
  }, []);

  return {
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
  };
}
