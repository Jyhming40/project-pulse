import { useMemo, useCallback } from 'react';
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
 * 里程碑選項
 */
export interface MilestoneOption {
  step: number;
  label: string;
  shortLabel: string;
  color: string;
}

/**
 * 取得里程碑選項
 */
export function getMilestoneOptions(): MilestoneOption[] {
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
 * 統一的比較階段資料來源 - 整合資料庫設定與系統預設
 * 提供與 useEditableStages 相容的介面
 */
export function useComparisonStages() {
  const { stages, isLoading, error } = useProcessStages();

  // 里程碑選項
  const milestoneOptions = useMemo(() => getMilestoneOptions(), []);

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
  // 策略：優先使用 DB 設定，如果沒有則使用系統預設
  const allStages = useMemo(() => {
    if (dbStages.length > 0) {
      // 合併：DB stages 優先，然後是系統 stages（避免重複）
      const dbIds = new Set(dbStages.map(s => s.id));
      const uniqueSystemStages = systemStages.filter(s => !dbIds.has(s.id));
      return [...dbStages, ...uniqueSystemStages].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return systemStages;
  }, [dbStages, systemStages]);

  // 只取得資料庫中設定的比較階段
  const customStages = dbStages;

  // 是否有自訂階段
  const hasCustomStages = dbStages.length > 0;

  /**
   * 取得階段的有效配置 (相容 useEditableStages 介面)
   */
  const getStageConfig = useCallback((stageId: string) => {
    const stage = allStages.find(s => s.id === stageId);
    if (!stage) {
      // Fallback 到系統預設
      const systemStage = COMPARISON_PAIRS.find(p => p.id === stageId);
      if (!systemStage) return null;
      return {
        fromStep: systemStage.fromStep,
        toStep: systemStage.toStep,
        isEdited: false,
      };
    }
    return {
      fromStep: stage.fromStep,
      toStep: stage.toStep,
      isEdited: stage.isFromDB,
    };
  }, [allStages]);

  /**
   * 根據階段配置計算區間標籤
   */
  const getStageLabel = useCallback((stageId: string) => {
    const config = getStageConfig(stageId);
    if (!config) return '';
    
    const fromMilestone = milestoneOptions.find(m => m.step === config.fromStep);
    const toMilestone = milestoneOptions.find(m => m.step === config.toStep);
    
    if (!fromMilestone || !toMilestone) return '';
    
    return `${fromMilestone.shortLabel}→${toMilestone.shortLabel}`;
  }, [getStageConfig, milestoneOptions]);

  /**
   * 建立可編輯的階段列表 (相容 useEditableStages 的 editableStages)
   * 只取前 10 個系統階段用於統計卡片
   */
  const editableStages = useMemo(() => {
    const stepPairs = COMPARISON_PAIRS.slice(0, 10);
    
    return stepPairs.map(pair => {
      // 查找 DB 是否有覆蓋設定
      const dbOverride = dbStages.find(s => s.id === pair.id);
      
      return {
        id: pair.id,
        label: pair.label,
        fromStep: dbOverride?.fromStep ?? pair.fromStep,
        toStep: dbOverride?.toStep ?? pair.toStep,
        isSystem: true,
        isEdited: !!dbOverride,
        originalFromStep: pair.fromStep,
        originalToStep: pair.toStep,
      };
    });
  }, [dbStages]);

  /**
   * 檢查是否有任何編輯 (相容 useEditableStages)
   */
  const hasEdits = dbStages.length > 0;

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
    // 相容 useEditableStages 的介面
    editableStages,
    getStageConfig,
    getStageLabel,
    hasEdits,
  };
}
