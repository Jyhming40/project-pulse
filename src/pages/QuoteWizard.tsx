import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
  Calculator, 
  TrendingUp, 
  Calendar,
  Check,
  Save,
  X,
  FileOutput,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import QuoteBasicInfoTab from "@/components/quotes/QuoteBasicInfoTab";
import QuoteCostCalculatorTab from "@/components/quotes/QuoteCostCalculatorTab";
import QuoteFinancialAnalysisTab from "@/components/quotes/QuoteFinancialAnalysisTab";
import QuoteScheduleTab from "@/components/quotes/QuoteScheduleTab";
// Quote document generation removed - to be reimplemented
import { calculate20YearProjection, QuoteParams } from "@/lib/quoteCalculations";
import { 
  ModuleItem, 
  InverterItem, 
  EngineeringCategory,
  EngineeringItem,
  BillingContext,
  createDefaultModule, 
  createDefaultInverter,
  generateId,
  calculateItemSubtotal,
  calculateModulePrice,
  calculateInverterPrice,
} from "@/hooks/useQuoteEngineering";

const STEPS = [
  { id: "basic", label: "基本資訊", icon: FileText, description: "案場與投資方" },
  { id: "cost", label: "成本報價", icon: Calculator, description: "設備與工程費用" },
  { id: "financial", label: "投資分析", icon: TrendingUp, description: "IRR 與現金流" },
  { id: "schedule", label: "工程時程", icon: Calendar, description: "施工排程規劃" },
];

interface CostTotals {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
}

export default function QuoteWizard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<Partial<QuoteParams>>({
    capacityKwp: 100,
    panelWattage: 590,
    panelCount: 170,
    inverterCapacityKw: 50,
    inverterCount: 2,
    pricePerKwp: 45000,
    taxRate: 0.05,
    tariffRate: 4.5,
    highEfficiencyBonus: 0.06,
    sunshineHours: 3.2,
    annualDegradationRate: 0.01,
    loanPercentage: 70,
    loanInterestRate: 0.0245,
    loanTermMonths: 180,
    insuranceRate: 0.0055,
    maintenanceRate6To10: 6,
    maintenanceRate11To15: 7,
    maintenanceRate16To20: 8,
    rentRate: 8,
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [investorId, setInvestorId] = useState<string | null>(null);
  const [costTotals, setCostTotals] = useState<CostTotals>({
    engineeringTotal: 0,
    modulesTotal: 0,
    invertersTotal: 0,
  });
  const [brokerageRate, setBrokerageRate] = useState(0);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  // Modules, inverters, and engineering categories state - lifted from QuoteCostCalculatorTab
  const [modules, setModules] = useState<ModuleItem[]>([createDefaultModule()]);
  const [inverters, setInverters] = useState<InverterItem[]>([createDefaultInverter()]);
  const [categories, setCategories] = useState<EngineeringCategory[]>([]);
  const [exchangeRate, setExchangeRate] = useState(30);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch existing quote if editing
  const { data: existingQuote, isLoading: isLoadingQuote } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("project_quotes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch existing modules
  const { data: existingModules } = useQuery({
    queryKey: ["quote-modules", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("quote_modules")
        .select("*")
        .eq("quote_id", id)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch existing inverters
  const { data: existingInverters } = useQuery({
    queryKey: ["quote-inverters", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("quote_inverters")
        .select("*")
        .eq("quote_id", id)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch existing engineering items
  const { data: existingEngineeringItems, isFetched: isEngineeringFetched } = useQuery({
    queryKey: ["quote-engineering-items", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("quote_engineering_items" as any)
        .select("*")
        .eq("quote_id", id)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Load existing data into form
  useEffect(() => {
    if (existingQuote) {
      setFormData({
        capacityKwp: existingQuote.capacity_kwp,
        panelWattage: existingQuote.panel_wattage ?? 590,
        panelCount: existingQuote.panel_count ?? 170,
        inverterCapacityKw: Number(existingQuote.inverter_capacity_kw) ?? 50,
        inverterCount: existingQuote.inverter_count ?? 2,
        pricePerKwp: Number(existingQuote.price_per_kwp) ?? 45000,
        taxRate: Number(existingQuote.tax_rate) ?? 0.05,
        tariffRate: Number(existingQuote.tariff_rate) ?? 4.5,
        highEfficiencyBonus: Number(existingQuote.high_efficiency_bonus) ?? 0.06,
        sunshineHours: Number(existingQuote.sunshine_hours) ?? 3.2,
        annualDegradationRate: Number(existingQuote.annual_degradation_rate) ?? 0.01,
        loanPercentage: Number(existingQuote.loan_percentage) ?? 70,
        loanInterestRate: Number(existingQuote.loan_interest_rate) ?? 0.0245,
        loanTermMonths: existingQuote.loan_term_months ?? 180,
        insuranceRate: Number(existingQuote.insurance_rate) ?? 0.0055,
        maintenanceRate6To10: Number(existingQuote.maintenance_rate_6_to_10) ?? 6,
        maintenanceRate11To15: Number(existingQuote.maintenance_rate_11_to_15) ?? 7,
        maintenanceRate16To20: Number(existingQuote.maintenance_rate_16_to_20) ?? 8,
        rentRate: Number(existingQuote.rent_rate) ?? 8,
      });
      setProjectId(existingQuote.project_id);
      setInvestorId(existingQuote.investor_id);
    }
  }, [existingQuote]);

  // Load existing modules into state
  useEffect(() => {
    if (existingModules && existingModules.length > 0 && !dataLoaded) {
      const mappedModules: ModuleItem[] = existingModules.map((m: any) => ({
        id: m.id,
        moduleModel: m.module_model || "",
        wattagePerPanel: m.wattage_per_panel,
        panelCount: m.panel_count,
        pricePerWattUsd: Number(m.price_per_watt_usd) || 0.22,
        exchangeRate: Number(m.exchange_rate) || 30,
        priceNtd: Number(m.price_ntd) || 0,
        sortOrder: m.sort_order || 0,
        note: m.note,
      }));
      setModules(mappedModules);
      if (mappedModules.length > 0 && mappedModules[0].exchangeRate) {
        setExchangeRate(mappedModules[0].exchangeRate);
      }
    }
  }, [existingModules, dataLoaded]);

  // Load existing inverters into state
  useEffect(() => {
    if (existingInverters && existingInverters.length > 0 && !dataLoaded) {
      const mappedInverters: InverterItem[] = existingInverters.map((inv: any) => ({
        id: inv.id,
        inverterModel: inv.inverter_model || "",
        capacityKw: Number(inv.capacity_kw),
        inverterCount: inv.inverter_count,
        pricePerUnitNtd: Number(inv.price_per_unit_ntd) || 30000,
        totalPriceNtd: Number(inv.total_price_ntd) || 0,
        sortOrder: inv.sort_order || 0,
        note: inv.note,
      }));
      setInverters(mappedInverters);
    }
  }, [existingInverters, dataLoaded]);

  // Load existing engineering items into categories
  useEffect(() => {
    // Wait for query to complete
    if (!isEngineeringFetched || dataLoaded) return;
    
    if (existingEngineeringItems && existingEngineeringItems.length > 0) {
      // Group items by category
      const categoryMap = new Map<string, EngineeringCategory>();
      
      (existingEngineeringItems as any[]).forEach((item: any) => {
        const key = item.category_code;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            categoryCode: item.category_code,
            categoryName: item.category_name,
            items: [],
          });
        }
        
        // 解析 item_code 以還原計費方式
        const itemCode = item.item_code || '';
        let billingMethod: string = 'per_kw'; // 預設值
        let brokerageRate: number | undefined;
        let tieredPricingType: string | undefined;
        
        // 檢查特殊計費方式 (格式: billing_method 或 billing_method:params)
        if (itemCode.startsWith('stamp_duty')) {
          billingMethod = 'stamp_duty';
        } else if (itemCode.startsWith('corp_tax')) {
          billingMethod = 'corp_tax';
        } else if (itemCode.startsWith('brokerage')) {
          billingMethod = 'brokerage';
          const parts = itemCode.split(':');
          if (parts.length > 1) {
            brokerageRate = parseFloat(parts[1]) || 0;
          }
        } else if (itemCode.startsWith('tiered')) {
          billingMethod = 'tiered';
          const parts = itemCode.split(':');
          if (parts.length > 1) {
            tieredPricingType = parts[1];
          }
        } else if (itemCode === 'per_unit') {
          billingMethod = 'per_unit';
        } else if (item.is_lump_sum) {
          billingMethod = 'lump_sum';
        } else {
          billingMethod = 'per_kw';
        }
        
        categoryMap.get(key)!.items.push({
          id: item.id,
          categoryCode: item.category_code,
          categoryName: item.category_name,
          itemCode: ['stamp_duty', 'corp_tax', 'brokerage', 'tiered', 'per_unit'].some(m => itemCode.startsWith(m)) 
            ? undefined 
            : item.item_code,
          itemName: item.item_name,
          unitPrice: Number(item.unit_price) || 0,
          unit: item.unit || "式",
          quantity: Number(item.quantity) || 1,
          billingMethod: billingMethod as any,
          tieredPricingType: tieredPricingType || item.tiered_pricing_type || undefined,
          lumpSumAmount: item.lump_sum_amount ? Number(item.lump_sum_amount) : undefined,
          brokerageRate,
          subtotal: Number(item.subtotal) || 0,
          sortOrder: item.sort_order || 0,
          note: item.note,
          isLumpSum: item.is_lump_sum || false,
        });
      });
      
      setCategories(Array.from(categoryMap.values()));
    }
    // Always set dataLoaded when fetch is complete (even if no items)
    setDataLoaded(true);
  }, [existingEngineeringItems, isEngineeringFetched, dataLoaded]);

  // Auto-calculate cost totals when data is loaded (for initial page load)
  useEffect(() => {
    if (!dataLoaded) return;
    
    const capacityKwp = formData.capacityKwp || 0;
    const pricePerKwp = formData.pricePerKwp || 0;
    const taxRate = formData.taxRate || 0.05;
    
    // Build billing context
    const billingContext: BillingContext = {
      capacityKwp,
      pricePerKwp,
      taxRate,
    };
    
    // Calculate engineering total
    const engineeringTotal = categories.reduce((sum, cat) => {
      return sum + cat.items.reduce((itemSum, item) => {
        return itemSum + calculateItemSubtotal(item, capacityKwp, billingContext);
      }, 0);
    }, 0);

    // Calculate modules total
    const modulesTotal = modules.reduce((sum, m) => {
      return sum + calculateModulePrice({ ...m, exchangeRate });
    }, 0);

    // Calculate inverters total
    const invertersTotal = inverters.reduce((sum, inv) => {
      return sum + calculateInverterPrice(inv);
    }, 0);

    setCostTotals({ engineeringTotal, modulesTotal, invertersTotal });
  }, [dataLoaded, modules, inverters, categories, exchangeRate, formData.capacityKwp, formData.pricePerKwp, formData.taxRate]);

  // Calculate projections
  const projections = formData.capacityKwp
    ? calculate20YearProjection(formData as QuoteParams)
    : null;

  // Generate quote number
  const generateQuoteNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `Q${year}${month}${day}-${random}`;
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const totalPriceWithTax = formData.capacityKwp && formData.pricePerKwp && formData.taxRate
        ? formData.capacityKwp * formData.pricePerKwp * (1 + formData.taxRate)
        : null;

      const quoteData = {
        project_id: projectId,
        investor_id: investorId,
        capacity_kwp: formData.capacityKwp,
        panel_wattage: formData.panelWattage,
        panel_count: formData.panelCount,
        inverter_capacity_kw: formData.inverterCapacityKw,
        inverter_count: formData.inverterCount,
        price_per_kwp: formData.pricePerKwp,
        tax_rate: formData.taxRate,
        total_price_with_tax: totalPriceWithTax,
        sunshine_hours: formData.sunshineHours,
        annual_degradation_rate: formData.annualDegradationRate,
        tariff_rate: formData.tariffRate,
        high_efficiency_bonus: formData.highEfficiencyBonus,
        loan_percentage: formData.loanPercentage,
        loan_interest_rate: formData.loanInterestRate,
        loan_term_months: formData.loanTermMonths,
        insurance_rate: formData.insuranceRate,
        maintenance_rate_6_to_10: formData.maintenanceRate6To10,
        maintenance_rate_11_to_15: formData.maintenanceRate11To15,
        maintenance_rate_16_to_20: formData.maintenanceRate16To20,
        rent_rate: formData.rentRate,
        irr_20_year: projections?.summary.irr20Year,
        payback_years: projections?.summary.paybackYears,
        net_profit_20_year: projections?.summary.netProfit20Year,
        roi_20_year: projections?.summary.totalRoi,
      };

      let quoteId = id;

      if (isEditing && id) {
        const { error } = await supabase
          .from("project_quotes")
          .update(quoteData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("project_quotes")
          .insert({
            ...quoteData,
            quote_number: generateQuoteNumber(),
            quote_status: "draft",
          })
          .select("id")
          .single();
        if (error) throw error;
        quoteId = data.id;
      }

      // Save modules - delete existing and insert new
      if (quoteId) {
        // Delete existing modules
        await supabase.from("quote_modules").delete().eq("quote_id", quoteId);
        
        // Insert new modules
        if (modules.length > 0) {
          const moduleData = modules.map((m, idx) => ({
            quote_id: quoteId,
            module_model: m.moduleModel || null,
            wattage_per_panel: m.wattagePerPanel,
            panel_count: m.panelCount,
            price_per_watt_usd: m.pricePerWattUsd,
            exchange_rate: exchangeRate,
            // price_ntd is a generated column, do not insert
            sort_order: idx,
            note: m.note || null,
          }));
          const { error: moduleError } = await supabase
            .from("quote_modules")
            .insert(moduleData);
          if (moduleError) {
            console.error("Error saving modules:", moduleError);
          }
        }

        // Delete existing inverters
        await supabase.from("quote_inverters").delete().eq("quote_id", quoteId);
        
        // Insert new inverters
        if (inverters.length > 0) {
          const inverterData = inverters.map((inv, idx) => ({
            quote_id: quoteId,
            inverter_model: inv.inverterModel || null,
            capacity_kw: inv.capacityKw,
            inverter_count: inv.inverterCount,
            price_per_unit_ntd: inv.pricePerUnitNtd,
            // total_price_ntd is a generated column, do not insert
            sort_order: idx,
            note: inv.note || null,
          }));
          const { error: inverterError } = await supabase
            .from("quote_inverters")
            .insert(inverterData);
          if (inverterError) {
            console.error("Error saving inverters:", inverterError);
          }
        }

        // Delete existing engineering items
        await supabase.from("quote_engineering_items" as any).delete().eq("quote_id", quoteId);
        
        // Insert new engineering items
        const allItems: any[] = [];
        let globalSortOrder = 0;
        
        console.log("Saving engineering items, categories:", categories.length);
        
        categories.forEach((category) => {
          console.log(`Category: ${category.categoryName}, items: ${category.items.length}`);
          category.items.forEach((item) => {
            // 將新計費方式映射為資料庫可支援的格式
            // stamp_duty, corp_tax, brokerage 等自動計算項目使用 is_lump_sum = false
            // 並通過 item_code 來區分計費方式
            const billingMethod = item.billingMethod || 'per_kw';
            const isAutoCalc = ['stamp_duty', 'corp_tax', 'brokerage'].includes(billingMethod);
            
            allItems.push({
              quote_id: quoteId,
              category_code: category.categoryCode,
              category_name: category.categoryName,
              // 使用 item_code 儲存計費方式識別碼
              item_code: isAutoCalc || billingMethod === 'tiered' 
                ? `${billingMethod}${item.brokerageRate ? `:${item.brokerageRate}` : ''}${item.tieredPricingType ? `:${item.tieredPricingType}` : ''}`
                : (billingMethod === 'per_unit' ? 'per_unit' : (item.itemCode || null)),
              item_name: item.itemName,
              unit_price: item.unitPrice,
              unit: item.unit || "式",
              quantity: item.quantity,
              is_lump_sum: billingMethod === 'lump_sum',
              lump_sum_amount: item.lumpSumAmount || null,
              sort_order: globalSortOrder++,
              note: item.note || null,
            });
          });
        });
        
        console.log("Total engineering items to save:", allItems.length);
        
        if (allItems.length > 0) {
          const { error: engineeringError } = await supabase
            .from("quote_engineering_items" as any)
            .insert(allItems);
          if (engineeringError) {
            console.error("Error saving engineering items:", engineeringError);
          } else {
            console.log("Engineering items saved successfully");
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote-modules"] });
      queryClient.invalidateQueries({ queryKey: ["quote-inverters"] });
      queryClient.invalidateQueries({ queryKey: ["quote-engineering-items"] });
      toast.success(isEditing ? "報價已更新" : "報價已建立");
      navigate("/quotes");
    },
    onError: (error) => {
      console.error("Save error:", error);
      toast.error("儲存失敗");
    },
  });

  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const isSaving = saveMutation.isPending;

  const handleCancel = () => {
    navigate("/quotes");
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case "basic":
        return (
          <QuoteBasicInfoTab
            formData={formData}
            setFormData={setFormData}
            projectId={projectId}
            setProjectId={setProjectId}
            investorId={investorId}
            setInvestorId={setInvestorId}
            onSave={handleSave}
            isSaving={isSaving}
            costs={costTotals}
            brokerageRate={brokerageRate}
            onBrokerageRateChange={setBrokerageRate}
          />
        );
      case "cost":
        return (
          <QuoteCostCalculatorTab
            formData={formData}
            setFormData={setFormData}
            onCostChange={setCostTotals}
            modules={modules}
            setModules={setModules}
            inverters={inverters}
            setInverters={setInverters}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            categories={categories}
            setCategories={setCategories}
            skipTemplateInit={isEditing && !dataLoaded}
          />
        );
      case "financial":
        return (
          <QuoteFinancialAnalysisTab
            formData={formData as QuoteParams}
            projections={projections}
          />
        );
      case "schedule":
        return <QuoteScheduleTab quoteId={id || null} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header with steps */}
      <div className="border-b bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          {/* Title row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  {isEditing ? "編輯報價" : "新增報價"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {STEPS[currentStep].description}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing && id && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowDocumentDialog(true)}
                >
                  <FileOutput className="h-4 w-4 mr-2" />
                  產出報價單
                </Button>
              )}
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "儲存中..." : "儲存報價"}
              </Button>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors flex-1",
                    isCurrent && "bg-primary/10",
                    !isCurrent && "hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary",
                      !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div
                      className={cn(
                        "text-sm font-medium leading-tight",
                        isCurrent && "text-primary",
                        !isCurrent && !isCompleted && "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      步驟 {index + 1}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <Progress value={progressPercent} className="mt-4 h-1" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              上一步
            </Button>

            <div className="text-sm text-muted-foreground">
              {currentStep + 1} / {STEPS.length}
            </div>

            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                完成並儲存
              </Button>
            ) : (
              <Button onClick={handleNext}>
                下一步
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 報價單產出對話框 - 待重新實作 */}
    </div>
  );
}
