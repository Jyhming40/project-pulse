import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { QuoteParams, formatCurrency } from "@/lib/quoteCalculations";
import {
  useEngineeringTemplates,
  EngineeringCategory,
  ModuleItem,
  InverterItem,
  BillingContext,
  initializeFromTemplates,
  createDefaultModule,
  createDefaultInverter,
  generateId,
  calculateItemSubtotal,
  calculateModulePrice,
  calculateInverterPrice,
} from "@/hooks/useQuoteEngineering";
import { useTieredPricing } from "@/hooks/useTieredPricing";
import EngineeringCategoryCard from "./EngineeringCategoryCard";
import EquipmentModulesCard from "./EquipmentModulesCard";
import EquipmentInvertersCard from "./EquipmentInvertersCard";
import BudgetVsActualSheet from "./BudgetVsActualSheet";

interface CostTotals {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
}

interface QuoteCostCalculatorTabProps {
  quoteId: string;
  formData: Partial<QuoteParams>;
  setFormData: (data: Partial<QuoteParams>) => void;
  onCostChange?: (costs: CostTotals) => void;
  // Lifted state for modules and inverters
  modules: ModuleItem[];
  setModules: (modules: ModuleItem[]) => void;
  inverters: InverterItem[];
  setInverters: (inverters: InverterItem[]) => void;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  // Lifted state for engineering categories
  categories: EngineeringCategory[];
  setCategories: (categories: EngineeringCategory[]) => void;
  // Control whether to initialize from templates
  skipTemplateInit?: boolean;
}

export default function QuoteCostCalculatorTab({
  quoteId,
  formData,
  setFormData,
  onCostChange,
  modules,
  setModules,
  inverters,
  setInverters,
  exchangeRate,
  setExchangeRate,
  categories,
  setCategories,
  skipTemplateInit = false,
}: QuoteCostCalculatorTabProps) {
  const { templates, loading } = useEngineeringTemplates();
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // 使用自訂階梯定價 hook，確保計算一致性
  const { calculatePrice } = useTieredPricing();

  // 從範本初始化 - 只在新增模式且尚未初始化時執行
  useEffect(() => {
    if (!loading && templates.length > 0 && categories.length === 0 && !skipTemplateInit && !hasInitialized) {
      setCategories(initializeFromTemplates(templates));
      setHasInitialized(true);
    }
  }, [templates, loading, categories.length, skipTemplateInit, hasInitialized]);

  // 計算各項總計
  const { totals, overheadBreakdown, projectExpenseBreakdown } = useMemo(() => {
    const capacityKwp = formData.capacityKwp || 0;
    const pricePerKwp = formData.pricePerKwp || 0;
    const taxRate = formData.taxRate || 0.05;
    
    // 建立計費上下文（包含自訂階梯定價計算器，確保一致性）
    const billingContext: BillingContext = {
      capacityKwp,
      pricePerKwp,
      taxRate,
      tieredPriceCalculator: calculatePrice,
    };
    
    // 工程項目總計 & 費用分類
    let engineeringTotal = 0;
    let stampDuty = 0;
    let corpTax = 0;
    let brokerage = 0;
    let maintenanceReserve = 0;
    
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const subtotal = calculateItemSubtotal(item, capacityKwp, billingContext);
        engineeringTotal += subtotal;
        
        // 識別公司管銷項目
        if (item.billingMethod === 'stamp_duty') {
          stampDuty += subtotal;
        } else if (item.billingMethod === 'corp_tax') {
          corpTax += subtotal;
        } else if (item.billingMethod === 'brokerage') {
          // 仲介費/開發費
          brokerage += subtotal;
        }
        
        // 識別維運準備金 (透過項目名稱包含關鍵字)
        const itemNameLower = item.itemName.toLowerCase();
        if (itemNameLower.includes('維運') || 
            itemNameLower.includes('準備金') || 
            itemNameLower.includes('維護') ||
            itemNameLower.includes('maintenance')) {
          maintenanceReserve += subtotal;
        }
      });
    });

    // 模組總計 - 使用每個模組自身的匯率，不覆蓋
    const modulesTotal = modules.reduce((sum, m) => {
      return sum + calculateModulePrice(m);
    }, 0);

    // 逆變器總計
    const invertersTotal = inverters.reduce((sum, inv) => {
      return sum + calculateInverterPrice(inv);
    }, 0);

    return { 
      totals: { engineeringTotal, modulesTotal, invertersTotal },
      overheadBreakdown: { stampDuty, corpTax },
      projectExpenseBreakdown: { brokerage, maintenanceReserve },
    };
  }, [categories, modules, inverters, exchangeRate, formData.capacityKwp, formData.pricePerKwp, formData.taxRate, calculatePrice]);

  // Notify parent of cost changes
  useEffect(() => {
    onCostChange?.(totals);
  }, [totals, onCostChange]);

  // 更新類別
  const handleUpdateCategory = (index: number, category: EngineeringCategory) => {
    const newCategories = [...categories];
    newCategories[index] = category;
    setCategories(newCategories);
  };

  // 刪除類別
  const handleDeleteCategory = (index: number) => {
    const newCategories = categories.filter((_, i) => i !== index);
    setCategories(newCategories);
    toast.success("已刪除工程項目分類");
  };

  // 新增類別
  const handleAddCategory = () => {
    const newCategory: EngineeringCategory = {
      categoryCode: `CUSTOM_${Date.now()}`,
      categoryName: "新分類",
      items: [],
    };
    setCategories([...categories, newCategory]);
  };

  // 重設為預設值
  const handleReset = () => {
    if (templates.length > 0) {
      setCategories(initializeFromTemplates(templates));
      setModules([createDefaultModule()]);
      setInverters([createDefaultInverter()]);
      setExchangeRate(30);
      toast.success("已重設為預設值");
    }
  };

  // 計算報價金額
  const sellingPrice = (formData.capacityKwp || 0) * (formData.pricePerKwp || 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 右側抽屜式成本摘要 (預算 vs 實際) */}
      <BudgetVsActualSheet
        quoteId={quoteId}
        engineeringTotal={totals.engineeringTotal}
        modulesTotal={totals.modulesTotal}
        invertersTotal={totals.invertersTotal}
        sellingPrice={sellingPrice}
        taxRate={formData.taxRate}
        overheadBreakdown={overheadBreakdown}
        projectExpenseBreakdown={projectExpenseBreakdown}
      />

      {/* 動作列 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">工程成本明細</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAddCategory}>
            <FolderPlus className="h-4 w-4 mr-1.5" />
            新增分類
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            重設為預設
          </Button>
        </div>
      </div>

      {/* 主要設備：模組 */}
      <EquipmentModulesCard
        modules={modules}
        onUpdate={setModules}
        exchangeRate={exchangeRate}
        onExchangeRateChange={setExchangeRate}
      />

      {/* 主要設備：逆變器 */}
      <EquipmentInvertersCard
        inverters={inverters}
        onUpdate={setInverters}
      />

      {/* 工程項目分類 */}
      {categories.map((category, index) => (
        <EngineeringCategoryCard
          key={category.categoryCode}
          category={category}
          onUpdate={(cat) => handleUpdateCategory(index, cat)}
          onDelete={() => handleDeleteCategory(index)}
          capacityKwp={formData.capacityKwp}
          pricePerKwp={formData.pricePerKwp}
          taxRate={formData.taxRate}
        />
      ))}

      {categories.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm mb-4">尚無工程項目分類</p>
          <Button onClick={handleAddCategory}>
            <Plus className="h-4 w-4 mr-1.5" />
            新增第一個分類
          </Button>
        </div>
      )}
    </div>
  );
}
