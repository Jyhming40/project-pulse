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
  initializeFromTemplates,
  createDefaultModule,
  createDefaultInverter,
  generateId,
  calculateItemSubtotal,
  calculateModulePrice,
  calculateInverterPrice,
} from "@/hooks/useQuoteEngineering";
import EngineeringCategoryCard from "./EngineeringCategoryCard";
import EquipmentModulesCard from "./EquipmentModulesCard";
import EquipmentInvertersCard from "./EquipmentInvertersCard";
import QuoteCostSummaryCard from "./QuoteCostSummaryCard";

interface QuoteCostCalculatorTabProps {
  formData: Partial<QuoteParams>;
  setFormData: (data: Partial<QuoteParams>) => void;
}

export default function QuoteCostCalculatorTab({
  formData,
  setFormData,
}: QuoteCostCalculatorTabProps) {
  const { templates, loading } = useEngineeringTemplates();
  
  // 工程項目分類
  const [categories, setCategories] = useState<EngineeringCategory[]>([]);
  
  // 設備資料
  const [modules, setModules] = useState<ModuleItem[]>([createDefaultModule()]);
  const [inverters, setInverters] = useState<InverterItem[]>([createDefaultInverter()]);
  const [exchangeRate, setExchangeRate] = useState(30);

  // 從範本初始化
  useEffect(() => {
    if (!loading && templates.length > 0 && categories.length === 0) {
      setCategories(initializeFromTemplates(templates));
    }
  }, [templates, loading, categories.length]);

  // 計算各項總計
  const totals = useMemo(() => {
    const capacityKwp = formData.capacityKwp || 0;
    
    // 工程項目總計
    const engineeringTotal = categories.reduce((sum, cat) => {
      return sum + cat.items.reduce((itemSum, item) => {
        return itemSum + calculateItemSubtotal(item, capacityKwp);
      }, 0);
    }, 0);

    // 模組總計
    const modulesTotal = modules.reduce((sum, m) => {
      return sum + calculateModulePrice({ ...m, exchangeRate });
    }, 0);

    // 逆變器總計
    const invertersTotal = inverters.reduce((sum, inv) => {
      return sum + calculateInverterPrice(inv);
    }, 0);

    return { engineeringTotal, modulesTotal, invertersTotal };
  }, [categories, modules, inverters, exchangeRate, formData.capacityKwp]);

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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* 左側：項目明細 */}
      <div className="lg:col-span-3 space-y-4">
        {/* 動作列 */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">工程成本明細</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAddCategory}>
              <FolderPlus className="h-4 w-4 mr-1" />
              新增分類
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
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
          />
        ))}

        {categories.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <p className="mb-4">尚無工程項目分類</p>
            <Button onClick={handleAddCategory}>
              <Plus className="h-4 w-4 mr-1" />
              新增第一個分類
            </Button>
          </div>
        )}
      </div>

      {/* 右側：成本摘要 */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          <QuoteCostSummaryCard
            engineeringTotal={totals.engineeringTotal}
            modulesTotal={totals.modulesTotal}
            invertersTotal={totals.invertersTotal}
            sellingPrice={sellingPrice}
            taxRate={formData.taxRate}
          />
        </div>
      </div>
    </div>
  );
}
