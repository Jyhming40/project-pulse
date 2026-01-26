import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TieredPricingType,
  calculateTieredPrice as calculateFromLib,
  structuralEngineerDataPoints,
  electricalEngineerTiers,
  environmentalTiers,
  STRUCTURAL_PER_500KW_FEE,
} from "@/lib/tieredPricing";

export interface PricingType {
  id: string;
  typeCode: string;
  typeName: string;
  description?: string;
  calculationMethod: 'interpolation' | 'tiered' | 'fixed';
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface PricingTier {
  id: string;
  pricingTypeId: string;
  minKw: number;
  maxKw: number;
  coefficient?: number;
  perKwPrice: number;
  minimumFee?: number;
  sortOrder: number;
}

// 結構技師內插法資料點類型
export interface InterpolationDataPoint {
  kw: number;
  price: number;
}

// 預設定價類型 (三種獨立類型)
const defaultPricingTypes: PricingType[] = [
  { 
    id: 'structural_engineer', 
    typeCode: 'structural_engineer', 
    typeName: '結構技師', 
    description: '使用內插法計算，<10kW固定$8,000，≥500kW按每500kW=$23,000+餘數', 
    calculationMethod: 'interpolation',
    isActive: true, 
    isSystem: true, 
    sortOrder: 1 
  },
  { 
    id: 'electrical_engineer', 
    typeCode: 'electrical_engineer', 
    typeName: '電機技師', 
    description: '1-99kW固定$7,000，100kW以上按階梯單價計算', 
    calculationMethod: 'tiered',
    isActive: true, 
    isSystem: true, 
    sortOrder: 2 
  },
  { 
    id: 'environmental', 
    typeCode: 'environmental', 
    typeName: '明群環能', 
    description: '標準階梯定價，1-49kW最低$10,000', 
    calculationMethod: 'tiered',
    isActive: true, 
    isSystem: true, 
    sortOrder: 3 
  },
];

// 預設級距 - 電機技師
const defaultElectricalTiers: PricingTier[] = electricalEngineerTiers.map((t, idx) => ({
  id: `elec_${idx + 1}`,
  pricingTypeId: 'electrical_engineer',
  minKw: t.minKw,
  maxKw: t.maxKw === Infinity ? 99999 : t.maxKw,
  coefficient: t.coefficient,
  perKwPrice: t.perKwPrice,
  minimumFee: t.minimumFee,
  sortOrder: idx + 1,
}));

// 預設級距 - 明群環能
const defaultEnvironmentalTiers: PricingTier[] = environmentalTiers.map((t, idx) => ({
  id: `env_${idx + 1}`,
  pricingTypeId: 'environmental',
  minKw: t.minKw,
  maxKw: t.maxKw === Infinity ? 99999 : t.maxKw,
  coefficient: t.coefficient,
  perKwPrice: t.perKwPrice,
  minimumFee: t.minimumFee,
  sortOrder: idx + 1,
}));

// 組合所有預設級距 (不含結構技師，因為它使用內插法)
const defaultTiers: PricingTier[] = [...defaultElectricalTiers, ...defaultEnvironmentalTiers];

// 預設結構技師內插法資料點
const defaultStructuralDataPoints: InterpolationDataPoint[] = structuralEngineerDataPoints;

/**
 * Hook 用於管理階梯定價類型和級距
 */
export function useTieredPricing() {
  const [pricingTypes, setPricingTypes] = useState<PricingType[]>(defaultPricingTypes);
  const [tiers, setTiers] = useState<PricingTier[]>(defaultTiers);
  const [structuralDataPoints, setStructuralDataPoints] = useState<InterpolationDataPoint[]>(defaultStructuralDataPoints);
  const [structuralPer500kwFee, setStructuralPer500kwFee] = useState(STRUCTURAL_PER_500KW_FEE);
  const [isLoading, setIsLoading] = useState(true);
  const [useDatabase, setUseDatabase] = useState(false);

  // 嘗試從資料庫載入
  const loadFromDatabase = useCallback(async () => {
    try {
      // 檢查資料庫表是否存在
      const { data: typesData, error: typesError } = await supabase
        .from('tiered_pricing_types' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (typesError) {
        // 表不存在，使用預設值
        console.log('Using default tiered pricing (table not found)');
        setUseDatabase(false);
        return;
      }

      if (typesData && typesData.length > 0) {
        const { data: tiersData, error: tiersError } = await supabase
          .from('tiered_pricing_tiers' as any)
          .select('*')
          .order('sort_order');

        if (!tiersError && tiersData) {
          // 轉換資料格式
          setPricingTypes(typesData.map((t: any) => ({
            id: t.id,
            typeCode: t.type_code,
            typeName: t.type_name,
            description: t.description,
            calculationMethod: t.calculation_method || 'tiered',
            isActive: t.is_active,
            isSystem: t.is_system,
            sortOrder: t.sort_order,
          })));

          setTiers(tiersData.map((t: any) => ({
            id: t.id,
            pricingTypeId: t.pricing_type_id,
            minKw: Number(t.min_kw),
            maxKw: Number(t.max_kw),
            coefficient: t.coefficient ? Number(t.coefficient) : undefined,
            perKwPrice: Number(t.per_kw_price),
            minimumFee: t.minimum_fee ? Number(t.minimum_fee) : undefined,
            sortOrder: t.sort_order,
          })));

          setUseDatabase(true);
        }
      }
    } catch (error) {
      console.log('Using default tiered pricing (error loading from database)');
      setUseDatabase(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  // 取得特定類型的級距
  const getTiersForType = useCallback((typeCode: string): PricingTier[] => {
    const type = pricingTypes.find(t => t.typeCode === typeCode);
    if (!type) return [];
    return tiers
      .filter(t => t.pricingTypeId === type.id || t.pricingTypeId === typeCode)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [pricingTypes, tiers]);

  // 根據容量計算定價 (使用 lib 中的計算邏輯)
  const calculatePrice = useCallback((capacityKw: number, typeCode: string): {
    total: number;
    perKwPrice: number;
  } => {
    const result = calculateFromLib(capacityKw, typeCode as TieredPricingType);
    return {
      total: result.total,
      perKwPrice: result.perKwPrice,
    };
  }, []);

  // 取得結構技師的內插法資料點
  const getStructuralDataPoints = useCallback((): InterpolationDataPoint[] => {
    return structuralDataPoints;
  }, [structuralDataPoints]);

  // 取得結構技師每500kW費用
  const getStructuralPer500kwFee = useCallback((): number => {
    return structuralPer500kwFee;
  }, [structuralPer500kwFee]);

  // 儲存類型到資料庫
  const savePricingType = useCallback(async (type: Partial<PricingType>) => {
    try {
      const payload = {
        type_code: type.typeCode,
        type_name: type.typeName,
        description: type.description,
        calculation_method: type.calculationMethod || 'tiered',
        is_active: type.isActive ?? true,
        is_system: type.isSystem ?? false,
        sort_order: type.sortOrder ?? 0,
      };

      if (type.id && !['structural_engineer', 'electrical_engineer', 'environmental'].includes(type.id)) {
        // 更新
        const { error } = await supabase
          .from('tiered_pricing_types' as any)
          .update(payload)
          .eq('id', type.id);
        if (error) throw error;
      } else {
        // 新增
        const { error } = await supabase
          .from('tiered_pricing_types' as any)
          .insert(payload);
        if (error) throw error;
      }

      await loadFromDatabase();
      toast.success('已儲存定價類型');
    } catch (error) {
      console.error('Error saving pricing type:', error);
      toast.error('儲存失敗');
    }
  }, [loadFromDatabase]);

  // 儲存級距到資料庫
  const saveTier = useCallback(async (tier: Partial<PricingTier>, typeId: string) => {
    try {
      const payload = {
        pricing_type_id: typeId,
        min_kw: tier.minKw,
        max_kw: tier.maxKw,
        coefficient: tier.coefficient,
        per_kw_price: tier.perKwPrice,
        minimum_fee: tier.minimumFee,
        sort_order: tier.sortOrder ?? 0,
      };

      const isDefaultId = tier.id?.startsWith('elec_') || tier.id?.startsWith('env_');
      if (tier.id && !isDefaultId) {
        // 更新
        const { error } = await supabase
          .from('tiered_pricing_tiers' as any)
          .update(payload)
          .eq('id', tier.id);
        if (error) throw error;
      } else {
        // 新增
        const { error } = await supabase
          .from('tiered_pricing_tiers' as any)
          .insert(payload);
        if (error) throw error;
      }

      await loadFromDatabase();
      toast.success('已儲存級距');
    } catch (error) {
      console.error('Error saving tier:', error);
      toast.error('儲存失敗');
    }
  }, [loadFromDatabase]);

  // 刪除級距
  const deleteTier = useCallback(async (tierId: string) => {
    try {
      const { error } = await supabase
        .from('tiered_pricing_tiers' as any)
        .delete()
        .eq('id', tierId);
      if (error) throw error;

      await loadFromDatabase();
      toast.success('已刪除級距');
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('刪除失敗');
    }
  }, [loadFromDatabase]);

  return {
    pricingTypes,
    tiers,
    isLoading,
    useDatabase,
    getTiersForType,
    calculatePrice,
    getStructuralDataPoints,
    getStructuralPer500kwFee,
    savePricingType,
    saveTier,
    deleteTier,
    reload: loadFromDatabase,
  };
}

/**
 * 取得所有可用的定價類型（用於下拉選單）
 */
export function usePricingTypeOptions() {
  const { pricingTypes, isLoading } = useTieredPricing();
  
  return {
    options: pricingTypes.filter(t => t.isActive).map(t => ({
      value: t.typeCode,
      label: t.typeName,
      description: t.description,
      calculationMethod: t.calculationMethod,
    })),
    isLoading,
  };
}
