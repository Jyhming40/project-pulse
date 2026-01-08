/**
 * 文件類型代碼對應表
 * 
 * doc_type_code (英文代碼) → documents.doc_type (中文 enum 值)
 * 
 * 此 mapping 為唯一權威來源，避免詞彙散落在各處
 */

// doc_type_code → documents.doc_type enum 中文值
export const DOC_TYPE_CODE_TO_ENUM: Record<string, string> = {
  // 台電相關
  TPC_REVIEW: '台電審查意見書',
  TPC_DRAWING: '台電審訖圖',
  TPC_CONSULT: '台電細部協商文件',
  TPC_CONTRACT: '台電躉售合約',
  TPC_FORMAL_CONTRACT: '台電正式躉售',
  TPC_VISIT: '台電派員訪查併聯函',
  TPC_METER: '台電報竣掛表',
  TPC_DEADLINE: '最終掛表期限',
  
  // 能源署相關（統一使用「能源署」，不再使用「能源局」）
  MOEA_CONSENT: '能源署同意備案',
  MOEA_REGISTER: '能源署設備登記',
  MOEA_TRANSFER: '電廠轉移申請',
  
  // 技師簽證
  STRUCT_CERT: '結構技師簽證',
  ELECTRIC_CERT: '電機技師簽證',
  
  // 免雜執照（地方政府）
  LICENSE_CONSENT: '免雜執照同意備案',
  LICENSE_COMPLETE: '免雜執照完竣',
  
  // 附屬設施
  FACILITY_CONSENT: '附屬綠能設施同意函',
  
  // 其他
  OTHER: '其他',
};

// 反向 mapping：documents.doc_type enum 中文值 → doc_type_code
export const ENUM_TO_DOC_TYPE_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(DOC_TYPE_CODE_TO_ENUM).map(([code, enumVal]) => [enumVal, code])
);

/**
 * 將 doc_type_code 轉換為 documents.doc_type enum 值
 * 若無對應則返回 '其他'
 */
export function docTypeCodeToEnum(code: string): string {
  return DOC_TYPE_CODE_TO_ENUM[code] || '其他';
}

/**
 * 將 documents.doc_type enum 值轉換為 doc_type_code
 * 若無對應則返回 'OTHER'
 */
export function enumToDocTypeCode(enumVal: string): string {
  return ENUM_TO_DOC_TYPE_CODE[enumVal] || 'OTHER';
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
 * 根據 doc_type_code 推斷 agency 代碼
 */
export function inferAgencyCodeFromDocTypeCode(docTypeCode: string): string | null {
  if (docTypeCode.startsWith('TPC_')) return 'TPC';
  if (docTypeCode.startsWith('MOEA_')) return 'MOEA';
  if (docTypeCode.startsWith('STRUCT_')) return 'STR';
  if (docTypeCode.startsWith('ELECTRIC_')) return 'ELEC';
  if (docTypeCode.startsWith('LICENSE_')) return 'GOV';
  if (docTypeCode.startsWith('FACILITY_')) return 'GOV';
  return null;
}

/**
 * 檢查 doc_type_code 是否可以自動推斷 agency
 */
export function canAutoInferAgencyFromCode(docTypeCode: string): boolean {
  return inferAgencyCodeFromDocTypeCode(docTypeCode) !== null;
}
