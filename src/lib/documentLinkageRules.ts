/**
 * 文件狀態連動規則定義
 * 
 * 集中管理所有文件類型的連動邏輯
 */

export interface LinkageRule {
  /** 文件類型代碼 */
  docTypeCodes: string[];
  /** 舊標籤（向後兼容） */
  legacyLabels: string[];
  /** 連動描述 */
  description: string;
  /** 連動目標 */
  target: 'project_status' | 'milestone' | 'construction_status' | 'multiple';
  /** 連動結果說明 */
  effect: string;
}

/**
 * 所有文件連動規則
 */
export const DOCUMENT_LINKAGE_RULES: LinkageRule[] = [
  // Rule 1: 同意備案
  {
    docTypeCodes: ['MOEA_CONSENT'],
    legacyLabels: ['同意備案'],
    description: '同意備案核發',
    target: 'project_status',
    effect: '案場狀態 → 同意備案、設定核准日期',
  },
  // Rule 2: 躉購合約
  {
    docTypeCodes: ['TPC_CONTRACT'],
    legacyLabels: ['躉售合約', '躉購合約', '台電躉售合約'],
    description: '躉購合約核發',
    target: 'milestone',
    effect: '里程碑 TPC_CONTRACT 標記完成',
  },
  // Rule 3: 正式躉售
  {
    docTypeCodes: ['TPC_FORMAL_FIT'],
    legacyLabels: ['正式躉售', '台電正式躉售'],
    description: '正式躉售核發',
    target: 'multiple',
    effect: '案場狀態 → 運維中、工程狀態 → 已完工',
  },
  // Rule 4: 設備登記
  {
    docTypeCodes: ['MOEA_REGISTER'],
    legacyLabels: ['設備登記'],
    description: '設備登記核發',
    target: 'milestone',
    effect: '里程碑 MOEA_REGISTER 標記完成',
  },
  // Rule 5: 免雜項竣工
  {
    docTypeCodes: ['BUILD_EXEMPT_COMP'],
    legacyLabels: ['免雜項竣工'],
    description: '免雜項竣工核發',
    target: 'milestone',
    effect: '里程碑 BUILD_EXEMPT_COMP 標記完成',
  },
  // Rule 6: 結構技師簽證
  {
    docTypeCodes: ['ENG_STRUCTURAL'],
    legacyLabels: ['結構技師簽證', '結構簽證'],
    description: '結構技師簽證核發',
    target: 'milestone',
    effect: '里程碑 ENG_STRUCTURAL 標記完成',
  },
  // Rule 7: 電機技師簽證
  {
    docTypeCodes: ['ENG_ELECTRICAL'],
    legacyLabels: ['電機技師簽證', '電機簽證'],
    description: '電機技師簽證核發',
    target: 'milestone',
    effect: '里程碑 ENG_ELECTRICAL 標記完成',
  },
  // Rule 8: 台電報竣掛表
  {
    docTypeCodes: ['TPC_METER'],
    legacyLabels: ['報竣掛表', '台電報竣掛表'],
    description: '台電報竣掛表核發',
    target: 'milestone',
    effect: '里程碑 TPC_METER 標記完成',
  },
];

/**
 * 取得所有有連動效果的文件類型代碼
 */
export function getLinkedDocTypeCodes(): string[] {
  return DOCUMENT_LINKAGE_RULES.flatMap(rule => rule.docTypeCodes);
}

/**
 * 取得所有有連動效果的文件類型標籤
 */
export function getLinkedDocTypeLabels(): string[] {
  return DOCUMENT_LINKAGE_RULES.flatMap(rule => rule.legacyLabels);
}

/**
 * 檢查文件類型是否有連動效果
 */
export function hasLinkageEffect(codeOrLabel: string): boolean {
  return DOCUMENT_LINKAGE_RULES.some(
    rule => 
      rule.docTypeCodes.includes(codeOrLabel) ||
      rule.legacyLabels.includes(codeOrLabel)
  );
}

/**
 * 取得文件類型的連動規則
 */
export function getLinkageRule(codeOrLabel: string): LinkageRule | undefined {
  return DOCUMENT_LINKAGE_RULES.find(
    rule => 
      rule.docTypeCodes.includes(codeOrLabel) ||
      rule.legacyLabels.includes(codeOrLabel)
  );
}

/**
 * 取得連動效果的描述文字
 */
export function getLinkageEffectDescription(codeOrLabel: string): string | null {
  const rule = getLinkageRule(codeOrLabel);
  return rule ? rule.effect : null;
}
