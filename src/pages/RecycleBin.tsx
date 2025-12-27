import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useRecycleBin } from '@/hooks/useRecycleBin';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { useAuth } from '@/contexts/AuthContext';
import { tableDisplayNames, softDeleteTables, type SoftDeleteTable } from '@/hooks/useDeletionPolicy';

export default function RecycleBin() {
  const [selectedTable, setSelectedTable] = useState<SoftDeleteTable | 'all'>('all');
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  const tableFilter = selectedTable === 'all' ? undefined : selectedTable;
  const { data: deletedRecords = [], isLoading, refetch } = useRecycleBin(tableFilter);

  // Create soft delete hooks for each table type
  const getDeleteHook = (tableName: SoftDeleteTable) => {
    return useSoftDelete({
      tableName,
      queryKey: ['recycle-bin'],
    });
  };

  const handleRestore = async (record: typeof deletedRecords[0]) => {
    setOperatingId(record.id);
    try {
      const hook = getDeleteHook(record.table_name);
      await hook.restore({ id: record.id });
      refetch();
    } finally {
      setOperatingId(null);
    }
  };

  const handlePurge = async (record: typeof deletedRecords[0]) => {
    setOperatingId(record.id);
    try {
      const hook = getDeleteHook(record.table_name);
      await hook.purge({ id: record.id });
      refetch();
    } finally {
      setOperatingId(null);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">回收區</h1>
            <p className="text-muted-foreground">查看並管理已刪除的資料</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>已刪除資料</CardTitle>
                <CardDescription>
                  共 {deletedRecords.length} 筆已刪除資料
                </CardDescription>
              </div>
              <Select 
                value={selectedTable} 
                onValueChange={(v) => setSelectedTable(v as SoftDeleteTable | 'all')}
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
            ) : deletedRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                回收區是空的
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>資料類型</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>刪除時間</TableHead>
                    <TableHead>刪除原因</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedRecords.map((record) => (
                    <TableRow key={`${record.table_name}-${record.id}`}>
                      <TableCell>
                        <Badge variant="secondary">{record.display_name}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{record.record_name}</TableCell>
                      <TableCell>
                        {format(new Date(record.deleted_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.delete_reason || '-'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(record)}
                          disabled={operatingId === record.id}
                        >
                          {operatingId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          <span className="ml-1">復原</span>
                        </Button>
                        
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={operatingId === record.id}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="ml-1">永久刪除</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>確認永久刪除？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作將永久刪除「{record.record_name}」，且無法復原。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handlePurge(record)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  確認刪除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
