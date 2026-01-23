import { useState, useCallback, useMemo, useEffect } from 'react';
import { COMPARISON_PAIRS, TIMELINE_DOC_MAPPING } from './useProjectComparison';

export interface EditableStage {
  id: string;
  label: string;
  fromStep: number;
  toStep: number;
  isSystem: boolean;
  isEdited: boolean; // 標記是否被使用者修改過
  originalFromStep?: number;
  originalToStep?: number;
}

const EDITABLE_STAGES_KEY = 'editableStages:v1';

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
 * 從 localStorage 載入編輯過的階段
 */
function loadEditedStagesFromStorage(): Record<string, { fromStep: number; toStep: number }> {
  try {
    const stored = localStorage.getItem(EDITABLE_STAGES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load edited stages:', e);
  }
  return {};
}

/**
 * 儲存編輯過的階段到 localStorage
 */
function saveEditedStagesToStorage(edits: Record<string, { fromStep: number; toStep: number }>) {
  try {
    localStorage.setItem(EDITABLE_STAGES_KEY, JSON.stringify(edits));
  } catch (e) {
    console.warn('Failed to save edited stages:', e);
  }
}

// Custom event for cross-component sync
const EDITABLE_STAGES_CHANGE_EVENT = 'editableStagesChanged';

/**
 * 可編輯階段 Hook
 * 允許使用者修改系統預設階段的起迄里程碑
 */
export function useEditableStages() {
  // 儲存被編輯過的階段配置 { stageId: { fromStep, toStep } }
  const [editedStages, setEditedStages] = useState<Record<string, { fromStep: number; toStep: number }>>(() =>
    loadEditedStagesFromStorage()
  );

  // 監聽其他 hook 實例的變更
  useEffect(() => {
    const handleChange = () => {
      setEditedStages(loadEditedStagesFromStorage());
    };
    window.addEventListener(EDITABLE_STAGES_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(EDITABLE_STAGES_CHANGE_EVENT, handleChange);
  }, []);

  // 通知其他訂閱者
  const notifyChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent(EDITABLE_STAGES_CHANGE_EVENT));
  }, []);

  // 取得里程碑選項
  const milestoneOptions = useMemo(() => getMilestoneOptions(), []);

  // 建立可編輯的階段列表（只取前 10 個步驟區間）
  const editableStages = useMemo((): EditableStage[] => {
    const stepPairs = COMPARISON_PAIRS.slice(0, 10);
    
    return stepPairs.map(pair => {
      const edited = editedStages[pair.id];
      
      return {
        id: pair.id,
        label: pair.label,
        fromStep: edited?.fromStep ?? pair.fromStep,
        toStep: edited?.toStep ?? pair.toStep,
        isSystem: true,
        isEdited: !!edited,
        originalFromStep: pair.fromStep,
        originalToStep: pair.toStep,
      };
    });
  }, [editedStages]);

  /**
   * 更新階段的起迄里程碑
   */
  const updateStage = useCallback((stageId: string, fromStep: number, toStep: number) => {
    const pair = COMPARISON_PAIRS.find(p => p.id === stageId);
    if (!pair) return;

    setEditedStages(prev => {
      // 如果恢復為原始值，則移除編輯記錄
      if (fromStep === pair.fromStep && toStep === pair.toStep) {
        const { [stageId]: _, ...rest } = prev;
        saveEditedStagesToStorage(rest);
        setTimeout(notifyChange, 0);
        return rest;
      }

      const newEdits = {
        ...prev,
        [stageId]: { fromStep, toStep },
      };
      saveEditedStagesToStorage(newEdits);
      setTimeout(notifyChange, 0);
      return newEdits;
    });
  }, [notifyChange]);

  /**
   * 重設單一階段為預設值
   */
  const resetStage = useCallback((stageId: string) => {
    setEditedStages(prev => {
      const { [stageId]: _, ...rest } = prev;
      saveEditedStagesToStorage(rest);
      setTimeout(notifyChange, 0);
      return rest;
    });
  }, [notifyChange]);

  /**
   * 重設所有階段為預設值
   */
  const resetAllStages = useCallback(() => {
    setEditedStages({});
    saveEditedStagesToStorage({});
    setTimeout(notifyChange, 0);
  }, [notifyChange]);

  /**
   * 檢查是否有任何編輯
   */
  const hasEdits = useMemo(() => Object.keys(editedStages).length > 0, [editedStages]);

  /**
   * 取得階段的有效配置（考慮編輯）
   */
  const getStageConfig = useCallback((stageId: string) => {
    const pair = COMPARISON_PAIRS.find(p => p.id === stageId);
    if (!pair) return null;
    
    const edited = editedStages[stageId];
    return {
      fromStep: edited?.fromStep ?? pair.fromStep,
      toStep: edited?.toStep ?? pair.toStep,
      isEdited: !!edited,
    };
  }, [editedStages]);

  /**
   * 根據編輯過的階段重新計算區間標籤
   */
  const getStageLabel = useCallback((stageId: string) => {
    const config = getStageConfig(stageId);
    if (!config) return '';
    
    const fromMilestone = milestoneOptions.find(m => m.step === config.fromStep);
    const toMilestone = milestoneOptions.find(m => m.step === config.toStep);
    
    if (!fromMilestone || !toMilestone) return '';
    
    return `${fromMilestone.shortLabel}→${toMilestone.shortLabel}`;
  }, [getStageConfig, milestoneOptions]);

  return {
    editableStages,
    milestoneOptions,
    updateStage,
    resetStage,
    resetAllStages,
    hasEdits,
    getStageConfig,
    getStageLabel,
    editedStages,
  };
}
