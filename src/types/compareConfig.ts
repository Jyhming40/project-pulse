/**
 * 自定義比較階段 (User-Defined Comparison Stages)
 * 將原本寫死在程式碼中的「比較邏輯」轉化為「資料驅動 (Data-Driven)」的動態配置
 */

/**
 * 階段定義 - 定義兩個里程碑之間的時間區間
 */
export interface StageDefinition {
  id: string;           // 唯一識別碼 (e.g., "custom_1737456789")
  label: string;        // 顯示名稱 (e.g., "案件成立時效")
  fromStep: number;     // 起始里程碑步驟 (1-11)
  toStep: number;       // 結束里程碑步驟 (1-11)
  isSystem: boolean;    // 是否為系統預設（不可刪除）
  description?: string; // 詳細描述
  sortOrder: number;    // 排序順序
}

/**
 * 比較配置 - 包含所有自定義階段
 */
export interface CompareConfig {
  stages: StageDefinition[];
  version: number;
  updatedAt: string;
}

/**
 * 比較範本 - 可儲存/載入的分析配置
 */
export interface CompareTemplate {
  id: string;
  name: string;
  description?: string;
  config: CompareConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 里程碑選項 (用於下拉選單)
 */
export interface MilestoneOption {
  step: number;
  label: string;
  shortLabel: string;
  color: string;
}

// LocalStorage keys
export const CUSTOM_STAGES_KEY = 'customStages:v1';
export const COMPARE_TEMPLATES_KEY = 'compareTemplates:v1';
export const ACTIVE_TEMPLATE_KEY = 'activeCompareTemplate:v1';
