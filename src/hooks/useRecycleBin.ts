import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { tableDisplayNames, softDeleteTables, type SoftDeleteTable } from './useDeletionPolicy';

export interface DeletedRecord {
  id: string;
  table_name: SoftDeleteTable;
  display_name: string;
  record_name: string;
  deleted_at: string;
  deleted_by: string | null;
  delete_reason: string | null;
  raw_data: Record<string, unknown>;
}

// Helper to get display name from record
function getRecordDisplayName(tableName: string, record: Record<string, unknown>): string {
  switch (tableName) {
    case 'projects':
      return (record.project_name as string) || (record.project_code as string) || '未命名案場';
    case 'documents':
      return (record.doc_type as string) || '未命名文件';
    case 'document_files':
      return (record.original_name as string) || '未命名檔案';
    case 'partners':
      return (record.name as string) || '未命名夥伴';
    case 'partner_contacts':
      return (record.contact_name as string) || '未命名聯絡人';
    case 'investors':
      return (record.company_name as string) || '未命名投資人';
    case 'investor_contacts':
      return (record.contact_name as string) || '未命名聯絡人';
    case 'investor_payment_methods':
      return (record.method_type as string) || '未命名付款方式';
    case 'project_construction_assignments':
      return (record.construction_work_type as string) || '未命名工程';
    default:
      return record.id as string || '未知記錄';
  }
}

export function useRecycleBin(selectedTable?: SoftDeleteTable) {
  return useQuery({
    queryKey: ['recycle-bin', selectedTable],
    queryFn: async (): Promise<DeletedRecord[]> => {
      const results: DeletedRecord[] = [];
      
      // Tables to query - either specific or all
      const tablesToQuery = selectedTable ? [selectedTable] : softDeleteTables;

      for (const tableName of tablesToQuery) {
        try {
          // Use type assertion to avoid TypeScript recursive type issues
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const query = (supabase as any)
            .from(tableName)
            .select('*')
            .eq('is_deleted', true)
            .order('deleted_at', { ascending: false });

          const { data, error } = await query;

          if (error) {
            console.warn(`Error fetching deleted records from ${tableName}:`, error);
            continue;
          }

          if (data) {
            for (const record of data as Record<string, unknown>[]) {
              results.push({
                id: record.id as string,
                table_name: tableName,
                display_name: tableDisplayNames[tableName] || tableName,
                record_name: getRecordDisplayName(tableName, record),
                deleted_at: record.deleted_at as string,
                deleted_by: record.deleted_by as string | null,
                delete_reason: record.delete_reason as string | null,
                raw_data: record,
              });
            }
          }
        } catch (e) {
          console.warn(`Failed to query ${tableName}:`, e);
        }
      }

      // Sort by deleted_at descending
      return results.sort((a, b) => 
        new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
      );
    },
    staleTime: 30000,
  });
}

export function useAuditLogs(tableName?: string, recordId?: string) {
  return useQuery({
    queryKey: ['audit-logs', tableName, recordId],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          actor:profiles!audit_logs_actor_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (tableName) {
        query = query.eq('table_name', tableName);
      }
      if (recordId) {
        query = query.eq('record_id', recordId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching audit logs:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 30000,
  });
}
