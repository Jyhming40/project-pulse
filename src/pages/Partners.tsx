import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartners, type Partner, type CreatePartnerInput } from '@/hooks/usePartners';
import { CodebookSelect, CodebookValue } from '@/components/CodebookSelect';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Power,
  PowerOff,
  Users,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';

export default function Partners() {
  const { canEdit, isAdmin } = useAuth();
  const {
    partners,
    isLoading,
    createPartner,
    updatePartner,
    toggleActive,
    deletePartner,
    isCreating,
    isUpdating,
  } = usePartners();

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: '',
    partner_type: '',
    contact_person: '',
    contact_phone: '',
    email: '',
    address: '',
    note: '',
  });

  // Filter partners by search
  const filteredPartners = partners.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.contact_person?.toLowerCase().includes(query) ||
      p.contact_phone?.includes(query)
    );
  });

  const handleOpenForm = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name,
        partner_type: partner.partner_type || '',
        contact_person: partner.contact_person || '',
        contact_phone: partner.contact_phone || '',
        email: partner.email || '',
        address: partner.address || '',
        note: partner.note || '',
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: '',
        partner_type: '',
        contact_person: '',
        contact_phone: '',
        email: '',
        address: '',
        note: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('請輸入夥伴名稱');
      return;
    }

    try {
      if (editingPartner) {
        await updatePartner({ id: editingPartner.id, ...formData });
      } else {
        await createPartner(formData);
      }
      setIsFormOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!deletingPartner) return;
    try {
      await deletePartner(deletingPartner.id);
      setIsDeleteOpen(false);
      setDeletingPartner(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (partner: Partner) => {
    await toggleActive({ id: partner.id, is_active: !partner.is_active });
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">您沒有權限存取此頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            外包夥伴管理
          </h1>
          <p className="text-muted-foreground">
            管理施工工班、廠商與個人外包夥伴
          </p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="w-4 h-4 mr-2" />
          新增夥伴
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋名稱、聯絡人、電話..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            外包夥伴清單
          </CardTitle>
          <CardDescription>
            共 {filteredPartners.length} 筆資料
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? '找不到符合的夥伴' : '尚無資料，請新增外包夥伴'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名稱</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>聯絡人</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.id} className={!partner.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>
                      <CodebookValue category="partner_type" value={partner.partner_type} />
                    </TableCell>
                    <TableCell>{partner.contact_person || '-'}</TableCell>
                    <TableCell>
                      {partner.contact_phone ? (
                        <a href={`tel:${partner.contact_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="w-3 h-3" />
                          {partner.contact_phone}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {partner.email ? (
                        <a href={`mailto:${partner.email}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Mail className="w-3 h-3" />
                          {partner.email}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                        {partner.is_active ? '啟用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenForm(partner)}
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(partner)}
                          title={partner.is_active ? '停用' : '啟用'}
                        >
                          {partner.is_active ? (
                            <PowerOff className="w-4 h-4 text-warning" />
                          ) : (
                            <Power className="w-4 h-4 text-success" />
                          )}
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingPartner(partner);
                              setIsDeleteOpen(true);
                            }}
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPartner ? '編輯外包夥伴' : '新增外包夥伴'}</DialogTitle>
            <DialogDescription>
              {editingPartner ? '修改夥伴資料' : '建立新的外包夥伴'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">名稱 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入夥伴名稱"
              />
            </div>
            <div className="grid gap-2">
              <Label>類型</Label>
              <CodebookSelect
                category="partner_type"
                value={formData.partner_type || ''}
                onValueChange={(v) => setFormData({ ...formData, partner_type: v })}
                placeholder="選擇類型"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact_person">聯絡人</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_phone">電話</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone || ''}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
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
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingPartner?.name}」嗎？此操作無法復原。
              如果此夥伴已被使用，建議改為停用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
