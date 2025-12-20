import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  MapPin,
  Zap,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectStatus = Database['public']['Enums']['project_status'];
type Investor = Database['public']['Tables']['investors']['Row'];

const statusColors: Record<ProjectStatus, string> = {
  '開發中': 'bg-info/15 text-info',
  '土地確認': 'bg-warning/15 text-warning',
  '結構簽證': 'bg-primary/15 text-primary',
  '台電送件': 'bg-info/15 text-info',
  '台電審查': 'bg-warning/15 text-warning',
  '能源局送件': 'bg-info/15 text-info',
  '同意備案': 'bg-success/15 text-success',
  '工程施工': 'bg-primary/15 text-primary',
  '報竣掛表': 'bg-info/15 text-info',
  '設備登記': 'bg-success/15 text-success',
  '運維中': 'bg-success/15 text-success',
  '暫停': 'bg-muted text-muted-foreground',
  '取消': 'bg-destructive/15 text-destructive',
};

const statusOptions: ProjectStatus[] = [
  '開發中', '土地確認', '結構簽證', '台電送件', '台電審查',
  '能源局送件', '同意備案', '工程施工', '報竣掛表', '設備登記',
  '運維中', '暫停', '取消'
];

const cities = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣'
];

export default function Projects() {
  const navigate = useNavigate();
  const { canEdit, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<ProjectInsert>>({});

  // Fetch projects with investor info
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(company_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch investors for dropdown
  const { data: investors = [] } = useQuery({
    queryKey: ['investors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProjectInsert) => {
      const { error } = await supabase.from('projects').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('案場建立成功');
      setIsCreateOpen(false);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error('建立失敗', { description: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      const { error } = await supabase.from('projects').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('案場更新成功');
      setEditingProject(null);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('案場已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.project_name.toLowerCase().includes(search.toLowerCase()) ||
      project.project_code.toLowerCase().includes(search.toLowerCase()) ||
      project.address?.toLowerCase().includes(search.toLowerCase()) ||
      (project.investors as any)?.company_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCity = cityFilter === 'all' || project.city === cityFilter;
    
    return matchesSearch && matchesStatus && matchesCity;
  });

  const handleCreate = () => {
    if (!formData.project_code || !formData.project_name) {
      toast.error('請填寫必填欄位');
      return;
    }
    createMutation.mutate({
      ...formData,
      created_by: user?.id,
    } as ProjectInsert);
  };

  const handleUpdate = () => {
    if (!editingProject) return;
    updateMutation.mutate({ id: editingProject.id, data: formData });
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormData({
      project_code: project.project_code,
      project_name: project.project_name,
      investor_id: project.investor_id,
      status: project.status,
      capacity_kwp: project.capacity_kwp,
      feeder_code: project.feeder_code,
      city: project.city,
      district: project.district,
      address: project.address,
      coordinates: project.coordinates,
      land_owner: project.land_owner,
      land_owner_contact: project.land_owner_contact,
      contact_person: project.contact_person,
      contact_phone: project.contact_phone,
      note: project.note,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">案場管理</h1>
          <p className="text-muted-foreground mt-1">共 {projects.length} 個案場</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新增案場
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案場名稱、編號、地址、投資方..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="狀態篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {statusOptions.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="縣市篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部縣市</SelectItem>
            {cities.map(city => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案場編號</TableHead>
              <TableHead>案場名稱</TableHead>
              <TableHead>投資方</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>容量 (kWp)</TableHead>
              <TableHead>縣市</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map(project => (
                <TableRow 
                  key={project.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <TableCell className="font-mono text-sm">{project.project_code}</TableCell>
                  <TableCell className="font-medium">{project.project_name}</TableCell>
                  <TableCell>{(project.investors as any)?.company_name || '-'}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[project.status]} variant="secondary">
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.capacity_kwp || '-'}</TableCell>
                  <TableCell>{project.city || '-'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          檢視
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => openEditDialog(project)}>
                            <Edit className="w-4 h-4 mr-2" />
                            編輯
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(project.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            刪除
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={isCreateOpen || !!editingProject} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingProject(null);
            setFormData({});
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? '編輯案場' : '新增案場'}</DialogTitle>
            <DialogDescription>
              {editingProject ? '修改案場資料' : '填寫案場基本資訊'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_code">案場編號 *</Label>
                <Input
                  id="project_code"
                  value={formData.project_code || ''}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  placeholder="例：PRJ-2024-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project_name">案場名稱 *</Label>
                <Input
                  id="project_name"
                  value={formData.project_name || ''}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="例：台南永康案"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="investor_id">投資方</Label>
                <Select 
                  value={formData.investor_id || ''} 
                  onValueChange={(value) => setFormData({ ...formData, investor_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇投資方" />
                  </SelectTrigger>
                  <SelectContent>
                    {investors.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>{inv.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">狀態</Label>
                <Select 
                  value={formData.status || '開發中'} 
                  onValueChange={(value) => setFormData({ ...formData, status: value as ProjectStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity_kwp">容量 (kWp)</Label>
                <Input
                  id="capacity_kwp"
                  type="number"
                  step="0.01"
                  value={formData.capacity_kwp || ''}
                  onChange={(e) => setFormData({ ...formData, capacity_kwp: parseFloat(e.target.value) || undefined })}
                  placeholder="例：499.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feeder_code">饋線代號</Label>
                <Input
                  id="feeder_code"
                  value={formData.feeder_code || ''}
                  onChange={(e) => setFormData({ ...formData, feeder_code: e.target.value })}
                  placeholder="例：TN-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">縣市</Label>
                <Select 
                  value={formData.city || ''} 
                  onValueChange={(value) => setFormData({ ...formData, city: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇縣市" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">區/鄉/鎮</Label>
                <Input
                  id="district"
                  value={formData.district || ''}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="例：永康區"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="完整地址"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="land_owner">承租/所有權人</Label>
                <Input
                  id="land_owner"
                  value={formData.land_owner || ''}
                  onChange={(e) => setFormData({ ...formData, land_owner: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="land_owner_contact">所有權人聯絡方式</Label>
                <Input
                  id="land_owner_contact"
                  value={formData.land_owner_contact || ''}
                  onChange={(e) => setFormData({ ...formData, land_owner_contact: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">聯絡人</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">聯絡電話</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone || ''}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">備註</Label>
              <Textarea
                id="note"
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateOpen(false);
                setEditingProject(null);
                setFormData({});
              }}
            >
              取消
            </Button>
            <Button 
              onClick={editingProject ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingProject ? '更新' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
