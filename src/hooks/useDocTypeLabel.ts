import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  DOC_TYPE_DEFINITIONS, 
  getDocTypeLabelByCode,
  AGENCY_CODE_TO_LABEL,
  type AgencyCode 
} from '@/lib/docTypeMapping';

// 舊系統遺留的代碼 → 中文標籤的 mapping
// 這些代碼來自 codebookConfig.ts 或舊資料，不在 document_type_config 中
const LEGACY_CODE_TO_LABEL: Record<string, string> = {
  'LINE_COMP_NOTICE': '線補費通知單',
  'STRUCT_CERT': '結構簽證',
  'TPC': '台電相關',
  'ENERGY_BUREAU': '能源署相關',
  'RELATED': '其他相關文件',
  'BUILDING_AUTH': '建管處相關',
  'GREEN_PERMISSION': '綠能設施',
  'OTHER': '其他',
  // 其他可能的舊代碼
};

interface DocTypeConfigRecord {
  code: string;
  label: string;
  agency_code: string;
  is_active: boolean;
  is_required: boolean;
}

/**
 * Hook 用於統一取得文件類型的中文標籤
 * 優先使用資料庫 document_type_config，找不到才用靜態 mapping
 */
export function useDocTypeLabel() {
  // 從資料庫取得文件類型設定
  const { data: dbDocTypes = [] } = useQuery({
    queryKey: ['document-type-config-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_type_config' as any)
        .select('code, label, agency_code, is_active, is_required')
        .eq('is_active', true);

      if (error) {
        console.warn('Failed to fetch document type config:', error);
        return [];
      }
      return (data || []) as unknown as DocTypeConfigRecord[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // 建立 code → label 的 mapping
  const codeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // 1. 先載入資料庫的設定（最高優先）
    dbDocTypes.forEach(dt => {
      map.set(dt.code, dt.label);
    });
    
    // 2. 再載入靜態定義（作為備援）
    DOC_TYPE_DEFINITIONS.forEach(def => {
      if (!map.has(def.code)) {
        map.set(def.code, def.label);
      }
    });
    
    // 3. 載入舊系統遺留代碼（最後備援）
    Object.entries(LEGACY_CODE_TO_LABEL).forEach(([code, label]) => {
      if (!map.has(code)) {
        map.set(code, label);
      }
    });
    
    return map;
  }, [dbDocTypes]);

  // 建立 label → code 的反向 mapping（用於舊資料的識別）
  const labelCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    
    dbDocTypes.forEach(dt => {
      map.set(dt.label, dt.code);
    });
    
    DOC_TYPE_DEFINITIONS.forEach(def => {
      if (!map.has(def.label)) {
        map.set(def.label, def.code);
      }
    });
    
    return map;
  }, [dbDocTypes]);

  /**
   * 取得文件類型的中文標籤
   * @param docTypeCode - 可能是 doc_type_code 或舊的 doc_type 值
   * @param fallbackDocType - 如果 code 找不到，用舊的 doc_type 作為備援
   */
  const getLabel = (docTypeCode: string | null | undefined, fallbackDocType?: string | null): string => {
    // 1. 如果有 doc_type_code，先從 codeLabelMap 查找
    if (docTypeCode) {
      const label = codeLabelMap.get(docTypeCode);
      if (label) return label;
    }
    
    // 2. 嘗試 fallbackDocType（舊的 doc_type 欄位值）
    if (fallbackDocType) {
      // 2a. fallbackDocType 可能是舊代碼，嘗試查找
      const labelFromFallback = codeLabelMap.get(fallbackDocType);
      if (labelFromFallback) return labelFromFallback;
      
      // 2b. 檢查是否為已知標籤（反向查找確認它是中文標籤）
      if (labelCodeMap.has(fallbackDocType)) {
        return fallbackDocType;
      }
      
      // 2c. 嘗試從 LEGACY_CODE_TO_LABEL 查找
      if (LEGACY_CODE_TO_LABEL[fallbackDocType]) {
        return LEGACY_CODE_TO_LABEL[fallbackDocType];
      }
      
      // 2d. 否則直接返回（可能是使用者自定義的類型名稱或中文）
      return fallbackDocType;
    }
    
    // 3. docTypeCode 本身可能是中文標籤（舊資料）
    if (docTypeCode && labelCodeMap.has(docTypeCode)) {
      return docTypeCode;
    }
    
    // 4. 嘗試從 LEGACY_CODE_TO_LABEL 查找 docTypeCode
    if (docTypeCode && LEGACY_CODE_TO_LABEL[docTypeCode]) {
      return LEGACY_CODE_TO_LABEL[docTypeCode];
    }
    
    // 5. 最後備援
    return docTypeCode || '未知類型';
  };

  /**
   * 取得用於下拉選單的選項（全部使用中文標籤）
   * 格式: { value: code, label: 中文標籤, isRequired: boolean }
   */
  const dropdownOptions = useMemo(() => {
    const options: { value: string; label: string; agencyCode: string; isRequired: boolean }[] = [];
    const seenCodes = new Set<string>();
    
    // 優先使用資料庫的設定
    dbDocTypes.forEach(dt => {
      if (!seenCodes.has(dt.code)) {
        options.push({
          value: dt.code,
          label: dt.label,
          agencyCode: dt.agency_code,
          isRequired: dt.is_required,
        });
        seenCodes.add(dt.code);
      }
    });
    
    // 備援：使用靜態定義（只加入資料庫沒有的）
    DOC_TYPE_DEFINITIONS.forEach(def => {
      if (!seenCodes.has(def.code)) {
        options.push({
          value: def.code,
          label: def.label,
          agencyCode: def.agencyCode,
          isRequired: false, // 靜態定義的預設為非必要
        });
        seenCodes.add(def.code);
      }
    });
    
    return options;
  }, [dbDocTypes]);

  /**
   * 取得必要文件類型列表
   */
  const requiredDocTypes = useMemo(() => {
    return dropdownOptions.filter(opt => opt.isRequired);
  }, [dropdownOptions]);

  /**
   * 檢查文件類型代碼是否為必要文件
   */
  const isRequired = (docTypeCode: string | null | undefined): boolean => {
    if (!docTypeCode) return false;
    const found = dropdownOptions.find(opt => opt.value === docTypeCode);
    return found?.isRequired ?? false;
  };

  /**
   * 按機關分組的下拉選項
   */
  const groupedOptions = useMemo(() => {
    const grouped: Record<string, { value: string; label: string }[]> = {};
    
    dropdownOptions.forEach(opt => {
      const agencyLabel = AGENCY_CODE_TO_LABEL[opt.agencyCode as AgencyCode] || opt.agencyCode;
      if (!grouped[agencyLabel]) {
        grouped[agencyLabel] = [];
      }
      grouped[agencyLabel].push({ value: opt.value, label: opt.label });
    });
    
    return grouped;
  }, [dropdownOptions]);

  return {
    getLabel,
    dropdownOptions,
    groupedOptions,
    codeLabelMap,
    labelCodeMap,
    requiredDocTypes,
    isRequired,
  };
}
