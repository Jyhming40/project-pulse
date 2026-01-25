import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Dispute data stored in database (now uses project_issues table)
export interface ProjectDispute {
  id: string;
  project_id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  severity: "low" | "medium" | "high";
  note?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // New fields from project_issues
  issue_type?: string;
  is_resolved?: boolean;
}

// Display strategy settings (kept in localStorage as it's UI preference)
export interface DisputeDisplayStrategy {
  filter: "all" | "high" | "intersecting";
  showOverlapDays: boolean;
  showDisputeLabels: boolean;
}

const SETTINGS_STORAGE_KEY = "projectDisputesSettings:v1";

const DEFAULT_STRATEGY: DisputeDisplayStrategy = {
  filter: "all",
  showOverlapDays: true,
  showDisputeLabels: true,
};

// Calculate overlap days between two date ranges
export function calculateOverlapDays(
  intervalStart: string | null,
  intervalEnd: string | null,
  disputeStart: string,
  disputeEnd: string
): number {
  if (!intervalStart || !intervalEnd) return 0;

  const intStart = new Date(intervalStart).getTime();
  const intEnd = new Date(intervalEnd).getTime();
  const dispStart = new Date(disputeStart).getTime();
  const dispEnd = new Date(disputeEnd).getTime();

  // No overlap
  if (dispEnd < intStart || dispStart > intEnd) return 0;

  // Calculate intersection
  const overlapStart = Math.max(intStart, dispStart);
  const overlapEnd = Math.min(intEnd, dispEnd);

  return Math.max(0, Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
}

// Check if dispute intersects with any interval
export function disputeIntersectsInterval(
  dispute: ProjectDispute,
  intervalStart: string | null,
  intervalEnd: string | null
): boolean {
  return calculateOverlapDays(intervalStart, intervalEnd, dispute.start_date, dispute.end_date) > 0;
}

export function useProjectDisputes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<DisputeDisplayStrategy>(DEFAULT_STRATEGY);

  // Load strategy from localStorage on mount
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        setStrategy({ ...DEFAULT_STRATEGY, ...JSON.parse(storedSettings) });
      }
    } catch (e) {
      console.error("Failed to load dispute settings from localStorage:", e);
    }
  }, []);

  // Save strategy to localStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(strategy));
  }, [strategy]);

  // Fetch disputes from project_issues table (issue_type = 'dispute')
  const { data: disputes = [], isLoading, refetch } = useQuery({
    queryKey: ["project-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_issues")
        .select("*")
        .eq("issue_type", "dispute")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch disputes:", error);
        throw error;
      }

      return (data || []).map((d) => ({
        id: d.id,
        project_id: d.project_id,
        title: d.title,
        start_date: d.start_date,
        end_date: d.end_date,
        severity: d.severity as "low" | "medium" | "high",
        note: d.description || undefined,
        created_by: d.created_by || undefined,
        created_at: d.created_at || undefined,
        updated_at: d.updated_at || undefined,
        issue_type: d.issue_type,
        is_resolved: d.is_resolved || false,
      })) as ProjectDispute[];
    },
    enabled: !!user,
  });

  // Add dispute mutation (now uses project_issues table)
  const addMutation = useMutation({
    mutationFn: async (dispute: Omit<ProjectDispute, "id" | "created_by" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("project_issues")
        .insert({
          project_id: dispute.project_id,
          issue_type: "dispute",
          title: dispute.title,
          start_date: dispute.start_date,
          end_date: dispute.end_date,
          severity: dispute.severity,
          description: dispute.note || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["project-issues"] });
      queryClient.invalidateQueries({ queryKey: ["project-issue-summary"] });
      toast.success("爭議期間已新增");
    },
    onError: (error) => {
      console.error("Failed to add dispute:", error);
      toast.error("新增爭議失敗");
    },
  });

  // Update dispute mutation (now uses project_issues table)
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<ProjectDispute, "id">> }) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if (updates.severity !== undefined) updateData.severity = updates.severity;
      if (updates.note !== undefined) updateData.description = updates.note;

      const { data, error } = await supabase
        .from("project_issues")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["project-issues"] });
      queryClient.invalidateQueries({ queryKey: ["project-issue-summary"] });
      toast.success("爭議期間已更新");
    },
    onError: (error) => {
      console.error("Failed to update dispute:", error);
      toast.error("更新爭議失敗");
    },
  });

  // Delete dispute mutation (now uses project_issues table)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_issues")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["project-issues"] });
      queryClient.invalidateQueries({ queryKey: ["project-issue-summary"] });
      toast.success("爭議期間已刪除");
    },
    onError: (error) => {
      console.error("Failed to delete dispute:", error);
      toast.error("刪除爭議失敗");
    },
  });

  // CRUD operations
  const addDispute = useCallback(
    (dispute: Omit<ProjectDispute, "id" | "created_by" | "created_at" | "updated_at">) => {
      return addMutation.mutateAsync(dispute);
    },
    [addMutation]
  );

  const updateDispute = useCallback(
    (id: string, updates: Partial<Omit<ProjectDispute, "id">>) => {
      return updateMutation.mutateAsync({ id, updates });
    },
    [updateMutation]
  );

  const deleteDispute = useCallback(
    (id: string) => {
      return deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const getDisputesByProject = useCallback(
    (projectId: string) => {
      return disputes.filter((d) => d.project_id === projectId);
    },
    [disputes]
  );

  const updateStrategy = useCallback((updates: Partial<DisputeDisplayStrategy>) => {
    setStrategy((prev) => ({ ...prev, ...updates }));
  }, []);

  // Filter disputes based on strategy and optional interval range
  const getFilteredDisputes = useCallback(
    (
      projectIds: string[],
      intervalRanges?: { projectId: string; start: string | null; end: string | null }[]
    ): ProjectDispute[] => {
      let filtered = disputes.filter((d) => projectIds.includes(d.project_id));

      // Apply severity filter
      if (strategy.filter === "high") {
        filtered = filtered.filter((d) => d.severity === "high");
      }

      // Apply intersection filter
      if (strategy.filter === "intersecting" && intervalRanges) {
        filtered = filtered.filter((dispute) => {
          const projectRange = intervalRanges.find((r) => r.projectId === dispute.project_id);
          if (!projectRange) return false;
          return disputeIntersectsInterval(dispute, projectRange.start, projectRange.end);
        });
      }

      return filtered;
    },
    [disputes, strategy.filter]
  );

  return {
    disputes,
    strategy,
    isLoading,
    isLoaded: !isLoading,
    addDispute,
    updateDispute,
    deleteDispute,
    getDisputesByProject,
    updateStrategy,
    getFilteredDisputes,
    calculateOverlapDays,
    refetch,
    isSaving: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

// Calculate KPI stats for disputes
export interface DisputeKpiStats {
  projectId: string;
  projectName: string;
  totalIntervalDays: number;
  totalOverlapDays: number;
  overlapPercentage: number;
  affectedIntervalCount: number;
  highSeverityOverlapDays: number;
}

export function calculateDisputeKpi(
  projectId: string,
  projectName: string,
  intervals: { fromDate: string | null; toDate: string | null; days: number | null }[],
  disputes: ProjectDispute[],
  strategy: DisputeDisplayStrategy
): DisputeKpiStats {
  const projectDisputes = disputes.filter((d) => d.project_id === projectId);
  
  // Apply strategy filter
  let filteredDisputes = projectDisputes;
  if (strategy.filter === "high") {
    filteredDisputes = projectDisputes.filter((d) => d.severity === "high");
  }

  let totalIntervalDays = 0;
  let totalOverlapDays = 0;
  let affectedIntervalCount = 0;
  let highSeverityOverlapDays = 0;

  for (const interval of intervals) {
    if (interval.fromDate && interval.toDate && interval.days !== null) {
      totalIntervalDays += interval.days;

      let intervalOverlap = 0;
      let hasOverlap = false;

      for (const dispute of filteredDisputes) {
        const overlap = calculateOverlapDays(
          interval.fromDate,
          interval.toDate,
          dispute.start_date,
          dispute.end_date
        );
        
        // Avoid double-counting overlapping disputes
        intervalOverlap = Math.max(intervalOverlap, overlap);
        
        if (overlap > 0) {
          hasOverlap = true;
          if (dispute.severity === "high") {
            highSeverityOverlapDays += overlap;
          }
        }
      }

      totalOverlapDays += intervalOverlap;
      if (hasOverlap) affectedIntervalCount++;
    }
  }

  return {
    projectId,
    projectName,
    totalIntervalDays,
    totalOverlapDays,
    overlapPercentage: totalIntervalDays > 0 ? (totalOverlapDays / totalIntervalDays) * 100 : 0,
    affectedIntervalCount,
    highSeverityOverlapDays,
  };
}

// Backward compatibility: re-export old hook name
export { useProjectDisputes as useProjectDisputesLocal };
