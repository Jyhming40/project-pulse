/**
 * 階梯式定價計算工具
 * Tiered Pricing Calculation Utilities
 */

export interface PricingTier {
  minKw: number;
  maxKw: number;
  coefficient?: number; // 係數 (如 133%, 100%, 89%...)
  perKwPrice: number; // 每 kW 單價
  minimumFee?: number; // 最低收費
}

// 結構技師/電機技師 開價級距
export const structuralEngineerTiers: PricingTier[] = [
  { minKw: 1, maxKw: 19, coefficient: undefined, perKwPrice: 30000, minimumFee: 30000 },
  { minKw: 20, maxKw: 49, coefficient: 1.33, perKwPrice: 1200 },
  { minKw: 50, maxKw: 99, coefficient: 1.00, perKwPrice: 900 },
  { minKw: 100, maxKw: 199, coefficient: 0.89, perKwPrice: 800 },
  { minKw: 200, maxKw: 299, coefficient: 0.78, perKwPrice: 700 },
  { minKw: 300, maxKw: 399, coefficient: 0.67, perKwPrice: 600 },
  { minKw: 400, maxKw: 499, coefficient: 0.61, perKwPrice: 550 },
  { minKw: 500, maxKw: 799, coefficient: undefined, perKwPrice: 500 },
  { minKw: 800, maxKw: 1099, coefficient: undefined, perKwPrice: 480 },
  { minKw: 1100, maxKw: 1399, coefficient: undefined, perKwPrice: 440 },
  { minKw: 1400, maxKw: 1699, coefficient: undefined, perKwPrice: 400 },
  { minKw: 1700, maxKw: 1999, coefficient: undefined, perKwPrice: 300 },
  { minKw: 2000, maxKw: Infinity, coefficient: undefined, perKwPrice: 300 },
];

// 明群環能級距
export const environmentalTiers: PricingTier[] = [
  { minKw: 1, maxKw: 49, coefficient: 1.90, perKwPrice: 400, minimumFee: 10000 },
  { minKw: 50, maxKw: 99, coefficient: 1.19, perKwPrice: 250 },
  { minKw: 100, maxKw: 199, coefficient: 1.00, perKwPrice: 210 },
  { minKw: 200, maxKw: 499, coefficient: 0.83, perKwPrice: 175 },
  { minKw: 500, maxKw: 799, coefficient: 0.57, perKwPrice: 120 },
  { minKw: 800, maxKw: 999, coefficient: 0.48, perKwPrice: 100 },
  { minKw: 1000, maxKw: 1199, coefficient: 0.43, perKwPrice: 90 },
  { minKw: 1300, maxKw: 1499, coefficient: 0.38, perKwPrice: 80 },
  { minKw: 1500, maxKw: 1699, coefficient: 0.33, perKwPrice: 70 },
  { minKw: 1800, maxKw: Infinity, coefficient: 0.33, perKwPrice: 70 },
];

// 定價類型
export type TieredPricingType = 
  | 'structural_engineer'  // 結構技師/電機技師
  | 'environmental'        // 明群環能
  | 'none';                // 無階梯定價

/**
 * 根據容量取得對應的定價級距
 */
export function getTierForCapacity(
  capacityKw: number,
  tiers: PricingTier[]
): PricingTier | null {
  return tiers.find(
    (tier) => capacityKw >= tier.minKw && capacityKw <= tier.maxKw
  ) || null;
}

/**
 * 計算階梯式定價的總金額
 */
export function calculateTieredPrice(
  capacityKw: number,
  pricingType: TieredPricingType
): { total: number; perKwPrice: number; tier: PricingTier | null } {
  if (pricingType === 'none' || capacityKw <= 0) {
    return { total: 0, perKwPrice: 0, tier: null };
  }

  const tiers = pricingType === 'structural_engineer' 
    ? structuralEngineerTiers 
    : environmentalTiers;

  const tier = getTierForCapacity(capacityKw, tiers);
  
  if (!tier) {
    return { total: 0, perKwPrice: 0, tier: null };
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
    tier,
  };
}

/**
 * 取得定價類型的顯示名稱
 */
export function getTieredPricingLabel(type: TieredPricingType): string {
  switch (type) {
    case 'structural_engineer':
      return '結構/電機技師級距';
    case 'environmental':
      return '明群環能級距';
    default:
      return '無';
  }
}
