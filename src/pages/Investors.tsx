import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImportExportDialog } from '@/components/ImportExportDialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Database } from '@/integrations/supabase/types';

type Investor = Database['public']['Tables']['investors']['Row'];
type InvestorInsert = Database['public']['Tables']['investors']['Insert'];

export default function Investors() {
  const { canEdit, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [viewingInvestor, setViewingInvestor] = useState<Investor | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InvestorInsert>>({});
  
  // Import/Export dialog
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Fetch investors
  const { data: investors = [], isLoading } = useQuery({
    queryKey: ['investors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      toast.success('投資方已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  // Filter investors
  const filteredInvestors = investors.filter(inv => {
    const matchesSearch = 
      inv.company_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.investor_code.toLowerCase().includes(search.toLowerCase()) ||
      inv.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      inv.email?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

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
      contact_person: investor.contact_person,
      phone: investor.phone,
      email: investor.email,
      address: investor.address,
      note: investor.note,
    });
  };

  const statusColors: Record<string, string> = {
    '開發中': 'bg-info/15 text-info',
    '同意備案': 'bg-success/15 text-success',
    '運維中': 'bg-success/15 text-success',
    '暫停': 'bg-muted text-muted-foreground',
    '取消': 'bg-destructive/15 text-destructive',
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
          placeholder="搜尋公司名稱、編號、聯絡人、Email..."
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
              <TableHead>投資方編號</TableHead>
              <TableHead>公司名稱</TableHead>
              <TableHead>統編</TableHead>
              <TableHead>聯絡人</TableHead>
              <TableHead>電話</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvestors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvestors.map(investor => (
                <TableRow 
                  key={investor.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setViewingInvestor(investor)}
                >
                  <TableCell className="font-mono text-sm">{investor.investor_code}</TableCell>
                  <TableCell className="font-medium">{investor.company_name}</TableCell>
                  <TableCell>{investor.tax_id || '-'}</TableCell>
                  <TableCell>{investor.contact_person || '-'}</TableCell>
                  <TableCell>{investor.phone || '-'}</TableCell>
                  <TableCell>{investor.email || '-'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingInvestor(investor)}>
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
                            onClick={() => deleteMutation.mutate(investor.id)}
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

      {/* View Investor Dialog */}
      <Dialog open={!!viewingInvestor} onOpenChange={(open) => !open && setViewingInvestor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {viewingInvestor?.company_name}
            </DialogTitle>
            <DialogDescription>投資方詳細資訊</DialogDescription>
          </DialogHeader>
          {viewingInvestor && (
            <div className="space-y-6">
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    關聯案場 ({investorProjects.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {investorProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">無關聯案場</p>
                  ) : (
                    <div className="space-y-2">
                      {investorProjects.map(project => (
                        <div 
                          key={project.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{project.project_name}</p>
                            <p className="text-sm text-muted-foreground">{project.project_code}</p>
                          </div>
                          <Badge className={statusColors[project.status] || 'bg-muted text-muted-foreground'} variant="secondary">
                            {project.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
        <DialogContent className="max-w-lg">
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
                <Label htmlFor="contact_person">聯絡人</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">電話</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
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
    </div>
  );
}
