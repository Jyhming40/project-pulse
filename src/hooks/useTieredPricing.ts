import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TieredPricingType,
  structuralEngineerDataPoints,
  electricalEngineerTiers,
  environmentalTiers,
  STRUCTURAL_PER_500KW_FEE,
  PricingTier as LibPricingTier,
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

// localStorage key
const STORAGE_KEY = 'tiered_pricing_tiers';

/**
 * 從 localStorage 讀取自訂級距
 */
function loadTiersFromStorage(): PricingTier[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading tiers from storage:', e);
  }
  return null;
}

/**
 * 儲存級距到 localStorage
 */
function saveTiersToStorage(tiers: PricingTier[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers));
  } catch (e) {
    console.error('Error saving tiers to storage:', e);
  }
}

/**
 * 計算階梯式定價
 */
function calculateTieredPriceFromTiers(
  capacityKw: number,
  tiers: PricingTier[]
): { total: number; perKwPrice: number } {
  if (capacityKw <= 0 || tiers.length === 0) {
    return { total: 0, perKwPrice: 0 };
  }

  const sortedTiers = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  const tier = sortedTiers.find(
    (t) => capacityKw >= t.minKw && capacityKw <= t.maxKw
  );

  if (!tier) {
    return { total: 0, perKwPrice: 0 };
  }

  // 如果 perKwPrice 為 0 且有 minimumFee，表示這是固定費用
  if (tier.perKwPrice === 0 && tier.minimumFee) {
    return {
      total: tier.minimumFee,
      perKwPrice: 0,
    };
  }

  // 計算總金額
  let total = capacityKw * tier.perKwPrice;
  
  // 如果有最低收費且計算結果低於最低收費，使用最低收費
  if (tier.minimumFee && total < tier.minimumFee) {
    total = tier.minimumFee;
  }

  return {
    total,
    perKwPrice: tier.perKwPrice,
  };
}

/**
 * 結構技師內插法計算
 */
function interpolateStructuralPrice(capacityKw: number, dataPoints: InterpolationDataPoint[], per500kwFee: number): number {
  if (capacityKw < 10) {
    return 8000;
  }
  
  if (capacityKw >= 500) {
    const blocks = Math.floor(capacityKw / 500);
    const remainder = capacityKw % 500;
    
    let total = blocks * per500kwFee;
    
    if (remainder > 0) {
      total += interpolateStructuralPrice(remainder, dataPoints, per500kwFee);
    }
    
    return total;
  }
  
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const p1 = dataPoints[i];
    const p2 = dataPoints[i + 1];
    
    if (capacityKw >= p1.kw && capacityKw <= p2.kw) {
      const interpolatedPrice = p1.price + 
        (capacityKw - p1.kw) * (p2.price - p1.price) / (p2.kw - p1.kw);
      
      return Math.round(interpolatedPrice);
    }
  }
  
  return dataPoints[dataPoints.length - 1].price;
}

/**
 * Hook 用於管理階梯定價類型和級距
 */
export function useTieredPricing() {
  const [pricingTypes, setPricingTypes] = useState<PricingType[]>(defaultPricingTypes);
  const [tiers, setTiers] = useState<PricingTier[]>(() => {
    const stored = loadTiersFromStorage();
    return stored || defaultTiers;
  });
  const [structuralDataPoints, setStructuralDataPoints] = useState<InterpolationDataPoint[]>(defaultStructuralDataPoints);
  const [structuralPer500kwFee, setStructuralPer500kwFee] = useState(STRUCTURAL_PER_500KW_FEE);
  const [isLoading, setIsLoading] = useState(false);
  const [useDatabase] = useState(true); // 現在總是允許編輯

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
  } => {
    const type = pricingTypes.find(t => t.typeCode === typeCode);
    
    if (!type || capacityKw <= 0) {
      return { total: 0, perKwPrice: 0 };
    }

    if (type.calculationMethod === 'interpolation') {
      // 結構技師使用內插法
      const total = interpolateStructuralPrice(capacityKw, structuralDataPoints, structuralPer500kwFee);
      const perKwPrice = capacityKw > 0 ? Math.round(total / capacityKw) : 0;
      return { total, perKwPrice };
    }

    // 電機技師和明群環能使用階梯定價
    const typeTiers = getTiersForType(typeCode);
    return calculateTieredPriceFromTiers(capacityKw, typeTiers);
  }, [pricingTypes, structuralDataPoints, structuralPer500kwFee, getTiersForType]);

  // 取得結構技師的內插法資料點
  const getStructuralDataPoints = useCallback((): InterpolationDataPoint[] => {
    return structuralDataPoints;
  }, [structuralDataPoints]);

  // 取得結構技師每500kW費用
  const getStructuralPer500kwFee = useCallback((): number => {
    return structuralPer500kwFee;
  }, [structuralPer500kwFee]);

  // 儲存級距 (使用 localStorage)
  const saveTier = useCallback(async (tier: Partial<PricingTier>, typeId: string) => {
    try {
      const isDefaultId = tier.id?.startsWith('elec_') || tier.id?.startsWith('env_');
      
      if (tier.id && !isDefaultId) {
        // 更新現有級距
        const updatedTiers = tiers.map(t => 
          t.id === tier.id ? { ...t, ...tier } as PricingTier : t
        );
        setTiers(updatedTiers);
        saveTiersToStorage(updatedTiers);
      } else {
        // 新增級距
        const newTier: PricingTier = {
          id: `custom_${Date.now()}`,
          pricingTypeId: typeId,
          minKw: tier.minKw || 0,
          maxKw: tier.maxKw || 0,
          coefficient: tier.coefficient,
          perKwPrice: tier.perKwPrice || 0,
          minimumFee: tier.minimumFee,
          sortOrder: tier.sortOrder || 0,
        };
        
        // 如果是修改預設級距，先移除原有的
        let updatedTiers = tiers;
        if (isDefaultId) {
          updatedTiers = tiers.filter(t => t.id !== tier.id);
        }
        
        updatedTiers = [...updatedTiers, newTier];
        setTiers(updatedTiers);
        saveTiersToStorage(updatedTiers);
      }

      toast.success('已儲存級距');
    } catch (error) {
      console.error('Error saving tier:', error);
      toast.error('儲存失敗');
    }
  }, [tiers]);

  // 刪除級距
  const deleteTier = useCallback(async (tierId: string) => {
    try {
      const updatedTiers = tiers.filter(t => t.id !== tierId);
      setTiers(updatedTiers);
      saveTiersToStorage(updatedTiers);
      toast.success('已刪除級距');
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('刪除失敗');
    }
  }, [tiers]);

  // 重置為預設值
  const resetToDefaults = useCallback(() => {
    setTiers(defaultTiers);
    localStorage.removeItem(STORAGE_KEY);
    toast.success('已重置為預設級距');
  }, []);

  // 重新載入
  const reload = useCallback(() => {
    const stored = loadTiersFromStorage();
    setTiers(stored || defaultTiers);
  }, []);

  return {
    pricingTypes,
    tiers,
    isLoading,
    useDatabase,
    getTiersForType,
    calculatePrice,
    getStructuralDataPoints,
    getStructuralPer500kwFee,
    saveTier,
    deleteTier,
    resetToDefaults,
    reload,
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
