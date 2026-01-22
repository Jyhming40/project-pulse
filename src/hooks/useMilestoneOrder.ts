import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIMELINE_DOC_MAPPING, COMPARISON_PAIRS } from "./useProjectComparison";

// Default milestone order (1-11)
export const DEFAULT_MILESTONE_ORDER = TIMELINE_DOC_MAPPING.map(m => `STEP_${m.step.toString().padStart(2, '0')}`);

export interface MilestoneOrderItem {
  code: string;
  step: number;
  label: string;
  short: string;
  color: string;
}

// Get milestone items in a given order
export function getMilestoneItemsInOrder(order: string[]): MilestoneOrderItem[] {
  return order.map(code => {
    const stepNum = parseInt(code.replace('STEP_', ''), 10);
    const mapping = TIMELINE_DOC_MAPPING.find(m => m.step === stepNum);
    if (!mapping) return null;
    return {
      code,
      step: mapping.step,
      label: mapping.label,
      short: mapping.short,
      color: mapping.color,
    };
  }).filter(Boolean) as MilestoneOrderItem[];
}

// Type for reordered milestone
export type TimelineDocMappingItem = (typeof TIMELINE_DOC_MAPPING)[number];

// Reorder TIMELINE_DOC_MAPPING based on custom order
export function getReorderedMilestones(customOrder: string[] | null): TimelineDocMappingItem[] {
  if (!customOrder || customOrder.length === 0) {
    return [...TIMELINE_DOC_MAPPING];
  }
  
  const reordered: TimelineDocMappingItem[] = [];
  
  for (const code of customOrder) {
    const stepNum = parseInt(code.replace('STEP_', ''), 10);
    const mapping = TIMELINE_DOC_MAPPING.find(m => m.step === stepNum);
    if (mapping) {
      reordered.push(mapping);
    }
  }
  
  // Add any missing milestones at the end
  const usedSteps = new Set(reordered.map(m => m.step));
  const missing = TIMELINE_DOC_MAPPING.filter(m => !usedSteps.has(m.step));
  
  return [...reordered, ...missing];
}

// Reorder COMPARISON_PAIRS based on custom milestone order
export function getReorderedComparisonPairs(customOrder: string[] | null) {
  if (!customOrder || customOrder.length === 0) {
    return COMPARISON_PAIRS;
  }
  
  // Create step mapping: original step -> new position (1-based)
  const stepMapping = new Map<number, number>();
  customOrder.forEach((code, index) => {
    const stepNum = parseInt(code.replace('STEP_', ''), 10);
    stepMapping.set(stepNum, index + 1);
  });
  
  // Reorder consecutive pairs based on new positions
  const consecutivePairs = COMPARISON_PAIRS.slice(0, 10); // First 10 are consecutive
  const summaryPairs = COMPARISON_PAIRS.slice(10); // Rest are summary pairs
  
  // Sort consecutive pairs by new from position
  const reorderedConsecutive = [...consecutivePairs].sort((a, b) => {
    const aPos = stepMapping.get(a.fromStep) || a.fromStep;
    const bPos = stepMapping.get(b.fromStep) || b.fromStep;
    return aPos - bPos;
  });
  
  return [...reorderedConsecutive, ...summaryPairs];
}

// Interface for the table row
interface UserMilestoneOrderRow {
  id: string;
  user_id: string;
  milestone_order: string[];
  created_at: string;
  updated_at: string;
}

// Hook to fetch user's milestone order
export function useMilestoneOrder() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-milestone-order', user?.id],
    queryFn: async (): Promise<string[] | null> => {
      if (!user?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('user_milestone_order' as any)
          .select('milestone_order')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching milestone order:', error);
          return null;
        }
        return (data as any)?.milestone_order || null;
      } catch (e) {
        console.error('Error fetching milestone order:', e);
        return null;
      }
    },
    enabled: !!user?.id,
  });
}

// Hook to save/update milestone order
export function useSaveMilestoneOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (milestoneOrder: string[]) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Upsert the order using direct query
      const { data, error } = await supabase
        .from('user_milestone_order' as any)
        .upsert(
          { 
            user_id: user.id, 
            milestone_order: milestoneOrder,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'user_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-milestone-order'] });
    },
  });
}

// Hook to reset milestone order to default
export function useResetMilestoneOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('user_milestone_order' as any)
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-milestone-order'] });
    },
  });
}
