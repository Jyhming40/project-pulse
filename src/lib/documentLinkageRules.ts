/**
 * 文件狀態連動規則輔助函數
 * 
 * 規則現已從資料庫讀取，此檔案提供前端輔助函數
 */

import { supabase } from '@/integrations/supabase/client';

export interface LinkageRule {
  id: string;
  rule_name: string;
  description: string | null;
  trigger_doc_type_code: string;
  trigger_field: 'issued_at' | 'submitted_at';
  trigger_condition: 'set_new' | 'any_change';
  target_type: 'project_status' | 'construction_status' | 'milestone' | 'project_field';
  target_value: string | null;
  target_field: string | null;
  use_trigger_value: boolean;
  is_active: boolean;
  is_system: boolean;
}

// Cache for linkage rules
let cachedRules: LinkageRule[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * 從資料庫取得啟用的連動規則
 */
export async function fetchActiveRules(): Promise<LinkageRule[]> {
  const now = Date.now();
  if (cachedRules && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedRules;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('document_linkage_rules')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch linkage rules:', error);
    return cachedRules || [];
  }

  cachedRules = data as LinkageRule[];
  cacheTimestamp = now;
  return cachedRules;
}

/**
 * 取得所有有連動效果的文件類型代碼
 */
export function getLinkedDocTypeCodes(rules: LinkageRule[]): string[] {
  return [...new Set(rules.map(rule => rule.trigger_doc_type_code))];
}

/**
 * 檢查文件類型是否有連動效果
 */
export function hasLinkageEffect(codeOrLabel: string, rules?: LinkageRule[]): boolean {
  if (!rules) {
    // Fallback to hardcoded list for synchronous calls
    const knownLinkedCodes = [
      'MOEA_CONSENT', 'TPC_CONTRACT', 'TPC_FORMAL_FIT',
      'MOEA_REGISTER', 'BUILD_EXEMPT_COMP',
      'ENG_STRUCTURAL', 'ENG_ELECTRICAL', 'TPC_METER',
    ];
    return knownLinkedCodes.includes(codeOrLabel);
  }
  return rules.some(rule => rule.trigger_doc_type_code === codeOrLabel);
}

/**
 * 取得文件類型的連動規則
 */
export function getLinkageRulesForDocType(docTypeCode: string, rules: LinkageRule[]): LinkageRule[] {
  return rules.filter(rule => rule.trigger_doc_type_code === docTypeCode);
}

/**
 * 取得連動效果的描述文字
 */
export function getLinkageEffectDescription(codeOrLabel: string, rules?: LinkageRule[]): string | null {
  if (!rules) {
    // Fallback descriptions for synchronous calls
    const descriptions: Record<string, string> = {
      'MOEA_CONSENT': '案場狀態 → 同意備案、設定核准日期',
      'TPC_CONTRACT': '里程碑 TPC_CONTRACT 標記完成',
      'TPC_FORMAL_FIT': '案場狀態 → 運維中、工程狀態 → 已完工',
      'MOEA_REGISTER': '里程碑 MOEA_REGISTER 標記完成',
      'BUILD_EXEMPT_COMP': '里程碑 BUILD_EXEMPT_COMP 標記完成',
      'ENG_STRUCTURAL': '里程碑 ENG_STRUCTURAL 標記完成',
      'ENG_ELECTRICAL': '里程碑 ENG_ELECTRICAL 標記完成',
      'TPC_METER': '里程碑 TPC_METER 標記完成',
    };
    return descriptions[codeOrLabel] || null;
  }

  const matchingRules = getLinkageRulesForDocType(codeOrLabel, rules);
  if (matchingRules.length === 0) return null;

  return matchingRules.map(rule => {
    if (rule.target_type === 'project_status') {
      return `案場狀態 → ${rule.target_value}`;
    } else if (rule.target_type === 'construction_status') {
      return `工程狀態 → ${rule.target_value}`;
    } else if (rule.target_type === 'milestone') {
      return `里程碑 ${rule.target_value} 標記完成`;
    } else if (rule.target_type === 'project_field') {
      return `設定 ${rule.target_field}`;
    }
    return rule.rule_name;
  }).join('、');
}

/**
 * 清除快取（當規則更新時呼叫）
 */
export function clearRulesCache(): void {
  cachedRules = null;
  cacheTimestamp = 0;
}
