import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIMELINE_DOC_MAPPING } from "@/hooks/useProjectComparison";

export interface MilestoneOrderState {
  order: number[];
  isLoading: boolean;
  isSaving: boolean;
}

const DEFAULT_ORDER = TIMELINE_DOC_MAPPING.map(m => m.step);

/**
 * Hook to manage user-customizable milestone order
 * Persists to database for logged-in users, falls back to localStorage
 */
export function useMilestoneOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [localOrder, setLocalOrder] = useState<number[]>(() => {
    const saved = localStorage.getItem("milestoneOrder:v1");
    return saved ? JSON.parse(saved) : DEFAULT_ORDER;
  });

  // Fetch from database for logged-in users
  const { data: dbOrder, isLoading } = useQuery({
    queryKey: ["milestoneOrder", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("user_milestone_order")
        .select("milestone_order")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Convert stored format (STEP_01) to numbers
      if (data?.milestone_order) {
        const order = data.milestone_order
          .map((s: string) => parseInt(s.replace("STEP_", ""), 10))
          .filter((n: number) => !isNaN(n));
        return order.length > 0 ? order : DEFAULT_ORDER;
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Current order: use DB data if available, otherwise localStorage
  const currentOrder = useMemo(() => {
    if (user?.id && dbOrder) return dbOrder;
    return localOrder;
  }, [user?.id, dbOrder, localOrder]);

  // Get ordered milestones based on current order
  const orderedMilestones = useMemo(() => {
    type MilestoneItem = typeof TIMELINE_DOC_MAPPING[number];
    const milestoneMap = new Map<number, MilestoneItem>(
      TIMELINE_DOC_MAPPING.map(m => [m.step, m])
    );
    return currentOrder
      .map(step => milestoneMap.get(step))
      .filter((m): m is MilestoneItem => m !== undefined);
  }, [currentOrder]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newOrder: number[]) => {
      // Always save to localStorage
      localStorage.setItem("milestoneOrder:v1", JSON.stringify(newOrder));
      setLocalOrder(newOrder);

      // If user is logged in, also save to database
      if (user?.id) {
        const orderStrings = newOrder.map(n => `STEP_${n.toString().padStart(2, "0")}`);
        
        const { error } = await supabase
          .from("user_milestone_order")
          .upsert(
            { 
              user_id: user.id, 
              milestone_order: orderStrings,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestoneOrder"] });
      // Emit custom event for chart sync
      window.dispatchEvent(new CustomEvent("milestoneOrderChanged"));
    },
  });

  // Move milestone to new position
  const moveMilestone = useCallback((fromIndex: number, toIndex: number) => {
    const newOrder = [...currentOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    saveMutation.mutate(newOrder);
  }, [currentOrder, saveMutation]);

  // Reset to default order
  const resetOrder = useCallback(() => {
    saveMutation.mutate(DEFAULT_ORDER);
  }, [saveMutation]);

  // Check if current order differs from default
  const isCustomOrder = useMemo(() => {
    return JSON.stringify(currentOrder) !== JSON.stringify(DEFAULT_ORDER);
  }, [currentOrder]);

  return {
    order: currentOrder,
    orderedMilestones,
    isLoading,
    isSaving: saveMutation.isPending,
    moveMilestone,
    resetOrder,
    isCustomOrder,
  };
}
