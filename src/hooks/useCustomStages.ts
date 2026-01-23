import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  StageDefinition, 
  CompareTemplate,
  CUSTOM_STAGES_KEY, 
  COMPARE_TEMPLATES_KEY,
  ACTIVE_TEMPLATE_KEY 
} from '@/types/compareConfig';
import { COMPARISON_PAIRS, TIMELINE_DOC_MAPPING } from './useProjectComparison';
import { toast } from 'sonner';

/**
 * 將系統預設的 COMPARISON_PAIRS 轉換為 StageDefinition 格式
 */
export function getSystemStages(): StageDefinition[] {
  return COMPARISON_PAIRS.map((pair, index) => ({
    id: pair.id,
    label: pair.label,
    fromStep: pair.fromStep,
    toStep: pair.toStep,
    isSystem: true,
    description: pair.description,
    sortOrder: index,
  }));
}

/**
 * 取得里程碑選項 (用於下拉選單)
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
 * 從 localStorage 讀取自定義階段
 */
function loadCustomStagesFromStorage(): StageDefinition[] {
  try {
    const stored = localStorage.getItem(CUSTOM_STAGES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load custom stages from localStorage:', e);
  }
  return [];
}

/**
 * 儲存自定義階段到 localStorage
 */
function saveCustomStagesToStorage(stages: StageDefinition[]) {
  try {
    localStorage.setItem(CUSTOM_STAGES_KEY, JSON.stringify(stages));
  } catch (e) {
    console.warn('Failed to save custom stages to localStorage:', e);
  }
}

/**
 * 從 localStorage 讀取範本
 */
function loadTemplatesFromStorage(): CompareTemplate[] {
  try {
    const stored = localStorage.getItem(COMPARE_TEMPLATES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load templates from localStorage:', e);
  }
  return [];
}

/**
 * 儲存範本到 localStorage
 */
function saveTemplatesToStorage(templates: CompareTemplate[]) {
  try {
    localStorage.setItem(COMPARE_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('Failed to save templates to localStorage:', e);
  }
}

/**
 * 取得目前啟用的範本 ID
 */
function getActiveTemplateId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TEMPLATE_KEY);
  } catch {
    return null;
  }
}

/**
 * 設定目前啟用的範本 ID
 */
function setActiveTemplateId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_TEMPLATE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_TEMPLATE_KEY);
    }
  } catch (e) {
    console.warn('Failed to save active template ID:', e);
  }
}

/**
 * 自定義比較階段 Hook
 * 支援 localStorage + Supabase 並行儲存
 */
export function useCustomStages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Local state for stages
  const [customStages, setCustomStagesState] = useState<StageDefinition[]>(() => 
    loadCustomStagesFromStorage()
  );
  
  // Local state for templates
  const [templates, setTemplatesState] = useState<CompareTemplate[]>(() =>
    loadTemplatesFromStorage()
  );
  
  // Active template
  const [activeTemplateId, setActiveTemplateIdState] = useState<string | null>(() =>
    getActiveTemplateId()
  );

  // System stages (always available)
  const systemStages = useMemo(() => getSystemStages(), []);
  
  // Milestone options for dropdowns
  const milestoneOptions = useMemo(() => getMilestoneOptions(), []);

  // Combined stages: system + custom, sorted by sortOrder
  const allStages = useMemo(() => {
    const combined = [...systemStages, ...customStages];
    return combined.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [systemStages, customStages]);

  // Only custom stages (for CRUD)
  const userStages = useMemo(() => {
    return customStages.filter(s => !s.isSystem);
  }, [customStages]);

  // Sync to localStorage when stages change
  useEffect(() => {
    saveCustomStagesToStorage(customStages);
  }, [customStages]);

  // Sync templates to localStorage
  useEffect(() => {
    saveTemplatesToStorage(templates);
  }, [templates]);

  // Sync active template ID to localStorage
  useEffect(() => {
    setActiveTemplateId(activeTemplateId);
  }, [activeTemplateId]);

  // ===== CRUD Operations =====

  /**
   * 新增自定義階段
   */
  const addStage = useCallback((stage: Omit<StageDefinition, 'id' | 'isSystem' | 'sortOrder'>) => {
    const newStage: StageDefinition = {
      ...stage,
      id: `custom_${Date.now()}`,
      isSystem: false,
      sortOrder: allStages.length,
    };
    setCustomStagesState(prev => [...prev, newStage]);
    toast.success('已新增自定義階段');
    return newStage;
  }, [allStages.length]);

  /**
   * 更新階段
   */
  const updateStage = useCallback((id: string, updates: Partial<StageDefinition>) => {
    setCustomStagesState(prev => 
      prev.map(s => s.id === id ? { ...s, ...updates } : s)
    );
    toast.success('已更新階段設定');
  }, []);

  /**
   * 刪除自定義階段 (系統階段不可刪除)
   */
  const deleteStage = useCallback((id: string) => {
    setCustomStagesState(prev => prev.filter(s => s.id !== id));
    toast.success('已刪除自定義階段');
  }, []);

  /**
   * 重新排序階段
   */
  const reorderStages = useCallback((stageIds: string[]) => {
    setCustomStagesState(prev => {
      return prev.map(stage => {
        const newOrder = stageIds.indexOf(stage.id);
        if (newOrder !== -1) {
          return { ...stage, sortOrder: newOrder + systemStages.length };
        }
        return stage;
      });
    });
  }, [systemStages.length]);

  // ===== Template Operations =====

  /**
   * 儲存為範本
   */
  const saveAsTemplate = useCallback((name: string, description?: string) => {
    const template: CompareTemplate = {
      id: `template_${Date.now()}`,
      name,
      description,
      config: {
        stages: customStages,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplatesState(prev => [...prev, template]);
    toast.success(`已儲存範本「${name}」`);
    return template;
  }, [customStages]);

  /**
   * 載入範本
   */
  const loadTemplate = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setCustomStagesState(template.config.stages);
      setActiveTemplateIdState(templateId);
      toast.success(`已載入範本「${template.name}」`);
    }
  }, [templates]);

  /**
   * 刪除範本
   */
  const deleteTemplate = useCallback((templateId: string) => {
    setTemplatesState(prev => prev.filter(t => t.id !== templateId));
    if (activeTemplateId === templateId) {
      setActiveTemplateIdState(null);
    }
    toast.success('已刪除範本');
  }, [activeTemplateId]);

  /**
   * 重設為系統預設
   */
  const resetToDefault = useCallback(() => {
    setCustomStagesState([]);
    setActiveTemplateIdState(null);
    toast.success('已重設為系統預設');
  }, []);

  // ===== Supabase Sync (Future) =====
  // TODO: 實作雲端同步
  // const syncToCloud = async () => { ... }
  // const syncFromCloud = async () => { ... }

  return {
    // Stages
    allStages,
    userStages,
    systemStages,
    milestoneOptions,
    
    // CRUD
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    
    // Templates
    templates,
    activeTemplateId,
    saveAsTemplate,
    loadTemplate,
    deleteTemplate,
    resetToDefault,
  };
}
