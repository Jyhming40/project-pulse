import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import { useCompanyBankAccounts, CompanyBankAccountInput } from '@/hooks/useCompanyBankAccounts';
import { taiwanBanks, getBankNameByCode } from '@/config/taiwanBanks';

const emptyForm: CompanyBankAccountInput = {
  bank_code: '',
  bank_name: '',
  bank_branch: '',
  bank_account_number: '',
  bank_account_name: '',
  is_default: false,
  is_active: true,
  sort_order: 0,
  note: null,
};

export default function CompanyBankAccountsPanel() {
  const {
    accounts,
    isLoading,
    createAccount,
    updateAccount,
    deleteAccount,
    setDefault,
  } = useCompanyBankAccounts();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompanyBankAccountInput>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, sort_order: accounts.length });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (account: typeof accounts[0]) => {
    setEditingId(account.id);
    setFormData({
      bank_code: account.bank_code,
      bank_name: account.bank_name,
      bank_branch: account.bank_branch || '',
      bank_account_number: account.bank_account_number,
      bank_account_name: account.bank_account_name,
      is_default: account.is_default,
      is_active: account.is_active,
      sort_order: account.sort_order,
      note: account.note,
    });
    setIsDialogOpen(true);
  };

  const handleBankCodeChange = (code: string) => {
    const bankName = getBankNameByCode(code);
    setFormData({
      ...formData,
      bank_code: code,
      bank_name: bankName || formData.bank_name,
    });
  };

  const handleSubmit = async () => {
    if (!formData.bank_code || !formData.bank_account_number || !formData.bank_account_name) {
      return;
    }

    if (editingId) {
      await updateAccount.mutateAsync({ id: editingId, ...formData });
    } else {
      await createAccount.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteAccount.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleSetDefault = async (id: string) => {
    await setDefault.mutateAsync(id);
  };

  const isSubmitting = createAccount.isPending || updateAccount.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>公司銀行帳戶</CardTitle>
          <CardDescription>
            設定公司收款帳戶，可在報價單中選擇使用。標記為「預設」的帳戶將自動帶入。
          </CardDescription>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          新增帳戶
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            尚未設定任何銀行帳戶
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">銀行代碼</TableHead>
                <TableHead>銀行名稱</TableHead>
                <TableHead>分行</TableHead>
                <TableHead>帳號</TableHead>
                <TableHead>戶名</TableHead>
                <TableHead className="w-[80px]">狀態</TableHead>
                <TableHead className="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-mono">{account.bank_code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {account.bank_name}
                      {account.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="w-3 h-3" />
                          預設
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{account.bank_branch || '-'}</TableCell>
                  <TableCell className="font-mono">{account.bank_account_number}</TableCell>
                  <TableCell>{account.bank_account_name}</TableCell>
                  <TableCell>
                    <Badge variant={account.is_active ? 'default' : 'secondary'}>
                      {account.is_active ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!account.is_default && account.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetDefault(account.id)}
                          title="設為預設"
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(account)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(account.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? '編輯銀行帳戶' : '新增銀行帳戶'}</DialogTitle>
            <DialogDescription>
              設定公司收款銀行帳戶資訊
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>銀行代碼 *</Label>
                <Select value={formData.bank_code} onValueChange={handleBankCodeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇銀行" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {taiwanBanks.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.code} - {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>銀行名稱</Label>
                <Input
                  value={formData.bank_name}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>分行名稱</Label>
              <Input
                value={formData.bank_branch || ''}
                onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                placeholder="例：台北分行"
              />
            </div>

            <div className="space-y-2">
              <Label>帳號 *</Label>
              <Input
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="例：1234-5678-9012"
              />
            </div>

            <div className="space-y-2">
              <Label>戶名 *</Label>
              <Input
                value={formData.bank_account_name}
                onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                placeholder="例：明群環能有限公司"
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label className="font-normal">啟用此帳戶</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label className="font-normal">設為預設帳戶</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.bank_code || !formData.bank_account_number || !formData.bank_account_name}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此銀行帳戶？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原，已使用此帳戶的報價單不受影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>確定刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
