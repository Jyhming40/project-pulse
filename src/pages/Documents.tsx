import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { useTableSort } from '@/hooks/useTableSort';
import { usePagination } from '@/hooks/usePagination';
import { useBatchSelect } from '@/hooks/useBatchSelect';
import { useDocumentTags, useAllDocumentTagAssignments } from '@/hooks/useDocumentTags';
import { useBatchOcr } from '@/hooks/useBatchOcr';
import { deleteDriveFile } from '@/hooks/useDriveSync';
import { format, isWithinInterval, subDays } from 'date-fns';
import { TablePagination } from '@/components/ui/table-pagination';
import { BatchActionBar, BatchActionIcons } from '@/components/BatchActionBar';
import { BatchUpdateDialog, BatchUpdateField } from '@/components/BatchUpdateDialog';
import { BatchDeleteDialog } from '@/components/BatchDeleteDialog';
import { CreateDocumentDialog } from '@/components/CreateDocumentDialog';
import { DocumentDetailDialog } from '@/components/DocumentDetailDialog';
import { BatchUploadVersionDialog } from '@/components/BatchUploadVersionDialog';
import { BatchOcrDialog } from '@/components/BatchOcrDialog';
import { DocumentTagBadge } from '@/components/DocumentTagBadge';
import { getDerivedDocStatus, getDerivedDocStatusColor, DerivedDocStatus } from '@/lib/documentStatus';
import { 
  AGENCY_CODE_TO_LABEL, 
  AGENCY_CODES, 
  getDocTypeLabelByCode, 
  getAgencyCodeByDocTypeCode,
  type AgencyCode 
} from '@/lib/docTypeMapping';
import { GroupedDocTypeSelect } from '@/components/GroupedDocTypeSelect';
import { 
  Search, 
  FileText, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileDown,
  Info,
  Plus,
  Building2,
  Upload,
  Bell,
  Loader2,
  Tag,
  ScanText,
} from 'lucide-react';
import { toast } from 'sonner';
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
import type { Database } from '@/integrations/supabase/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type DocType = Database['public']['Enums']['doc_type'];

// Filter options for derived status
const derivedStatusOptions: { value: DerivedDocStatus; label: string }[] = [
  { value: '未開始', label: '未開始' },
  { value: '已開始', label: '已開始' },
  { value: '已取得', label: '已取得' },
];

export default function Documents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  
  // Fetch doc_type_code options (single source of truth)
  const { options: docTypeOptions } = useOptionsForCategory('doc_type_code');
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [isBatchOcrOpen, setIsBatchOcrOpen] = useState(false);

  // Batch OCR hook
  const batchOcr = useBatchOcr({ maxConcurrent: 3, maxBatchSize: 50, autoUpdate: true });

  // Fetch document tags and assignments
  const { tags } = useDocumentTags();
  const { data: tagAssignments } = useAllDocumentTagAssignments();
  
  // Fetch documents with project info and file counts
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const { count, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);
      
      if (countError) throw countError;
      
      const totalCount = count || 0;
      const pageSize = 1000;
      const pages = Math.ceil(totalCount / pageSize);
      
      const promises = [];
      for (let i = 0; i < pages; i++) {
        promises.push(
          supabase
            .from('documents')
            .select('*, projects(project_name, project_code, drive_folder_id), owner:profiles!documents_owner_user_id_fkey(full_name), document_files(id)')
            .eq('is_deleted', false)
            .eq('document_files.is_deleted', false)
            .order('updated_at', { ascending: false })
            .range(i * pageSize, (i + 1) * pageSize - 1)
        );
      }
      
      const results = await Promise.all(promises);
      
      const allData: any[] = [];
      for (const result of results) {
        if (result.error) throw result.error;
        // Add file_count to each document
        const docsWithFileCount = (result.data || []).map((doc: any) => ({
          ...doc,
          file_count: Array.isArray(doc.document_files) ? doc.document_files.length : 0,
        }));
        allData.push(...docsWithFileCount);
      }
      
      return allData;
    },
  });

  const uniqueProjects = documents.reduce((acc, doc) => {
    const project = doc.projects as any;
    if (project && !acc.find(p => p.id === doc.project_id)) {
      acc.push({ id: doc.project_id, code: project.project_code, name: project.project_name });
    }
    return acc;
  }, [] as { id: string; code: string; name: string }[]).sort((a, b) => a.code.localeCompare(b.code));

  // Filter documents with derived status, project filter, agency filter, tag filter, and enhanced search
  const filteredDocuments = documents.filter(doc => {
    const project = doc.projects as any;
    const searchLower = search.toLowerCase();
    
    // Enhanced search across multiple fields
    const matchesSearch = !search || 
      project?.project_name?.toLowerCase().includes(searchLower) ||
      project?.project_code?.toLowerCase().includes(searchLower) ||
      doc.doc_type.toLowerCase().includes(searchLower) ||
      doc.title?.toLowerCase().includes(searchLower) ||
      doc.note?.toLowerCase().includes(searchLower);
    
    // Type filter - check both doc_type_code and doc_type for backward compatibility
    // Special handling: '審查意見書' filter should also match 'TPC_REVIEW_SIMPLE' and doc_type '審查意見書'
    let matchesType = typeFilter === 'all' || 
      doc.doc_type_code === typeFilter || 
      doc.doc_type === typeFilter;
    
    // Handle special case for 審查意見書 (matches both label and old doc_type values)
    if (!matchesType && typeFilter === 'TPC_REVIEW_SIMPLE') {
      matchesType = doc.doc_type === '審查意見書';
    }
    
    // Agency filter - use doc_type_code or agency_code
    let matchesAgency = agencyFilter === 'all';
    if (!matchesAgency) {
      const docAgency = doc.agency_code || getAgencyCodeByDocTypeCode(doc.doc_type_code || '');
      matchesAgency = docAgency === agencyFilter;
    }
    
    const matchesProject = projectFilter === 'all' || doc.project_id === projectFilter;
    
    // Tag filter
    let matchesTag = true;
    if (tagFilter !== 'all' && tagAssignments) {
      const docTags = tagAssignments.get(doc.id) || [];
      matchesTag = docTags.some(t => t.id === tagFilter);
    }
    
    // Handle status filter including 'upcoming' for expiring soon
    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'upcoming') {
      // Filter for documents due within 14 days
      if (!doc.due_at) {
        matchesStatus = false;
      } else {
        const dueDate = new Date(doc.due_at);
        const today = new Date();
        const in14Days = subDays(new Date(), -14);
        matchesStatus = isWithinInterval(dueDate, { start: today, end: in14Days });
      }
    } else {
      // Use derived status for filtering
      const derivedStatus = getDerivedDocStatus(doc);
      matchesStatus = derivedStatus === statusFilter;
    }
    
    return matchesSearch && matchesType && matchesAgency && matchesStatus && matchesProject && matchesTag;
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

  // Batch update mutation with audit logging
  const batchUpdateMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const selectedIds = Array.from(batchSelect.selectedIds);
      
      // Get old data for audit
      const { data: oldData } = await supabase
        .from('documents')
        .select('id, doc_status, doc_type')
        .in('id', selectedIds);
      
      const { error } = await supabase
        .from('documents')
        .update(values)
        .in('id', selectedIds);
      if (error) throw error;
      
      // Log batch update to audit_logs
      for (const id of selectedIds) {
        const oldRecord = oldData?.find(r => r.id === id);
        await supabase.rpc('log_audit_action', {
          p_table_name: 'documents',
          p_record_id: id,
          p_action: 'UPDATE',
          p_old_data: oldRecord || null,
          p_new_data: { ...oldRecord, ...values },
          p_reason: `批次更新 ${selectedIds.length} 筆資料`,
        });
      }
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

  // Batch delete mutation with audit logging and optional Drive sync
  const batchDeleteMutation = useMutation({
    mutationFn: async ({ reason, deleteDriveFiles }: { reason?: string; deleteDriveFiles?: boolean }) => {
      const selectedIds = Array.from(batchSelect.selectedIds);
      
      // Get documents with drive_file_id for Drive deletion
      const { data: docsToDelete } = await supabase
        .from('documents')
        .select('id, doc_type, doc_status, drive_file_id')
        .in('id', selectedIds);
      
      // Delete from Drive first if requested
      if (deleteDriveFiles && docsToDelete) {
        const drivePromises = docsToDelete
          .filter(d => d.drive_file_id)
          .map(d => deleteDriveFile(d.id));
        
        const driveResults = await Promise.all(drivePromises);
        const successCount = driveResults.filter(r => r.driveDeleted).length;
        if (successCount > 0) {
          toast.success(`已刪除 ${successCount} 個雲端檔案`);
        }
      }
      
      const { error } = await supabase
        .from('documents')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          delete_reason: reason || null,
        })
        .in('id', selectedIds);
      if (error) throw error;
      
      // Log batch delete to audit_logs
      for (const id of selectedIds) {
        const oldRecord = docsToDelete?.find(r => r.id === id);
        await supabase.rpc('log_audit_action', {
          p_table_name: 'documents',
          p_record_id: id,
          p_action: 'DELETE',
          p_old_data: oldRecord || null,
          p_new_data: null,
          p_reason: reason || `批次刪除 ${selectedIds.length} 筆資料`,
        });
      }
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

  // Batch update fields - note: status is derived from dates, cannot be manually updated
  // To change status, update the date fields directly in the document detail page
  const batchUpdateFields: BatchUpdateField[] = [
    {
      key: 'doc_type',
      label: '文件類型',
      type: 'select',
      options: docTypeOptions,
      placeholder: '選擇類型',
    },
  ];

  // Send expiry reminders
  const handleSendReminders = async () => {
    try {
      setIsSendingReminders(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('請先登入');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-document-expiry`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ daysAhead: 14, sendEmails: true }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '發送失敗');
      }

      if (result.count === 0) {
        toast.info('目前沒有即將到期的文件');
      } else {
        toast.success(`已發送 ${result.emailsSent || 0} 封到期提醒通知`);
      }
    } catch (error: any) {
      toast.error('發送提醒失敗', { description: error.message });
    } finally {
      setIsSendingReminders(false);
    }
  };

  // Stats - using derived status
  const notStartedCount = documents.filter(d => getDerivedDocStatus(d) === '未開始').length;
  const inProgressCount = documents.filter(d => getDerivedDocStatus(d) === '已開始').length;
  const completedCount = documents.filter(d => getDerivedDocStatus(d) === '已取得').length;
  
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
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增文件
              </Button>
              <Button variant="outline" onClick={() => setIsImportExportOpen(true)}>
                <FileDown className="w-4 h-4 mr-2" />
                匯入/匯出
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleSendReminders}
              disabled={isSendingReminders}
            >
              {isSendingReminders ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bell className="w-4 h-4 mr-2" />
              )}
              發送到期提醒
            </Button>
          )}
        </div>
      </div>

      {/* Stats - clickable cards for filtering */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === '未開始' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === '未開始' ? 'all' : '未開始')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <XCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notStartedCount}</p>
              <p className="text-xs text-muted-foreground">未開始</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === '已開始' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === '已開始' ? 'all' : '已開始')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">已開始</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === '已取得' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === '已取得' ? 'all' : '已取得')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">已取得</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'upcoming' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingDueCount}</p>
              <p className="text-xs text-muted-foreground">即將到期</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案場、標題、備註..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="選擇案場" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部案場</SelectItem>
            {uniqueProjects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-mono text-xs text-muted-foreground mr-1">{p.code}</span>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <SelectValue placeholder="發證機關" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部機關</SelectItem>
            {AGENCY_CODES.map(code => (
              <SelectItem key={code} value={code}>
                {AGENCY_CODE_TO_LABEL[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {derivedStatusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <SelectValue placeholder="標籤篩選" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部標籤</SelectItem>
            {tags.map(tag => (
              <SelectItem key={tag.id} value={tag.id}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-${tag.color}-500`} />
                  {tag.name}
                </div>
              </SelectItem>
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
              <TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        狀態
                        <Info className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>狀態由送件日 / 核發日自動判斷</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <SortableTableHead sortKey="submitted_at" currentSortKey={sortConfig.key} currentDirection={getSortInfo('submitted_at').direction} sortIndex={getSortInfo('submitted_at').index} onSort={handleSort}>送件日</SortableTableHead>
              <SortableTableHead sortKey="issued_at" currentSortKey={sortConfig.key} currentDirection={getSortInfo('issued_at').direction} sortIndex={getSortInfo('issued_at').index} onSort={handleSort}>核發日</SortableTableHead>
              <SortableTableHead sortKey="due_at" currentSortKey={sortConfig.key} currentDirection={getSortInfo('due_at').direction} sortIndex={getSortInfo('due_at').index} onSort={handleSort}>到期日</SortableTableHead>
              <TableHead>標籤</TableHead>
              <SortableTableHead sortKey="owner.full_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('owner.full_name').direction} sortIndex={getSortInfo('owner.full_name').index} onSort={handleSort}>負責人</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedData.map(doc => {
                const project = doc.projects as any;
                const docTags = tagAssignments?.get(doc.id) || [];
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
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      setIsDetailOpen(true);
                    }}
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
                    <TableCell>
                      <div>
                        <p className="font-medium">{project?.project_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{project?.project_code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {doc.doc_type}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const derivedStatus = getDerivedDocStatus(doc);
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={getDerivedDocStatusColor(derivedStatus)} variant="secondary">
                                  {derivedStatus}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>狀態由送件日 / 核發日自動判斷</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {doc.submitted_at ? format(new Date(doc.submitted_at), 'yyyy/MM/dd') : '-'}
                    </TableCell>
                    <TableCell>
                      {doc.issued_at ? format(new Date(doc.issued_at), 'yyyy/MM/dd') : '-'}
                    </TableCell>
                    <TableCell>
                      {doc.due_at ? (
                        <span className={isDueSoon ? 'text-destructive font-medium' : ''}>
                          {format(new Date(doc.due_at), 'yyyy/MM/dd')}
                          {isDueSoon && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {docTags.map(tag => (
                          <DocumentTagBadge
                            key={tag.id}
                            name={tag.name}
                            color={tag.color}
                            size="sm"
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{owner?.full_name || '-'}</TableCell>
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
              key: 'ocr',
              label: '批次 OCR 辨識',
              icon: <ScanText className="w-4 h-4" />,
              onClick: async () => {
                // Prepare documents for batch OCR
                const docsForOcr = batchSelect.selectedItems.map(doc => ({
                  id: doc.id,
                  title: doc.title || doc.doc_type,
                  projectCode: (doc.projects as any)?.project_code || '',
                  projectId: doc.project_id,
                  hasDriveFile: !!doc.drive_file_id,
                  hasSubmittedAt: !!doc.submitted_at,
                  hasIssuedAt: !!doc.issued_at,
                }));
                
                setIsBatchOcrOpen(true);
                const result = await batchOcr.startBatchOcr(docsForOcr);
                
                if (!result.started) {
                  toast.error('批次 OCR 無法開始', { description: result.message });
                  setIsBatchOcrOpen(false);
                } else {
                  // Refresh data after OCR completes
                  queryClient.invalidateQueries({ queryKey: ['all-documents'] });
                }
              },
            },
            {
              key: 'upload',
              label: '批次上傳新版本',
              icon: <Upload className="w-4 h-4" />,
              onClick: () => setIsBatchUploadOpen(true),
            },
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
        selectedItems={batchSelect.selectedItems}
        fields={batchUpdateFields}
        onSubmit={async (values) => {
          await batchUpdateMutation.mutateAsync(values);
        }}
        isLoading={batchUpdateMutation.isPending}
        getItemLabel={(item) => `${item.doc_type} - ${(item as unknown as { projects?: { project_name?: string } }).projects?.project_name || ''}`}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        selectedCount={batchSelect.selectedCount}
        itemLabel="筆文件"
        requireReason
        onConfirm={async (reason, deleteDriveFiles) => {
          await batchDeleteMutation.mutateAsync({ reason, deleteDriveFiles });
        }}
        isLoading={batchDeleteMutation.isPending}
        driveFileCount={batchSelect.selectedItems.filter(d => d.drive_file_id).length}
      />

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultProjectId={projectFilter !== 'all' ? projectFilter : null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['all-documents'] });
        }}
      />

      {/* Document Detail Dialog */}
      <DocumentDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        documentId={selectedDocumentId}
      />

      {/* Batch Upload Version Dialog */}
      <BatchUploadVersionDialog
        open={isBatchUploadOpen}
        onOpenChange={setIsBatchUploadOpen}
        selectedDocuments={batchSelect.selectedItems.map(doc => ({
          id: doc.id,
          doc_type: doc.doc_type,
          title: doc.title,
          version: doc.version,
          projects: doc.projects as any,
        }))}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['all-documents'] });
          batchSelect.deselectAll();
        }}
      />

      {/* Batch OCR Dialog */}
      <BatchOcrDialog
        open={isBatchOcrOpen}
        onOpenChange={setIsBatchOcrOpen}
        tasks={batchOcr.tasks}
        progress={batchOcr.progress}
        isRunning={batchOcr.isRunning}
        onCancel={batchOcr.cancelBatchOcr}
        onClose={() => {
          batchOcr.reset();
          batchSelect.deselectAll();
        }}
      />
    </div>
  );
}
