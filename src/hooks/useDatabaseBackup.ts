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
      const { data, error } = await supabase.functions.invoke('database-backup', {
        body: { action: 'discover_schema' }
      });

      if (error) throw error;
      
      const tablesWithSelection = (data.tables || []).map((t: TableInfo) => ({
        ...t,
        selected: true
      }));
      
      setTables(tablesWithSelection);
      setExportProgress({ phase: 'idle', tables_done: 0, tables_total: 0, rows_done: 0, rows_total: 0 });
      return tablesWithSelection;
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
    
    // Initialize with expected total from schema discovery
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

      // Track actual totals from backend for verification
      interface TableExportResult {
        table_name: string;
        sheet_name: string;
        row_count: number;        // Actually exported
        total_count: number;      // From DB (total_count)
        column_count: number;
        columns: string[];
        suggested_upsert_key: string;
        status: 'success' | 'incomplete' | 'error';
      }
      const tableExportResults: TableExportResult[] = [];
      const tableSheets: Map<string, XLSX.WorkSheet> = new Map();
      
      let actualRowsDone = 0;
      let actualTotalRows = 0;
      let hasIncomplete = false;

      // Export each table
      for (let i = 0; i < selectedTables.length; i++) {
        const table = selectedTables[i];
        setExportProgress(prev => ({
          ...prev,
          current_table: table.table_name,
          tables_done: i
        }));

        // Fetch all data with pagination
        let allRows: any[] = [];
        let offset = 0;
        const limit = 2000;
        let hasMore = true;
        let tableTotalCount = 0;

        while (hasMore) {
          const { data, error } = await supabase.functions.invoke('database-backup', {
            body: { 
              action: 'export_table', 
              table_name: table.table_name,
              limit,
              offset
            }
          });

          if (error) {
            console.error(`Export error for ${table.table_name}:`, error);
            tableExportResults.push({
              table_name: table.table_name,
              sheet_name: table.table_name.substring(0, 31),
              row_count: 0,
              total_count: table.row_count,
              column_count: table.columns.length,
              columns: table.columns.map(c => c.column_name),
              suggested_upsert_key: UPSERT_KEY_SUGGESTIONS[table.table_name] || 'id',
              status: 'error'
            });
            hasIncomplete = true;
            break;
          }
          
          // Use total_count from backend (exact DB count)
          tableTotalCount = data.total_count;
          
          allRows = [...allRows, ...data.rows];
          hasMore = data.hasMore;
          offset += limit;
          
          actualRowsDone += data.rows.length;
          setExportProgress(prev => ({
            ...prev,
            rows_done: actualRowsDone,
            rows_total: actualTotalRows + tableTotalCount
          }));
        }

        // Update actual total after getting backend count
        actualTotalRows += tableTotalCount;

        // Get column names from table schema (preserve original column order)
        const columnNames = table.columns.map(c => c.column_name);

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
          // Create empty sheet with just headers
          sheet = XLSX.utils.aoa_to_sheet([columnNames]);
        } else {
          sheet = XLSX.utils.json_to_sheet(formattedRows, { header: columnNames });
        }
        
        // Set column widths for better readability
        const colWidths = columnNames.map(col => ({
          wch: Math.max(col.length + 2, 12)
        }));
        sheet['!cols'] = colWidths;
        
        // Truncate sheet name to 31 chars (Excel limit)
        const sheetName = table.table_name.substring(0, 31);
        tableSheets.set(table.table_name, sheet);

        // Check if export is complete
        const isComplete = allRows.length === tableTotalCount;
        if (!isComplete) {
          hasIncomplete = true;
        }

        // Record export result for __meta
        tableExportResults.push({
          table_name: table.table_name,
          sheet_name: sheetName,
          row_count: allRows.length,
          total_count: tableTotalCount,
          column_count: columnNames.length,
          columns: columnNames,
          suggested_upsert_key: UPSERT_KEY_SUGGESTIONS[table.table_name] || 'id',
          status: isComplete ? 'success' : 'incomplete'
        });
      }

      // Create __meta sheet with all required fields
      const metaRows = tableExportResults.map(t => ({
        '資料表名稱': t.table_name,
        'Sheet名稱': t.sheet_name,
        '匯出筆數': t.row_count,
        '資料庫總筆數': t.total_count,
        '欄位數': t.column_count,
        '狀態': t.status === 'success' ? '完整' : (t.status === 'incomplete' ? '未完整' : '錯誤'),
        '建議Upsert鍵': t.suggested_upsert_key,
        '欄位列表': t.columns.join(', ')
      }));

      // Add summary row at the top
      const totalExported = tableExportResults.reduce((sum, t) => sum + t.row_count, 0);
      const totalInDB = tableExportResults.reduce((sum, t) => sum + t.total_count, 0);
      const allComplete = tableExportResults.every(t => t.status === 'success');
      
      const summaryRow = {
        '資料表名稱': '【匯出摘要】',
        'Sheet名稱': '',
        '匯出筆數': totalExported,
        '資料庫總筆數': totalInDB,
        '欄位數': tableExportResults.length,
        '狀態': allComplete ? '全部完整' : '有未完整',
        '建議Upsert鍵': '',
        '欄位列表': `匯出時間: ${exportTime}`
      };

      const metaSheet = XLSX.utils.json_to_sheet([summaryRow, ...metaRows]);
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
      
      // Add __meta sheet first
      XLSX.utils.book_append_sheet(workbook, metaSheet, '__meta');
      
      // Then add all table sheets
      for (const [tableName, sheet] of tableSheets) {
        const sheetName = tableName.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      }

      // Generate and download file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `database_backup_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, filename);

      // Final status check
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
            
            // Extract summary info
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
            
            // Use the mapping to get actual table name, or fall back to sheet name
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
      const { sheets, meta } = await parseImportFile(file);
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

        // Prepare rows with index for error tracking
        const preparedRows = rows.map((row, idx) => ({
          row_index: idx + 2, // +2 for 1-based index + header row
          data: row
        }));

        // Import in batches
        const batchSize = 500;
        const tableResult: ImportResult = {
          table: tableName,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: []
        };

        for (let j = 0; j < preparedRows.length; j += batchSize) {
          const batch = preparedRows.slice(j, j + batchSize);
          
          const { data, error } = await supabase.functions.invoke('database-backup', {
            body: {
              action: 'import_batch',
              table_name: tableName,
              rows: batch,
              mode,
              upsert_key: upsertKeys[tableName] || UPSERT_KEY_SUGGESTIONS[tableName] || 'id'
            }
          });

          if (error) {
            tableResult.errors.push({
              row: j + 2,
              reason: `Batch error: ${error.message}`
            });
          } else if (data) {
            tableResult.inserted += data.inserted || 0;
            tableResult.updated += data.updated || 0;
            tableResult.skipped += data.skipped || 0;
            if (data.errors) {
              tableResult.errors.push(...data.errors);
            }
          }

          rowsDone += batch.length;
          setImportProgress(prev => ({
            ...prev,
            rows_done: rowsDone
          }));
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
        allErrors.push({
          table: result.table,
          ...error
        });
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
