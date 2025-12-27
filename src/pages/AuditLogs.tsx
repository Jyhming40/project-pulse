import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Trash2, RotateCcw, Archive, ArchiveRestore } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useAuditLogs } from '@/hooks/useRecycleBin';
import { tableDisplayNames, softDeleteTables, type SoftDeleteTable } from '@/hooks/useDeletionPolicy';

const actionDisplayNames: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  DELETE: { label: '刪除', icon: <Trash2 className="w-3 h-3" />, color: 'bg-destructive/15 text-destructive' },
  RESTORE: { label: '復原', icon: <RotateCcw className="w-3 h-3" />, color: 'bg-success/15 text-success' },
  PURGE: { label: '永久刪除', icon: <Trash2 className="w-3 h-3" />, color: 'bg-destructive text-destructive-foreground' },
  ARCHIVE: { label: '封存', icon: <Archive className="w-3 h-3" />, color: 'bg-warning/15 text-warning' },
  UNARCHIVE: { label: '取消封存', icon: <ArchiveRestore className="w-3 h-3" />, color: 'bg-info/15 text-info' },
};

export default function AuditLogs() {
  const [selectedTable, setSelectedTable] = useState<string>('all');
  
  const tableFilter = selectedTable === 'all' ? undefined : selectedTable;
  const { data: logs = [], isLoading } = useAuditLogs(tableFilter);

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6" />
              稽核日誌
            </h1>
            <p className="text-muted-foreground">追蹤所有資料的刪除、復原、永久刪除等操作紀錄</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>操作紀錄</CardTitle>
                <CardDescription>
                  共 {logs.length} 筆紀錄
                </CardDescription>
              </div>
              <Select 
                value={selectedTable} 
                onValueChange={setSelectedTable}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="篩選資料類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {softDeleteTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {tableDisplayNames[table] || table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                尚無稽核紀錄
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>資料類型</TableHead>
                    <TableHead>資料 ID</TableHead>
                    <TableHead>操作者</TableHead>
                    <TableHead>原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const actionInfo = actionDisplayNames[log.action] || { 
                      label: log.action, 
                      icon: null, 
                      color: 'bg-muted text-muted-foreground' 
                    };
                    const actor = log.actor as any;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${actionInfo.color} gap-1`} variant="secondary">
                            {actionInfo.icon}
                            {actionInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tableDisplayNames[log.table_name] || log.table_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate" title={log.record_id}>
                          {log.record_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {actor?.full_name || actor?.email || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={log.reason || ''}>
                          {log.reason || '-'}
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
    </Layout>
  );
}
