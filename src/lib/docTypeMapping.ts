/**
 * 文件類型代碼對應表
 * 
 * doc_type_code (英文代碼) → documents.doc_type (中文 enum 值)
 * 
 * 此 mapping 為唯一權威來源，避免詞彙散落在各處
 * 
 * ⚠️ IMPORTANT: documents.doc_type enum 合法值只有 8 種：
 *   台電審查意見書、能源署同意備案、結構簽證、躉售合約、報竣掛表、設備登記、土地契約、其他
 *   所有 mapping 必須嚴格輸出這 8 種之一，無對應一律輸出「其他」
 */

// documents.doc_type enum 合法值（Phase 1 唯一權威來源）
// ⚠️ 已統一使用「能源署」，不再使用「能源局」
export const DOC_TYPE_ENUM_VALUES = [
  '台電審查意見書',
  '能源署同意備案',
  '結構簽證',
  '躉售合約',
  '報竣掛表',
  '設備登記',
  '土地契約',
  '其他',
] as const;

export type DocTypeEnum = typeof DOC_TYPE_ENUM_VALUES[number];

// Phase 1 doc_type_code → documents.doc_type enum 中文值
// ⚠️ value 必須嚴格等於 DOC_TYPE_ENUM_VALUES 之一
export const DOC_TYPE_CODE_TO_ENUM: Record<string, DocTypeEnum> = {
  // 台電相關
  TPC_REVIEW: '台電審查意見書',
  TPC_CONTRACT: '躉售合約',
  TPC_METER: '報竣掛表',
  
  // 能源署相關（已統一使用「能源署」）
  MOEA_CONSENT: '能源署同意備案',
  MOEA_REGISTER: '設備登記',
  
  // 技師簽證
  STRUCT_CERT: '結構簽證',
  
  // 土地
  LAND_CONTRACT: '土地契約',
  
  // 其他
  OTHER: '其他',
};

// 反向 mapping：documents.doc_type enum 中文值 → doc_type_code
export const ENUM_TO_DOC_TYPE_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(DOC_TYPE_CODE_TO_ENUM).map(([code, enumVal]) => [enumVal, code])
);

/**
 * ⚠️ 兼容性 normalize：將舊長值字串轉為標準短 enum 值
 * 
 * 【策略】documents.doc_type 採「短值」策略：
 *   - enum 只存 8 種短值（不帶機關前綴）
 *   - 機關資訊由 agency_code / doc_type_code 表達
 *   - 顯示名稱可在 UI 層組合
 * 
 * 用於：
 *   1. 讀入舊資料時轉換顯示
 *   2. 匯入時正規化
 */
export function normalizeDocTypeString(input: string): DocTypeEnum {
  if (!input) return '其他';
  
  // 先處理「能源局」→「能源署」
  let normalized = input.replace(/能源局/g, '能源署');
  
  // 若已經是合法短值，直接返回
  if (isValidDocTypeEnum(normalized)) {
    return normalized;
  }
  
  // 舊長值 → 標準短 enum（按優先順序匹配）
  const LEGACY_TO_SHORT: Record<string, DocTypeEnum> = {
    // 台電相關 → 短值
    '台電審查意見書': '台電審查意見書',  // 保持（已是 enum）
    '台電躉售合約': '躉售合約',
    '台電正式躉售': '躉售合約',
    '台電報竣掛表': '報竣掛表',
    '台電審訖圖': '其他',
    '台電派員訪查併聯函': '其他',
    '最終掛表期限': '其他',
    
    // 能源署相關 → 短值
    '能源署同意備案': '能源署同意備案',  // 保持（已是 enum）
    '能源署設備登記': '設備登記',
    
    // 技師簽證 → 短值
    '結構技師簽證': '結構簽證',
    '電機技師簽證': '其他',
    
    // 其他舊值 → 其他
    '免雜執照同意備案': '其他',
    '免雜執照完竣': '其他',
    '附屬綠能設施同意函': '其他',
  };
  
  // 完全匹配
  if (LEGACY_TO_SHORT[normalized]) {
    return LEGACY_TO_SHORT[normalized];
  }
  
  // 模糊匹配（包含關鍵字）
  if (normalized.includes('躉售')) return '躉售合約';
  if (normalized.includes('報竣') || normalized.includes('掛表') || normalized.includes('掛錶')) return '報竣掛表';
  if (normalized.includes('同意備案')) return '能源署同意備案';
  if (normalized.includes('設備登記')) return '設備登記';
  if (normalized.includes('結構') && normalized.includes('簽證')) return '結構簽證';
  if (normalized.includes('土地') && normalized.includes('契約')) return '土地契約';
  if (normalized.includes('審查意見')) return '台電審查意見書';
  
  // 無法識別，返回「其他」
  return '其他';
}

/**
 * 驗證並正規化 doc_type enum 值
 * 若輸入為合法 enum 值則返回，否則 normalize 轉換
 * 
 * ⚠️ 此函數保證輸出一定是合法的 DocTypeEnum
 */
export function ensureValidDocTypeEnum(input: string): DocTypeEnum {
  // 先檢查是否為合法值
  if (isValidDocTypeEnum(input)) {
    return input;
  }
  
  // normalize 已保證返回 DocTypeEnum
  return normalizeDocTypeString(input);
}

/**
 * 將 doc_type_code 轉換為 documents.doc_type enum 值
 * ⚠️ 若無對應則返回 '其他'（確保永遠輸出合法 enum 值）
 */
export function docTypeCodeToEnum(code: string): DocTypeEnum {
  return DOC_TYPE_CODE_TO_ENUM[code] || '其他';
}

/**
 * 將 documents.doc_type enum 值轉換為 doc_type_code
 * 若無對應則返回 'OTHER'
 */
export function enumToDocTypeCode(enumVal: string): string {
  // 先 normalize 輸入
  const normalized = normalizeDocTypeString(enumVal);
  return ENUM_TO_DOC_TYPE_CODE[normalized] || 'OTHER';
}

/**
 * 驗證是否為合法的 doc_type enum 值
 */
export function isValidDocTypeEnum(value: string): value is DocTypeEnum {
  return DOC_TYPE_ENUM_VALUES.includes(value as DocTypeEnum);
}

// agency 代碼對應中文顯示名
export const AGENCY_CODE_TO_LABEL: Record<string, string> = {
  TPC: '台灣電力公司',
  MOEA: '經濟部能源署',
  GOV: '地方政府',
  CONST: '建管單位',
  FIRE: '消防單位',
  STR: '結構技師',
  ELEC: '電機技師',
  ENV: '環保單位',
  OTHER: '其他',
};

// 反向 mapping
export const LABEL_TO_AGENCY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(AGENCY_CODE_TO_LABEL).map(([code, label]) => [label, code])
);

/**
 * 根據 doc_type_code 推斷 agency 代碼（Phase 1 最小集合）
 */
export function inferAgencyCodeFromDocTypeCode(docTypeCode: string): string | null {
  if (docTypeCode.startsWith('TPC_')) return 'TPC';
  if (docTypeCode.startsWith('MOEA_')) return 'MOEA';
  if (docTypeCode.startsWith('STRUCT_')) return 'STR';
  if (docTypeCode.startsWith('LAND_')) return 'OTHER'; // 土地契約無固定機關
  return null;
}

/**
 * 檢查 doc_type_code 是否可以自動推斷 agency
 */
export function canAutoInferAgencyFromCode(docTypeCode: string): boolean {
  return inferAgencyCodeFromDocTypeCode(docTypeCode) !== null;
}
