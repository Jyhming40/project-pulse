import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { CodebookSelect } from '@/components/CodebookSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectStatus = Database['public']['Enums']['project_status'];

const cities = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣'
];

interface ProjectEditDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProjectEditDialog({ 
  project, 
  open, 
  onOpenChange,
  onSuccess 
}: ProjectEditDialogProps) {
  const queryClient = useQueryClient();
  const { options: statusOptions } = useOptionsForCategory('project_status');
  
  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Fetch investors for dropdown
  const { data: investors = [] } = useQuery({
    queryKey: ['investors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('id, company_name, investor_code')
        .eq('is_deleted', false)
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  // Initialize form when project changes
  useEffect(() => {
    if (project && open) {
      setFormData({
        project_code: project.project_code,
        project_name: project.project_name,
        investor_id: project.investor_id,
        status: project.status,
        capacity_kwp: project.capacity_kwp,
        actual_installed_capacity: (project as any).actual_installed_capacity,
        feeder_code: (project as any).feeder_code,
        installation_type: (project as any).installation_type,
        revenue_model: (project as any).revenue_model,
        construction_status: (project as any).construction_status,
        city: project.city,
        district: project.district,
        address: project.address,
        land_owner: project.land_owner,
        land_owner_contact: project.land_owner_contact,
        contact_person: project.contact_person,
        contact_phone: project.contact_phone,
        taipower_pv_id: (project as any).taipower_pv_id,
        grid_connection_type: (project as any).grid_connection_type,
        power_phase_type: (project as any).power_phase_type,
        power_voltage: (project as any).power_voltage,
        pole_status: (project as any).pole_status,
        initial_survey_date: (project as any).initial_survey_date,
        structural_cert_date: (project as any).structural_cert_date,
        electrical_cert_date: (project as any).electrical_cert_date,
        construction_start_date: (project as any).construction_start_date,
        note: project.note,
      });
    }
  }, [project, open]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!project) return;
      const { error } = await supabase
        .from('projects')
        .update(data)
        .eq('id', project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project?.id] });
      toast.success('案場更新成功');
      onOpenChange(false);
      setFormData({});
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  const handleUpdate = () => {
    if (!project) return;
    
    // Build update data (exclude project_code which is immutable)
    const updateData: Record<string, any> = {
      project_name: formData.project_name,
      investor_id: formData.investor_id || null,
      status: formData.status,
      capacity_kwp: formData.capacity_kwp || null,
      actual_installed_capacity: formData.actual_installed_capacity || null,
      feeder_code: formData.feeder_code || null,
      installation_type: formData.installation_type || null,
      revenue_model: formData.revenue_model || null,
      construction_status: formData.construction_status || null,
      city: formData.city || null,
      district: formData.district || null,
      address: formData.address || null,
      land_owner: formData.land_owner || null,
      land_owner_contact: formData.land_owner_contact || null,
      contact_person: formData.contact_person || null,
      contact_phone: formData.contact_phone || null,
      taipower_pv_id: formData.taipower_pv_id || null,
      grid_connection_type: formData.grid_connection_type || null,
      power_phase_type: formData.power_phase_type || null,
      power_voltage: formData.power_voltage || null,
      pole_status: formData.pole_status || null,
      initial_survey_date: formData.initial_survey_date || null,
      structural_cert_date: formData.structural_cert_date || null,
      electrical_cert_date: formData.electrical_cert_date || null,
      construction_start_date: formData.construction_start_date || null,
      note: formData.note || null,
    };
    
    updateMutation.mutate(updateData);
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯案場</DialogTitle>
          <DialogDescription>修改案場資料</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basic Info Section */}
          <h3 className="font-semibold text-foreground border-b pb-2">基本資料</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_code">案場編號</Label>
              <Input
                id="project_code"
                value={formData.project_code || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">案場編號不可修改</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project_name">案場名稱 *</Label>
              <Input
                id="project_name"
                value={formData.project_name || ''}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="例：台南永康案"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="investor_id">業務單位</Label>
              <Select 
                value={formData.investor_id || ''} 
                onValueChange={(value) => setFormData({ ...formData, investor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇業務單位" />
                </SelectTrigger>
                <SelectContent>
                  {investors.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.company_name} {inv.investor_code ? `(${inv.investor_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">狀態</Label>
              <Select 
                value={formData.status || '開發中'} 
                onValueChange={(value) => setFormData({ ...formData, status: value as ProjectStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity_kwp">容量 (kWp)</Label>
              <Input
                id="capacity_kwp"
                type="number"
                step="0.01"
                value={formData.capacity_kwp || ''}
                onChange={(e) => setFormData({ ...formData, capacity_kwp: parseFloat(e.target.value) || undefined })}
                placeholder="例：499.5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual_installed_capacity">實際裝置容量 (kWp)</Label>
              <Input
                id="actual_installed_capacity"
                type="number"
                step="0.01"
                value={formData.actual_installed_capacity || ''}
                onChange={(e) => setFormData({ ...formData, actual_installed_capacity: parseFloat(e.target.value) || undefined })}
                placeholder="例：495.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeder_code">饋線代號</Label>
              <Input
                id="feeder_code"
                value={formData.feeder_code || ''}
                onChange={(e) => setFormData({ ...formData, feeder_code: e.target.value })}
                placeholder="例：TN-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="installation_type">裝置類型</Label>
              <CodebookSelect
                category="installation_type"
                value={formData.installation_type}
                onValueChange={(value) => setFormData({ ...formData, installation_type: value })}
                placeholder="選擇裝置類型"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue_model">收益模式</Label>
              <CodebookSelect
                category="revenue_model"
                value={formData.revenue_model || 'FIT'}
                onValueChange={(value) => setFormData({ ...formData, revenue_model: value })}
                placeholder="選擇收益模式"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="construction_status">施工狀態</Label>
              <CodebookSelect
                category="construction_status"
                value={formData.construction_status}
                onValueChange={(value) => setFormData({ ...formData, construction_status: value })}
                placeholder="選擇施工狀態"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">縣市</Label>
              <Select 
                value={formData.city || ''} 
                onValueChange={(value) => setFormData({ ...formData, city: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇縣市" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">區/鄉/鎮</Label>
              <Input
                id="district"
                value={formData.district || ''}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="例：永康區"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">地址</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="完整地址"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="land_owner">承租/所有權人</Label>
              <Input
                id="land_owner"
                value={formData.land_owner || ''}
                onChange={(e) => setFormData({ ...formData, land_owner: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="land_owner_contact">所有權人聯絡方式</Label>
              <Input
                id="land_owner_contact"
                value={formData.land_owner_contact || ''}
                onChange={(e) => setFormData({ ...formData, land_owner_contact: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">聯絡人</Label>
              <Input
                id="contact_person"
                value={formData.contact_person || ''}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">聯絡電話</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone || ''}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>
          </div>

          {/* Power Info Section */}
          <h3 className="font-semibold text-foreground border-b pb-2 mt-4">用電資訊</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taipower_pv_id">台電 PV 編號</Label>
              <Input
                id="taipower_pv_id"
                value={formData.taipower_pv_id || ''}
                onChange={(e) => setFormData({ ...formData, taipower_pv_id: e.target.value })}
                placeholder="台電審查意見書後填寫"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grid_connection_type">併聯方式</Label>
              <CodebookSelect
                category="grid_connection_type"
                value={formData.grid_connection_type}
                onValueChange={(value) => setFormData({ ...formData, grid_connection_type: value })}
                placeholder="選擇併聯方式"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="power_phase_type">供電模式</Label>
              <CodebookSelect
                category="power_phase_type"
                value={formData.power_phase_type}
                onValueChange={(value) => setFormData({ ...formData, power_phase_type: value })}
                placeholder="選擇供電模式"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="power_voltage">供電電壓</Label>
              <CodebookSelect
                category="power_voltage"
                value={formData.power_voltage}
                onValueChange={(value) => setFormData({ ...formData, power_voltage: value })}
                placeholder="選擇供電電壓"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pole_status">立桿狀態</Label>
              <CodebookSelect
                category="pole_status"
                value={formData.pole_status}
                onValueChange={(value) => setFormData({ ...formData, pole_status: value })}
                placeholder="選擇立桿狀態"
              />
            </div>
          </div>

          {/* Milestone Dates Section */}
          <h3 className="font-semibold text-foreground border-b pb-2 mt-4">里程碑日期</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initial_survey_date">初步現勘日期</Label>
              <Input
                id="initial_survey_date"
                type="date"
                value={formData.initial_survey_date || ''}
                onChange={(e) => setFormData({ ...formData, initial_survey_date: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="structural_cert_date">結構技師簽證日期</Label>
              <Input
                id="structural_cert_date"
                type="date"
                value={formData.structural_cert_date || ''}
                onChange={(e) => setFormData({ ...formData, structural_cert_date: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="electrical_cert_date">電機技師簽證日期</Label>
              <Input
                id="electrical_cert_date"
                type="date"
                value={formData.electrical_cert_date || ''}
                onChange={(e) => setFormData({ ...formData, electrical_cert_date: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="construction_start_date">材料進場/施工日期</Label>
              <Input
                id="construction_start_date"
                type="date"
                value={formData.construction_start_date || ''}
                onChange={(e) => setFormData({ ...formData, construction_start_date: e.target.value || undefined })}
              />
            </div>
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
              onOpenChange(false);
              setFormData({});
            }}
          >
            取消
          </Button>
          <Button 
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
          >
            更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
