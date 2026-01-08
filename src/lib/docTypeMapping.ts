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
 * ⚠️ 兼容性 normalize：將舊字串（能源局→能源署）或非標準寫法統一
 * 用於處理讀入資料時的舊值轉換
 */
export function normalizeDocTypeString(input: string): string {
  if (!input) return input;
  
  // 能源局 → 能源署
  let normalized = input.replace(/能源局/g, '能源署');
  
  // 常見非標準寫法 → 標準 enum 值
  const LEGACY_MAPPING: Record<string, DocTypeEnum> = {
    // 舊的長描述 → 標準短 enum
    '台電躉售合約': '躉售合約',
    '台電正式躉售': '躉售合約',
    '台電報竣掛表': '報竣掛表',
    '結構技師簽證': '結構簽證',
    '能源署設備登記': '設備登記',
    '能源局設備登記': '設備登記',
    // 其他可能的舊值
    '台電審訖圖': '其他',
    '台電派員訪查併聯函': '其他',
    '最終掛表期限': '其他',
    '電機技師簽證': '其他',
    '免雜執照同意備案': '其他',
    '免雜執照完竣': '其他',
    '附屬綠能設施同意函': '其他',
  };
  
  if (LEGACY_MAPPING[normalized]) {
    return LEGACY_MAPPING[normalized];
  }
  
  return normalized;
}

/**
 * 驗證並正規化 doc_type enum 值
 * 若輸入為合法 enum 值則返回，否則嘗試 normalize 後再驗證
 */
export function ensureValidDocTypeEnum(input: string): DocTypeEnum {
  // 先檢查是否為合法值
  if (isValidDocTypeEnum(input)) {
    return input;
  }
  
  // 嘗試 normalize
  const normalized = normalizeDocTypeString(input);
  if (isValidDocTypeEnum(normalized)) {
    return normalized;
  }
  
  // 無法識別，返回「其他」
  return '其他';
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
