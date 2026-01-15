/**
 * 文件類型代碼對應表
 * 
 * 依發證機關分組，支援分組下拉選單與搜尋
 */

// ============================================
// 發證機關定義
// ============================================
export const AGENCY_CODES = ['TPC', 'MOEA', 'LOCAL_GOV', 'BUILDING', 'ENGINEER', 'LAND', 'CONSTRUCTION', 'FIRE', 'INSURANCE', 'OTHER'] as const;
export type AgencyCode = typeof AGENCY_CODES[number];

export const AGENCY_CODE_TO_LABEL: Record<AgencyCode, string> = {
  TPC: '台電',
  MOEA: '能源署',
  LOCAL_GOV: '縣市政府',
  BUILDING: '建管單位',
  ENGINEER: '技師',
  LAND: '土地相關',
  CONSTRUCTION: '施工相關',
  FIRE: '消防單位',
  INSURANCE: '保險/金融',
  OTHER: '其他',
};

// ============================================
// 文件類型定義（按機關分組）
// ============================================
export interface DocTypeDefinition {
  code: string;
  label: string;
  agencyCode: AgencyCode;
}

// 所有文件類型定義
export const DOC_TYPE_DEFINITIONS: DocTypeDefinition[] = [
  // 台電
  { code: 'TPC_REVIEW', label: '審查意見書', agencyCode: 'TPC' },
  { code: 'TPC_NEGOTIATION', label: '細部協商', agencyCode: 'TPC' },
  { code: 'TPC_APPROVED_DRAWING', label: '審訖圖', agencyCode: 'TPC' },
  { code: 'TPC_INSPECTION', label: '派員訪查併聯函', agencyCode: 'TPC' },
  { code: 'TPC_METER_LEASE', label: '電表租約', agencyCode: 'TPC' },
  { code: 'TPC_LINE_COMP', label: '線補費通知單/收據', agencyCode: 'TPC' },
  { code: 'TPC_FEEDER_SHORTAGE', label: '饋線不足通知單', agencyCode: 'TPC' },
  { code: 'TPC_CONTRACT', label: '躉售合約', agencyCode: 'TPC' },
  { code: 'TPC_FORMAL_FIT', label: '正式躉售', agencyCode: 'TPC' },
  { code: 'TPC_POWER_BILL', label: '躉購電費單', agencyCode: 'TPC' },
  { code: 'TPC_AMENDMENT', label: '換文修約', agencyCode: 'TPC' },
  { code: 'TPC_METER', label: '報竣掛表', agencyCode: 'TPC' },
  { code: 'TPC_OTHER', label: '台電其他文件', agencyCode: 'TPC' },

  // 能源署
  { code: 'MOEA_CONSENT', label: '同意備案', agencyCode: 'MOEA' },
  { code: 'MOEA_REGISTER', label: '設備登記', agencyCode: 'MOEA' },
  { code: 'MOEA_OTHER', label: '能源署其他文件', agencyCode: 'MOEA' },

  // 縣市政府
  { code: 'GOV_GREEN_PERMIT', label: '綠能容許', agencyCode: 'LOCAL_GOV' },
  { code: 'GOV_ZONING', label: '使用分區', agencyCode: 'LOCAL_GOV' },
  { code: 'GOV_OTHER', label: '縣市政府其他文件', agencyCode: 'LOCAL_GOV' },

  // 建管單位
  { code: 'BUILD_EXEMPT_APP', label: '免雜項申請', agencyCode: 'BUILDING' },
  { code: 'BUILD_EXEMPT_COMP', label: '免雜項竣工', agencyCode: 'BUILDING' },
  { code: 'BUILD_OTHER', label: '建管其他文件', agencyCode: 'BUILDING' },

  // 技師
  { code: 'ENG_ELECTRICAL', label: '電機技師簽證', agencyCode: 'ENGINEER' },
  { code: 'ENG_STRUCTURAL', label: '結構技師簽證', agencyCode: 'ENGINEER' },
  { code: 'ENG_OTHER', label: '技師其他文件', agencyCode: 'ENGINEER' },

  // 土地相關
  { code: 'LAND_CONSENT', label: '土地使用同意書', agencyCode: 'LAND' },
  { code: 'LAND_TRANSCRIPT', label: '地籍謄本', agencyCode: 'LAND' },
  { code: 'LAND_LEASE', label: '租賃契約', agencyCode: 'LAND' },
  { code: 'LAND_OWNER_ID', label: '地主身分證影本', agencyCode: 'LAND' },
  { code: 'LAND_OTHER', label: '土地其他文件', agencyCode: 'LAND' },

  // 施工相關
  { code: 'CONST_START', label: '開工報告', agencyCode: 'CONSTRUCTION' },
  { code: 'CONST_COMPLETE', label: '竣工報告', agencyCode: 'CONSTRUCTION' },
  { code: 'CONST_PERMIT', label: '施工許可', agencyCode: 'CONSTRUCTION' },
  { code: 'CONST_OTHER', label: '施工其他文件', agencyCode: 'CONSTRUCTION' },

  // 消防單位
  { code: 'FIRE_REVIEW', label: '消防審查', agencyCode: 'FIRE' },
  { code: 'FIRE_INSPECTION', label: '消防設備檢查', agencyCode: 'FIRE' },
  { code: 'FIRE_OTHER', label: '消防其他文件', agencyCode: 'FIRE' },

  // 保險/金融
  { code: 'INS_EQUIPMENT', label: '設備保險單', agencyCode: 'INSURANCE' },
  { code: 'INS_FINANCING', label: '銀行融資文件', agencyCode: 'INSURANCE' },
  { code: 'INS_OTHER', label: '保險/金融其他', agencyCode: 'INSURANCE' },

  // 其他
  { code: 'OTHER_COMPANY', label: '公司登記文件', agencyCode: 'OTHER' },
  { code: 'OTHER_AGREEMENT', label: '合作協議書', agencyCode: 'OTHER' },
  { code: 'OTHER_MISC', label: '其他文件', agencyCode: 'OTHER' },
];

// ============================================
// 輔助函數
// ============================================

/**
 * 取得按機關分組的文件類型
 */
export function getDocTypesByAgency(): Record<AgencyCode, DocTypeDefinition[]> {
  const grouped: Record<AgencyCode, DocTypeDefinition[]> = {
    TPC: [],
    MOEA: [],
    LOCAL_GOV: [],
    BUILDING: [],
    ENGINEER: [],
    LAND: [],
    CONSTRUCTION: [],
    FIRE: [],
    INSURANCE: [],
    OTHER: [],
  };

  DOC_TYPE_DEFINITIONS.forEach(def => {
    grouped[def.agencyCode].push(def);
  });

  return grouped;
}

/**
 * 根據 code 取得文件類型定義
 */
export function getDocTypeByCode(code: string): DocTypeDefinition | undefined {
  return DOC_TYPE_DEFINITIONS.find(def => def.code === code);
}

/**
 * 根據 code 取得文件類型標籤
 */
export function getDocTypeLabelByCode(code: string): string {
  const def = getDocTypeByCode(code);
  return def?.label || code;
}

/**
 * 根據 code 取得機關代碼
 */
export function getAgencyCodeByDocTypeCode(code: string): AgencyCode | null {
  const def = getDocTypeByCode(code);
  return def?.agencyCode || null;
}

/**
 * 根據 code 取得機關標籤
 */
export function getAgencyLabelByDocTypeCode(code: string): string {
  const agencyCode = getAgencyCodeByDocTypeCode(code);
  return agencyCode ? AGENCY_CODE_TO_LABEL[agencyCode] : '';
}

/**
 * 搜尋文件類型（支援標籤和機關名稱）
 */
export function searchDocTypes(query: string): DocTypeDefinition[] {
  if (!query.trim()) return DOC_TYPE_DEFINITIONS;
  
  const lowerQuery = query.toLowerCase();
  return DOC_TYPE_DEFINITIONS.filter(def => {
    const agencyLabel = AGENCY_CODE_TO_LABEL[def.agencyCode];
    return (
      def.label.toLowerCase().includes(lowerQuery) ||
      def.code.toLowerCase().includes(lowerQuery) ||
      agencyLabel.toLowerCase().includes(lowerQuery)
    );
  });
}

// ============================================
// 向後兼容：舊值轉換
// ============================================

// documents.doc_type 舊值 → 新 code 的 mapping
const LEGACY_TO_CODE: Record<string, string> = {
  '台電審查意見書': 'TPC_REVIEW',
  '躉售合約': 'TPC_CONTRACT',
  '報竣掛表': 'TPC_METER',
  '同意備案': 'MOEA_CONSENT',
  '設備登記': 'MOEA_REGISTER',
  '結構簽證': 'ENG_STRUCTURAL',
  '線補費通知單': 'TPC_LINE_COMP',
  '台電相關': 'TPC_OTHER',
  '能源署相關': 'MOEA_OTHER',
  '其他相關文件': 'OTHER_MISC',
  '建管處相關': 'BUILD_OTHER',
  '綠能設施': 'GOV_GREEN_PERMIT',
  '其他': 'OTHER_MISC',
  // 更多舊值...
  '能源署同意備案': 'MOEA_CONSENT',
  '能源署設備登記': 'MOEA_REGISTER',
  '台電躉售合約': 'TPC_CONTRACT',
  '台電報竣掛表': 'TPC_METER',
  '結構技師簽證': 'ENG_STRUCTURAL',
  '電機技師簽證': 'ENG_ELECTRICAL',
};

/**
 * 將舊的 doc_type 值正規化為新的 code
 */
export function normalizeToDocTypeCode(input: string): string {
  if (!input) return 'OTHER_MISC';
  
  // 如果已經是合法 code，直接返回
  if (DOC_TYPE_DEFINITIONS.some(def => def.code === input)) {
    return input;
  }
  
  // 嘗試從舊值 mapping
  if (LEGACY_TO_CODE[input]) {
    return LEGACY_TO_CODE[input];
  }
  
  // 模糊匹配
  if (input.includes('躉售')) return 'TPC_CONTRACT';
  if (input.includes('報竣') || input.includes('掛表') || input.includes('掛錶')) return 'TPC_METER';
  if (input.includes('同意備案')) return 'MOEA_CONSENT';
  if (input.includes('設備登記')) return 'MOEA_REGISTER';
  if (input.includes('結構') && input.includes('簽證')) return 'ENG_STRUCTURAL';
  if (input.includes('電機') && input.includes('簽證')) return 'ENG_ELECTRICAL';
  if (input.includes('線補費')) return 'TPC_LINE_COMP';
  if (input.includes('審查意見')) return 'TPC_REVIEW';
  
  return 'OTHER_MISC';
}

/**
 * 驗證是否為合法的文件類型 code
 */
export function isValidDocTypeCode(code: string): boolean {
  return DOC_TYPE_DEFINITIONS.some(def => def.code === code);
}

// ============================================
// 向後兼容 exports（逐步棄用）
// ============================================
export const DOC_TYPE_SHORT_VALUES = DOC_TYPE_DEFINITIONS.map(d => d.label);
export type DocTypeShort = string;
export const DOC_TYPE_ENUM_VALUES = DOC_TYPE_SHORT_VALUES;
export type DocTypeEnum = DocTypeShort;

export function normalizeDocTypeString(input: string): string {
  const code = normalizeToDocTypeCode(input);
  return getDocTypeLabelByCode(code);
}

export function isValidDocTypeShort(value: string): boolean {
  return DOC_TYPE_DEFINITIONS.some(def => def.label === value);
}

export const isValidDocTypeEnum = isValidDocTypeShort;

export function ensureValidDocTypeEnum(input: string): string {
  return normalizeDocTypeString(input);
}

export function docTypeCodeToEnum(code: string): string {
  return getDocTypeLabelByCode(code);
}

export const docTypeCodeToShort = docTypeCodeToEnum;

export function enumToDocTypeCode(label: string): string {
  const def = DOC_TYPE_DEFINITIONS.find(d => d.label === label);
  return def?.code || 'OTHER_MISC';
}

export function inferAgencyCodeFromDocTypeCode(docTypeCode: string): AgencyCode | null {
  return getAgencyCodeByDocTypeCode(docTypeCode);
}

export function canAutoInferAgencyFromCode(docTypeCode: string): boolean {
  return getAgencyCodeByDocTypeCode(docTypeCode) !== null;
}

// 反向 mapping
export const LABEL_TO_AGENCY_CODE: Record<string, AgencyCode> = Object.fromEntries(
  Object.entries(AGENCY_CODE_TO_LABEL).map(([code, label]) => [label, code as AgencyCode])
);

// ============================================
// 向後兼容 exports（維持舊 API）
// ============================================

// DOC_TYPE_CODE_TO_SHORT: code → label mapping (for backwards compat)
export const DOC_TYPE_CODE_TO_SHORT: Record<string, string> = Object.fromEntries(
  DOC_TYPE_DEFINITIONS.map(def => [def.code, def.label])
);

// SHORT_TO_DOC_TYPE_CODE: label → code mapping (for backwards compat)
export const SHORT_TO_DOC_TYPE_CODE: Record<string, string> = Object.fromEntries(
  DOC_TYPE_DEFINITIONS.map(def => [def.label, def.code])
);
