/**
 * 階梯式定價計算工具
 * Tiered Pricing Calculation Utilities
 * 
 * 支援三種獨立的定價類型：
 * 1. 結構技師 - 使用內插法計算
 * 2. 電機技師 - 標準階梯定價
 * 3. 明群環能 - 標準階梯定價
 */

export interface PricingTier {
  minKw: number;
  maxKw: number;
  coefficient?: number; // 係數 (如 133%, 100%, 89%...)
  perKwPrice: number; // 每 kW 單價
  minimumFee?: number; // 最低收費
}

/**
 * 結構技師定價資料點 (用於內插法)
 * 根據圖表：
 * - <10kW: 固定 $8,000
 * - 10-499kW: 內插法計算
 * - ≥500kW: 每500kW=$23,000 + 餘數另計
 */
export interface StructuralDataPoint {
  kw: number;
  price: number;
}

// 結構技師內插法資料點
export const structuralEngineerDataPoints: StructuralDataPoint[] = [
  { kw: 10, price: 8000 },
  { kw: 100, price: 12000 },
  { kw: 200, price: 16500 },
  { kw: 300, price: 21000 },
  { kw: 400, price: 25500 },
  { kw: 499, price: 30000 },
];

// 結構技師每500kW的費用 (用於 ≥500kW 計算)
export const STRUCTURAL_PER_500KW_FEE = 23000;

// 電機技師級距
export const electricalEngineerTiers: PricingTier[] = [
  { minKw: 1, maxKw: 99, perKwPrice: 0, minimumFee: 7000 }, // 固定費用
  { minKw: 100, maxKw: 149, coefficient: 1.00, perKwPrice: 570 },
  { minKw: 150, maxKw: 199, coefficient: 0.66, perKwPrice: 375 },
  { minKw: 200, maxKw: 299, coefficient: 0.54, perKwPrice: 310 },
  { minKw: 300, maxKw: 499, coefficient: 0.44, perKwPrice: 250 },
  { minKw: 500, maxKw: 799, coefficient: 0.35, perKwPrice: 200 },
  { minKw: 800, maxKw: Infinity, coefficient: 0.35, perKwPrice: 200 },
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
  | 'structural_engineer'  // 結構技師 (內插法)
  | 'electrical_engineer'  // 電機技師 (標準階梯)
  | 'environmental'        // 明群環能 (標準階梯)
  | 'none';                // 無階梯定價

/**
 * 結構技師內插法計算
 * 根據兩個相鄰資料點進行線性內插
 */
function interpolateStructuralPrice(capacityKw: number): number {
  // <10kW: 固定 $8,000
  if (capacityKw < 10) {
    return 8000;
  }
  
  // ≥500kW: 每500kW=$23,000 + 餘數另計
  if (capacityKw >= 500) {
    const blocks = Math.floor(capacityKw / 500);
    const remainder = capacityKw % 500;
    
    // 每個 500kW 區塊 = $23,000
    let total = blocks * STRUCTURAL_PER_500KW_FEE;
    
    // 餘數使用內插法計算 (如果有餘數的話)
    if (remainder > 0) {
      total += interpolateStructuralPrice(remainder);
    }
    
    return total;
  }
  
  // 10-499kW: 使用內插法
  const dataPoints = structuralEngineerDataPoints;
  
  // 找到包含此容量的兩個相鄰資料點
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const p1 = dataPoints[i];
    const p2 = dataPoints[i + 1];
    
    if (capacityKw >= p1.kw && capacityKw <= p2.kw) {
      // 線性內插公式: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
      const interpolatedPrice = p1.price + 
        (capacityKw - p1.kw) * (p2.price - p1.price) / (p2.kw - p1.kw);
      
      // 四捨五入到整數
      return Math.round(interpolatedPrice);
    }
  }
  
  // 如果超出範圍，使用最後一個資料點的價格
  return dataPoints[dataPoints.length - 1].price;
}

/**
 * 根據容量取得對應的定價級距 (用於標準階梯定價)
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
 * 計算標準階梯式定價的總金額
 */
function calculateStandardTieredPrice(
  capacityKw: number,
  tiers: PricingTier[]
): { total: number; perKwPrice: number; tier: PricingTier | null } {
  if (capacityKw <= 0) {
    return { total: 0, perKwPrice: 0, tier: null };
  }

  const tier = getTierForCapacity(capacityKw, tiers);
  
  if (!tier) {
    return { total: 0, perKwPrice: 0, tier: null };
  }

  // 如果 perKwPrice 為 0 且有 minimumFee，表示這是固定費用
  if (tier.perKwPrice === 0 && tier.minimumFee) {
    return {
      total: tier.minimumFee,
      perKwPrice: 0,
      tier,
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
    tier,
  };
}

/**
 * 計算階梯式定價的總金額 (主要入口)
 */
export function calculateTieredPrice(
  capacityKw: number,
  pricingType: TieredPricingType
): { total: number; perKwPrice: number; tier: PricingTier | null } {
  if (pricingType === 'none' || capacityKw <= 0) {
    return { total: 0, perKwPrice: 0, tier: null };
  }

  switch (pricingType) {
    case 'structural_engineer': {
      // 結構技師使用內插法
      const total = interpolateStructuralPrice(capacityKw);
      const perKwPrice = capacityKw > 0 ? Math.round(total / capacityKw) : 0;
      return {
        total,
        perKwPrice,
        tier: null, // 內插法無對應的單一級距
      };
    }
    
    case 'electrical_engineer':
      return calculateStandardTieredPrice(capacityKw, electricalEngineerTiers);
    
    case 'environmental':
      return calculateStandardTieredPrice(capacityKw, environmentalTiers);
    
    default:
      return { total: 0, perKwPrice: 0, tier: null };
  }
}

/**
 * 取得定價類型的顯示名稱
 */
export function getTieredPricingLabel(type: TieredPricingType): string {
  switch (type) {
    case 'structural_engineer':
      return '結構技師';
    case 'electrical_engineer':
      return '電機技師';
    case 'environmental':
      return '明群環能';
    default:
      return '無';
  }
}

/**
 * 取得所有可用的定價類型選項
 */
export function getTieredPricingOptions(): { value: TieredPricingType; label: string }[] {
  return [
    { value: 'structural_engineer', label: '結構技師' },
    { value: 'electrical_engineer', label: '電機技師' },
    { value: 'environmental', label: '明群環能' },
  ];
}

/**
 * 取得定價類型的計算方式說明
 */
export function getTieredPricingDescription(type: TieredPricingType): string {
  switch (type) {
    case 'structural_engineer':
      return '內插法計算，<10kW固定$8,000，≥500kW按每500kW=$23,000+餘數';
    case 'electrical_engineer':
      return '1-99kW固定$7,000，100kW以上按階梯單價計算';
    case 'environmental':
      return '標準階梯定價，1-49kW最低$10,000';
    default:
      return '';
  }
}
