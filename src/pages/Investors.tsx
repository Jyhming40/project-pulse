import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { useTableSort } from '@/hooks/useTableSort';
import { usePagination } from '@/hooks/usePagination';
import { useBatchSelect } from '@/hooks/useBatchSelect';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { BatchActionBar, BatchActionIcons } from '@/components/BatchActionBar';
import { BatchUpdateDialog } from '@/components/BatchUpdateDialog';
import { BatchDeleteDialog } from '@/components/BatchDeleteDialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, 
  Search, 
  Users, 
  Building2,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  FileDown,
  User,
  CreditCard,
  Contact
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImportExportDialog } from '@/components/ImportExportDialog';
import { useDataExport } from '@/hooks/useDataExport';
import { InvestorContacts } from '@/components/InvestorContacts';
import { InvestorPaymentMethods } from '@/components/InvestorPaymentMethods';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Database } from '@/integrations/supabase/types';

type Investor = Database['public']['Tables']['investors']['Row'];
type InvestorInsert = Database['public']['Tables']['investors']['Insert'];
type InvestorType = Database['public']['Enums']['investor_type'];

const INVESTOR_TYPE_OPTIONS: InvestorType[] = ['自有投資', '租賃投資', 'SPC', '個人', '其他'];

export default function Investors() {
  const { canEdit, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const { exportInvestorContacts, exportInvestorPaymentMethods } = useDataExport();
  
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [viewingInvestor, setViewingInvestor] = useState<Investor | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  // Form state
  const [formData, setFormData] = useState<Partial<InvestorInsert>>({});
  
  // Import/Export dialog
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  
  // Delete dialog state
  const [deletingInvestor, setDeletingInvestor] = useState<Investor | null>(null);
  
  // Soft delete hook
  const { softDelete, isDeleting } = useSoftDelete({
    tableName: 'investors',
    queryKey: 'investors',
  });

  // Fetch investors (exclude soft-deleted)
  const { data: investors = [], isLoading } = useQuery({
    queryKey: ['investors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects for viewing investor
  const { data: investorProjects = [] } = useQuery({
    queryKey: ['investor-projects', viewingInvestor?.id],
    queryFn: async () => {
      if (!viewingInvestor) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('investor_id', viewingInvestor.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!viewingInvestor,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InvestorInsert) => {
      const { error } = await supabase.from('investors').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      toast.success('投資方建立成功');
      setIsCreateOpen(false);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error('建立失敗', { description: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Investor> }) => {
      const { error } = await supabase.from('investors').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      toast.success('投資方更新成功');
      setEditingInvestor(null);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Handle soft delete
  const handleDelete = async (reason?: string) => {
    if (!deletingInvestor) return;
    await softDelete({ id: deletingInvestor.id, reason });
    setDeletingInvestor(null);
  };

  // Filter investors
  const filteredInvestors = investors.filter(inv => {
    const matchesSearch = 
      inv.company_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.investor_code.toLowerCase().includes(search.toLowerCase()) ||
      inv.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      inv.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.email?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Sorting (multi-column support)
  const { sortedData: sortedInvestors, sortConfig, handleSort, getSortInfo } = useTableSort(filteredInvestors, {
    key: 'updated_at',
    direction: 'desc',
  });

  // Pagination
  const pagination = usePagination(sortedInvestors, { pageSize: 20 });

  // Batch selection
  const batchSelect = useBatchSelect(sortedInvestors);
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [batchUpdateField, setBatchUpdateField] = useState<string>('');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  const handleCreate = () => {
    if (!formData.investor_code || !formData.company_name) {
      toast.error('請填寫必填欄位');
      return;
    }
    createMutation.mutate({
      ...formData,
      created_by: user?.id,
    } as InvestorInsert);
  };

  const handleUpdate = () => {
    if (!editingInvestor) return;
    updateMutation.mutate({ id: editingInvestor.id, data: formData });
  };

  const openEditDialog = (investor: Investor) => {
    setEditingInvestor(investor);
    setFormData({
      investor_code: investor.investor_code,
      company_name: investor.company_name,
      tax_id: investor.tax_id,
      owner_name: investor.owner_name,
      owner_title: investor.owner_title,
      investor_type: investor.investor_type,
      contact_person: investor.contact_person,
      phone: investor.phone,
      email: investor.email,
      address: investor.address,
      note: investor.note,
    });
  };

  const openViewDialog = (investor: Investor) => {
    setViewingInvestor(investor);
    setActiveTab('info');
  };

  const statusColors: Record<string, string> = {
    '開發中': 'bg-info/15 text-info',
    '同意備案': 'bg-success/15 text-success',
    '運維中': 'bg-success/15 text-success',
    '暫停': 'bg-muted text-muted-foreground',
    '取消': 'bg-destructive/15 text-destructive',
  };

  // Batch update handler with audit logging
  const handleBatchUpdate = async (field: string, value: string) => {
    setIsBatchUpdating(true);
    try {
      const ids = Array.from(batchSelect.selectedIds);
      
      // Get old data for audit
      const { data: oldData } = await supabase
        .from('investors')
        .select('id, company_name, investor_type')
        .in('id', ids);
      
      if (field === 'investor_type') {
        const { error } = await supabase
          .from('investors')
          .update({ investor_type: value })
          .in('id', ids);
        if (error) throw error;
        
        // Log batch update to audit_logs
        for (const id of ids) {
          const oldRecord = oldData?.find(r => r.id === id);
          await supabase.rpc('log_audit_action', {
            p_table_name: 'investors',
            p_record_id: id,
            p_action: 'UPDATE',
            p_old_data: oldRecord || null,
            p_new_data: { ...oldRecord, investor_type: value },
            p_reason: `批次更新 ${ids.length} 筆資料`,
          });
        }
      }
      toast.success(`已更新 ${ids.length} 筆資料`);
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      batchSelect.deselectAll();
      setIsBatchUpdateOpen(false);
    } catch (error: any) {
      toast.error('批次更新失敗', { description: error.message });
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Batch delete handler (softDelete already logs to audit)
  const handleBatchDelete = async (reason?: string) => {
    const ids = Array.from(batchSelect.selectedIds);
    let successCount = 0;
    for (const id of ids) {
      try {
        await softDelete({ id, reason: reason || `批次刪除 ${ids.length} 筆資料` });
        successCount++;
      } catch (error) {
        // Continue with others
      }
    }
    toast.success(`已刪除 ${successCount} 筆資料`);
    batchSelect.deselectAll();
    setIsBatchDeleteOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">投資方管理</h1>
          <p className="text-muted-foreground mt-1">共 {investors.length} 個投資方</p>
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
              新增投資方
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜尋公司名稱、編號、負責人、聯絡人..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={batchSelect.isAllSelected}
                  onCheckedChange={batchSelect.toggleAll}
                  aria-label="全選"
                />
              </TableHead>
              <SortableTableHead sortKey="investor_code" currentSortKey={sortConfig.key} currentDirection={getSortInfo('investor_code').direction} sortIndex={getSortInfo('investor_code').index} onSort={handleSort}>投資方編號</SortableTableHead>
              <SortableTableHead sortKey="company_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('company_name').direction} sortIndex={getSortInfo('company_name').index} onSort={handleSort}>公司名稱</SortableTableHead>
              <SortableTableHead sortKey="investor_type" currentSortKey={sortConfig.key} currentDirection={getSortInfo('investor_type').direction} sortIndex={getSortInfo('investor_type').index} onSort={handleSort}>類型</SortableTableHead>
              <SortableTableHead sortKey="owner_name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('owner_name').direction} sortIndex={getSortInfo('owner_name').index} onSort={handleSort}>負責人</SortableTableHead>
              <SortableTableHead sortKey="contact_person" currentSortKey={sortConfig.key} currentDirection={getSortInfo('contact_person').direction} sortIndex={getSortInfo('contact_person').index} onSort={handleSort}>聯絡人</SortableTableHead>
              <SortableTableHead sortKey="phone" currentSortKey={sortConfig.key} currentDirection={getSortInfo('phone').direction} sortIndex={getSortInfo('phone').index} onSort={handleSort}>電話</SortableTableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvestors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedData.map(investor => (
                <TableRow 
                  key={investor.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openViewDialog(investor)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={batchSelect.isSelected(investor.id)}
                      onCheckedChange={() => batchSelect.toggle(investor.id)}
                      aria-label={`選取 ${investor.company_name}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{investor.investor_code}</TableCell>
                  <TableCell className="font-medium">{investor.company_name}</TableCell>
                  <TableCell>
                    {investor.investor_type && (
                      <Badge variant="outline" className="text-xs">
                        {investor.investor_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{investor.owner_name || '-'}</TableCell>
                  <TableCell>{investor.contact_person || '-'}</TableCell>
                  <TableCell>{investor.phone || '-'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openViewDialog(investor)}>
                          <Eye className="w-4 h-4 mr-2" />
                          檢視
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => openEditDialog(investor)}>
                            <Edit className="w-4 h-4 mr-2" />
                            編輯
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setDeletingInvestor(investor)}
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

      {/* View Investor Dialog with Tabs */}
      <Dialog open={!!viewingInvestor} onOpenChange={(open) => !open && setViewingInvestor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {viewingInvestor?.company_name}
              {viewingInvestor?.investor_type && (
                <Badge variant="outline" className="ml-2">
                  {viewingInvestor.investor_type}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>投資方編號：{viewingInvestor?.investor_code}</DialogDescription>
          </DialogHeader>
          
          {viewingInvestor && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info" className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  基本資料
                </TabsTrigger>
                <TabsTrigger value="contacts" className="flex items-center gap-1">
                  <Contact className="w-4 h-4" />
                  聯絡人
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  支付方式
                </TabsTrigger>
                <TabsTrigger value="projects" className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  關聯案場
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">投資方編號</p>
                    <p className="font-mono">{viewingInvestor.investor_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">統一編號</p>
                    <p>{viewingInvestor.tax_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">負責人</p>
                    <p>
                      {viewingInvestor.owner_name || '-'}
                      {viewingInvestor.owner_title && ` (${viewingInvestor.owner_title})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">投資方類型</p>
                    <p>{viewingInvestor.investor_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">聯絡人</p>
                    <p>{viewingInvestor.contact_person || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">電話</p>
                    <p>{viewingInvestor.phone || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p>{viewingInvestor.email || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">地址</p>
                    <p>{viewingInvestor.address || '-'}</p>
                  </div>
                  {viewingInvestor.note && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">備註</p>
                      <p className="whitespace-pre-wrap">{viewingInvestor.note}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="mt-4">
                <InvestorContacts 
                  investorId={viewingInvestor.id} 
                  onExport={(contacts, format) => exportInvestorContacts(contacts, format)}
                />
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <InvestorPaymentMethods 
                  investorId={viewingInvestor.id}
                  onExport={(methods, format) => exportInvestorPaymentMethods(methods, format)}
                />
              </TabsContent>

              <TabsContent value="projects" className="mt-4">
                {investorProjects.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/30">
                    尚無關聯案場
                  </div>
                ) : (
                  <div className="space-y-2">
                    {investorProjects.map(project => (
                      <div 
                        key={project.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{project.project_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {project.site_code_display || project.project_code}
                          </p>
                        </div>
                        <Badge className={statusColors[project.status] || 'bg-muted text-muted-foreground'} variant="secondary">
                          {project.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={isCreateOpen || !!editingInvestor} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingInvestor(null);
            setFormData({});
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvestor ? '編輯投資方' : '新增投資方'}</DialogTitle>
            <DialogDescription>
              {editingInvestor ? '修改投資方資料' : '填寫投資方基本資訊'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="investor_code">投資方代碼 *</Label>
                <Input
                  id="investor_code"
                  value={formData.investor_code || ''}
                  onChange={(e) => setFormData({ ...formData, investor_code: e.target.value.toUpperCase() })}
                  placeholder="例：YP（2-5碼英數大寫）"
                  maxLength={5}
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  代碼用於自動生成案場編號，一旦使用後請勿任意更動
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">公司名稱 *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name || ''}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="公司全名"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_id">統一編號</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id || ''}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="8位數字"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investor_type">投資方類型</Label>
                <Select
                  value={formData.investor_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, investor_type: value as InvestorType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTOR_TYPE_OPTIONS.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_name">負責人</Label>
                <Input
                  id="owner_name"
                  value={formData.owner_name || ''}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="公司負責人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_title">負責人職稱</Label>
                <Input
                  id="owner_title"
                  value={formData.owner_title || ''}
                  onChange={(e) => setFormData({ ...formData, owner_title: e.target.value })}
                  placeholder="例：董事長"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">主要聯絡人</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
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
                setEditingInvestor(null);
                setFormData({});
              }}
            >
              取消
            </Button>
            <Button 
              onClick={editingInvestor ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingInvestor ? '更新' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import/Export Dialog */}
      <ImportExportDialog
        open={isImportExportOpen}
        onOpenChange={setIsImportExportOpen}
        type="investors"
        data={investors}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['investors'] })}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={!!deletingInvestor}
        onOpenChange={(open) => !open && setDeletingInvestor(null)}
        onConfirm={handleDelete}
        tableName="investors"
        itemName={deletingInvestor?.company_name}
        isPending={isDeleting}
      />

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedCount={batchSelect.selectedCount}
        onClear={batchSelect.deselectAll}
        actions={[
          {
            key: 'update',
            label: '批次修改',
            icon: BatchActionIcons.edit,
            onClick: () => {
              setBatchUpdateField('investor_type');
              setIsBatchUpdateOpen(true);
            },
          },
          ...(isAdmin
            ? [
                {
                  key: 'delete',
                  label: '批次刪除',
                  icon: BatchActionIcons.delete,
                  variant: 'destructive' as const,
                  onClick: () => setIsBatchDeleteOpen(true),
                },
              ]
            : []),
        ]}
      />

      {/* Batch Update Dialog */}
      <BatchUpdateDialog
        open={isBatchUpdateOpen}
        onOpenChange={setIsBatchUpdateOpen}
        title="批次修改投資方"
        selectedCount={batchSelect.selectedCount}
        fields={[
          {
            key: 'investor_type',
            label: '投資方類型',
            type: 'select',
            options: INVESTOR_TYPE_OPTIONS.map((t) => ({ value: t, label: t })),
          },
        ]}
        onSubmit={async (values) => {
          if (values.investor_type) {
            await handleBatchUpdate('investor_type', values.investor_type);
          }
        }}
        isLoading={isBatchUpdating}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        selectedCount={batchSelect.selectedCount}
        itemLabel="筆投資方"
        requireReason={false}
        onConfirm={handleBatchDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
