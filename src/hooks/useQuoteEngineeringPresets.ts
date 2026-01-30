import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// 完整的工程類別定義 (對應 quote_engineering_templates)
export type PresetCategory = 
  | 'RACK'          // 模組支架
  | 'SAFETY'        // 防護工程
  | 'STEEL'         // 鋼構工程
  | 'MEP'           // 機電工程
  | 'CIVIL'         // 土木工程
  | 'CABINET'       // 箱體
  | 'ADMIN'         // 行政作業
  | 'COMPANY'       // 公司管理
  | 'ROOF_RENTAL';  // 模租鋪設

// 類別代碼對應顯示名稱
export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  RACK: '模組支架',
  SAFETY: '防護工程',
  STEEL: '鋼構工程',
  MEP: '機電工程',
  CIVIL: '土木工程',
  CABINET: '箱體',
  ADMIN: '行政作業',
  COMPANY: '公司管理',
  ROOF_RENTAL: '模租鋪設',
};

// 類別排序順序
export const PRESET_CATEGORY_ORDER: PresetCategory[] = [
  'RACK', 'SAFETY', 'STEEL', 'MEP', 'CIVIL', 'CABINET', 'ADMIN', 'COMPANY', 'ROOF_RENTAL'
];

export interface EngineeringPreset {
  id: string;
  category: PresetCategory;
  preset_key: string;
  item_name: string;
  spec_description: string | null;
  parent_label: string | null;
  is_sub_option: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePresetInput {
  category: PresetCategory;
  preset_key: string;
  item_name: string;
  spec_description?: string;
  parent_label?: string;
  is_sub_option?: boolean;
  sort_order?: number;
}

export interface UpdatePresetInput {
  id: string;
  item_name?: string;
  spec_description?: string;
  parent_label?: string;
  is_sub_option?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export function useQuoteEngineeringPresets(category?: PresetCategory) {
  const queryClient = useQueryClient();

  // 取得所有預設值
  const { data: presets = [], isLoading, error } = useQuery({
    queryKey: ['quote-engineering-presets', category],
    queryFn: async () => {
      let query = supabase
        .from('quote_engineering_presets' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EngineeringPreset[];
    },
  });

  // 取得有效的預設值 (用於下拉選單)
  const activePresets = presets.filter(p => p.is_active);

  // 新增預設值
  const createPreset = useMutation({
    mutationFn: async (input: CreatePresetInput) => {
      // 取得最大 sort_order
      const { data: existing } = await supabase
        .from('quote_engineering_presets' as any)
        .select('sort_order')
        .eq('category', input.category)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextSortOrder = input.sort_order ?? (((existing as any)?.[0]?.sort_order ?? 0) + 1);
      
      const { data, error } = await supabase
        .from('quote_engineering_presets' as any)
        .insert({
          ...input,
          sort_order: nextSortOrder,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-engineering-presets'] });
      toast.success('項目預設值已新增');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error('此項目代碼已存在');
      } else {
        toast.error('新增失敗: ' + error.message);
      }
    },
  });

  // 更新預設值
  const updatePreset = useMutation({
    mutationFn: async (input: UpdatePresetInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('quote_engineering_presets' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-engineering-presets'] });
      toast.success('項目預設值已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  // 刪除預設值
  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quote_engineering_presets' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-engineering-presets'] });
      toast.success('項目預設值已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗: ' + error.message);
    },
  });

  // 批次初始化預設值 (從靜態配置)
  const initializeFromDefaults = useMutation({
    mutationFn: async () => {
      // 動態載入靜態預設值
      const { ALL_ENGINEERING_PRESETS } = await import('@/config/bracketSpecPresets');
      
      // 取得現有的 key
      const { data: existing } = await supabase
        .from('quote_engineering_presets' as any)
        .select('preset_key');
      
      const existingKeys = new Set((existing as any[] || []).map((e: any) => e.preset_key));
      
      let added = 0;
      let skipped = 0;
      
      for (let i = 0; i < ALL_ENGINEERING_PRESETS.length; i++) {
        const preset = ALL_ENGINEERING_PRESETS[i];
        
        if (existingKeys.has(preset.key)) {
          skipped++;
          continue;
        }
        
        const { error } = await supabase
          .from('quote_engineering_presets' as any)
          .insert({
            category: preset.category,
            preset_key: preset.key,
            item_name: preset.label,
            spec_description: preset.specDescription,
            parent_label: preset.parentLabel || null,
            is_sub_option: preset.isSubOption || false,
            sort_order: i + 1,
          });
        
        if (!error) added++;
      }
      
      return { added, skipped };
    },
    onSuccess: ({ added, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['quote-engineering-presets'] });
      toast.success(`初始化完成：新增 ${added} 項，跳過 ${skipped} 項已存在`);
    },
    onError: (error: Error) => {
      toast.error('初始化失敗: ' + error.message);
    },
  });

  return {
    presets,
    activePresets,
    isLoading,
    error,
    createPreset,
    updatePreset,
    deletePreset,
    initializeFromDefaults,
  };
}

// 將資料庫預設值轉換為報價卡片用的格式
export function toCardPresetFormat(presets: EngineeringPreset[]) {
  return presets.map(p => ({
    key: p.preset_key,
    label: p.item_name,
    parentLabel: p.parent_label || undefined,
    specDescription: p.spec_description || '',
    category: p.category,
    isSubOption: p.is_sub_option,
  }));
}
