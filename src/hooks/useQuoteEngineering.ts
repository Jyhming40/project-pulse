import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TieredPricingType, calculateTieredPrice } from "@/lib/tieredPricing";

export interface EngineeringCategory {
  categoryCode: string;
  categoryName: string;
  items: EngineeringItem[];
}

// 計費方式
export type BillingMethod = 
  | 'per_kw'      // 每 kW 計價 (單價 × 裝置容量)
  | 'per_unit'    // 單位計價 (單價 × 數量)
  | 'lump_sum'    // 一式計價 (固定金額)
  | 'tiered'      // 階梯式計價 (依容量級距)
  | 'stamp_duty'  // 印花稅 (含稅總價 × 0.001)
  | 'corp_tax'    // 營所稅 (含稅總價 × 0.02)
  | 'brokerage';  // 仲介費 (每kW含稅價格 × 容量 × 自訂百分比)

export interface EngineeringItem {
  id: string;
  categoryCode: string;
  categoryName: string;
  itemCode?: string;
  itemName: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  billingMethod: BillingMethod;
  tieredPricingType?: TieredPricingType; // 階梯定價類型
  lumpSumAmount?: number;
  brokerageRate?: number; // 仲介費百分比
  subtotal: number;
  sortOrder: number;
  note?: string;
  // Legacy support
  isLumpSum?: boolean;
}

export interface ModuleItem {
  id: string;
  moduleModel?: string;
  wattagePerPanel: number;
  panelCount: number;
  pricePerWattUsd: number;
  exchangeRate: number;
  priceNtd: number;
  note?: string;
  sortOrder: number;
}

export interface InverterItem {
  id: string;
  inverterModel?: string;
  capacityKw: number;
  inverterCount: number;
  pricePerUnitNtd: number;
  totalPriceNtd: number;
  note?: string;
  sortOrder: number;
}

// 從資料庫載入工程項目範本
export function useEngineeringTemplates() {
  const [templates, setTemplates] = useState<EngineeringCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        // 使用 rpc 或原生查詢來避免 TypeScript 類型問題
        const { data, error } = await supabase
          .from("quote_engineering_templates" as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order");

        if (error) throw error;

        // 將 templates 分組為 categories
        const categoryMap = new Map<string, EngineeringCategory>();
        
        (data as any[] || []).forEach((item: any) => {
          const key = item.category_code;
          if (!categoryMap.has(key)) {
            categoryMap.set(key, {
              categoryCode: item.category_code,
              categoryName: item.category_name,
              items: [],
            });
          }
          
          categoryMap.get(key)!.items.push({
            id: item.id,
            categoryCode: item.category_code,
            categoryName: item.category_name,
            itemCode: item.item_code,
            itemName: item.item_name,
            unitPrice: item.default_unit_price || 0,
            unit: item.default_unit || "式",
            quantity: item.default_quantity || 1,
            billingMethod: item.billing_method || (item.is_lump_sum ? 'lump_sum' : 'per_kw'),
            tieredPricingType: item.tiered_pricing_type || 'none',
            isLumpSum: item.is_lump_sum || false,
            subtotal: 0,
            sortOrder: item.sort_order || 0,
          });
        });

        setTemplates(Array.from(categoryMap.values()));
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast.error("無法載入工程項目範本");
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  return { templates, loading };
}

// 計費方式上下文 - 用於自動計算的項目
export interface BillingContext {
  capacityKwp: number;
  pricePerKwp: number;
  taxRate: number;
  // 自訂階梯定價計算函數（可選，若提供則使用此函數而非預設）
  tieredPriceCalculator?: (capacityKw: number, typeCode: string) => { total: number; perKwPrice: number };
}

// 計算小計 (需要傳入 context 以支援各種計費方式)
export function calculateItemSubtotal(
  item: EngineeringItem, 
  capacityKwp: number = 0,
  context?: BillingContext
): number {
  // Legacy support for isLumpSum
  const method = item.billingMethod || (item.isLumpSum ? 'lump_sum' : 'per_unit');
  
  // 取得完整上下文
  const ctx = context || { capacityKwp, pricePerKwp: 0, taxRate: 0.05 };
  
  // 計算含稅總價
  const totalPriceWithTax = ctx.capacityKwp * ctx.pricePerKwp * (1 + ctx.taxRate);
  // 計算每kW含稅價格
  const pricePerKwpWithTax = ctx.pricePerKwp * (1 + ctx.taxRate);
  
  switch (method) {
    case 'per_kw':
      // 每 kW 計價：單價 × 裝置容量
      return item.unitPrice * capacityKwp;
    
    case 'tiered':
      // 階梯式計價：依容量級距計算
      if (item.tieredPricingType && item.tieredPricingType !== 'none') {
        // 優先使用自訂計算器（來自 localStorage 的設定）
        if (ctx.tieredPriceCalculator) {
          const result = ctx.tieredPriceCalculator(capacityKwp, item.tieredPricingType);
          return result.total;
        }
        // 退回到預設的硬編碼計算
        const result = calculateTieredPrice(capacityKwp, item.tieredPricingType);
        return result.total;
      }
      return 0;
    
    case 'lump_sum':
      // 一式計價：固定金額
      return item.lumpSumAmount || 0;
    
    case 'stamp_duty':
      // 印花稅：含稅總價 × 0.001 (千分之一)
      return totalPriceWithTax * 0.001;
    
    case 'corp_tax':
      // 營所稅：含稅總價 × 0.02 (2%)
      return totalPriceWithTax * 0.02;
    
    case 'brokerage':
      // 仲介費：每kW仲介費 × 容量 = 小計，再加上 小計 × 百分比
      // unitPrice = 每kW仲介費, brokerageRate = 加成百分比
      const brokerageSubtotal = item.unitPrice * capacityKwp;
      const brokerageBonus = brokerageSubtotal * ((item.brokerageRate || 0) / 100);
      return brokerageSubtotal + brokerageBonus;
    
    case 'per_unit':
    default:
      // 單位計價：單價 × 數量
      return item.unitPrice * item.quantity;
  }
}

// 計算模組價格
export function calculateModulePrice(item: ModuleItem): number {
  return item.wattagePerPanel * item.panelCount * item.pricePerWattUsd * item.exchangeRate;
}

// 計算逆變器價格
export function calculateInverterPrice(item: InverterItem): number {
  return item.inverterCount * item.pricePerUnitNtd;
}

// 產生唯一 ID
export function generateId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 從範本初始化工程項目
export function initializeFromTemplates(templates: EngineeringCategory[]): EngineeringCategory[] {
  return templates.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      id: generateId(),
      subtotal: calculateItemSubtotal(item),
    })),
  }));
}

// 初始化預設模組
export function createDefaultModule(): ModuleItem {
  return {
    id: generateId(),
    moduleModel: "",
    wattagePerPanel: 495,
    panelCount: 20,
    pricePerWattUsd: 0.22,
    exchangeRate: 30,
    priceNtd: 0,
    sortOrder: 0,
  };
}

// 初始化預設逆變器
export function createDefaultInverter(): InverterItem {
  return {
    id: generateId(),
    inverterModel: "",
    capacityKw: 5,
    inverterCount: 1,
    pricePerUnitNtd: 30000,
    totalPriceNtd: 0,
    sortOrder: 0,
  };
}
