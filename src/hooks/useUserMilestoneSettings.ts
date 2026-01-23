import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { COMPARISON_PAIRS, TIMELINE_DOC_MAPPING } from "./useProjectComparison";

// Default milestone order (step codes)
const DEFAULT_MILESTONE_ORDER = TIMELINE_DOC_MAPPING.map(m => `STEP_${m.step.toString().padStart(2, '0')}`);

// Default selected intervals (all intervals)
const DEFAULT_SELECTED_INTERVALS = COMPARISON_PAIRS.map(p => p.id);

export interface UserMilestoneSettings {
  id: string;
  user_id: string;
  milestone_order: string[];
  selected_intervals: string[];
  created_at: string;
  updated_at: string;
}

export function useUserMilestoneSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-milestone-settings', user?.id],
    queryFn: async (): Promise<UserMilestoneSettings | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_milestone_order')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching milestone settings:', error);
        throw error;
      }

      // Return default settings if none exist
      if (!data) {
        return {
          id: '',
          user_id: user.id,
          milestone_order: DEFAULT_MILESTONE_ORDER,
          selected_intervals: DEFAULT_SELECTED_INTERVALS,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // Type assertion since Supabase types may not reflect the new column yet
      const settings = data as unknown as UserMilestoneSettings;
      
      // Ensure selected_intervals has a value (for existing records before migration)
      if (!settings.selected_intervals || settings.selected_intervals.length === 0) {
        settings.selected_intervals = DEFAULT_SELECTED_INTERVALS;
      }

      return settings;
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { 
      milestone_order?: string[]; 
      selected_intervals?: string[];
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updateData = {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('user_milestone_order')
        .upsert(updateData, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-milestone-settings'] });
      toast.success('設定已儲存');
    },
    onError: (error) => {
      console.error('Error saving milestone settings:', error);
      toast.error('儲存設定失敗');
    },
  });

  const updateMilestoneOrder = (order: string[]) => {
    return updateMutation.mutateAsync({ milestone_order: order });
  };

  const updateSelectedIntervals = (intervals: string[]) => {
    return updateMutation.mutateAsync({ selected_intervals: intervals });
  };

  const updateSettings = (updates: { 
    milestone_order?: string[]; 
    selected_intervals?: string[];
  }) => {
    return updateMutation.mutateAsync(updates);
  };

  const resetToDefaults = () => {
    return updateMutation.mutateAsync({
      milestone_order: DEFAULT_MILESTONE_ORDER,
      selected_intervals: DEFAULT_SELECTED_INTERVALS,
    });
  };

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isUpdating: updateMutation.isPending,
    updateMilestoneOrder,
    updateSelectedIntervals,
    updateSettings,
    resetToDefaults,
    // Computed values for easy access
    milestoneOrder: query.data?.milestone_order ?? DEFAULT_MILESTONE_ORDER,
    selectedIntervals: query.data?.selected_intervals ?? DEFAULT_SELECTED_INTERVALS,
  };
}

// Utility function to filter comparison pairs by selected intervals
export function filterComparisonPairs(selectedIntervals: string[]) {
  return COMPARISON_PAIRS.filter(pair => selectedIntervals.includes(pair.id));
}

// Utility function to reorder milestones
export function reorderMilestones(milestoneOrder: string[]) {
  // Create a map from step code to original milestone
  const milestoneMap = new Map(
    TIMELINE_DOC_MAPPING.map(m => [`STEP_${m.step.toString().padStart(2, '0')}`, m])
  );
  
  // Return milestones in the specified order
  return milestoneOrder
    .map(code => milestoneMap.get(code))
    .filter(Boolean) as typeof TIMELINE_DOC_MAPPING[number][];
}
