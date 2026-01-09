/**
 * 文件類型代碼對應表
 * 
 * doc_type_code (英文代碼) → documents.doc_type (中文短值)
 * 
 * 此 mapping 為唯一權威來源，避免詞彙散落在各處
 * 
 * ⚠️ IMPORTANT: documents.doc_type 短值集合只有 8 種（不帶機關前綴）：
 *   台電審查意見書、同意備案、結構簽證、躉售合約、報竣掛表、設備登記、土地契約、其他
 *   所有 mapping 必須嚴格輸出這 8 種之一，無對應一律輸出「其他」
 */

// documents.doc_type 短值集合（Phase 1 唯一權威來源）
// ⚠️ 採「短值策略」：不帶機關前綴，機關資訊由 agency_code 表達
export const DOC_TYPE_SHORT_VALUES = [
  '台電審查意見書',
  '同意備案',      // 不帶「能源署」前綴
  '結構簽證',       // 不帶「技師」
  '躉售合約',       // 不帶「台電」
  '報竣掛表',       // 不帶「台電」
  '設備登記',       // 不帶「能源署」
  '線補費通知單',   // 替換原「土地契約」
  '其他',
] as const;

export type DocTypeShort = typeof DOC_TYPE_SHORT_VALUES[number];

// 為了向後兼容，保留 alias
export const DOC_TYPE_ENUM_VALUES = DOC_TYPE_SHORT_VALUES;
export type DocTypeEnum = DocTypeShort;

// Phase 1 doc_type_code → documents.doc_type 短值
// ⚠️ value 必須嚴格等於 DOC_TYPE_SHORT_VALUES 之一
export const DOC_TYPE_CODE_TO_SHORT: Record<string, DocTypeShort> = {
  // 台電相關
  TPC_REVIEW: '台電審查意見書',
  TPC_CONTRACT: '躉售合約',
  TPC_METER: '報竣掛表',
  
  // 能源署相關（短值不帶機關前綴）
  MOEA_CONSENT: '同意備案',
  MOEA_REGISTER: '設備登記',
  
  // 技師簽證（短值不帶「技師」）
  STRUCT_CERT: '結構簽證',
  
  // 線補費
  LINE_COMP_NOTICE: '線補費通知單',
  
  // 其他
  OTHER: '其他',
};

// 向後兼容 alias
export const DOC_TYPE_CODE_TO_ENUM = DOC_TYPE_CODE_TO_SHORT;

// 反向 mapping：documents.doc_type 短值 → doc_type_code
export const SHORT_TO_DOC_TYPE_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(DOC_TYPE_CODE_TO_SHORT).map(([code, shortVal]) => [shortVal, code])
);

// 向後兼容 alias
export const ENUM_TO_DOC_TYPE_CODE = SHORT_TO_DOC_TYPE_CODE;

/**
 * ⚠️ 兼容性 normalize：將舊長值字串轉為標準短值
 * 
 * 【策略】documents.doc_type 採「短值」策略：
 *   - 只存 8 種短值（不帶機關前綴）
 *   - 機關資訊由 agency_code / doc_type_code 表達
 *   - 顯示名稱可在 UI 層組合
 * 
 * 用於：
 *   1. 讀入舊資料時轉換顯示
 *   2. 匯入時正規化
 */
export function normalizeDocTypeString(input: string): DocTypeShort {
  if (!input) return '其他';
  
  // 先處理「能源局」→「能源署」（歷史遺留）
  let normalized = input.replace(/能源局/g, '能源署');
  
  // 若已經是合法短值，直接返回
  if (isValidDocTypeShort(normalized)) {
    return normalized;
  }
  
  // 舊長值 → 標準短值（按優先順序匹配）
  const LEGACY_TO_SHORT: Record<string, DocTypeShort> = {
    // 台電相關 → 短值
    '台電審查意見書': '台電審查意見書',
    '台電躉售合約': '躉售合約',
    '台電正式躉售': '躉售合約',
    '台電報竣掛表': '報竣掛表',
    '台電審訖圖': '其他',
    '台電派員訪查併聯函': '其他',
    '最終掛表期限': '其他',
    
    // 能源署相關 → 短值（去掉機關前綴）
    '能源署同意備案': '同意備案',
    '能源署設備登記': '設備登記',
    
    // 技師簽證 → 短值
    '結構技師簽證': '結構簽證',
    '電機技師簽證': '其他',
    
    // 其他舊值 → 其他
    '免雜執照同意備案': '其他',
    '免雜執照完竣': '其他',
    '附屬綠能設施同意函': '其他',
    '電廠轉移申請': '其他',
  };
  
  // 完全匹配
  if (LEGACY_TO_SHORT[normalized]) {
    return LEGACY_TO_SHORT[normalized];
  }
  
  // 模糊匹配（包含關鍵字）
  if (normalized.includes('躉售')) return '躉售合約';
  if (normalized.includes('報竣') || normalized.includes('掛表') || normalized.includes('掛錶')) return '報竣掛表';
  if (normalized.includes('同意備案')) return '同意備案';
  if (normalized.includes('設備登記')) return '設備登記';
  if (normalized.includes('結構') && normalized.includes('簽證')) return '結構簽證';
  if (normalized.includes('線補費')) return '線補費通知單';
  if (normalized.includes('審查意見')) return '台電審查意見書';
  
  // 無法識別，返回「其他」
  return '其他';
}

/**
 * 驗證是否為合法的 doc_type 短值
 */
export function isValidDocTypeShort(value: string): value is DocTypeShort {
  return DOC_TYPE_SHORT_VALUES.includes(value as DocTypeShort);
}

// 向後兼容 alias
export const isValidDocTypeEnum = isValidDocTypeShort;

/**
 * 驗證並正規化 doc_type 值
 * 若輸入為合法短值則返回，否則 normalize 轉換
 * 
 * ⚠️ 此函數保證輸出一定是合法的 DocTypeShort
 */
export function ensureValidDocTypeEnum(input: string): DocTypeShort {
  if (isValidDocTypeShort(input)) {
    return input;
  }
  return normalizeDocTypeString(input);
}

/**
 * 將 doc_type_code 轉換為 documents.doc_type 短值
 * ⚠️ 若無對應則返回 '其他'（確保永遠輸出合法短值）
 */
export function docTypeCodeToEnum(code: string): DocTypeShort {
  return DOC_TYPE_CODE_TO_SHORT[code] || '其他';
}

// 向後兼容 alias
export const docTypeCodeToShort = docTypeCodeToEnum;

/**
 * 將 documents.doc_type 短值轉換為 doc_type_code
 * 若無對應則返回 'OTHER'
 */
export function enumToDocTypeCode(shortVal: string): string {
  const normalized = normalizeDocTypeString(shortVal);
  return SHORT_TO_DOC_TYPE_CODE[normalized] || 'OTHER';
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
  if (docTypeCode.startsWith('LINE_')) return 'TPC'; // 線補費屬於台電
  return null;
}

/**
 * 檢查 doc_type_code 是否可以自動推斷 agency
 */
export function canAutoInferAgencyFromCode(docTypeCode: string): boolean {
  return inferAgencyCodeFromDocTypeCode(docTypeCode) !== null;
}
