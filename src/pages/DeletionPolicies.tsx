import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { tableDisplayNames, type DeletionMode } from '@/hooks/useDeletionPolicy';
import { useAuth } from '@/contexts/AuthContext';

interface DeletionPolicy {
  id: string;
  table_name: string;
  deletion_mode: DeletionMode;
  retention_days: number;
  require_reason: boolean;
  require_confirmation: boolean;
  allow_auto_purge: boolean;
}

const deletionModeLabels: Record<DeletionMode, string> = {
  soft_delete: '軟刪除',
  archive: '封存',
  hard_delete: '直接刪除',
  disable_only: '僅停用',
};

export default function DeletionPolicies() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingPolicy, setEditingPolicy] = useState<DeletionPolicy | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['deletion-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deletion_policies')
        .select('*')
        .order('table_name');
      
      if (error) throw error;
      return data as DeletionPolicy[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (policy: Partial<DeletionPolicy> & { id: string }) => {
      const { error } = await supabase
        .from('deletion_policies')
        .update({
          deletion_mode: policy.deletion_mode,
          retention_days: policy.retention_days,
          require_reason: policy.require_reason,
          require_confirmation: policy.require_confirmation,
          allow_auto_purge: policy.allow_auto_purge,
          updated_at: new Date().toISOString(),
        })
        .eq('id', policy.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-policies'] });
      toast.success('刪除政策已更新');
      setEditingPolicy(null);
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  const handleSave = () => {
    if (!editingPolicy) return;
    updateMutation.mutate(editingPolicy);
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              只有管理員可以管理刪除政策
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">刪除政策設定</h1>
          <p className="text-muted-foreground">管理各資料表的刪除行為與保留政策</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>資料表刪除政策</CardTitle>
            <CardDescription>
              為每個資料表設定不同的刪除模式、保留天數等
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>資料表</TableHead>
                    <TableHead>刪除模式</TableHead>
                    <TableHead>保留天數</TableHead>
                    <TableHead>需填原因</TableHead>
                    <TableHead>需二次確認</TableHead>
                    <TableHead>自動清理</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">
                        {tableDisplayNames[policy.table_name] || policy.table_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {deletionModeLabels[policy.deletion_mode]}
                        </Badge>
                      </TableCell>
                      <TableCell>{policy.retention_days} 天</TableCell>
                      <TableCell>
                        <Badge variant={policy.require_reason ? 'default' : 'secondary'}>
                          {policy.require_reason ? '是' : '否'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.require_confirmation ? 'default' : 'secondary'}>
                          {policy.require_confirmation ? '是' : '否'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.allow_auto_purge ? 'destructive' : 'secondary'}>
                          {policy.allow_auto_purge ? '開啟' : '關閉'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPolicy(policy)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Policy Dialog */}
        <Dialog open={!!editingPolicy} onOpenChange={(open) => !open && setEditingPolicy(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                編輯刪除政策 - {editingPolicy && (tableDisplayNames[editingPolicy.table_name] || editingPolicy.table_name)}
              </DialogTitle>
              <DialogDescription>
                調整此資料表的刪除行為設定
              </DialogDescription>
            </DialogHeader>

            {editingPolicy && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>刪除模式</Label>
                  <Select
                    value={editingPolicy.deletion_mode}
                    onValueChange={(v) => setEditingPolicy({ 
                      ...editingPolicy, 
                      deletion_mode: v as DeletionMode 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soft_delete">軟刪除（可復原）</SelectItem>
                      <SelectItem value="archive">封存（唯讀）</SelectItem>
                      <SelectItem value="hard_delete">直接刪除（不可復原）</SelectItem>
                      <SelectItem value="disable_only">僅停用（不可刪除）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>保留天數</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingPolicy.retention_days}
                    onChange={(e) => setEditingPolicy({ 
                      ...editingPolicy, 
                      retention_days: parseInt(e.target.value) || 0 
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    回收區資料保留天數，0 表示永久保留
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>需填寫刪除原因</Label>
                    <p className="text-xs text-muted-foreground">刪除時要求使用者填寫原因</p>
                  </div>
                  <Switch
                    checked={editingPolicy.require_reason}
                    onCheckedChange={(v) => setEditingPolicy({ 
                      ...editingPolicy, 
                      require_reason: v 
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>需二次確認</Label>
                    <p className="text-xs text-muted-foreground">刪除前顯示確認對話框</p>
                  </div>
                  <Switch
                    checked={editingPolicy.require_confirmation}
                    onCheckedChange={(v) => setEditingPolicy({ 
                      ...editingPolicy, 
                      require_confirmation: v 
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>自動清理</Label>
                    <p className="text-xs text-muted-foreground">超過保留天數後自動永久刪除</p>
                  </div>
                  <Switch
                    checked={editingPolicy.allow_auto_purge}
                    onCheckedChange={(v) => setEditingPolicy({ 
                      ...editingPolicy, 
                      allow_auto_purge: v 
                    })}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPolicy(null)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
