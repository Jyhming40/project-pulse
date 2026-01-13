import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CodebookCategory, codebookCategoryConfig } from '@/config/codebookConfig';

export interface CodebookOption {
  id: string;
  category: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  usage_count?: number;
}

export interface CreateOptionInput {
  category: CodebookCategory;
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

// Calculate usage count for a specific option value in a category
async function calculateUsageCount(category: CodebookCategory, value: string): Promise<number> {
  const config = codebookCategoryConfig[category];
  if (!config || !config.usageMapping.length) return 0;

  let totalCount = 0;

  for (const mapping of config.usageMapping) {
    const { table, column } = mapping;
    
    // Query the table to count rows with this value
    const queryValue = value;
    
    // Query the table to count rows with this value
    const { count, error } = await supabase
      .from(table as any)
      .select('*', { count: 'exact', head: true })
      .eq(column, queryValue);
    
    if (!error && count !== null) {
      totalCount += count;
    }
  }

  return totalCount;
}

// Calculate usage counts for all options in a category
async function calculateCategoryUsageCounts(
  category: CodebookCategory, 
  options: CodebookOption[]
): Promise<Map<string, number>> {
  const usageCounts = new Map<string, number>();
  
  const categoryOptions = options.filter(opt => opt.category === category);
  
  await Promise.all(
    categoryOptions.map(async (opt) => {
      const count = await calculateUsageCount(category as CodebookCategory, opt.value);
      usageCounts.set(opt.id, count);
    })
  );

  return usageCounts;
}

export function useCodebook(category?: CodebookCategory) {
  const queryClient = useQueryClient();

  // Fetch all options
  const { data: options = [], isLoading, error } = useQuery({
    queryKey: ['codebook-options', category],
    queryFn: async () => {
      let query = supabase
        .from('system_options')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CodebookOption[];
    },
  });

  // Fetch usage counts for a specific category
  const { data: usageCounts = new Map<string, number>(), isLoading: isLoadingUsage } = useQuery({
    queryKey: ['codebook-usage', category],
    queryFn: async () => {
      if (!category) return new Map<string, number>();
      return calculateCategoryUsageCounts(category, options);
    },
    enabled: !!category && options.length > 0,
  });

  // Get options by category (for dropdowns) - only active options
  const getOptionsByCategory = (cat: CodebookCategory) => {
    return options
      .filter(opt => opt.category === cat && opt.is_active)
      .map(opt => ({ value: opt.value, label: opt.label }));
  };

  // Get all options by category (including inactive) - for admin view
  const getAllOptionsByCategory = (cat: CodebookCategory) => {
    return options.filter(opt => opt.category === cat);
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
      queryClient.invalidateQueries({ queryKey: ['codebook-options'] });
      queryClient.invalidateQueries({ queryKey: ['codebook-usage'] });
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
      queryClient.invalidateQueries({ queryKey: ['codebook-options'] });
      queryClient.invalidateQueries({ queryKey: ['codebook-usage'] });
      toast.success('選項已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  // Delete option - with usage check
  const deleteOption = useMutation({
    mutationFn: async ({ id, category: cat, value }: { id: string; category: CodebookCategory; value: string }) => {
      // Check usage count first
      const usageCount = await calculateUsageCount(cat, value);
      
      if (usageCount > 0) {
        throw new Error(`此選項已被 ${usageCount} 筆資料使用，無法刪除。請改為停用此選項。`);
      }
      
      const { error } = await supabase
        .from('system_options')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codebook-options'] });
      queryClient.invalidateQueries({ queryKey: ['codebook-usage'] });
      toast.success('選項已刪除');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reorder options - only update items that actually changed
  const reorderOptions = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Get current options to check what actually needs updating
      const currentOptions = options.filter(opt => orderedIds.includes(opt.id));
      
      // Build a map of id -> current sort_order
      const currentSortMap = new Map(currentOptions.map(opt => [opt.id, opt.sort_order]));
      
      // Collect items that need updating
      const itemsToUpdate: { id: string; newSortOrder: number }[] = [];
      orderedIds.forEach((id, index) => {
        const newSortOrder = index + 1;
        const currentSortOrder = currentSortMap.get(id);
        
        // Only update if sort_order actually changed
        if (currentSortOrder !== newSortOrder) {
          itemsToUpdate.push({ id, newSortOrder });
        }
      });
      
      // Execute updates
      if (itemsToUpdate.length > 0) {
        for (const item of itemsToUpdate) {
          await supabase
            .from('system_options')
            .update({ sort_order: item.newSortOrder })
            .eq('id', item.id);
        }
      }
      
      return itemsToUpdate.length; // Return count of updated items
    },
    onSuccess: (updatedCount) => {
      queryClient.invalidateQueries({ queryKey: ['codebook-options'] });
      if (updatedCount > 0) {
        toast.success('順序已更新');
      }
    },
    onError: (error: Error) => {
      toast.error('更新順序失敗: ' + error.message);
    },
  });

  // Get usage count for a specific option
  const getUsageCount = (optionId: string): number => {
    return usageCounts.get(optionId) ?? 0;
  };

  return {
    options,
    isLoading,
    isLoadingUsage,
    error,
    usageCounts,
    getOptionsByCategory,
    getAllOptionsByCategory,
    getUsageCount,
    createOption,
    updateOption,
    deleteOption,
    reorderOptions,
  };
}

// Hook for getting options for a specific category (for use in forms)
export function useCodebookOptions(category: CodebookCategory) {
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['codebook-options', category, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_options')
        .select('value, label')
        .eq('category', category)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data.map(opt => ({ value: opt.value, label: opt.label }));
    },
  });

  return { options, isLoading };
}
