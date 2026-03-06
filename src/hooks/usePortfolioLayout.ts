import { useState, useCallback, useEffect } from 'react';

export type ChartSpan = 1 | 2 | 3; // 1=1/3寬, 2=2/3寬, 3=整行

export interface PortfolioChartItem {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  span: ChartSpan;
}

const STORAGE_KEY = 'portfolio-chart-layout-v2';

const DEFAULT_CHARTS: PortfolioChartItem[] = [
  { id: 'installation-type', label: '案場類型分佈', visible: true, order: 0, span: 1 },
  { id: 'installation-type-table', label: '案場類型統計', visible: true, order: 1, span: 1 },
  { id: 'yearly-trend', label: '年度案件趨勢', visible: true, order: 2, span: 1 },
  { id: 'capacity-distribution', label: '容量級距分佈', visible: true, order: 3, span: 1 },
  { id: 'region-distribution', label: '地區分佈', visible: true, order: 4, span: 1 },
];

function loadLayout(): PortfolioChartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHARTS;
    const parsed = JSON.parse(raw) as PortfolioChartItem[];
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

  const setSpan = useCallback((id: string, span: ChartSpan) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, span } : c));
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

  return { charts, visibleCharts, toggleVisibility, setSpan, reorder, resetLayout };
}
