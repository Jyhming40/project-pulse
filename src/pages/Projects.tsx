import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
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
  Trash2,
  FileDown,
  FileUp,
  Wrench
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

// Dynamic status color mapping - fallback to default style if not found
const getStatusColor = (status: string) => {
  const statusColorMap: Record<string, string> = {
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
  return statusColorMap[status] || 'bg-muted text-muted-foreground';
};

const getConstructionStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    '已開工': 'bg-primary/15 text-primary',
    '尚未開工': 'bg-muted text-muted-foreground',
    '已掛錶': 'bg-success/15 text-success',
    '待掛錶': 'bg-warning/15 text-warning',
    '暫緩': 'bg-muted text-muted-foreground',
    '取消': 'bg-destructive/15 text-destructive',
  };
  return colorMap[status] || 'bg-muted text-muted-foreground';
};

const cities = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣'
];

// Enum options for new fields
const installationTypes = [
  '畜牧舍', '農業設施', '農棚', '地面型', '農舍', '住宅', '廠辦',
  '特目用建物', '特登工廠', '集合住宅', '其他設施', '新建物（農業）', '新建物（其他）'
];

const gridConnectionTypes = ['高壓併低壓側', '低壓', '併內線－躉售', '併內線－自發自用'];
const powerPhaseTypes = ['單相三線式', '三相三線式', '三相四線式'];
const powerVoltages = ['220V', '220V / 380V', '380V', '440V', '480V'];
const poleStatuses = ['已立桿', '未立桿', '基礎完成', '無須', '需移桿', '亭置式'];
const constructionStatuses = ['已開工', '尚未開工', '已掛錶', '待掛錶', '暫緩', '取消'];

export default function Projects() {
  const navigate = useNavigate();
  const { canEdit, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch dynamic status options
  const { options: statusOptions } = useOptionsForCategory('project_status');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [constructionFilter, setConstructionFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<ProjectInsert> & {
    installation_type?: string;
    actual_installed_capacity?: number;
    taipower_pv_id?: string;
    grid_connection_type?: string;
    power_phase_type?: string;
    power_voltage?: string;
    pole_status?: string;
    construction_status?: string;
  }>({});
  
  // Import/Export dialog
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

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
    mutationFn: async (data: any) => {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert(data)
        .select('id')
        .single();
      if (error) throw error;
      return newProject;
    },
    onSuccess: async (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('案場建立成功');
      setIsCreateOpen(false);
      setFormData({});
      
      // Navigate to project detail for Drive folder creation (now requires OAuth)
      if (newProject?.id) {
        toast.info('請至案場詳情頁連結 Google Drive 並建立資料夾');
      }
    },
    onError: (error: Error) => {
      toast.error('建立失敗', { description: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
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
    const matchesConstruction = constructionFilter === 'all' || (project as any).construction_status === constructionFilter;
    
    return matchesSearch && matchesStatus && matchesCity && matchesConstruction;
  });

  const handleCreate = () => {
    if (!formData.project_code || !formData.project_name) {
      toast.error('請填寫必填欄位');
      return;
    }
    createMutation.mutate({
      ...formData,
      created_by: user?.id,
    });
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
      installation_type: (project as any).installation_type,
      actual_installed_capacity: (project as any).actual_installed_capacity,
      taipower_pv_id: (project as any).taipower_pv_id,
      grid_connection_type: (project as any).grid_connection_type,
      power_phase_type: (project as any).power_phase_type,
      power_voltage: (project as any).power_voltage,
      pole_status: (project as any).pole_status,
      construction_status: (project as any).construction_status,
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
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setIsImportExportOpen(true)}>
              <FileDown className="w-4 h-4 mr-2" />
              匯入/匯出
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新增案場
            </Button>
          )}
        </div>
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
            {statusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
        <Select value={constructionFilter} onValueChange={setConstructionFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="施工狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部施工狀態</SelectItem>
            {constructionStatuses.map(status => (
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
              <TableHead>案場編號</TableHead>
              <TableHead>案場名稱</TableHead>
              <TableHead>投資方</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>施工狀態</TableHead>
              <TableHead>裝置類型</TableHead>
              <TableHead>台電 PV 編號</TableHead>
              <TableHead>容量 (kWp)</TableHead>
              <TableHead>縣市</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
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
                    <Badge className={getStatusColor(project.status)} variant="secondary">
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(project as any).construction_status ? (
                      <Badge className={getConstructionStatusColor((project as any).construction_status)} variant="secondary">
                        {(project as any).construction_status}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-sm">{(project as any).installation_type || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{(project as any).taipower_pv_id || '-'}</TableCell>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? '編輯案場' : '新增案場'}</DialogTitle>
            <DialogDescription>
              {editingProject ? '修改案場資料' : '填寫案場基本資訊'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info Section */}
            <h3 className="font-semibold text-foreground border-b pb-2">基本資料</h3>
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
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="actual_installed_capacity">實際裝置容量 (kWp)</Label>
                <Input
                  id="actual_installed_capacity"
                  type="number"
                  step="0.01"
                  value={formData.actual_installed_capacity || ''}
                  onChange={(e) => setFormData({ ...formData, actual_installed_capacity: parseFloat(e.target.value) || undefined })}
                  placeholder="例：495.0"
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
                <Label htmlFor="installation_type">裝置類型</Label>
                <Select 
                  value={formData.installation_type || ''} 
                  onValueChange={(value) => setFormData({ ...formData, installation_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇裝置類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {installationTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="construction_status">施工狀態</Label>
                <Select 
                  value={formData.construction_status || ''} 
                  onValueChange={(value) => setFormData({ ...formData, construction_status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇施工狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    {constructionStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Power Info Section */}
            <h3 className="font-semibold text-foreground border-b pb-2 mt-4">用電資訊</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taipower_pv_id">台電 PV 編號</Label>
                <Input
                  id="taipower_pv_id"
                  value={formData.taipower_pv_id || ''}
                  onChange={(e) => setFormData({ ...formData, taipower_pv_id: e.target.value })}
                  placeholder="台電審查意見書後填寫"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grid_connection_type">併聯方式</Label>
                <Select 
                  value={formData.grid_connection_type || ''} 
                  onValueChange={(value) => setFormData({ ...formData, grid_connection_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇併聯方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {gridConnectionTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="power_phase_type">供電模式</Label>
                <Select 
                  value={formData.power_phase_type || ''} 
                  onValueChange={(value) => setFormData({ ...formData, power_phase_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇供電模式" />
                  </SelectTrigger>
                  <SelectContent>
                    {powerPhaseTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="power_voltage">供電電壓</Label>
                <Select 
                  value={formData.power_voltage || ''} 
                  onValueChange={(value) => setFormData({ ...formData, power_voltage: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇供電電壓" />
                  </SelectTrigger>
                  <SelectContent>
                    {powerVoltages.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pole_status">立桿狀態</Label>
                <Select 
                  value={formData.pole_status || ''} 
                  onValueChange={(value) => setFormData({ ...formData, pole_status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇立桿狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    {poleStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* Import/Export Dialog */}
      <ImportExportDialog
        open={isImportExportOpen}
        onOpenChange={setIsImportExportOpen}
        type="projects"
        data={projects}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />
    </div>
  );
}
