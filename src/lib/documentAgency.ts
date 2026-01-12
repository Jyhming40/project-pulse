/**
 * 文件類型對應機關自動推斷邏輯
 * 
 * 根據 doc_type 自動推斷對應的發證機關
 * 若無法推斷則需要使用者手動選擇
 */

// 文件類型對應機關映射
const DOC_TYPE_AGENCY_MAP: Record<string, string> = {
  // 台電相關
  '台電審查意見書': '台灣電力公司',
  '台電躉售合約': '台灣電力公司',
  '台電報竣掛表': '台灣電力公司',
  '台電派員訪查併聯函': '台灣電力公司',
  '台電正式躉售': '台灣電力公司',
  '台電審訖圖': '台灣電力公司',
  
  // 能源署相關
  '能源署同意備案': '經濟部能源署',
  '能源署設備登記': '經濟部能源署',
  
  // 技師簽證
  '結構技師簽證': '結構技師',
  '電機技師簽證': '電機技師',
  
  // 免雜執照相關
  '免雜執照同意備案': '地方政府',
  '免雜執照完竣': '地方政府',
  
  // 其他
  '附屬綠能設施同意函': '地方政府',
  '最終掛表期限': '台灣電力公司',
  '電廠轉移申請': '經濟部能源署',
};

/**
 * 根據文件類型推斷對應機關
 * @param docType 文件類型
 * @returns 對應機關名稱，若無法推斷則返回 null
 */
export function getAgencyByDocType(docType: string): string | null {
  // 精確匹配
  if (DOC_TYPE_AGENCY_MAP[docType]) {
    return DOC_TYPE_AGENCY_MAP[docType];
  }
  
  // 部分匹配 - 根據關鍵字推斷
  const lowerType = docType.toLowerCase();
  
  if (lowerType.includes('台電')) {
    return '台灣電力公司';
  }
  
  if (lowerType.includes('能源署') || lowerType.includes('能源局')) {
    return '經濟部能源署';
  }
  
  if (lowerType.includes('技師')) {
    if (lowerType.includes('結構')) return '結構技師';
    if (lowerType.includes('電機')) return '電機技師';
    return null;
  }
  
  if (lowerType.includes('免雜') || lowerType.includes('建照')) {
    return '地方政府';
  }
  
  return null;
}

/**
 * 檢查文件類型是否可以自動推斷機關
 * @param docType 文件類型
 * @returns 是否可以自動推斷
 */
export function canAutoInferAgency(docType: string): boolean {
  return getAgencyByDocType(docType) !== null;
}

/**
 * 生成標準文件顯示名稱
 * 格式：{ProjectCode}_{Agency}_{DocumentType}_{YYYYMMDD}_v{XX}
 * 
 * @param params 命名參數
 * @returns 標準化的檔案名稱
 */
export function generateDocumentDisplayName(params: {
  projectCode: string;
  agency: string;
  docType: string;
  date: Date;
  version: number;
  extension?: string;
}): string {
  const {
    projectCode,
    agency,
    docType,
    date,
    version,
    extension = 'pdf',
  } = params;
  
  // 格式化日期為 YYYYMMDD（使用本地時間，避免 UTC 時區偏移）
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  // 格式化版本號 v01, v02 等
  const versionStr = `v${version.toString().padStart(2, '0')}`;
  
  // 移除空格和特殊字元
  const cleanProjectCode = projectCode.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, '');
  const cleanAgency = agency.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, '');
  const cleanDocType = docType.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, '');
  
  return `${cleanProjectCode}_${cleanAgency}_${cleanDocType}_${dateStr}_${versionStr}.${extension}`;
}

// 預設機關選項（當無法自動推斷時使用）
export const DEFAULT_AGENCY_OPTIONS = [
  { value: '台灣電力公司', label: '台灣電力公司' },
  { value: '經濟部能源署', label: '經濟部能源署' },
  { value: '地方政府', label: '地方政府' },
  { value: '結構技師', label: '結構技師' },
  { value: '電機技師', label: '電機技師' },
  { value: '其他', label: '其他' },
];
