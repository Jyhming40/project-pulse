import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES, MODULE_LABELS, ModuleName } from '@/hooks/usePermissions';
import {
  Shield,
  Loader2,
  Save,
  User,
  Eye,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  user_roles: { role: AppRole }[];
}

interface ModulePermission {
  id?: string;
  user_id: string;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const ALL_MODULES = Object.values(MODULES) as ModuleName[];

export default function PermissionManagement() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Map<string, ModulePermission>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all-users-permissions'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;
      
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;
      
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      return (profiles || []).map(p => ({
        ...p,
        user_roles: rolesMap.has(p.id) ? [{ role: rolesMap.get(p.id)! }] : []
      })) as unknown as UserWithRole[];
    },
    enabled: isAdmin,
  });

  // Fetch permissions for selected user
  const { data: userPermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      
      const { data, error } = await (supabase
        .from('module_permissions' as any)
        .select('*')
        .eq('user_id', selectedUserId) as any);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedUserId && isAdmin,
  });

  // Initialize edited permissions when user permissions load
  useEffect(() => {
    if (userPermissions.length > 0) {
      const permMap = new Map<string, ModulePermission>();
      userPermissions.forEach((p: any) => {
        permMap.set(p.module_name, {
          id: p.id,
          user_id: p.user_id,
          module_name: p.module_name,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        });
      });
      setEditedPermissions(permMap);
      setHasChanges(false);
    } else if (selectedUserId) {
      setEditedPermissions(new Map());
      setHasChanges(false);
    }
  }, [userPermissions, selectedUserId]);

  // Save permissions mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) return;

      const permissions = Array.from(editedPermissions.values());
      
      for (const perm of permissions) {
        if (perm.id) {
          // Update existing
          const { error } = await (supabase
            .from('module_permissions' as any)
            .update({
              can_view: perm.can_view,
              can_create: perm.can_create,
              can_edit: perm.can_edit,
              can_delete: perm.can_delete,
            })
            .eq('id', perm.id) as any);
          
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await (supabase
            .from('module_permissions' as any)
            .insert({
              user_id: selectedUserId,
              module_name: perm.module_name,
              can_view: perm.can_view,
              can_create: perm.can_create,
              can_edit: perm.can_edit,
              can_delete: perm.can_delete,
            }) as any);
          
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['module-permissions'] });
      toast.success('權限設定已儲存');
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error('儲存失敗: ' + error.message);
    },
  });

  const handlePermissionChange = (
    module: ModuleName,
    field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    if (!selectedUserId) return;

    const newMap = new Map(editedPermissions);
    const existing = newMap.get(module);
    
    if (existing) {
      newMap.set(module, { ...existing, [field]: value });
    } else {
      newMap.set(module, {
        user_id: selectedUserId,
        module_name: module,
        can_view: field === 'can_view' ? value : false,
        can_create: field === 'can_create' ? value : false,
        can_edit: field === 'can_edit' ? value : false,
        can_delete: field === 'can_delete' ? value : false,
      });
    }

    setEditedPermissions(newMap);
    setHasChanges(true);
  };

  const getPermission = (module: ModuleName, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete'): boolean => {
    const perm = editedPermissions.get(module);
    return perm?.[field] ?? false;
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedUserRole = selectedUser?.user_roles?.[0]?.role || 'viewer';

  // Check if user is admin (admins have all permissions by default)
  const isSelectedUserAdmin = selectedUserRole === 'admin';

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          模組權限管理
        </CardTitle>
        <CardDescription>
          設定個別使用者對各模組的存取權限。管理員自動擁有所有權限。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Selector */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select 
              value={selectedUserId || ''} 
              onValueChange={(v) => setSelectedUserId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇使用者..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => {
                  const role = u.user_roles?.[0]?.role || 'viewer';
                  return (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {u.full_name || u.email}
                        <Badge variant={role === 'admin' ? 'default' : role === 'staff' ? 'secondary' : 'outline'} className="ml-2">
                          {role === 'admin' ? '管理員' : role === 'staff' ? '員工' : '檢視者'}
                        </Badge>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {hasChanges && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              儲存變更
            </Button>
          )}
        </div>

        {/* Permission Table */}
        {selectedUserId && (
          <>
            {isSelectedUserAdmin && (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  此使用者為管理員，自動擁有所有模組的完整權限。
                </p>
              </div>
            )}

            {!isSelectedUserAdmin && (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  勾選的權限會覆蓋角色預設值。未設定的模組將使用角色預設權限。
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">模組</TableHead>
                        <TableHead className="w-[100px] text-center">
                          <span className="flex items-center justify-center gap-1">
                            <Eye className="w-4 h-4" /> 查看
                          </span>
                        </TableHead>
                        <TableHead className="w-[100px] text-center">
                          <span className="flex items-center justify-center gap-1">
                            <Plus className="w-4 h-4" /> 新增
                          </span>
                        </TableHead>
                        <TableHead className="w-[100px] text-center">
                          <span className="flex items-center justify-center gap-1">
                            <Edit2 className="w-4 h-4" /> 編輯
                          </span>
                        </TableHead>
                        <TableHead className="w-[100px] text-center">
                          <span className="flex items-center justify-center gap-1">
                            <Trash2 className="w-4 h-4" /> 刪除
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissionsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : (
                        ALL_MODULES.map(module => (
                          <TableRow key={module}>
                            <TableCell className="font-medium">
                              {MODULE_LABELS[module]}
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={getPermission(module, 'can_view')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'can_view', !!checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={getPermission(module, 'can_create')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'can_create', !!checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={getPermission(module, 'can_edit')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'can_edit', !!checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={getPermission(module, 'can_delete')}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(module, 'can_delete', !!checked)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>已授權</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <X className="w-4 h-4 text-muted-foreground" />
                    <span>未授權（使用角色預設）</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!selectedUserId && (
          <div className="text-center py-8 text-muted-foreground">
            請選擇一位使用者來設定其模組權限
          </div>
        )}
      </CardContent>
    </Card>
  );
}
