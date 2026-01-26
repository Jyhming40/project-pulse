import { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import QuoteBasicInfoTab from "@/components/quotes/QuoteBasicInfoTab";
import QuoteCostCalculatorTab from "@/components/quotes/QuoteCostCalculatorTab";
import QuoteFinancialAnalysisTab from "@/components/quotes/QuoteFinancialAnalysisTab";
import QuoteScheduleTab from "@/components/quotes/QuoteScheduleTab";
import { calculate20YearProjection, QuoteParams } from "@/lib/quoteCalculations";

const STEPS = [
  { id: "basic", label: "基本資訊", icon: FileText, description: "案場與投資方" },
  { id: "cost", label: "成本報價", icon: Calculator, description: "設備與工程費用" },
  { id: "financial", label: "投資分析", icon: TrendingUp, description: "IRR 與現金流" },
  { id: "schedule", label: "工程時程", icon: Calendar, description: "施工排程規劃" },
];

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

      if (isEditing && id) {
        const { error } = await supabase
          .from("project_quotes")
          .update(quoteData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_quotes")
          .insert({
            ...quoteData,
            quote_number: generateQuoteNumber(),
            quote_status: "draft",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-quotes"] });
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
          />
        );
      case "cost":
        return (
          <QuoteCostCalculatorTab
            formData={formData}
            setFormData={setFormData}
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
                <h1 className="text-xl font-semibold">
                  {isEditing ? "編輯報價" : "新增報價"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {STEPS[currentStep].description}
                </p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "儲存中..." : "儲存報價"}
            </Button>
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
                        "text-sm font-medium",
                        isCurrent && "text-primary",
                        !isCurrent && !isCompleted && "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
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
    </div>
  );
}
