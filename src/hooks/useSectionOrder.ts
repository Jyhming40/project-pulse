import { useState, useEffect, useCallback } from 'react';

export type SectionId = 'chart' | 'disputeKpi' | 'bottleneck' | 'stats' | 'analysis' | 'dates' | 'pairInfo';

export interface SectionConfig {
  id: SectionId;
  label: string;
  icon: string; // Lucide icon name for reference
}

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'chart', label: '進度爬升曲線', icon: 'LineChart' },
  { id: 'disputeKpi', label: '爭議影響分析', icon: 'Scale' },
  { id: 'bottleneck', label: '瓶頸階段識別', icon: 'AlertOctagon' },
  { id: 'stats', label: '同年度統計分析', icon: 'Calculator' },
  { id: 'analysis', label: '階段耗時差異分析', icon: 'BarChart3' },
  { id: 'dates', label: '原始日期列表', icon: 'Calendar' },
  { id: 'pairInfo', label: '比較區間說明', icon: 'Info' },
];

const STORAGE_KEY = 'comparison-section-order:v1';

export function useSectionOrder() {
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SectionId[];
        // Validate: ensure all default sections are included
        const defaultIds = DEFAULT_SECTIONS.map(s => s.id);
        const isValid = parsed.length === defaultIds.length && 
          parsed.every(id => defaultIds.includes(id));
        if (isValid) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load section order:', e);
    }
    return DEFAULT_SECTIONS.map(s => s.id);
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionOrder));
    } catch (e) {
      console.warn('Failed to save section order:', e);
    }
  }, [sectionOrder]);

  const reorderSections = useCallback((activeId: string, overId: string) => {
    setSectionOrder(prev => {
      const oldIndex = prev.indexOf(activeId as SectionId);
      const newIndex = prev.indexOf(overId as SectionId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      
      const newOrder = [...prev];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      return newOrder;
    });
  }, []);

  const resetOrder = useCallback(() => {
    setSectionOrder(DEFAULT_SECTIONS.map(s => s.id));
  }, []);

  const getOrderedSections = useCallback(() => {
    return sectionOrder.map(id => DEFAULT_SECTIONS.find(s => s.id === id)!).filter(Boolean);
  }, [sectionOrder]);

  return {
    sectionOrder,
    setSectionOrder,
    reorderSections,
    resetOrder,
    getOrderedSections,
  };
}
