import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModuleAccess, MODULES } from '@/hooks/usePermissions';
import { PermissionGate, PermissionButton } from '@/components/PermissionGate';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { useTableSort } from '@/hooks/useTableSort';
import { usePagination } from '@/hooks/usePagination';
import { useBatchSelect } from '@/hooks/useBatchSelect';

import { CodebookSelect } from '@/components/CodebookSelect';
import { TablePagination } from '@/components/ui/table-pagination';
import { BatchActionBar, BatchActionIcons } from '@/components/BatchActionBar';
import { BatchUpdateDialog, BatchUpdateField } from '@/components/BatchUpdateDialog';
import { BatchDeleteDialog } from '@/components/BatchDeleteDialog';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ProjectDetailDrawer } from '@/components/ProjectDetailDrawer';
import { DataEnrichmentPanel } from '@/components/DataEnrichmentPanel';
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
  ClipboardEdit,
  Database as DatabaseIcon,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImportExportDialog } from '@/components/ImportExportDialog';
import { ProjectBackupDialog } from '@/components/ProjectBackupDialog';
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

// Static options (cities only - not managed in Codebook)
// All other dropdowns now read from Codebook (system_options table)

export default function Projects() {
  const navigate = useNavigate();
  const { canEdit, isAdmin, user } = useAuth();
  const { canCreate, canEdit: canEditProjects, canDelete } = useModuleAccess(MODULES.PROJECTS);
  const queryClient = useQueryClient();
  
  // Fetch dynamic options from Codebook (for filter dropdowns only)
  const { options: statusOptions } = useOptionsForCategory('project_status');
  const { options: constructionStatusOptions } = useOptionsForCategory('construction_status');
  const { options: installationTypeOptions } = useOptionsForCategory('installation_type');
  const { options: gridConnectionTypeOptions } = useOptionsForCategory('grid_connection_type');
  const { options: powerVoltageOptions } = useOptionsForCategory('power_voltage');
  const { options: poleStatusOptions } = useOptionsForCategory('pole_status');
  
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
  
  // Selected investor code (for display)
  const [selectedInvestorCode, setSelectedInvestorCode] = useState<string>('');
  
  // Import/Export dialog
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  
  // Backup dialog
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  
  // Creating state for Edge Function call
  const [isCreating, setIsCreating] = useState(false);
  
  // Delete dialog state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  
  // Drawer state for project details
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Batch dialogs
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  
  // Data Enrichment Mode (Admin only)
  const [isEnrichmentMode, setIsEnrichmentMode] = useState(false);
  
  // Soft delete hook
  const { softDelete, isDeleting } = useSoftDelete({
    tableName: 'projects',
    queryKey: 'projects',
  });

  // Fetch projects with investor info (exclude soft-deleted)
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(company_name)')
        .eq('is_deleted', false)
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

  // Create project via Edge Function (for atomic sequence generation)
  const handleCreateProject = async () => {
    if (!formData.investor_id) {
      toast.error('請選擇投資方');
      return;
    }
    if (!formData.project_name) {
      toast.error('請填寫案場名稱');
      return;
    }
    
    // Check if investor has a code
    const selectedInvestor = investors.find(inv => inv.id === formData.investor_id);
    if (!selectedInvestor?.investor_code) {
      toast.error('投資方尚未設定代碼', { description: '請先在投資方資料補齊代碼' });
      return;
    }
    
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-project-with-seq', {
        body: {
          project_name: formData.project_name,
          investor_id: formData.investor_id,
          status: formData.status,
          capacity_kwp: formData.capacity_kwp,
          feeder_code: formData.feeder_code,
          city: formData.city,
          district: formData.district,
          address: formData.address,
          coordinates: formData.coordinates,
          land_owner: formData.land_owner,
          land_owner_contact: formData.land_owner_contact,
          contact_person: formData.contact_person,
          contact_phone: formData.contact_phone,
          note: formData.note,
          installation_type: formData.installation_type,
          actual_installed_capacity: formData.actual_installed_capacity,
          taipower_pv_id: formData.taipower_pv_id,
          grid_connection_type: formData.grid_connection_type,
          power_phase_type: formData.power_phase_type,
          power_voltage: formData.power_voltage,
          pole_status: formData.pole_status,
          construction_status: formData.construction_status,
        },
      });
      
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('案場建立成功', { 
        description: `案場編號：${data.project?.site_code_display || data.project?.project_code}` 
      });
      setIsCreateOpen(false);
      setFormData({});
      setSelectedInvestorCode('');
      
      // Navigate to project detail for Drive folder creation
      if (data.project?.id) {
        toast.info('請至案場詳情頁連結 Google Drive 並建立資料夾');
      }
    } catch (err) {
      const error = err as Error;
      toast.error('建立失敗', { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

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

  // Handle soft delete
  const handleDelete = async (reason?: string) => {
    if (!deletingProject) return;
    await softDelete({ id: deletingProject.id, reason });
    setDeletingProject(null);
  };

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.project_name.toLowerCase().includes(search.toLowerCase()) ||
      project.project_code.toLowerCase().includes(search.toLowerCase()) ||
      ((project as any).site_code_display || '').toLowerCase().includes(search.toLowerCase()) ||
      project.address?.toLowerCase().includes(search.toLowerCase()) ||
      (project.investors as any)?.company_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCity = cityFilter === 'all' || project.city === cityFilter;
    const matchesConstruction = constructionFilter === 'all' || (project as any).construction_status === constructionFilter;
    
    return matchesSearch && matchesStatus && matchesCity && matchesConstruction;
  });

  // Sorting (multi-column support)
  const { sortedData: sortedProjects, sortConfig, handleSort, getSortInfo } = useTableSort(filteredProjects, {
    key: 'updated_at',
    direction: 'desc',
  });

  // Pagination
  const pagination = usePagination(sortedProjects, { pageSize: 20 });

  // Batch selection
  const batchSelect = useBatchSelect(pagination.paginatedData);
  

  // Batch update mutation with audit logging
  const batchUpdateMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const selectedIds = Array.from(batchSelect.selectedIds);
      
      // Get old data for audit
      const { data: oldData } = await supabase
        .from('projects')
        .select('id, status, construction_status, city, installation_type, grid_connection_type, power_voltage, pole_status')
        .in('id', selectedIds);
      
      // Perform update
      const { error } = await supabase
        .from('projects')
        .update(values)
        .in('id', selectedIds);
      if (error) throw error;
      
      // Log batch update to audit_logs
      for (const id of selectedIds) {
        const oldRecord = oldData?.find(r => r.id === id);
        await supabase.rpc('log_audit_action', {
          p_table_name: 'projects',
          p_record_id: id,
          p_action: 'UPDATE',
          p_old_data: oldRecord || null,
          p_new_data: { ...oldRecord, ...values },
          p_reason: `批次更新 ${selectedIds.length} 筆資料`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('批次更新成功');
      batchSelect.deselectAll();
    },
    onError: (error: Error) => {
      toast.error('批次更新失敗', { description: error.message });
    },
  });

  // Batch delete mutation with audit logging
  const batchDeleteMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const selectedIds = Array.from(batchSelect.selectedIds);
      
      // Get old data for audit
      const { data: oldData } = await supabase
        .from('projects')
        .select('id, project_name, project_code, status')
        .in('id', selectedIds);
      
      const { error } = await supabase
        .from('projects')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          delete_reason: reason || null,
        })
        .in('id', selectedIds);
      if (error) throw error;
      
      // Log batch delete to audit_logs
      for (const id of selectedIds) {
        const oldRecord = oldData?.find(r => r.id === id);
        await supabase.rpc('log_audit_action', {
          p_table_name: 'projects',
          p_record_id: id,
          p_action: 'DELETE',
          p_old_data: oldRecord || null,
          p_new_data: null,
          p_reason: reason || `批次刪除 ${selectedIds.length} 筆資料`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('批次刪除成功');
      batchSelect.deselectAll();
    },
    onError: (error: Error) => {
      toast.error('批次刪除失敗', { description: error.message });
    },
  });

  // Batch update fields for projects
  const batchUpdateFields: BatchUpdateField[] = [
    {
      key: 'status',
      label: '案場狀態',
      type: 'select',
      options: statusOptions,
      placeholder: '選擇狀態',
    },
    {
      key: 'construction_status',
      label: '施工狀態',
      type: 'select',
      options: constructionStatusOptions,
      placeholder: '選擇施工狀態',
    },
    {
      key: 'city',
      label: '縣市',
      type: 'select',
      options: cities.map(c => ({ value: c, label: c })),
      placeholder: '選擇縣市',
    },
    {
      key: 'installation_type',
      label: '設施類型',
      type: 'select',
      options: installationTypeOptions,
      placeholder: '選擇設施類型',
    },
    {
      key: 'grid_connection_type',
      label: '併網方式',
      type: 'select',
      options: gridConnectionTypeOptions,
      placeholder: '選擇併網方式',
    },
    {
      key: 'power_voltage',
      label: '電壓等級',
      type: 'select',
      options: powerVoltageOptions,
      placeholder: '選擇電壓等級',
    },
    {
      key: 'pole_status',
      label: '電桿狀態',
      type: 'select',
      options: poleStatusOptions,
      placeholder: '選擇電桿狀態',
    },
  ];

  // Handle investor selection - auto-fill investor code
  const handleInvestorChange = (investorId: string) => {
    const investor = investors.find(inv => inv.id === investorId);
    setFormData({ ...formData, investor_id: investorId });
    setSelectedInvestorCode(investor?.investor_code || '');
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
    <div className={`flex h-full ${isEnrichmentMode ? 'gap-0' : ''}`}>
      {/* Main content area */}
      <div className={`flex-1 space-y-6 animate-fade-in pb-24 ${isEnrichmentMode ? 'pr-4' : ''}`}>
        {/* Enrichment Mode Banner */}
        {isEnrichmentMode && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardEdit className="w-5 h-5 text-warning" />
              <span className="font-medium text-warning">資料補齊模式</span>
              <span className="text-sm text-muted-foreground">- 點擊列可選取案場，勾選欄位後批次更新</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsEnrichmentMode(false);
                batchSelect.deselectAll();
              }}
            >
              退出補齊模式
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">案場管理</h1>
            <p className="text-muted-foreground mt-1">共 {projects.length} 個案場</p>
          </div>
          <div className="flex gap-2">
            {/* Admin-only Enrichment Mode Button */}
            {isAdmin && !isEnrichmentMode && (
              <Button 
                variant="outline" 
                onClick={() => setIsEnrichmentMode(true)}
                className="border-warning/50 text-warning hover:bg-warning/10"
              >
                <ClipboardEdit className="w-4 h-4 mr-2" />
                資料補齊模式
              </Button>
            )}
            <PermissionGate module={MODULES.PROJECTS} action="edit">
              <Button variant="outline" onClick={() => setIsBackupOpen(true)}>
                <DatabaseIcon className="w-4 h-4 mr-2" />
                完整備份
              </Button>
            </PermissionGate>
            <PermissionGate module={MODULES.PROJECTS} action="edit">
              <Button variant="outline" onClick={() => setIsImportExportOpen(true)}>
                <FileDown className="w-4 h-4 mr-2" />
                匯入/匯出
              </Button>
            </PermissionGate>
            <PermissionGate module={MODULES.PROJECTS} action="create">
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增案場
              </Button>
            </PermissionGate>
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
            {constructionStatusOptions.map(opt => (
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
              {(canEditProjects || isEnrichmentMode) && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={batchSelect.isAllSelected}
                    onCheckedChange={() => batchSelect.toggleAll()}
                    aria-label="全選"
                  />
                </TableHead>
              )}
              <SortableTableHead sortKey="site_code_display" currentSortKey={sortConfig.key} currentDirection={getSortInfo('site_code_display').direction} sortIndex={getSortInfo('site_code_display').index} onSort={handleSort}>案場編號</SortableTableHead>
              <SortableTableHead sortKey="project_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('project_name').direction} sortIndex={getSortInfo('project_name').index} onSort={handleSort}>案場名稱</SortableTableHead>
              <SortableTableHead sortKey="investors.company_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('investors.company_name').direction} sortIndex={getSortInfo('investors.company_name').index} onSort={handleSort}>投資方</SortableTableHead>
              <SortableTableHead sortKey="status" currentSortKey={sortConfig.key} currentDirection={getSortInfo('status').direction} sortIndex={getSortInfo('status').index} onSort={handleSort}>狀態</SortableTableHead>
              <SortableTableHead sortKey="overall_progress" currentSortKey={sortConfig.key} currentDirection={getSortInfo('overall_progress').direction} sortIndex={getSortInfo('overall_progress').index} onSort={handleSort}>總進度</SortableTableHead>
              <SortableTableHead sortKey="admin_progress" currentSortKey={sortConfig.key} currentDirection={getSortInfo('admin_progress').direction} sortIndex={getSortInfo('admin_progress').index} onSort={handleSort}>行政</SortableTableHead>
              <SortableTableHead sortKey="engineering_progress" currentSortKey={sortConfig.key} currentDirection={getSortInfo('engineering_progress').direction} sortIndex={getSortInfo('engineering_progress').index} onSort={handleSort}>工程</SortableTableHead>
              <SortableTableHead sortKey="construction_status" currentSortKey={sortConfig.key} currentDirection={getSortInfo('construction_status').direction} sortIndex={getSortInfo('construction_status').index} onSort={handleSort}>施工狀態</SortableTableHead>
              <SortableTableHead sortKey="capacity_kwp" currentSortKey={sortConfig.key} currentDirection={getSortInfo('capacity_kwp').direction} sortIndex={getSortInfo('capacity_kwp').index} onSort={handleSort}>容量 (kWp)</SortableTableHead>
              <SortableTableHead sortKey="city" currentSortKey={sortConfig.key} currentDirection={getSortInfo('city').direction} sortIndex={getSortInfo('city').index} onSort={handleSort}>縣市</SortableTableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(canEditProjects || isEnrichmentMode) ? 12 : 11} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedData.map(project => {
                // In enrichment mode: clicking row toggles selection
                // In normal mode: clicking row opens drawer
                const handleRowClick = () => {
                  if (isEnrichmentMode) {
                    batchSelect.toggle(project.id);
                  } else {
                    setDrawerProjectId(project.id);
                    setIsDrawerOpen(true);
                  }
                };
                
                return (
                  <TableRow 
                    key={project.id} 
                    className={`cursor-pointer hover:bg-muted/50 ${
                      isEnrichmentMode && batchSelect.isSelected(project.id) 
                        ? 'bg-warning/10 hover:bg-warning/15' 
                        : ''
                    }`}
                    onClick={handleRowClick}
                  >
                    {(canEditProjects || isEnrichmentMode) && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={batchSelect.isSelected(project.id)}
                          onCheckedChange={() => batchSelect.toggle(project.id)}
                          aria-label={`選取 ${project.project_name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm">{(project as any).site_code_display || project.project_code}</TableCell>
                    <TableCell className="font-medium">{project.project_name}</TableCell>
                    <TableCell>{(project.investors as any)?.company_name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.status)} variant="secondary">
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(project as any).overall_progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{Math.round((project as any).overall_progress || 0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{Math.round((project as any).admin_progress || 0)}%</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{Math.round((project as any).engineering_progress || 0)}%</span>
                    </TableCell>
                    <TableCell>
                      {(project as any).construction_status ? (
                        <Badge className={getConstructionStatusColor((project as any).construction_status)} variant="secondary">
                          {(project as any).construction_status}
                        </Badge>
                      ) : '-'}
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
                          <DropdownMenuItem onClick={() => {
                            setDrawerProjectId(project.id);
                            setIsDrawerOpen(true);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            快速檢視
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            完整頁面
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
                              onClick={() => setDeletingProject(project)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              刪除
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
            
            {/* New project: auto-generate code, Edit: show existing code */}
            {editingProject ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project_code">案場編號</Label>
                  <Input
                    id="project_code"
                    value={formData.project_code || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">案場編號不可修改</p>
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
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="investor_id">投資方 *</Label>
                  <Select 
                    value={formData.investor_id || ''} 
                    onValueChange={handleInvestorChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇投資方" />
                    </SelectTrigger>
                    <SelectContent>
                      {investors.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.company_name} {inv.investor_code ? `(${inv.investor_code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedInvestorCode && (
                    <p className="text-xs text-primary">投資方代碼：{selectedInvestorCode}</p>
                  )}
                  {formData.investor_id && !selectedInvestorCode && (
                    <p className="text-xs text-destructive">⚠️ 此投資方尚未設定代碼</p>
                  )}
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
            )}

            {/* For new projects, show auto-generate info */}
            {!editingProject && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  📋 案場編號將依據規則自動生成：<span className="font-mono">{new Date().getFullYear()}{selectedInvestorCode || '??'}XXXX</span>
                </p>
              </div>
            )}

            {/* For editing, show investor selection */}
            {editingProject && (
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
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.company_name} {inv.investor_code ? `(${inv.investor_code})` : ''}
                        </SelectItem>
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
            )}

            {/* Status for new projects */}
            {!editingProject && (
              <div className="grid grid-cols-2 gap-4">
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
            )}

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
                <CodebookSelect
                  category="installation_type"
                  value={formData.installation_type}
                  onValueChange={(value) => setFormData({ ...formData, installation_type: value })}
                  placeholder="選擇裝置類型"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="construction_status">施工狀態</Label>
                <CodebookSelect
                  category="construction_status"
                  value={formData.construction_status}
                  onValueChange={(value) => setFormData({ ...formData, construction_status: value })}
                  placeholder="選擇施工狀態"
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
                <CodebookSelect
                  category="grid_connection_type"
                  value={formData.grid_connection_type}
                  onValueChange={(value) => setFormData({ ...formData, grid_connection_type: value })}
                  placeholder="選擇併聯方式"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="power_phase_type">供電模式</Label>
                <CodebookSelect
                  category="power_phase_type"
                  value={formData.power_phase_type}
                  onValueChange={(value) => setFormData({ ...formData, power_phase_type: value })}
                  placeholder="選擇供電模式"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="power_voltage">供電電壓</Label>
                <CodebookSelect
                  category="power_voltage"
                  value={formData.power_voltage}
                  onValueChange={(value) => setFormData({ ...formData, power_voltage: value })}
                  placeholder="選擇供電電壓"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pole_status">立桿狀態</Label>
                <CodebookSelect
                  category="pole_status"
                  value={formData.pole_status}
                  onValueChange={(value) => setFormData({ ...formData, pole_status: value })}
                  placeholder="選擇立桿狀態"
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
              onClick={editingProject ? handleUpdate : handleCreateProject}
              disabled={isCreating || updateMutation.isPending}
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

      {/* Project Backup Dialog */}
      <ProjectBackupDialog
        open={isBackupOpen}
        onOpenChange={setIsBackupOpen}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
        onConfirm={handleDelete}
        tableName="projects"
        itemName={deletingProject?.project_name}
        isPending={isDeleting}
      />

      {/* Batch Action Bar (hidden in enrichment mode) */}
      {canEditProjects && !isEnrichmentMode && (
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
        title="批次更新案場"
        selectedCount={batchSelect.selectedCount}
        selectedItems={batchSelect.selectedItems}
        fields={batchUpdateFields}
        onSubmit={async (values) => {
          await batchUpdateMutation.mutateAsync(values);
        }}
        isLoading={batchUpdateMutation.isPending}
        getItemLabel={(item) => item.project_name as string}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        selectedCount={batchSelect.selectedCount}
        itemLabel="個案場"
        requireReason
        onConfirm={async (reason) => {
          await batchDeleteMutation.mutateAsync(reason);
        }}
        isLoading={batchDeleteMutation.isPending}
      />

      {/* Project Detail Drawer */}
      <ProjectDetailDrawer
        projectId={drawerProjectId}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
      </div>

      {/* Data Enrichment Panel (Admin only) */}
      {isAdmin && isEnrichmentMode && (
        <div className="w-80 flex-shrink-0 border-l bg-background">
          <DataEnrichmentPanel
            selectedIds={batchSelect.selectedIds}
            onClose={() => {
              setIsEnrichmentMode(false);
              batchSelect.deselectAll();
            }}
            onSuccess={() => {
              // Keep mode open, just clear selection after success
            }}
          />
        </div>
      )}
    </div>
  );
}
