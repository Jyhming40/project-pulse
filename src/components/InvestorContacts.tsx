import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { Plus, Edit, Phone, Mail, MessageCircle, Star, UserX, UserCheck, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import type { Database } from '@/integrations/supabase/types';

type InvestorContact = Database['public']['Tables']['investor_contacts']['Row'];
type InvestorContactInsert = Database['public']['Tables']['investor_contacts']['Insert'];
type ContactRoleTag = Database['public']['Enums']['contact_role_tag'];

const ROLE_TAG_OPTIONS: { value: ContactRoleTag; label: string }[] = [
  { value: '主要聯絡人', label: '主要聯絡人' },
  { value: '財務', label: '財務' },
  { value: '工程', label: '工程' },
  { value: '法務', label: '法務' },
  { value: '行政', label: '行政' },
  { value: '業務', label: '業務' },
  { value: '其他', label: '其他' },
];

interface InvestorContactsProps {
  investorId: string;
  investorCode?: string;
  onExport?: (contacts: InvestorContact[], format: 'xlsx' | 'csv') => void;
}

export function InvestorContacts({ investorId, investorCode, onExport }: InvestorContactsProps) {
  const { canEdit, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<InvestorContact | null>(null);
  const [formData, setFormData] = useState<Partial<InvestorContactInsert>>({});
  const [deletingContact, setDeletingContact] = useState<InvestorContact | null>(null);

  // Soft delete hook
  const { softDelete, isDeleting } = useSoftDelete({
    tableName: 'investor_contacts',
    queryKey: ['investor-contacts', investorId],
    onSuccess: () => setDeletingContact(null),
  });

  // Fetch contacts (exclude soft deleted)
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['investor-contacts', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_contacts')
        .select('*')
        .eq('investor_id', investorId)
        .eq('is_deleted', false)
        .order('is_primary', { ascending: false })
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InvestorContactInsert) => {
      // If setting as primary, unset other primaries first
      if (data.is_primary) {
        await supabase
          .from('investor_contacts')
          .update({ is_primary: false })
          .eq('investor_id', investorId);
      }
      const { error } = await supabase.from('investor_contacts').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-contacts', investorId] });
      toast.success('聯絡人建立成功');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error('建立失敗', { description: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvestorContact> }) => {
      // If setting as primary, unset other primaries first
      if (data.is_primary) {
        await supabase
          .from('investor_contacts')
          .update({ is_primary: false })
          .eq('investor_id', investorId)
          .neq('id', id);
      }
      const { error } = await supabase.from('investor_contacts').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-contacts', investorId] });
      toast.success('聯絡人更新成功');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('investor_contacts')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['investor-contacts', investorId] });
      toast.success(isActive ? '聯絡人已啟用' : '聯絡人已停用');
    },
    onError: (error: Error) => {
      toast.error('操作失敗', { description: error.message });
    },
  });

  // Set primary mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('investor_contacts')
        .update({ is_primary: false })
        .eq('investor_id', investorId);
      const { error } = await supabase
        .from('investor_contacts')
        .update({ is_primary: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-contacts', investorId] });
      toast.success('已設為主要聯絡人');
    },
    onError: (error: Error) => {
      toast.error('操作失敗', { description: error.message });
    },
  });

  const openCreateDialog = () => {
    setEditingContact(null);
    setFormData({ investor_id: investorId, is_active: true, is_primary: false });
    setIsDialogOpen(true);
  };

  const openEditDialog = (contact: InvestorContact) => {
    setEditingContact(contact);
    setFormData({
      contact_name: contact.contact_name,
      title: contact.title,
      department: contact.department,
      phone: contact.phone,
      mobile: contact.mobile,
      email: contact.email,
      line_id: contact.line_id,
      role_tags: contact.role_tags,
      is_primary: contact.is_primary,
      is_active: contact.is_active,
      note: contact.note,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingContact(null);
    setFormData({});
  };

  const handleSubmit = () => {
    if (!formData.contact_name) {
      toast.error('請填寫聯絡人姓名');
      return;
    }
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createMutation.mutate({
        ...formData,
        investor_id: investorId,
        created_by: user?.id,
      } as InvestorContactInsert);
    }
  };

  const toggleRoleTag = (tag: ContactRoleTag) => {
    const current = formData.role_tags || [];
    const updated = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    setFormData({ ...formData, role_tags: updated });
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {contacts.length} 位聯絡人</p>
        <div className="flex gap-2">
          {contacts.length > 0 && onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  匯出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onExport(contacts, 'xlsx')}>
                  匯出 Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(contacts, 'csv')}>
                  匯出 CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && (
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-1" />
              新增聯絡人
            </Button>
          )}
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/30">
          尚無聯絡人資料
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map(contact => (
            <div 
              key={contact.id} 
              className={`p-4 rounded-lg border ${
                contact.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.contact_name}</span>
                    {contact.is_primary && (
                      <Badge variant="default" className="text-xs">主要聯絡人</Badge>
                    )}
                    {!contact.is_active && (
                      <Badge variant="secondary" className="text-xs">已停用</Badge>
                    )}
                  </div>
                  {(contact.title || contact.department) && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {[contact.department, contact.title].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-sm">
                    {contact.phone && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {contact.phone}
                      </span>
                    )}
                    {contact.mobile && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {contact.mobile}
                      </span>
                    )}
                    {contact.email && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        {contact.email}
                      </span>
                    )}
                    {contact.line_id && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {contact.line_id}
                      </span>
                    )}
                  </div>
                  {contact.role_tags && contact.role_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {contact.role_tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {contact.note && (
                    <p className="text-sm text-muted-foreground mt-2">{contact.note}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {!contact.is_primary && contact.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPrimaryMutation.mutate(contact.id)}
                        title="設為主要聯絡人"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleActiveMutation.mutate({ 
                        id: contact.id, 
                        isActive: !contact.is_active 
                      })}
                      title={contact.is_active ? '停用' : '啟用'}
                    >
                      {contact.is_active ? (
                        <UserX className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(contact)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingContact(contact)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? '編輯聯絡人' : '新增聯絡人'}</DialogTitle>
            <DialogDescription>
              {editingContact ? '修改聯絡人資料' : '填寫聯絡人基本資訊'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">姓名 *</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name || ''}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">職稱</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">部門</Label>
              <Input
                id="department"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
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
                <Label htmlFor="mobile">手機</Label>
                <Input
                  id="mobile"
                  value={formData.mobile || ''}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="line_id">LINE ID</Label>
                <Input
                  id="line_id"
                  value={formData.line_id || ''}
                  onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>角色標籤</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_TAG_OPTIONS.map(option => (
                  <Badge
                    key={option.value}
                    variant={(formData.role_tags || []).includes(option.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRoleTag(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_primary"
                  checked={formData.is_primary || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
                />
                <Label htmlFor="is_primary">設為主要聯絡人</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">啟用</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">備註</Label>
              <Textarea
                id="note"
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingContact ? '更新' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={!!deletingContact}
        onOpenChange={(open) => !open && setDeletingContact(null)}
        onConfirm={(reason) => deletingContact && softDelete({ id: deletingContact.id, reason })}
        title="刪除聯絡人"
        description="確定要刪除此聯絡人嗎？"
        itemName={deletingContact?.contact_name}
        tableName="investor_contacts"
        isPending={isDeleting}
      />
    </div>
  );
}
