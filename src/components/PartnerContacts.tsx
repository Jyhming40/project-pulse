import { useState } from 'react';
import { usePartnerContacts, type PartnerContact, type CreatePartnerContactInput } from '@/hooks/usePartnerContacts';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Phone,
  Mail,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

interface PartnerContactsProps {
  partnerId: string;
  partnerName: string;
}

export function PartnerContacts({ partnerId, partnerName }: PartnerContactsProps) {
  const { canEdit, isAdmin } = useAuth();
  const {
    contacts,
    isLoading,
    createContact,
    updateContact,
    deleteContact,
    isCreating,
    isUpdating,
  } = usePartnerContacts(partnerId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<PartnerContact | null>(null);
  const [formData, setFormData] = useState<Omit<CreatePartnerContactInput, 'partner_id'>>({
    contact_name: '',
    role: '',
    phone: '',
    email: '',
    note: '',
    is_primary: false,
  });

  const handleOpenForm = (contact?: PartnerContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        contact_name: contact.contact_name,
        role: contact.role || '',
        phone: contact.phone || '',
        email: contact.email || '',
        note: contact.note || '',
        is_primary: contact.is_primary,
      });
    } else {
      setEditingContact(null);
      setFormData({
        contact_name: '',
        role: '',
        phone: '',
        email: '',
        note: '',
        is_primary: contacts.length === 0, // First contact is primary by default
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.contact_name.trim()) {
      return;
    }

    try {
      if (editingContact) {
        await updateContact({ id: editingContact.id, partnerId, ...formData });
      } else {
        await createContact({ partner_id: partnerId, ...formData });
      }
      setIsFormOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!deletingContact) return;
    try {
      await deleteContact({ id: deletingContact.id, partnerId });
      setIsDeleteOpen(false);
      setDeletingContact(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              聯絡人
            </CardTitle>
            <CardDescription>
              {partnerName} 的聯絡人清單
            </CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => handleOpenForm()}>
              <Plus className="w-4 h-4 mr-1" />
              新增
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">載入中...</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            尚無聯絡人
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-3 rounded-lg border ${
                  contact.is_primary ? 'border-primary/50 bg-primary/5' : 'border-border'
                } ${!contact.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.contact_name}</span>
                      {contact.is_primary && (
                        <Badge variant="default" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          主要
                        </Badge>
                      )}
                      {contact.role && (
                        <Badge variant="secondary" className="text-xs">
                          {contact.role}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-primary">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-primary">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                    {contact.note && (
                      <p className="text-xs text-muted-foreground mt-1">{contact.note}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenForm(contact)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setDeletingContact(contact);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? '編輯聯絡人' : '新增聯絡人'}</DialogTitle>
            <DialogDescription>
              {partnerName} 的聯絡人資料
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="contact_name">姓名 *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="請輸入姓名"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">角色</Label>
              <Input
                id="role"
                value={formData.role || ''}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="例如：負責人、會計、工程師"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">電話</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">備註</Label>
              <Textarea
                id="note"
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
              <Label htmlFor="is_primary">設為主要聯絡人</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating || !formData.contact_name.trim()}>
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
              確定要刪除「{deletingContact?.contact_name}」嗎？此操作無法復原。
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
    </Card>
  );
}
