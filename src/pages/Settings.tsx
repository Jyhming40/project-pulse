import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Settings as SettingsIcon, Users, Database, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import type { Database as DB } from '@/integrations/supabase/types';

type AppRole = DB['public']['Enums']['app_role'];

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)');
      if (error) throw error;
      return data;
    },
  });

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
  });

  const seedDataMutation = useMutation({
    mutationFn: async () => {
      // Create sample investors
      const { data: inv1 } = await supabase.from('investors').insert({
        investor_code: 'INV-001', company_name: '永沛投資股份有限公司',
        tax_id: '12345678', contact_person: '王大明', phone: '02-1234-5678',
        email: 'contact@yungpei.com', address: '台北市信義區信義路五段7號'
      }).select().single();
      
      const { data: inv2 } = await supabase.from('investors').insert({
        investor_code: 'INV-002', company_name: '明群綠能有限公司',
        tax_id: '87654321', contact_person: '李小華', phone: '04-2345-6789',
        email: 'info@mingqun.com', address: '台中市西屯區台灣大道四段1號'
      }).select().single();

      // Create sample projects
      await supabase.from('projects').insert([
        { project_code: 'PRJ-2024-001', project_name: '台南永康太陽能案', investor_id: inv1?.id,
          status: '同意備案', capacity_kwp: 499.5, city: '台南市', district: '永康區',
          address: '永康區中正路100號', feeder_code: 'TN-001' },
        { project_code: 'PRJ-2024-002', project_name: '高雄鳳山屋頂案', investor_id: inv1?.id,
          status: '工程施工', capacity_kwp: 299.8, city: '高雄市', district: '鳳山區',
          address: '鳳山區五甲路200號', feeder_code: 'KH-002' },
        { project_code: 'PRJ-2024-003', project_name: '台中大肚地面案', investor_id: inv2?.id,
          status: '台電審查', capacity_kwp: 999.0, city: '台中市', district: '大肚區',
          address: '大肚區沙田路一段50號', feeder_code: 'TC-001' },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      toast.success('範例資料已建立');
    },
  });

  if (!isAdmin) return <div className="text-center py-12 text-muted-foreground">權限不足</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">系統設定</h1>
        <p className="text-muted-foreground mt-1">管理使用者權限與系統設定</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> 使用者管理</CardTitle>
          <CardDescription>管理系統使用者角色</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.full_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(u.user_roles as any)?.[0]?.role || 'viewer'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={(u.user_roles as any)?.[0]?.role || 'viewer'}
                      onValueChange={(role) => updateRoleMutation.mutate({ userId: u.id, role: role as AppRole })}
                      disabled={u.id === user?.id}
                    >
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理員</SelectItem>
                        <SelectItem value="staff">員工</SelectItem>
                        <SelectItem value="viewer">檢視者</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> 資料管理</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => seedDataMutation.mutate()} disabled={seedDataMutation.isPending}>
            匯入範例資料
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
