import { useCallback, useMemo } from "react";

const STORAGE_KEY = "project_comparison_frequency";

interface FrequencyData {
  baseline: Record<string, number>;
  comparison: Record<string, number>;
}

function getFrequencyData(): FrequencyData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to parse frequency data:", e);
  }
  return { baseline: {}, comparison: {} };
}

function saveFrequencyData(data: FrequencyData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save frequency data:", e);
  }
}

export function useFrequentProjects() {
  const frequencyData = useMemo(() => getFrequencyData(), []);

  const recordBaselineSelection = useCallback((projectId: string) => {
    const data = getFrequencyData();
    data.baseline[projectId] = (data.baseline[projectId] || 0) + 1;
    saveFrequencyData(data);
  }, []);

  const recordComparisonSelection = useCallback((projectId: string) => {
    const data = getFrequencyData();
    data.comparison[projectId] = (data.comparison[projectId] || 0) + 1;
    saveFrequencyData(data);
  }, []);

  const getBaselineFrequency = useCallback((projectId: string): number => {
    return frequencyData.baseline[projectId] || 0;
  }, [frequencyData]);

  const getComparisonFrequency = useCallback((projectId: string): number => {
    return frequencyData.comparison[projectId] || 0;
  }, [frequencyData]);

  const sortByBaselineFrequency = useCallback(<T extends { id: string }>(projects: T[]): T[] => {
    const data = getFrequencyData();
    return [...projects].sort((a, b) => {
      const freqA = data.baseline[a.id] || 0;
      const freqB = data.baseline[b.id] || 0;
      return freqB - freqA; // Descending order
    });
  }, []);

  const sortByComparisonFrequency = useCallback(<T extends { id: string }>(projects: T[]): T[] => {
    const data = getFrequencyData();
    return [...projects].sort((a, b) => {
      const freqA = data.comparison[a.id] || 0;
      const freqB = data.comparison[b.id] || 0;
      return freqB - freqA; // Descending order
    });
  }, []);

  return {
    recordBaselineSelection,
    recordComparisonSelection,
    getBaselineFrequency,
    getComparisonFrequency,
    sortByBaselineFrequency,
    sortByComparisonFrequency,
  };
}
