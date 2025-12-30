import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { useTableSort } from '@/hooks/useTableSort';
import { usePagination } from '@/hooks/usePagination';
import { useBatchSelect } from '@/hooks/useBatchSelect';
import { format, isWithinInterval, subDays } from 'date-fns';
import { TablePagination } from '@/components/ui/table-pagination';
import { BatchActionBar, BatchActionIcons } from '@/components/BatchActionBar';
import { BatchUpdateDialog, BatchUpdateField } from '@/components/BatchUpdateDialog';
import { BatchDeleteDialog } from '@/components/BatchDeleteDialog';
import { 
  Search, 
  FileText, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ImportExportDialog } from '@/components/ImportExportDialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type DocType = Database['public']['Enums']['doc_type'];
type DocStatus = Database['public']['Enums']['doc_status'];

// Dynamic status color mapping
const getDocStatusColor = (status: string) => {
  const docStatusColorMap: Record<string, string> = {
    '未開始': 'bg-muted text-muted-foreground',
    '進行中': 'bg-info/15 text-info',
    '已完成': 'bg-success/15 text-success',
    '退件補正': 'bg-warning/15 text-warning',
  };
  return docStatusColorMap[status] || 'bg-muted text-muted-foreground';
};

export default function Documents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  
  // Fetch dynamic options
  const { options: docTypeOptions } = useOptionsForCategory('doc_type');
  const { options: docStatusOptions } = useOptionsForCategory('doc_status');
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);

  // Fetch documents with project info
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const { count, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      const totalCount = count || 0;
      const pageSize = 1000;
      const pages = Math.ceil(totalCount / pageSize);
      
      const promises = [];
      for (let i = 0; i < pages; i++) {
        promises.push(
          supabase
            .from('documents')
            .select('*, projects(project_name, project_code), owner:profiles!documents_owner_user_id_fkey(full_name)')
            .order('updated_at', { ascending: false })
            .range(i * pageSize, (i + 1) * pageSize - 1)
        );
      }
      
      const results = await Promise.all(promises);
      
      const allData: any[] = [];
      for (const result of results) {
        if (result.error) throw result.error;
        allData.push(...(result.data || []));
      }
      
      return allData;
    },
  });

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const project = doc.projects as any;
    const matchesSearch = 
      project?.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      project?.project_code?.toLowerCase().includes(search.toLowerCase()) ||
      doc.doc_type.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === 'all' || doc.doc_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || doc.doc_status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Sorting
  const { sortedData: sortedDocuments, sortConfig, handleSort, getSortInfo } = useTableSort(filteredDocuments, {
    key: 'updated_at',
    direction: 'desc',
  });

  // Pagination
  const pagination = usePagination(sortedDocuments, { pageSize: 20 });

  // Batch selection
  const batchSelect = useBatchSelect(pagination.paginatedData);

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const selectedIds = Array.from(batchSelect.selectedIds);
      const { error } = await supabase
        .from('documents')
        .update(values)
        .in('id', selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      toast.success('批次更新成功');
      batchSelect.deselectAll();
    },
    onError: (error: Error) => {
      toast.error('批次更新失敗', { description: error.message });
    },
  });

  // Batch delete mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const selectedIds = Array.from(batchSelect.selectedIds);
      const { error } = await supabase
        .from('documents')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          delete_reason: reason || null,
        })
        .in('id', selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      toast.success('批次刪除成功');
      batchSelect.deselectAll();
    },
    onError: (error: Error) => {
      toast.error('批次刪除失敗', { description: error.message });
    },
  });

  // Batch update fields
  const batchUpdateFields: BatchUpdateField[] = [
    {
      key: 'doc_status',
      label: '文件狀態',
      type: 'select',
      options: docStatusOptions,
      placeholder: '選擇狀態',
    },
  ];

  // Stats
  const pendingCount = documents.filter(d => d.doc_status === '退件補正').length;
  const inProgressCount = documents.filter(d => d.doc_status === '進行中').length;
  const completedCount = documents.filter(d => d.doc_status === '已完成').length;
  
  const upcomingDueCount = documents.filter(d => {
    if (!d.due_at) return false;
    const dueDate = new Date(d.due_at);
    const today = new Date();
    const in14Days = subDays(new Date(), -14);
    return isWithinInterval(dueDate, { start: today, end: in14Days });
  }).length;

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">文件管理</h1>
          <p className="text-muted-foreground mt-1">
            所有案場文件總覽 {documents.length > 0 && `(共 ${documents.length} 筆)`}
          </p>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setIsImportExportOpen(true)}>
            <FileDown className="w-4 h-4 mr-2" />
            匯入/匯出
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">進行中</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">待補正</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingDueCount}</p>
              <p className="text-xs text-muted-foreground">即將到期</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">已完成</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案場名稱、編號、文件類型..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="文件類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            {docTypeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="狀態篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {docStatusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={batchSelect.isAllSelected}
                    onCheckedChange={() => batchSelect.toggleAll()}
                    aria-label="全選"
                  />
                </TableHead>
              )}
              <SortableTableHead sortKey="projects.project_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('projects.project_name').direction} sortIndex={getSortInfo('projects.project_name').index} onSort={handleSort}>案場</SortableTableHead>
              <SortableTableHead sortKey="doc_type" currentSortKey={sortConfig.key} currentDirection={getSortInfo('doc_type').direction} sortIndex={getSortInfo('doc_type').index} onSort={handleSort}>文件類型</SortableTableHead>
              <SortableTableHead sortKey="doc_status" currentSortKey={sortConfig.key} currentDirection={getSortInfo('doc_status').direction} sortIndex={getSortInfo('doc_status').index} onSort={handleSort}>狀態</SortableTableHead>
              <SortableTableHead sortKey="submitted_at" currentSortKey={sortConfig.key} currentDirection={getSortInfo('submitted_at').direction} sortIndex={getSortInfo('submitted_at').index} onSort={handleSort}>送件日</SortableTableHead>
              <SortableTableHead sortKey="issued_at" currentSortKey={sortConfig.key} currentDirection={getSortInfo('issued_at').direction} sortIndex={getSortInfo('issued_at').index} onSort={handleSort}>核發日</SortableTableHead>
              <SortableTableHead sortKey="due_at" currentSortKey={sortConfig.key} currentDirection={getSortInfo('due_at').direction} sortIndex={getSortInfo('due_at').index} onSort={handleSort}>到期日</SortableTableHead>
              <SortableTableHead sortKey="owner.full_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('owner.full_name').direction} sortIndex={getSortInfo('owner.full_name').index} onSort={handleSort}>負責人</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedData.map(doc => {
                const project = doc.projects as any;
                const owner = doc.owner as any;
                const isDueSoon = doc.due_at && isWithinInterval(new Date(doc.due_at), {
                  start: new Date(),
                  end: subDays(new Date(), -14)
                });

                return (
                  <TableRow 
                    key={doc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-selected={batchSelect.isSelected(doc.id)}
                  >
                    {canEdit && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={batchSelect.isSelected(doc.id)}
                          onCheckedChange={() => batchSelect.toggle(doc.id)}
                          aria-label={`選取 ${doc.doc_type}`}
                        />
                      </TableCell>
                    )}
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>
                      <div>
                        <p className="font-medium">{project?.project_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{project?.project_code}</p>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {doc.doc_type}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>
                      <Badge className={getDocStatusColor(doc.doc_status)} variant="secondary">
                        {doc.doc_status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>
                      {doc.submitted_at ? format(new Date(doc.submitted_at), 'yyyy/MM/dd') : '-'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>
                      {doc.issued_at ? format(new Date(doc.issued_at), 'yyyy/MM/dd') : '-'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>
                      {doc.due_at ? (
                        <span className={isDueSoon ? 'text-destructive font-medium' : ''}>
                          {format(new Date(doc.due_at), 'yyyy/MM/dd')}
                          {isDueSoon && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/projects/${doc.project_id}`)}>{owner?.full_name || '-'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          hasNextPage={pagination.hasNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          onPageChange={pagination.goToPage}
          onPageSizeChange={pagination.changePageSize}
          getPageNumbers={pagination.getPageNumbers}
        />
      </div>

      {/* Import/Export Dialog */}
      <ImportExportDialog
        open={isImportExportOpen}
        onOpenChange={setIsImportExportOpen}
        type="documents"
        data={documents as any}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['all-documents'] })}
      />

      {/* Batch Action Bar */}
      {canEdit && (
        <BatchActionBar
          selectedCount={batchSelect.selectedCount}
          onClear={batchSelect.deselectAll}
          actions={[
            {
              key: 'edit',
              label: '批次修改',
              icon: BatchActionIcons.edit,
              onClick: () => setIsBatchUpdateOpen(true),
            },
            ...(isAdmin ? [{
              key: 'delete',
              label: '批次刪除',
              icon: BatchActionIcons.delete,
              variant: 'destructive' as const,
              onClick: () => setIsBatchDeleteOpen(true),
            }] : []),
          ]}
        />
      )}

      {/* Batch Update Dialog */}
      <BatchUpdateDialog
        open={isBatchUpdateOpen}
        onOpenChange={setIsBatchUpdateOpen}
        title="批次更新文件"
        selectedCount={batchSelect.selectedCount}
        fields={batchUpdateFields}
        onSubmit={async (values) => {
          await batchUpdateMutation.mutateAsync(values);
        }}
        isLoading={batchUpdateMutation.isPending}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        selectedCount={batchSelect.selectedCount}
        itemLabel="筆文件"
        requireReason
        onConfirm={async (reason) => {
          await batchDeleteMutation.mutateAsync(reason);
        }}
        isLoading={batchDeleteMutation.isPending}
      />
    </div>
  );
}
