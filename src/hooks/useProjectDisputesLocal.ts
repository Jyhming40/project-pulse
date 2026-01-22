import { useState, useEffect, useCallback, useMemo } from "react";

// Dispute data stored in localStorage
export interface ProjectDispute {
  id: string;
  project_id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  severity: "low" | "medium" | "high";
  note?: string;
}

// Display strategy settings
export interface DisputeDisplayStrategy {
  filter: "all" | "high" | "intersecting";
  showOverlapDays: boolean;
  showDisputeLabels: boolean;
}

const DISPUTES_STORAGE_KEY = "projectDisputes:v1";
const SETTINGS_STORAGE_KEY = "projectDisputesSettings:v1";

const DEFAULT_STRATEGY: DisputeDisplayStrategy = {
  filter: "all",
  showOverlapDays: true,
  showDisputeLabels: true,
};

// Generate unique ID
function generateId(): string {
  return `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

export function useProjectDisputesLocal() {
  const [disputes, setDisputes] = useState<ProjectDispute[]>([]);
  const [strategy, setStrategy] = useState<DisputeDisplayStrategy>(DEFAULT_STRATEGY);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedDisputes = localStorage.getItem(DISPUTES_STORAGE_KEY);
      if (storedDisputes) {
        setDisputes(JSON.parse(storedDisputes));
      }

      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        setStrategy({ ...DEFAULT_STRATEGY, ...JSON.parse(storedSettings) });
      }
    } catch (e) {
      console.error("Failed to load disputes from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save disputes to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(DISPUTES_STORAGE_KEY, JSON.stringify(disputes));
    }
  }, [disputes, isLoaded]);

  // Save strategy to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(strategy));
    }
  }, [strategy, isLoaded]);

  // CRUD operations
  const addDispute = useCallback((dispute: Omit<ProjectDispute, "id">) => {
    const newDispute: ProjectDispute = {
      ...dispute,
      id: generateId(),
    };
    setDisputes((prev) => [...prev, newDispute]);
    return newDispute;
  }, []);

  const updateDispute = useCallback((id: string, updates: Partial<Omit<ProjectDispute, "id">>) => {
    setDisputes((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  }, []);

  const deleteDispute = useCallback((id: string) => {
    setDisputes((prev) => prev.filter((d) => d.id !== id));
  }, []);

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
    isLoaded,
    addDispute,
    updateDispute,
    deleteDispute,
    getDisputesByProject,
    updateStrategy,
    getFilteredDisputes,
    calculateOverlapDays,
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

  // If filtering by "intersecting", only count intervals that have overlap
  if (strategy.filter === "intersecting") {
    // Already handled in the loop
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
