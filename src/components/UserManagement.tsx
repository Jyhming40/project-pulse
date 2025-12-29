import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Mail,
  User,
  Shield,
  Search,
  X,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import type { Database as DB } from '@/integrations/supabase/types';

type AppRole = DB['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  user_roles: { role: AppRole }[];
}

export default function UserManagement() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  
  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('viewer');
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<AppRole>('viewer');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as UserWithRole[];
    },
    enabled: isAdmin,
  });

  // Filter users by search term
  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('角色已更新');
    },
    onError: (error) => {
      toast.error('更新角色失敗: ' + error.message);
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, fullName }: { userId: string; fullName: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('使用者資料已更新');
    },
    onError: (error) => {
      toast.error('更新失敗: ' + error.message);
    }
  });

  // Create user mutation (via Edge Function)
  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, fullName, role }: { 
      email: string; 
      password: string; 
      fullName: string; 
      role: AppRole 
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, password, fullName, role }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('使用者已建立');
      setIsAddDialogOpen(false);
      resetAddForm();
    },
    onError: (error) => {
      toast.error('建立使用者失敗: ' + error.message);
    }
  });

  // Delete user mutation (via Edge Function)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('使用者已刪除');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error('刪除使用者失敗: ' + error.message);
    }
  });

  const resetAddForm = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('viewer');
  };

  const handleAddUser = () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('請填寫 Email 和密碼');
      return;
    }
    createUserMutation.mutate({
      email: newUserEmail,
      password: newUserPassword,
      fullName: newUserName,
      role: newUserRole
    });
  };

  const handleEditClick = (u: UserWithRole) => {
    setSelectedUser(u);
    setEditUserName(u.full_name || '');
    setEditUserRole((u.user_roles?.[0]?.role as AppRole) || 'viewer');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    const promises: Promise<void>[] = [];
    
    // Update name if changed
    if (editUserName !== (selectedUser.full_name || '')) {
      promises.push(
        updateProfileMutation.mutateAsync({ 
          userId: selectedUser.id, 
          fullName: editUserName 
        })
      );
    }
    
    // Update role if changed and not current user
    const currentRole = (selectedUser.user_roles?.[0]?.role as AppRole) || 'viewer';
    if (editUserRole !== currentRole && selectedUser.id !== user?.id) {
      promises.push(
        updateRoleMutation.mutateAsync({ 
          userId: selectedUser.id, 
          role: editUserRole 
        })
      );
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
    }
    
    setIsEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteClick = (u: UserWithRole) => {
    setSelectedUser(u);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default">管理員</Badge>;
      case 'staff':
        return <Badge variant="secondary">員工</Badge>;
      default:
        return <Badge variant="outline">檢視者</Badge>;
    }
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              使用者管理
            </CardTitle>
            <CardDescription>
              管理系統使用者與角色權限。共 {users.length} 位使用者
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新增使用者
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Role Legend */}
        <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="default">管理員</Badge>
            <span className="text-muted-foreground">完整系統權限</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">員工</Badge>
            <span className="text-muted-foreground">資料編輯權限</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">檢視者</Badge>
            <span className="text-muted-foreground">僅能查看資料</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋使用者..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Users Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[280px]">Email</TableHead>
                <TableHead className="w-[150px]">姓名</TableHead>
                <TableHead className="w-[100px]">角色</TableHead>
                <TableHead className="w-[120px]">註冊時間</TableHead>
                <TableHead className="w-[120px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchTerm ? '找不到符合的使用者' : '尚無使用者資料'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(u => {
                  const userRole = (u.user_roles?.[0]?.role as AppRole) || 'viewer';
                  const isCurrentUser = u.id === user?.id;
                  return (
                    <TableRow key={u.id} className={isCurrentUser ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{u.email}</span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs shrink-0">您</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{u.full_name || '-'}</TableCell>
                      <TableCell>{getRoleBadge(userRole)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-TW') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditClick(u)}
                            title="編輯"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(u)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? '無法刪除自己' : '刪除'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          * 您無法刪除自己的帳號或變更自己的角色。若需變更，請聯繫其他管理員。
        </p>
      </CardContent>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新增使用者
            </DialogTitle>
            <DialogDescription>
              建立新的系統使用者帳號
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">
                <Mail className="w-4 h-4 inline mr-1" />
                Email *
              </Label>
              <Input
                id="new-email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">
                密碼 *
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少 6 個字元"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">
                <User className="w-4 h-4 inline mr-1" />
                姓名
              </Label>
              <Input
                id="new-name"
                placeholder="使用者姓名"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">
                <Shield className="w-4 h-4 inline mr-1" />
                角色
              </Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理員</SelectItem>
                  <SelectItem value="staff">員工</SelectItem>
                  <SelectItem value="viewer">檢視者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              建立使用者
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              編輯使用者
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                <User className="w-4 h-4 inline mr-1" />
                姓名
              </Label>
              <Input
                id="edit-name"
                placeholder="使用者姓名"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">
                <Shield className="w-4 h-4 inline mr-1" />
                角色
              </Label>
              <Select 
                value={editUserRole} 
                onValueChange={(v) => setEditUserRole(v as AppRole)}
                disabled={selectedUser?.id === user?.id}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理員</SelectItem>
                  <SelectItem value="staff">員工</SelectItem>
                  <SelectItem value="viewer">檢視者</SelectItem>
                </SelectContent>
              </Select>
              {selectedUser?.id === user?.id && (
                <p className="text-xs text-muted-foreground">您無法變更自己的角色</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateProfileMutation.isPending || updateRoleMutation.isPending}
            >
              {(updateProfileMutation.isPending || updateRoleMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              儲存變更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              確認刪除使用者
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                您確定要刪除使用者 <strong>{selectedUser?.email}</strong> 嗎？
              </p>
              <p className="text-destructive font-medium">
                此操作無法復原，使用者將永久從系統中移除。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
