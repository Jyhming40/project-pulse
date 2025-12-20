import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isWithinInterval, subDays } from 'date-fns';
import { 
  Search, 
  FileText, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type DocType = Database['public']['Enums']['doc_type'];
type DocStatus = Database['public']['Enums']['doc_status'];

const docStatusColors: Record<DocStatus, string> = {
  '未開始': 'bg-muted text-muted-foreground',
  '進行中': 'bg-info/15 text-info',
  '已完成': 'bg-success/15 text-success',
  '退件補正': 'bg-warning/15 text-warning',
};

const docTypeOptions: DocType[] = [
  '台電審查意見書', '能源局同意備案', '結構簽證', '躉售合約',
  '報竣掛表', '設備登記', '土地契約', '其他'
];

const docStatusOptions: DocStatus[] = ['未開始', '進行中', '已完成', '退件補正'];

export default function Documents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch documents with project info
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*, projects(project_name, project_code), profiles:owner_user_id(full_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
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
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">文件管理</h1>
        <p className="text-muted-foreground mt-1">所有案場文件總覽</p>
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
            {docTypeOptions.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="狀態篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {docStatusOptions.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案場</TableHead>
              <TableHead>文件類型</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>送件日</TableHead>
              <TableHead>核發日</TableHead>
              <TableHead>到期日</TableHead>
              <TableHead>負責人</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map(doc => {
                const project = doc.projects as any;
                const owner = doc.profiles as any;
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
                      <Badge className={docStatusColors[doc.doc_status]} variant="secondary">
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
    </div>
  );
}
