import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FieldConfig {
  id: string;
  field_key: string;
  field_label: string;
  is_visible: boolean;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  field_options: string[];
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  project_id: string;
  field_id: string;
  field_value: string | null;
}

// Default field configurations
const DEFAULT_FIELDS: Omit<FieldConfig, 'id' | 'created_at' | 'updated_at'>[] = [
  { field_key: 'project_code', field_label: '案場編號', sort_order: 1, is_visible: true, is_system: true },
  { field_key: 'project_name', field_label: '案場名稱', sort_order: 2, is_visible: true, is_system: true },
  { field_key: 'status', field_label: '專案狀態', sort_order: 3, is_visible: true, is_system: true },
  { field_key: 'construction_status', field_label: '工程狀態', sort_order: 4, is_visible: true, is_system: true },
  { field_key: 'investor_name', field_label: '投資人', sort_order: 5, is_visible: true, is_system: true },
  { field_key: 'city', field_label: '縣市', sort_order: 6, is_visible: true, is_system: true },
  { field_key: 'district', field_label: '鄉鎮區', sort_order: 7, is_visible: true, is_system: true },
  { field_key: 'capacity_kwp', field_label: '設置容量', sort_order: 8, is_visible: true, is_system: true },
  { field_key: 'installation_type', field_label: '案場類型', sort_order: 9, is_visible: true, is_system: true },
  { field_key: 'overall_progress', field_label: '總進度', sort_order: 10, is_visible: true, is_system: true },
  { field_key: 'site_code_display', field_label: '案場代碼', sort_order: 11, is_visible: false, is_system: true },
  { field_key: 'intake_year', field_label: '收案年度', sort_order: 12, is_visible: false, is_system: true },
  { field_key: 'fiscal_year', field_label: '併網年度', sort_order: 13, is_visible: false, is_system: true },
  { field_key: 'approval_date', field_label: '同意備案日期', sort_order: 14, is_visible: false, is_system: true },
  { field_key: 'grid_connection_type', field_label: '併網類型', sort_order: 15, is_visible: false, is_system: true },
  { field_key: 'power_phase_type', field_label: '電力相別', sort_order: 16, is_visible: false, is_system: true },
  { field_key: 'power_voltage', field_label: '電壓', sort_order: 17, is_visible: false, is_system: true },
  { field_key: 'pole_status', field_label: '電桿狀態', sort_order: 18, is_visible: false, is_system: true },
  { field_key: 'contact_person', field_label: '聯絡人', sort_order: 19, is_visible: false, is_system: true },
  { field_key: 'contact_phone', field_label: '聯絡電話', sort_order: 20, is_visible: false, is_system: true },
  { field_key: 'address', field_label: '地址', sort_order: 21, is_visible: false, is_system: true },
  { field_key: 'note', field_label: '備註', sort_order: 22, is_visible: false, is_system: true },
];

export function useProjectFieldConfig() {
  const queryClient = useQueryClient();

  // Fetch field configurations
  const { data: fieldConfigs = [], isLoading, refetch } = useQuery({
    queryKey: ['project-field-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_field_config' as any)
        .select('*')
        .order('sort_order') as { data: FieldConfig[] | null; error: any };
      
      if (error) {
        console.error('Error fetching field config:', error);
        return [];
      }
      return data as FieldConfig[];
    },
  });

  // Initialize default field configs if empty
  const initializeDefaults = useMutation({
    mutationFn: async () => {
      // Check if already initialized
      const { count } = await supabase
        .from('project_field_config' as any)
        .select('*', { count: 'exact', head: true });
      
      if (count && count > 0) {
        throw new Error('已存在欄位設定');
      }

      // Insert defaults
      const { error } = await supabase
        .from('project_field_config' as any)
        .insert(DEFAULT_FIELDS);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-field-config'] });
      toast.success('已初始化預設欄位設定');
    },
    onError: (error: Error) => {
      toast.error('初始化失敗', { description: error.message });
    },
  });

  // Update field config
  const updateFieldConfig = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FieldConfig> & { id: string }) => {
      const { error } = await supabase
        .from('project_field_config' as any)
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-field-config'] });
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Reorder fields
  const reorderFields = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('project_field_config' as any)
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-field-config'] });
      toast.success('欄位順序已更新');
    },
    onError: (error: Error) => {
      toast.error('排序失敗', { description: error.message });
    },
  });

  // Get visible fields sorted by order
  const visibleFields = fieldConfigs
    .filter(f => f.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    fieldConfigs,
    visibleFields,
    isLoading,
    initializeDefaults,
    updateFieldConfig,
    reorderFields,
    refetch,
  };
}

export function useProjectCustomFields() {
  const queryClient = useQueryClient();

  // Fetch custom fields
  const { data: customFields = [], isLoading } = useQuery({
    queryKey: ['project-custom-fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_custom_fields' as any)
        .select('*')
        .order('sort_order');
      
      if (error) {
        console.error('Error fetching custom fields:', error);
        return [];
      }
      return (data || []).map((f: any) => ({
        ...f,
        field_options: f.field_options || [],
      })) as CustomField[];
    },
  });

  // Create custom field
  const createCustomField = useMutation({
    mutationFn: async (field: Omit<CustomField, 'id' | 'created_at' | 'updated_at'>) => {
      // Generate field_key from label
      const field_key = `custom_${Date.now()}`;
      
      const { data, error } = await supabase
        .from('project_custom_fields' as any)
        .insert({
          ...field,
          field_key,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-custom-fields'] });
      toast.success('自訂欄位已新增');
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });

  // Update custom field
  const updateCustomField = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomField> & { id: string }) => {
      const { error } = await supabase
        .from('project_custom_fields' as any)
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-custom-fields'] });
      toast.success('欄位已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Delete custom field
  const deleteCustomField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_custom_fields' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-custom-fields'] });
      toast.success('欄位已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  // Reorder custom fields
  const reorderCustomFields = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('project_custom_fields' as any)
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-custom-fields'] });
      toast.success('欄位順序已更新');
    },
    onError: (error: Error) => {
      toast.error('排序失敗', { description: error.message });
    },
  });

  // Get active custom fields
  const activeCustomFields = customFields.filter(f => f.is_active);

  return {
    customFields,
    activeCustomFields,
    isLoading,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    reorderCustomFields,
  };
}

// Hook to get custom field values for a project
export function useProjectCustomFieldValues(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data: values = [], isLoading } = useQuery({
    queryKey: ['project-custom-field-values', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_custom_field_values' as any)
        .select('*')
        .eq('project_id', projectId) as { data: CustomFieldValue[] | null; error: any };
      
      if (error) {
        console.error('Error fetching custom field values:', error);
        return [];
      }
      return data as CustomFieldValue[];
    },
    enabled: !!projectId,
  });

  // Save custom field value
  const saveValue = useMutation({
    mutationFn: async ({ fieldId, value }: { fieldId: string; value: string | null }) => {
      if (!projectId) throw new Error('No project ID');

      // Upsert the value
      const { error } = await supabase
        .from('project_custom_field_values' as any)
        .upsert({
          project_id: projectId,
          field_id: fieldId,
          field_value: value,
        }, {
          onConflict: 'project_id,field_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-custom-field-values', projectId] });
    },
    onError: (error: Error) => {
      toast.error('儲存失敗', { description: error.message });
    },
  });

  // Get value for a specific field
  const getValue = (fieldId: string): string | null => {
    const found = values.find(v => v.field_id === fieldId);
    return found?.field_value || null;
  };

  return {
    values,
    isLoading,
    saveValue,
    getValue,
  };
}
