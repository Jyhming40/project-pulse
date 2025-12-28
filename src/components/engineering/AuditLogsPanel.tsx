import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Trash2, RotateCcw, Archive, ArchiveRestore, Database, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { tableDisplayNames, softDeleteTables } from '@/hooks/useDeletionPolicy';

type AuditAction = 'DELETE' | 'RESTORE' | 'PURGE' | 'ARCHIVE' | 'UNARCHIVE' | 'CREATE' | 'UPDATE' | 'DB_RESET' | 'DB_EXPORT' | 'DB_IMPORT';

const actionDisplayNames: Record<AuditAction, { label: string; icon: typeof Trash2; variant: string }> = {
  DELETE: { label: '刪除', icon: Trash2, variant: 'destructive' },
  RESTORE: { label: '還原', icon: RotateCcw, variant: 'default' },
  PURGE: { label: '永久刪除', icon: Trash2, variant: 'destructive' },
  ARCHIVE: { label: '封存', icon: Archive, variant: 'secondary' },
  UNARCHIVE: { label: '取消封存', icon: ArchiveRestore, variant: 'default' },
  CREATE: { label: '建立', icon: Plus, variant: 'default' },
  UPDATE: { label: '更新', icon: Edit, variant: 'secondary' },
  DB_RESET: { label: '資料庫重置', icon: Database, variant: 'destructive' },
  DB_EXPORT: { label: '資料庫匯出', icon: Database, variant: 'default' },
  DB_IMPORT: { label: '資料庫匯入', icon: Database, variant: 'default' },
};

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  actor_user_id: string | null;
  reason: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export function AuditLogsPanel() {
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<string>('all');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['engineering-audit-logs', selectedAction, selectedTable],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedAction !== 'all') {
        query = query.eq('action', selectedAction as any);
      }

      if (selectedTable !== 'all') {
        query = query.eq('table_name', selectedTable);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const allTables = ['system', ...softDeleteTables];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">操作紀錄</h3>
          <p className="text-sm text-muted-foreground">
            檢視系統操作歷史記錄
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          重新整理
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger>
              <SelectValue placeholder="篩選操作類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有操作</SelectItem>
              {Object.entries(actionDisplayNames).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger>
              <SelectValue placeholder="篩選資料類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有類型</SelectItem>
              {allTables.map((table) => (
                <SelectItem key={table} value={table}>
                  {tableDisplayNames[table] || table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              沒有符合條件的操作記錄
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">時間</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                  <TableHead className="w-[120px]">資料類型</TableHead>
                  <TableHead>記錄 ID</TableHead>
                  <TableHead>原因 / 備註</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const actionInfo = actionDisplayNames[log.action] || {
                    label: log.action,
                    icon: Database,
                    variant: 'secondary',
                  };
                  const ActionIcon = actionInfo.icon;

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            actionInfo.variant === 'destructive'
                              ? 'destructive'
                              : actionInfo.variant === 'secondary'
                              ? 'secondary'
                              : 'default'
                          }
                          className="flex items-center gap-1 w-fit"
                        >
                          <ActionIcon className="w-3 h-3" />
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {tableDisplayNames[log.table_name] || log.table_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[150px] truncate">
                        {log.record_id}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px]">
                        {log.reason || (
                          log.new_data ? (
                            <span className="text-xs text-muted-foreground">
                              {log.action === 'DB_RESET' && log.new_data.scope
                                ? `範圍: ${log.new_data.scope}`
                                : '-'}
                            </span>
                          ) : '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
