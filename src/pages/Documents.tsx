import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { useTableSort } from '@/hooks/useTableSort';
import { format, isWithinInterval, subDays } from 'date-fns';
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
import { useQueryClient } from '@tanstack/react-query';
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
  const { canEdit } = useAuth();
  
  // Fetch dynamic options
  const { options: docTypeOptions } = useOptionsForCategory('doc_type');
  const { options: docStatusOptions } = useOptionsForCategory('doc_status');
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Fetch documents with project info - use range to get all records (no 1000 limit)
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      // First get total count
      const { count, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      const totalCount = count || 0;
      const pageSize = 1000;
      const pages = Math.ceil(totalCount / pageSize);
      
      // Fetch all pages in parallel
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
      
      // Combine all results
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
  const { sortedData: sortedDocuments, sortConfig, handleSort } = useTableSort(filteredDocuments, {
    key: 'updated_at',
    direction: 'desc',
  });

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
    <div className="space-y-6 animate-fade-in">
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
              <SortableTableHead sortKey="projects.project_name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>案場</SortableTableHead>
              <SortableTableHead sortKey="doc_type" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>文件類型</SortableTableHead>
              <SortableTableHead sortKey="doc_status" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>狀態</SortableTableHead>
              <SortableTableHead sortKey="submitted_at" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>送件日</SortableTableHead>
              <SortableTableHead sortKey="issued_at" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>核發日</SortableTableHead>
              <SortableTableHead sortKey="due_at" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>到期日</SortableTableHead>
              <SortableTableHead sortKey="owner.full_name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort}>負責人</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              sortedDocuments.map(doc => {
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
                    onClick={() => navigate(`/projects/${doc.project_id}`)}
                  >
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
                      <Badge className={getDocStatusColor(doc.doc_status)} variant="secondary">
                        {doc.doc_status}
                      </Badge>
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
                    <TableCell>{owner?.full_name || '-'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Import/Export Dialog */}
      <ImportExportDialog
        open={isImportExportOpen}
        onOpenChange={setIsImportExportOpen}
        type="documents"
        data={documents as any}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['all-documents'] })}
      />
    </div>
  );
}
