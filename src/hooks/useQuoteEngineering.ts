import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EngineeringCategory {
  categoryCode: string;
  categoryName: string;
  items: EngineeringItem[];
}

export interface EngineeringItem {
  id: string;
  categoryCode: string;
  categoryName: string;
  itemCode?: string;
  itemName: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  isLumpSum: boolean;
  lumpSumAmount?: number;
  subtotal: number;
  sortOrder: number;
  note?: string;
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

// 計算小計
export function calculateItemSubtotal(item: EngineeringItem): number {
  if (item.isLumpSum) {
    return item.lumpSumAmount || 0;
  }
  return item.unitPrice * item.quantity;
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
