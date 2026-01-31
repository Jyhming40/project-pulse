import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calculator, Info, AlertCircle, TrendingDown, TrendingUp, Lock, Unlock } from "lucide-react";
import { formatCurrency } from "@/lib/quoteCalculations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OverheadBreakdown {
  stampDuty: number;
  corpTax: number;
}

interface ProjectExpenseBreakdown {
  brokerage: number;
  maintenanceReserve: number;
}

interface ActualCosts {
  actualModulesCost: number | null;
  actualInvertersCost: number | null;
  actualEngineeringCost: number | null;
  actualBrokerageCost: number | null;
  actualMaintenanceReserve: number | null;
}

interface BudgetVsActualSheetProps {
  quoteId: string;
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  sellingPrice: number;
  taxRate?: number;
  overheadBreakdown?: OverheadBreakdown;
  projectExpenseBreakdown?: ProjectExpenseBreakdown;
  isFinalized?: boolean;
  onFinalizeChange?: (isFinalized: boolean) => void;
}

interface CostRowProps {
  label: string;
  budget: number;
  actual: number | null;
  onActualChange: (value: number | null) => void;
  isLocked: boolean;
  showWarning?: boolean;
  warningText?: string;
}

function CostRow({ label, budget, actual, onActualChange, isLocked, showWarning, warningText }: CostRowProps) {
  const difference = actual !== null ? actual - budget : null;
  const isOverBudget = difference !== null && difference > 0;
  const isUnderBudget = difference !== null && difference < 0;

  return (
    <div className="grid grid-cols-4 gap-2 items-center text-sm py-1.5">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground truncate">{label}</span>
        {showWarning && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{warningText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="font-mono text-right">{formatCurrency(budget, 0)}</div>
      <div className="relative">
        <Input
          type="number"
          value={actual ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onActualChange(val === "" ? null : parseFloat(val));
          }}
          disabled={isLocked}
          placeholder="—"
          className="h-7 text-xs font-mono text-right pr-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="flex items-center justify-end gap-1">
        {difference !== null ? (
          <>
            {isOverBudget && <TrendingUp className="h-3 w-3 text-destructive" />}
            {isUnderBudget && <TrendingDown className="h-3 w-3 text-green-600" />}
            <span className={`font-mono text-xs ${isOverBudget ? "text-destructive" : isUnderBudget ? "text-green-600" : ""}`}>
              {difference >= 0 ? "+" : ""}{formatCurrency(difference, 0)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>
    </div>
  );
}

export default function BudgetVsActualSheet({
  quoteId,
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  sellingPrice,
  taxRate = 0.05,
  overheadBreakdown,
  projectExpenseBreakdown,
  isFinalized: initialIsFinalized = false,
  onFinalizeChange,
}: BudgetVsActualSheetProps) {
  const [open, setOpen] = useState(false);
  const [riskReserveRate, setRiskReserveRate] = useState(3);
  const [isFinalized, setIsFinalized] = useState(initialIsFinalized);
  const [isSaving, setIsSaving] = useState(false);
  
  // Actual cost states
  const [actualCosts, setActualCosts] = useState<ActualCosts>({
    actualModulesCost: null,
    actualInvertersCost: null,
    actualEngineeringCost: null,
    actualBrokerageCost: null,
    actualMaintenanceReserve: null,
  });

  // Load actual costs from database
  useEffect(() => {
    if (quoteId && open) {
      loadActualCosts();
    }
  }, [quoteId, open]);

  const loadActualCosts = async () => {
    const { data, error } = await supabase
      .from("project_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (data && !error) {
      // Type assertion for new columns not yet in generated types
      const record = data as typeof data & {
        actual_modules_cost?: number | null;
        actual_inverters_cost?: number | null;
        actual_engineering_cost?: number | null;
        actual_brokerage_cost?: number | null;
        actual_maintenance_reserve?: number | null;
        is_finalized?: boolean | null;
      };
      setActualCosts({
        actualModulesCost: record.actual_modules_cost ?? null,
        actualInvertersCost: record.actual_inverters_cost ?? null,
        actualEngineeringCost: record.actual_engineering_cost ?? null,
        actualBrokerageCost: record.actual_brokerage_cost ?? null,
        actualMaintenanceReserve: record.actual_maintenance_reserve ?? null,
      });
      setIsFinalized(record.is_finalized || false);
    }
  };

  // Budget calculations
  const stampDuty = overheadBreakdown?.stampDuty || 0;
  const corpTax = overheadBreakdown?.corpTax || 0;
  const companyOverhead = stampDuty + corpTax;
  
  const brokerage = projectExpenseBreakdown?.brokerage || 0;
  const maintenanceReserve = projectExpenseBreakdown?.maintenanceReserve || 0;
  
  // Direct cost = engineering (excluding overhead & project expenses) + modules + inverters
  const directCost = (engineeringTotal - companyOverhead - brokerage - maintenanceReserve) + modulesTotal + invertersTotal;
  const riskReserve = directCost * (riskReserveRate / 100);
  const projectSpecificExpenses = riskReserve + brokerage + maintenanceReserve;
  
  // Budget profit tiers
  const budgetSiteGrossProfit = sellingPrice - directCost;
  const budgetSiteGrossMargin = sellingPrice > 0 ? (budgetSiteGrossProfit / sellingPrice) * 100 : 0;
  
  const budgetOperatingProfit = budgetSiteGrossProfit - projectSpecificExpenses;
  const budgetOperatingMargin = sellingPrice > 0 ? (budgetOperatingProfit / sellingPrice) * 100 : 0;
  
  const budgetNetProfit = budgetOperatingProfit - companyOverhead;
  const budgetNetMargin = sellingPrice > 0 ? (budgetNetProfit / sellingPrice) * 100 : 0;

  // Actual profit calculations
  const actualDirectCost = (
    (actualCosts.actualEngineeringCost ?? (engineeringTotal - companyOverhead - brokerage - maintenanceReserve)) +
    (actualCosts.actualModulesCost ?? modulesTotal) +
    (actualCosts.actualInvertersCost ?? invertersTotal)
  );
  
  const actualRiskReserve = actualDirectCost * (riskReserveRate / 100);
  const actualBrokerage = actualCosts.actualBrokerageCost ?? brokerage;
  const actualMaintenance = actualCosts.actualMaintenanceReserve ?? maintenanceReserve;
  const actualProjectExpenses = actualRiskReserve + actualBrokerage + actualMaintenance;
  
  const actualSiteGrossProfit = sellingPrice - actualDirectCost;
  const actualOperatingProfit = actualSiteGrossProfit - actualProjectExpenses;
  const actualNetProfit = actualOperatingProfit - companyOverhead;
  const actualNetMargin = sellingPrice > 0 ? (actualNetProfit / sellingPrice) * 100 : 0;

  // Check if any actual values are entered
  const hasAnyActual = Object.values(actualCosts).some(v => v !== null);

  // Save actual costs to database
  const saveActualCosts = async () => {
    setIsSaving(true);
    try {
      // Use type assertion for new columns not yet in generated types
      const updatePayload = {
        actual_modules_cost: actualCosts.actualModulesCost,
        actual_inverters_cost: actualCosts.actualInvertersCost,
        actual_engineering_cost: actualCosts.actualEngineeringCost,
        actual_brokerage_cost: actualCosts.actualBrokerageCost,
        actual_maintenance_reserve: actualCosts.actualMaintenanceReserve,
      } as Record<string, unknown>;
      
      const { error } = await supabase
        .from("project_quotes")
        .update(updatePayload)
        .eq("id", quoteId);

      if (error) throw error;
      toast.success("實際成本已儲存");
    } catch (err) {
      toast.error("儲存失敗");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle finalization toggle
  const handleFinalizeToggle = async (checked: boolean) => {
    if (checked && !hasAnyActual) {
      toast.error("請先輸入至少一項實際成本");
      return;
    }

    setIsSaving(true);
    try {
      // Use type assertion for new columns not yet in generated types
      const updatePayload = {
        actual_modules_cost: actualCosts.actualModulesCost,
        actual_inverters_cost: actualCosts.actualInvertersCost,
        actual_engineering_cost: actualCosts.actualEngineeringCost,
        actual_brokerage_cost: actualCosts.actualBrokerageCost,
        actual_maintenance_reserve: actualCosts.actualMaintenanceReserve,
        is_finalized: checked,
        finalized_at: checked ? new Date().toISOString() : null,
      } as Record<string, unknown>;
      
      const { error } = await supabase
        .from("project_quotes")
        .update(updatePayload)
        .eq("id", quoteId);

      if (error) throw error;
      
      setIsFinalized(checked);
      onFinalizeChange?.(checked);
      toast.success(checked ? "已確認結案並鎖定編輯" : "已解除結案鎖定");
    } catch (err) {
      toast.error("操作失敗");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateActualCost = (key: keyof ActualCosts, value: number | null) => {
    setActualCosts(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="fixed right-4 top-1/2 -translate-y-1/2 z-40 shadow-lg bg-background hover:bg-primary hover:text-primary-foreground"
        >
          <Calculator className="h-4 w-4 mr-1" />
          成本分析
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            預算 vs 實際成本分析
            {isFinalized && <Lock className="h-4 w-4 text-amber-500" />}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-5 space-y-4">
          {/* 專案總收 */}
          <div className="bg-primary/5 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">專案總收 (未稅)</span>
              <span className="text-xl font-bold font-mono">{formatCurrency(sellingPrice, 0)}</span>
            </div>
          </div>

          <Separator />

          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>項目</span>
            <span className="text-right">預計</span>
            <span className="text-right">實際</span>
            <span className="text-right">差異</span>
          </div>

          {/* [支出項 A] 直接成本 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">A. 直接成本</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">直接投入生產的成本，包含工程費用、模組與逆變器。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="space-y-0.5 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
              <CostRow
                label="工程費用"
                budget={engineeringTotal - companyOverhead - brokerage - maintenanceReserve}
                actual={actualCosts.actualEngineeringCost}
                onActualChange={(v) => updateActualCost("actualEngineeringCost", v)}
                isLocked={isFinalized}
              />
              <CostRow
                label="PV 模組"
                budget={modulesTotal}
                actual={actualCosts.actualModulesCost}
                onActualChange={(v) => updateActualCost("actualModulesCost", v)}
                isLocked={isFinalized}
              />
              <CostRow
                label="逆變器"
                budget={invertersTotal}
                actual={actualCosts.actualInvertersCost}
                onActualChange={(v) => updateActualCost("actualInvertersCost", v)}
                isLocked={isFinalized}
              />
            </div>
            
            <div className="flex justify-between items-center pt-1 bg-slate-50 dark:bg-slate-900/50 rounded px-2 py-1.5">
              <span className="text-sm font-medium">直接成本小計</span>
              <div className="flex gap-4 font-mono text-sm">
                <span>{formatCurrency(directCost, 0)}</span>
                <span className={actualDirectCost !== directCost ? (actualDirectCost > directCost ? "text-destructive" : "text-green-600") : ""}>
                  {formatCurrency(actualDirectCost, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 層次一：案場毛利 */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-blue-700 dark:text-blue-400">一、案場毛利</span>
              <div className="flex gap-4 font-mono">
                <span className="text-muted-foreground">{formatCurrency(budgetSiteGrossProfit, 0)}</span>
                <span className={`font-bold ${actualSiteGrossProfit >= budgetSiteGrossProfit ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(actualSiteGrossProfit, 0)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-600 dark:text-blue-400/80">毛利率</span>
              <span className="font-medium">{budgetSiteGrossMargin.toFixed(1)}%</span>
            </div>
          </div>

          <Separator />

          {/* [支出項 B] 專案特定支出 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">B. 專案特定支出</span>
            </div>
            
            <div className="space-y-2 pl-2 border-l-2 border-orange-200 dark:border-orange-800">
              {/* 風險預留 with slider */}
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-md px-2 py-2 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-orange-700 dark:text-orange-400">
                    風險預留 ({riskReserveRate}%)
                  </span>
                  <div className="flex gap-4 font-mono text-sm text-orange-700 dark:text-orange-400">
                    <span>{formatCurrency(riskReserve, 0)}</span>
                    <span>{formatCurrency(actualRiskReserve, 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-orange-500 w-5">0%</span>
                  <Slider
                    value={[riskReserveRate]}
                    onValueChange={(value) => setRiskReserveRate(value[0])}
                    min={0}
                    max={10}
                    step={0.5}
                    disabled={isFinalized}
                    className="flex-1 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                  <span className="text-[10px] text-orange-500 w-6">10%</span>
                </div>
              </div>

              <CostRow
                label="仲介/開發費"
                budget={brokerage}
                actual={actualCosts.actualBrokerageCost}
                onActualChange={(v) => updateActualCost("actualBrokerageCost", v)}
                isLocked={isFinalized}
                showWarning={brokerage === 0}
                warningText="尚未設定仲介費，請於工程項目中新增。"
              />
              <CostRow
                label="維運準備金"
                budget={maintenanceReserve}
                actual={actualCosts.actualMaintenanceReserve}
                onActualChange={(v) => updateActualCost("actualMaintenanceReserve", v)}
                isLocked={isFinalized}
                showWarning={maintenanceReserve === 0}
                warningText="尚未設定維運準備金，請於工程項目中新增。"
              />
            </div>
            
            <div className="flex justify-between items-center pt-1 bg-orange-50/50 dark:bg-orange-900/20 rounded px-2 py-1.5">
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">專案支出小計</span>
              <div className="flex gap-4 font-mono text-sm text-orange-700 dark:text-orange-400">
                <span>{formatCurrency(projectSpecificExpenses, 0)}</span>
                <span>{formatCurrency(actualProjectExpenses, 0)}</span>
              </div>
            </div>
          </div>

          {/* 層次二：營業利潤 */}
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-purple-700 dark:text-purple-400">二、營業利潤</span>
              <div className="flex gap-4 font-mono">
                <span className="text-muted-foreground">{formatCurrency(budgetOperatingProfit, 0)}</span>
                <span className={`font-bold ${actualOperatingProfit >= budgetOperatingProfit ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(actualOperatingProfit, 0)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-600 dark:text-purple-400/80">營業利潤率</span>
              <span className="font-medium">{budgetOperatingMargin.toFixed(1)}%</span>
            </div>
          </div>

          <Separator />

          {/* [支出項 C] 公司管銷 */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">C. 公司管銷</span>
            
            <div className="space-y-1.5 pl-2 border-l-2 border-red-200 dark:border-red-800">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">印花稅 (0.1%)</span>
                <span className="font-mono text-red-600">{formatCurrency(stampDuty, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">預扣營所稅 (2%)</span>
                <span className="font-mono text-red-600">{formatCurrency(corpTax, 0)}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-1 bg-red-50/50 dark:bg-red-900/20 rounded px-2 py-1.5">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">管銷費用小計</span>
              <span className="font-mono font-semibold text-red-700 dark:text-red-400">{formatCurrency(companyOverhead, 0)}</span>
            </div>
          </div>

          {/* 層次三：最終預估淨利 - 雙欄顯示 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 rounded-lg p-4 space-y-3">
            <div className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5">
              三、最終預估淨利
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-green-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">扣除所有成本、專案支出及管銷後，實際可動用利潤。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">預估淨利</div>
                <div className={`text-lg font-bold font-mono ${budgetNetProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {formatCurrency(budgetNetProfit, 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  淨利率 {budgetNetMargin.toFixed(2)}%
                </div>
              </div>
              
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 text-center border-2 border-green-300 dark:border-green-700">
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                  目前實際淨利
                  {hasAnyActual && (
                    actualNetProfit >= budgetNetProfit 
                      ? <TrendingDown className="h-3 w-3 text-green-600" />
                      : <TrendingUp className="h-3 w-3 text-destructive" />
                  )}
                </div>
                <div className={`text-lg font-bold font-mono ${actualNetProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {formatCurrency(actualNetProfit, 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  淨利率 {actualNetMargin.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* 說明備註 */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            此為預估值，實際利潤以結案結算為準。淨利 = 總收 − 直接成本 − 專案支出 − 公司管銷。
          </p>

          <Separator />

          {/* Save & Finalize Controls */}
          <div className="space-y-3 pt-2">
            {!isFinalized && (
              <Button 
                onClick={saveActualCosts} 
                disabled={isSaving || !hasAnyActual}
                className="w-full"
                variant="outline"
              >
                儲存實際成本
              </Button>
            )}
            
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <div className="flex items-center gap-2">
                {isFinalized ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                <Label htmlFor="finalize-toggle" className="text-sm font-medium">
                  確認結案
                </Label>
              </div>
              <Switch
                id="finalize-toggle"
                checked={isFinalized}
                onCheckedChange={handleFinalizeToggle}
                disabled={isSaving}
              />
            </div>
            
            {isFinalized && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                已結案並鎖定。實際支出數據將作為未來報價參考基礎。
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
