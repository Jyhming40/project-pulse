import { useState, useCallback, useEffect } from 'react';

export interface PortfolioChartItem {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const STORAGE_KEY = 'portfolio-chart-layout';

const DEFAULT_CHARTS: PortfolioChartItem[] = [
  { id: 'installation-type', label: '案場類型分佈', visible: true, order: 0 },
  { id: 'installation-type-table', label: '案場類型統計', visible: true, order: 1 },
  { id: 'yearly-trend', label: '年度案件趨勢', visible: true, order: 2 },
  { id: 'capacity-distribution', label: '容量級距分佈', visible: true, order: 3 },
  { id: 'region-distribution', label: '地區分佈', visible: true, order: 4 },
];

function loadLayout(): PortfolioChartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHARTS;
    const parsed = JSON.parse(raw) as PortfolioChartItem[];
    // Merge with defaults to handle new charts added later
    const knownIds = new Set(parsed.map(c => c.id));
    const merged = [...parsed];
    DEFAULT_CHARTS.forEach(dc => {
      if (!knownIds.has(dc.id)) {
        merged.push({ ...dc, order: merged.length });
      }
    });
    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_CHARTS;
  }
}

export function usePortfolioLayout() {
  const [charts, setCharts] = useState<PortfolioChartItem[]>(loadLayout);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
  }, [charts]);

  const toggleVisibility = useCallback((id: string) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setCharts(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const resetLayout = useCallback(() => {
    setCharts(DEFAULT_CHARTS);
  }, []);

  const visibleCharts = charts.filter(c => c.visible).sort((a, b) => a.order - b.order);

  return { charts, visibleCharts, toggleVisibility, reorder, resetLayout };
}
