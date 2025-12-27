import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { Plus, Edit, CreditCard, Star, Trash2, Download } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type InvestorPaymentMethod = Database['public']['Tables']['investor_payment_methods']['Row'];
type InvestorPaymentMethodInsert = Database['public']['Tables']['investor_payment_methods']['Insert'];
type PaymentMethodType = Database['public']['Enums']['payment_method_type'];

const METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: '銀行轉帳', label: '銀行轉帳' },
  { value: '支票', label: '支票' },
  { value: '現金', label: '現金' },
  { value: '其他', label: '其他' },
];

interface InvestorPaymentMethodsProps {
  investorId: string;
  investorCode?: string;
  onExport?: (methods: InvestorPaymentMethod[], format: 'xlsx' | 'csv') => void;
}

export function InvestorPaymentMethods({ investorId, investorCode, onExport }: InvestorPaymentMethodsProps) {
  const { canEdit, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<InvestorPaymentMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<InvestorPaymentMethod | null>(null);
  const [formData, setFormData] = useState<Partial<InvestorPaymentMethodInsert>>({});

  const { softDelete, isDeleting } = useSoftDelete({
    tableName: 'investor_payment_methods',
    queryKey: ['investor-payment-methods', investorId],
  });

  // Fetch payment methods (exclude soft deleted)
  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['investor-payment-methods', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_payment_methods')
        .select('*')
        .eq('investor_id', investorId)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InvestorPaymentMethodInsert) => {
      // If setting as default, unset other defaults first
      if (data.is_default) {
        await supabase
          .from('investor_payment_methods')
          .update({ is_default: false })
          .eq('investor_id', investorId);
      }
      const { error } = await supabase.from('investor_payment_methods').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-payment-methods', investorId] });
      toast.success('支付方式建立成功');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error('建立失敗', { description: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvestorPaymentMethod> }) => {
      // If setting as default, unset other defaults first
      if (data.is_default) {
        await supabase
          .from('investor_payment_methods')
          .update({ is_default: false })
          .eq('investor_id', investorId)
          .neq('id', id);
      }
      const { error } = await supabase.from('investor_payment_methods').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-payment-methods', investorId] });
      toast.success('支付方式更新成功');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('investor_payment_methods')
        .update({ is_default: false })
        .eq('investor_id', investorId);
      const { error } = await supabase
        .from('investor_payment_methods')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-payment-methods', investorId] });
      toast.success('已設為預設支付方式');
    },
    onError: (error: Error) => {
      toast.error('操作失敗', { description: error.message });
    },
  });

  const openCreateDialog = () => {
    setEditingMethod(null);
    setFormData({ investor_id: investorId, is_default: false });
    setIsDialogOpen(true);
  };

  const openEditDialog = (method: InvestorPaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      method_type: method.method_type,
      bank_name: method.bank_name,
      bank_code: method.bank_code,
      branch_name: method.branch_name,
      account_name: method.account_name,
      account_number: method.account_number,
      is_default: method.is_default,
      note: method.note,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMethod(null);
    setFormData({});
  };

  const handleSubmit = () => {
    if (!formData.method_type) {
      toast.error('請選擇支付方式類型');
      return;
    }
    if (editingMethod) {
      updateMutation.mutate({ id: editingMethod.id, data: formData });
    } else {
      createMutation.mutate({
        ...formData,
        investor_id: investorId,
        created_by: user?.id,
      } as InvestorPaymentMethodInsert);
    }
  };

  const handleDelete = async (reason?: string) => {
    if (!deletingMethod) return;
    try {
      await softDelete({ id: deletingMethod.id, reason });
      setDeletingMethod(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {methods.length} 種支付方式</p>
        <div className="flex gap-2">
          {methods.length > 0 && onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  匯出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onExport(methods, 'xlsx')}>
                  匯出 Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(methods, 'csv')}>
                  匯出 CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && (
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-1" />
              新增支付方式
            </Button>
          )}
        </div>
      </div>

      {methods.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/30">
          尚無支付方式資料
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(method => (
            <div key={method.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{method.method_type}</span>
                    {method.is_default && (
                      <Badge variant="default" className="text-xs">預設</Badge>
                    )}
                  </div>
                  {method.method_type === '銀行轉帳' && (
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                      {method.bank_name && (
                        <p>銀行：{method.bank_name} {method.bank_code && `(${method.bank_code})`}</p>
                      )}
                      {method.branch_name && <p>分行：{method.branch_name}</p>}
                      {method.account_name && <p>戶名：{method.account_name}</p>}
                      {method.account_number && <p>帳號：{method.account_number}</p>}
                    </div>
                  )}
                  {method.note && (
                    <p className="text-sm text-muted-foreground mt-2">{method.note}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {!method.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDefaultMutation.mutate(method.id)}
                        title="設為預設"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(method)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeletingMethod(method)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
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
            <DialogTitle>{editingMethod ? '編輯支付方式' : '新增支付方式'}</DialogTitle>
            <DialogDescription>
              {editingMethod ? '修改支付方式資料' : '填寫支付方式資訊'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="method_type">支付方式類型 *</Label>
              <Select
                value={formData.method_type || ''}
                onValueChange={(value) => setFormData({ ...formData, method_type: value as PaymentMethodType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇支付方式" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.method_type === '銀行轉帳' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">銀行名稱</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name || ''}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_code">銀行代碼</Label>
                    <Input
                      id="bank_code"
                      value={formData.bank_code || ''}
                      onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                      placeholder="3碼"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch_name">分行名稱</Label>
                  <Input
                    id="branch_name"
                    value={formData.branch_name || ''}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_name">戶名</Label>
                    <Input
                      id="account_name"
                      value={formData.account_name || ''}
                      onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_number">帳號</Label>
                    <Input
                      id="account_number"
                      value={formData.account_number || ''}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="is_default"
                checked={formData.is_default || false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label htmlFor="is_default">設為預設支付方式</Label>
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
              {editingMethod ? '更新' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deletingMethod}
        onOpenChange={(open) => !open && setDeletingMethod(null)}
        onConfirm={handleDelete}
        tableName="investor_payment_methods"
        itemName={deletingMethod?.method_type || ''}
        isPending={isDeleting}
      />
    </div>
  );
}
