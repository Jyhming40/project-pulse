import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PricingType {
  id: string;
  typeCode: string;
  typeName: string;
  description?: string;
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

// 預設定價類型
const defaultPricingTypes: PricingType[] = [
  { id: 'structural_engineer', typeCode: 'structural_engineer', typeName: '結構/電機技師', description: '結構技師及電機技師簽證費用級距', isActive: true, isSystem: true, sortOrder: 1 },
  { id: 'environmental', typeCode: 'environmental', typeName: '明群環能', description: '明群環能服務費用級距', isActive: true, isSystem: true, sortOrder: 2 },
];

// 預設級距 - 結構/電機技師
const defaultStructuralTiers: PricingTier[] = [
  { id: 's1', pricingTypeId: 'structural_engineer', minKw: 1, maxKw: 19, perKwPrice: 30000, minimumFee: 30000, sortOrder: 1 },
  { id: 's2', pricingTypeId: 'structural_engineer', minKw: 20, maxKw: 49, coefficient: 1.33, perKwPrice: 1200, sortOrder: 2 },
  { id: 's3', pricingTypeId: 'structural_engineer', minKw: 50, maxKw: 99, coefficient: 1.00, perKwPrice: 900, sortOrder: 3 },
  { id: 's4', pricingTypeId: 'structural_engineer', minKw: 100, maxKw: 199, coefficient: 0.89, perKwPrice: 800, sortOrder: 4 },
  { id: 's5', pricingTypeId: 'structural_engineer', minKw: 200, maxKw: 299, coefficient: 0.78, perKwPrice: 700, sortOrder: 5 },
  { id: 's6', pricingTypeId: 'structural_engineer', minKw: 300, maxKw: 399, coefficient: 0.67, perKwPrice: 600, sortOrder: 6 },
  { id: 's7', pricingTypeId: 'structural_engineer', minKw: 400, maxKw: 499, coefficient: 0.61, perKwPrice: 550, sortOrder: 7 },
  { id: 's8', pricingTypeId: 'structural_engineer', minKw: 500, maxKw: 799, perKwPrice: 500, sortOrder: 8 },
  { id: 's9', pricingTypeId: 'structural_engineer', minKw: 800, maxKw: 1099, perKwPrice: 480, sortOrder: 9 },
  { id: 's10', pricingTypeId: 'structural_engineer', minKw: 1100, maxKw: 1399, perKwPrice: 440, sortOrder: 10 },
  { id: 's11', pricingTypeId: 'structural_engineer', minKw: 1400, maxKw: 1699, perKwPrice: 400, sortOrder: 11 },
  { id: 's12', pricingTypeId: 'structural_engineer', minKw: 1700, maxKw: 99999, perKwPrice: 300, sortOrder: 12 },
];

// 預設級距 - 明群環能
const defaultEnvironmentalTiers: PricingTier[] = [
  { id: 'e1', pricingTypeId: 'environmental', minKw: 1, maxKw: 49, coefficient: 1.90, perKwPrice: 400, minimumFee: 10000, sortOrder: 1 },
  { id: 'e2', pricingTypeId: 'environmental', minKw: 50, maxKw: 99, coefficient: 1.19, perKwPrice: 250, sortOrder: 2 },
  { id: 'e3', pricingTypeId: 'environmental', minKw: 100, maxKw: 199, coefficient: 1.00, perKwPrice: 210, sortOrder: 3 },
  { id: 'e4', pricingTypeId: 'environmental', minKw: 200, maxKw: 499, coefficient: 0.83, perKwPrice: 175, sortOrder: 4 },
  { id: 'e5', pricingTypeId: 'environmental', minKw: 500, maxKw: 799, coefficient: 0.57, perKwPrice: 120, sortOrder: 5 },
  { id: 'e6', pricingTypeId: 'environmental', minKw: 800, maxKw: 999, coefficient: 0.48, perKwPrice: 100, sortOrder: 6 },
  { id: 'e7', pricingTypeId: 'environmental', minKw: 1000, maxKw: 1199, coefficient: 0.43, perKwPrice: 90, sortOrder: 7 },
  { id: 'e8', pricingTypeId: 'environmental', minKw: 1300, maxKw: 1499, coefficient: 0.38, perKwPrice: 80, sortOrder: 8 },
  { id: 'e9', pricingTypeId: 'environmental', minKw: 1500, maxKw: 1699, coefficient: 0.33, perKwPrice: 70, sortOrder: 9 },
  { id: 'e10', pricingTypeId: 'environmental', minKw: 1800, maxKw: 99999, coefficient: 0.33, perKwPrice: 70, sortOrder: 10 },
];

// 組合所有預設級距
const defaultTiers: PricingTier[] = [...defaultStructuralTiers, ...defaultEnvironmentalTiers];

/**
 * Hook 用於管理階梯定價類型和級距
 */
export function useTieredPricing() {
  const [pricingTypes, setPricingTypes] = useState<PricingType[]>(defaultPricingTypes);
  const [tiers, setTiers] = useState<PricingTier[]>(defaultTiers);
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

  // 根據容量計算定價
  const calculatePrice = useCallback((capacityKw: number, typeCode: string): {
    total: number;
    perKwPrice: number;
    tier: PricingTier | null;
  } => {
    const typeTiers = getTiersForType(typeCode);
    const tier = typeTiers.find(t => capacityKw >= t.minKw && capacityKw <= t.maxKw);

    if (!tier) {
      return { total: 0, perKwPrice: 0, tier: null };
    }

    let total = capacityKw * tier.perKwPrice;
    
    // 如果有最低收費且計算結果低於最低收費，使用最低收費
    if (tier.minimumFee && total < tier.minimumFee) {
      total = tier.minimumFee;
    }

    return {
      total,
      perKwPrice: tier.perKwPrice,
      tier,
    };
  }, [getTiersForType]);

  // 儲存類型到資料庫
  const savePricingType = useCallback(async (type: Partial<PricingType>) => {
    try {
      const payload = {
        type_code: type.typeCode,
        type_name: type.typeName,
        description: type.description,
        is_active: type.isActive ?? true,
        is_system: type.isSystem ?? false,
        sort_order: type.sortOrder ?? 0,
      };

      if (type.id && !type.id.startsWith('structural_') && !type.id.startsWith('environmental')) {
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

      if (tier.id && !tier.id.startsWith('s') && !tier.id.startsWith('e')) {
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
    })),
    isLoading,
  };
}
