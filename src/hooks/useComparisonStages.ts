import { useMemo } from 'react';
import { useProcessStages, ProcessStage } from './useProcessStages';
import { COMPARISON_PAIRS, TIMELINE_DOC_MAPPING } from './useProjectComparison';

/**
 * 比較階段定義 (用於案件比較分析)
 */
export interface ComparisonStage {
  id: string;
  code: string;
  label: string;
  description?: string;
  fromStep: number;
  toStep: number;
  sortOrder: number;
  isSystem: boolean;
  isFromDB: boolean;
}

/**
 * 取得里程碑選項
 */
export function getMilestoneOptions() {
  return TIMELINE_DOC_MAPPING.map(m => ({
    step: m.step,
    label: m.label,
    shortLabel: m.short,
    color: m.color,
  }));
}

/**
 * 將 process_stages 資料轉換為 ComparisonStage 格式
 */
function processStageToComparison(stage: ProcessStage): ComparisonStage | null {
  if (!stage.is_comparison_stage || stage.from_milestone_step === null || stage.to_milestone_step === null) {
    return null;
  }

  return {
    id: stage.code,
    code: stage.code,
    label: stage.name,
    description: stage.description || undefined,
    fromStep: stage.from_milestone_step,
    toStep: stage.to_milestone_step,
    sortOrder: stage.comparison_sort_order ?? stage.sort_order,
    isSystem: false,
    isFromDB: true,
  };
}

/**
 * 將系統預設的 COMPARISON_PAIRS 轉換為 ComparisonStage 格式
 */
function getSystemComparisonStages(): ComparisonStage[] {
  return COMPARISON_PAIRS.map((pair, index) => ({
    id: pair.id,
    code: pair.id,
    label: pair.label,
    description: pair.description,
    fromStep: pair.fromStep,
    toStep: pair.toStep,
    sortOrder: index,
    isSystem: true,
    isFromDB: false,
  }));
}

/**
 * useComparisonStages Hook
 * 
 * 整合資料庫中的 process_stages (is_comparison_stage = true) 
 * 與系統預設的 COMPARISON_PAIRS，提供統一的比較階段資料來源
 */
export function useComparisonStages() {
  const { stages, isLoading, error } = useProcessStages();

  // 從資料庫取得的比較階段
  const dbStages = useMemo(() => {
    return stages
      .filter(s => s.is_active && s.is_comparison_stage)
      .map(processStageToComparison)
      .filter((s): s is ComparisonStage => s !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [stages]);

  // 系統預設的比較階段
  const systemStages = useMemo(() => getSystemComparisonStages(), []);

  // 合併後的所有比較階段
  // 策略：如果資料庫有設定比較階段，則使用 DB 設定 + 系統預設
  // 如果資料庫完全沒有設定，則只使用系統預設
  const allStages = useMemo(() => {
    if (dbStages.length > 0) {
      // 合併：DB stages 優先，然後是系統 stages（避免重複）
      const dbIds = new Set(dbStages.map(s => s.id));
      const uniqueSystemStages = systemStages.filter(s => !dbIds.has(s.id));
      return [...dbStages, ...uniqueSystemStages];
    }
    return systemStages;
  }, [dbStages, systemStages]);

  // 里程碑選項
  const milestoneOptions = useMemo(() => getMilestoneOptions(), []);

  // 只取得資料庫中設定的比較階段
  const customStages = dbStages;

  // 是否有自訂階段
  const hasCustomStages = dbStages.length > 0;

  return {
    // 所有比較階段 (DB + System)
    allStages,
    // 只有資料庫設定的自訂階段
    customStages,
    // 系統預設階段
    systemStages,
    // 是否有自訂階段
    hasCustomStages,
    // 里程碑選項
    milestoneOptions,
    // 載入狀態
    isLoading,
    error,
  };
}
