import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, Loader2, Search, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useRecycleBin, type DeletedRecord } from '@/hooks/useRecycleBin';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { tableDisplayNames, softDeleteTables, type SoftDeleteTable } from '@/hooks/useDeletionPolicy';

export default function RecycleBin() {
  const [selectedTable, setSelectedTable] = useState<SoftDeleteTable | 'all'>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  // Fetch doc_type options for document type filter
  const { options: docTypeOptions } = useOptionsForCategory('doc_type');

  const tableFilter = selectedTable === 'all' ? undefined : selectedTable;
  const { data: deletedRecords = [], isLoading, refetch } = useRecycleBin(tableFilter);

  // Filter records by doc_type and search query
  const filteredRecords = useMemo(() => {
    return deletedRecords.filter(record => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        record.record_name?.toLowerCase().includes(searchLower) ||
        record.display_name?.toLowerCase().includes(searchLower) ||
        record.delete_reason?.toLowerCase().includes(searchLower);

      // Doc type filter (only applies to documents)
      let matchesDocType = true;
      if (docTypeFilter !== 'all') {
        if (record.table_name === 'documents') {
          const docType = record.raw_data?.doc_type as string | undefined;
          matchesDocType = docType === docTypeFilter;
        } else {
          // Non-document records don't match when doc type filter is active
          matchesDocType = false;
        }
      }

      return matchesSearch && matchesDocType;
    });
  }, [deletedRecords, searchQuery, docTypeFilter]);

  // Get unique doc_types from deleted documents for filter dropdown
  const availableDocTypes = useMemo(() => {
    const docTypes = new Set<string>();
    deletedRecords.forEach(record => {
      if (record.table_name === 'documents' && record.raw_data?.doc_type) {
        docTypes.add(record.raw_data.doc_type as string);
      }
    });
    return Array.from(docTypes).sort();
  }, [deletedRecords]);

  // Create soft delete hooks for all table types at component level (respecting Rules of Hooks)
  const projectsHook = useSoftDelete({ tableName: 'projects', queryKey: ['recycle-bin'] });
  const investorsHook = useSoftDelete({ tableName: 'investors', queryKey: ['recycle-bin'] });
  const partnersHook = useSoftDelete({ tableName: 'partners', queryKey: ['recycle-bin'] });
  const documentsHook = useSoftDelete({ tableName: 'documents', queryKey: ['recycle-bin'] });
  const partnerContactsHook = useSoftDelete({ tableName: 'partner_contacts', queryKey: ['recycle-bin'] });
  const investorContactsHook = useSoftDelete({ tableName: 'investor_contacts', queryKey: ['recycle-bin'] });
  const investorPaymentMethodsHook = useSoftDelete({ tableName: 'investor_payment_methods', queryKey: ['recycle-bin'] });
  const documentFilesHook = useSoftDelete({ tableName: 'document_files', queryKey: ['recycle-bin'] });
  const constructionAssignmentsHook = useSoftDelete({ tableName: 'project_construction_assignments', queryKey: ['recycle-bin'] });

  // Map table names to their hooks
  const hookMap: Partial<Record<SoftDeleteTable, ReturnType<typeof useSoftDelete>>> = {
    projects: projectsHook,
    investors: investorsHook,
    partners: partnersHook,
    documents: documentsHook,
    partner_contacts: partnerContactsHook,
    investor_contacts: investorContactsHook,
    investor_payment_methods: investorPaymentMethodsHook,
    document_files: documentFilesHook,
    project_construction_assignments: constructionAssignmentsHook,
  };

  const handleRestore = async (record: DeletedRecord) => {
    setOperatingId(record.id);
    try {
      const hook = hookMap[record.table_name];
      if (hook) {
        await hook.restore({ id: record.id });
        refetch();
      }
    } finally {
      setOperatingId(null);
    }
  };

  const handlePurge = async (record: DeletedRecord) => {
    setOperatingId(record.id);
    try {
      const hook = hookMap[record.table_name];
      if (hook) {
        await hook.purge({ id: record.id });
        refetch();
      }
    } finally {
      setOperatingId(null);
    }
  };

  // Check if we should show document type filter
  const showDocTypeFilter = selectedTable === 'all' || selectedTable === 'documents';
  const hasDocumentRecords = deletedRecords.some(r => r.table_name === 'documents');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">回收區</h1>
          <p className="text-muted-foreground">查看並管理已刪除的資料</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>已刪除資料</CardTitle>
                <CardDescription>
                  共 {filteredRecords.length} 筆已刪除資料
                  {filteredRecords.length !== deletedRecords.length && ` (篩選自 ${deletedRecords.length} 筆)`}
                </CardDescription>
              </div>
            </div>
            
            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋名稱、刪除原因..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Table type filter */}
              <Select 
                value={selectedTable} 
                onValueChange={(v) => {
                  setSelectedTable(v as SoftDeleteTable | 'all');
                  // Reset doc type filter when changing table
                  if (v !== 'all' && v !== 'documents') {
                    setDocTypeFilter('all');
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="篩選資料類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部類型</SelectItem>
                  {softDeleteTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {tableDisplayNames[table] || table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Document type filter - only show when documents are visible */}
              {showDocTypeFilter && hasDocumentRecords && (
                <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="文件類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部文件類型</SelectItem>
                    {availableDocTypes.map((docType) => (
                      <SelectItem key={docType} value={docType}>
                        {docType}
                      </SelectItem>
                    ))}
                    {/* Also show from system options that might not be in deleted records */}
                    {docTypeOptions
                      .filter(opt => !availableDocTypes.includes(opt.value))
                      .map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {deletedRecords.length === 0 ? '回收區是空的' : '沒有符合篩選條件的資料'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>資料類型</TableHead>
                  <TableHead>名稱</TableHead>
                  {showDocTypeFilter && <TableHead>文件類型</TableHead>}
                  <TableHead>刪除時間</TableHead>
                  <TableHead>刪除原因</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={`${record.table_name}-${record.id}`}>
                    <TableCell>
                      <Badge variant="secondary">{record.display_name}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{record.record_name}</TableCell>
                    {showDocTypeFilter && (
                      <TableCell>
                        {record.table_name === 'documents' && record.raw_data?.doc_type ? (
                          <Badge variant="outline">{record.raw_data.doc_type as string}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
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
  );
}
