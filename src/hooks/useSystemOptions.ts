import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CodebookCategory, defaultEnumValues, allCategories, codebookCategoryConfig } from '@/config/codebookConfig';

// Re-export CodebookCategory as OptionCategory for backward compatibility
export type OptionCategory = CodebookCategory;

export interface SystemOption {
  id: string;
  category: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateOptionInput {
  category: OptionCategory;
  value: string;
  label: string;
  sort_order?: number;
}

export interface UpdateOptionInput {
  id: string;
  value?: string;
  label?: string;
  sort_order?: number;
  is_active?: boolean;
}

export function useSystemOptions(category?: OptionCategory) {
  const queryClient = useQueryClient();

  // Fetch options - optionally filtered by category
  const { data: options = [], isLoading, error } = useQuery({
    queryKey: ['system-options', category],
    queryFn: async () => {
      let query = supabase
        .from('system_options')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SystemOption[];
    },
  });

  // Get options by category (for dropdowns)
  const getOptionsByCategory = (cat: OptionCategory) => {
    return options.filter(opt => opt.category === cat && opt.is_active);
  };

  // Create new option
  const createOption = useMutation({
    mutationFn: async (input: CreateOptionInput) => {
      // Get max sort_order for this category
      const { data: existing } = await supabase
        .from('system_options')
        .select('sort_order')
        .eq('category', input.category)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextSortOrder = input.sort_order ?? ((existing?.[0]?.sort_order ?? 0) + 1);
      
      const { data, error } = await supabase
        .from('system_options')
        .insert({
          category: input.category,
          value: input.value,
          label: input.label,
          sort_order: nextSortOrder,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] });
      toast.success('選項已新增');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('此選項值已存在');
      } else {
        toast.error('新增失敗: ' + error.message);
      }
    },
  });

  // Update option
  const updateOption = useMutation({
    mutationFn: async (input: UpdateOptionInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('system_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] });
      toast.success('選項已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  // Delete option
  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('system_options')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] });
      toast.success('選項已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗: ' + error.message);
    },
  });

  // Reorder options
  const reorderOptions = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('system_options')
          .update({ sort_order: index + 1 })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] });
      toast.success('順序已更新');
    },
    onError: (error: Error) => {
      toast.error('更新順序失敗: ' + error.message);
    },
  });

  return {
    options,
    isLoading,
    error,
    getOptionsByCategory,
    createOption,
    updateOption,
    deleteOption,
    reorderOptions,
  };
}

export interface OptionWithStatus {
  value: string;
  label: string;
  is_active: boolean;
}

// Hook for getting options for a specific category (for use in forms)
// Returns both active options for selection and includes inactive for display
export function useOptionsForCategory(category: OptionCategory, currentValue?: string) {
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['system-options', category, 'for-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_options')
        .select('value, label, is_active')
        .eq('category', category)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as OptionWithStatus[];
    },
  });

  // For dropdown: show active options + current value (even if disabled)
  const activeOptions = options.filter(opt => opt.is_active);
  
  // If current value exists but is not in active options, include it as disabled
  const currentOption = currentValue 
    ? options.find(opt => opt.value === currentValue)
    : null;
  
  const shouldIncludeCurrentAsDisabled = currentOption && !currentOption.is_active;
  
  // Combined options for dropdown
  const dropdownOptions = shouldIncludeCurrentAsDisabled
    ? [currentOption, ...activeOptions]
    : activeOptions;

  return { 
    options: activeOptions.map(opt => ({ value: opt.value, label: opt.label })),
    allOptions: options,
    dropdownOptions,
    isLoading 
  };
}

// Hook to batch initialize all categories with default values
export function useBatchInitialize() {
  const queryClient = useQueryClient();

  const batchInitialize = useMutation({
    mutationFn: async () => {
      const results: { category: string; added: number; skipped: number }[] = [];
      
      for (const category of allCategories) {
        const defaults = defaultEnumValues[category];
        if (!defaults || defaults.length === 0) continue;

        // Get existing options for this category
        const { data: existing } = await supabase
          .from('system_options')
          .select('value')
          .eq('category', category);
        
        const existingValues = new Set(existing?.map(e => e.value) || []);
        
        let added = 0;
        let skipped = 0;
        
        for (let i = 0; i < defaults.length; i++) {
          const { value, label } = defaults[i];
          if (existingValues.has(value)) {
            skipped++;
            continue;
          }
          
          const { error } = await supabase
            .from('system_options')
            .insert({
              category,
              value,
              label,
              sort_order: i + 1,
            });
          
          if (!error) added++;
        }
        
        results.push({ 
          category: codebookCategoryConfig[category].label, 
          added, 
          skipped 
        });
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['system-options'] });
      const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
      toast.success(`批次初始化完成：新增 ${totalAdded} 個選項，跳過 ${totalSkipped} 個已存在選項`);
    },
    onError: (error: Error) => {
      toast.error('批次初始化失敗: ' + error.message);
    },
  });

  return batchInitialize;
}
