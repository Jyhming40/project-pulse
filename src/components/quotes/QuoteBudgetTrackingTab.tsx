import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Info, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp, 
  Lock, 
  Unlock,
  Save,
  BarChart3,
  Target,
  Wallet,
  PiggyBank,
} from "lucide-react";
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

interface QuoteBudgetTrackingTabProps {
  quoteId: string;
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  sellingPrice: number;
  taxRate?: number;
  overheadBreakdown?: OverheadBreakdown;
  projectExpenseBreakdown?: ProjectExpenseBreakdown;
}

interface CostCompareRowProps {
  label: string;
  budget: number;
  actual: number | null;
  onActualChange: (value: number | null) => void;
  isLocked: boolean;
  showWarning?: boolean;
  warningText?: string;
}

function CostCompareRow({ label, budget, actual, onActualChange, isLocked, showWarning, warningText }: CostCompareRowProps) {
  const difference = actual !== null ? actual - budget : null;
  const isOverBudget = difference !== null && difference > 0;
  const isUnderBudget = difference !== null && difference < 0;

  return (
    <div className="grid grid-cols-4 gap-4 items-center py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {showWarning && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{warningText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="text-right font-mono text-sm">{formatCurrency(budget, 0)}</div>
      <div>
        <Input
          type="number"
          value={actual ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onActualChange(val === "" ? null : parseFloat(val));
          }}
          disabled={isLocked}
          placeholder="輸入實際金額"
          className="h-9 text-sm font-mono text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {difference !== null ? (
          <>
            {isOverBudget && <TrendingUp className="h-4 w-4 text-destructive" />}
            {isUnderBudget && <TrendingDown className="h-4 w-4 text-green-600" />}
            <span className={`font-mono text-sm font-medium ${isOverBudget ? "text-destructive" : isUnderBudget ? "text-green-600" : ""}`}>
              {difference >= 0 ? "+" : ""}{formatCurrency(difference, 0)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
    </div>
  );
}

export default function QuoteBudgetTrackingTab({
  quoteId,
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  sellingPrice,
  taxRate = 0.05,
  overheadBreakdown,
  projectExpenseBreakdown,
}: QuoteBudgetTrackingTabProps) {
  const [riskReserveRate, setRiskReserveRate] = useState(3);
  const [isFinalized, setIsFinalized] = useState(false);
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
    if (quoteId) {
      loadActualCosts();
    }
  }, [quoteId]);

  const loadActualCosts = async () => {
    if (!quoteId) return;
    
    const { data, error } = await supabase
      .from("project_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (data && !error) {
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
  const pureEngineeringCost = engineeringTotal - companyOverhead - brokerage - maintenanceReserve;
  const directCost = pureEngineeringCost + modulesTotal + invertersTotal;
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
  const actualEngineeringCost = actualCosts.actualEngineeringCost ?? pureEngineeringCost;
  const actualDirectCost = (
    actualEngineeringCost +
    (actualCosts.actualModulesCost ?? modulesTotal) +
    (actualCosts.actualInvertersCost ?? invertersTotal)
  );
  
  const actualRiskReserve = actualDirectCost * (riskReserveRate / 100);
  const actualBrokerage = actualCosts.actualBrokerageCost ?? brokerage;
  const actualMaintenance = actualCosts.actualMaintenanceReserve ?? maintenanceReserve;
  const actualProjectExpenses = actualRiskReserve + actualBrokerage + actualMaintenance;
  
  const actualSiteGrossProfit = sellingPrice - actualDirectCost;
  const actualSiteGrossMargin = sellingPrice > 0 ? (actualSiteGrossProfit / sellingPrice) * 100 : 0;
  
  const actualOperatingProfit = actualSiteGrossProfit - actualProjectExpenses;
  const actualOperatingMargin = sellingPrice > 0 ? (actualOperatingProfit / sellingPrice) * 100 : 0;
  
  const actualNetProfit = actualOperatingProfit - companyOverhead;
  const actualNetMargin = sellingPrice > 0 ? (actualNetProfit / sellingPrice) * 100 : 0;

  // Check if any actual values are entered
  const hasAnyActual = Object.values(actualCosts).some(v => v !== null);

  // Save actual costs to database
  const saveActualCosts = async () => {
    setIsSaving(true);
    try {
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
    <div className="space-y-6">
      {/* Header with save/finalize controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            預算 vs 實際成本分析
            {isFinalized && <Lock className="h-4 w-4 text-amber-500" />}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            追蹤實際支出與預算的差異，確保專案利潤
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isFinalized && (
            <Button 
              onClick={saveActualCosts} 
              disabled={isSaving || !hasAnyActual}
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              儲存實際成本
            </Button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            {isFinalized ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
            <Label htmlFor="finalize-toggle" className="text-sm font-medium">
              確認結案
            </Label>
            <Switch
              id="finalize-toggle"
              checked={isFinalized}
              onCheckedChange={handleFinalizeToggle}
              disabled={isSaving}
            />
          </div>
        </div>
      </div>

      {isFinalized && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <Lock className="h-4 w-4 inline mr-1" />
            已結案並鎖定。實際支出數據將作為未來報價參考基礎。
          </p>
        </div>
      )}

      {/* Top summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              專案總收 (未稅)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(sellingPrice, 0)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 dark:bg-blue-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              預估毛利
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${budgetSiteGrossProfit >= 0 ? "text-blue-700 dark:text-blue-400" : "text-destructive"}`}>
              {formatCurrency(budgetSiteGrossProfit, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">毛利率 {budgetSiteGrossMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 dark:bg-purple-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              預估營業利潤
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${budgetOperatingProfit >= 0 ? "text-purple-700 dark:text-purple-400" : "text-destructive"}`}>
              {formatCurrency(budgetOperatingProfit, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">營業利潤率 {budgetOperatingMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <PiggyBank className="h-4 w-4" />
              預估淨利
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${budgetNetProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
              {formatCurrency(budgetNetProfit, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">淨利率 {budgetNetMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Main comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">成本明細比較</CardTitle>
          <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
            <span>項目</span>
            <span className="text-right">預計 (Budget)</span>
            <span className="text-right">實際 (Actual)</span>
            <span className="text-right">差異 (Variance)</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* [支出項 A] 直接成本 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
              <div className="w-1 h-4 bg-blue-500 rounded" />
              A. 直接成本
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <p className="text-xs">直接投入生產的成本，包含工程費用、模組與逆變器。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="pl-4 space-y-1 border-l-2 border-blue-200 dark:border-blue-800">
              <CostCompareRow
                label="工程費用"
                budget={pureEngineeringCost}
                actual={actualCosts.actualEngineeringCost}
                onActualChange={(v) => updateActualCost("actualEngineeringCost", v)}
                isLocked={isFinalized}
              />
              <CostCompareRow
                label="PV 模組"
                budget={modulesTotal}
                actual={actualCosts.actualModulesCost}
                onActualChange={(v) => updateActualCost("actualModulesCost", v)}
                isLocked={isFinalized}
              />
              <CostCompareRow
                label="逆變器"
                budget={invertersTotal}
                actual={actualCosts.actualInvertersCost}
                onActualChange={(v) => updateActualCost("actualInvertersCost", v)}
                isLocked={isFinalized}
              />
            </div>
            
            <div className="flex justify-between items-center pt-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg px-4 py-2">
              <span className="font-medium text-blue-700 dark:text-blue-400">直接成本小計</span>
              <div className="flex gap-8 font-mono font-medium">
                <span className="text-blue-700 dark:text-blue-400">{formatCurrency(directCost, 0)}</span>
                <span className={actualDirectCost !== directCost ? (actualDirectCost > directCost ? "text-destructive" : "text-green-600") : "text-blue-700 dark:text-blue-400"}>
                  {formatCurrency(actualDirectCost, 0)}
                </span>
                <span className={actualDirectCost - directCost > 0 ? "text-destructive" : actualDirectCost - directCost < 0 ? "text-green-600" : ""}>
                  {actualDirectCost - directCost >= 0 ? "+" : ""}{formatCurrency(actualDirectCost - directCost, 0)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 案場毛利 */}
          <div className="bg-blue-100/50 dark:bg-blue-900/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-blue-800 dark:text-blue-300">一、案場毛利</span>
              <div className="flex gap-8 font-mono font-bold">
                <span className="text-muted-foreground">{formatCurrency(budgetSiteGrossProfit, 0)}</span>
                <span className={actualSiteGrossProfit >= budgetSiteGrossProfit ? "text-green-600" : "text-destructive"}>
                  {formatCurrency(actualSiteGrossProfit, 0)}
                </span>
                <span className={actualSiteGrossProfit - budgetSiteGrossProfit >= 0 ? "text-green-600" : "text-destructive"}>
                  {actualSiteGrossProfit - budgetSiteGrossProfit >= 0 ? "+" : ""}{formatCurrency(actualSiteGrossProfit - budgetSiteGrossProfit, 0)}
                </span>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-blue-600 dark:text-blue-400">毛利率</span>
              <div className="flex gap-8 font-mono">
                <span>{budgetSiteGrossMargin.toFixed(1)}%</span>
                <span className={actualSiteGrossMargin >= budgetSiteGrossMargin ? "text-green-600" : "text-destructive"}>
                  {actualSiteGrossMargin.toFixed(1)}%
                </span>
                <span className={actualSiteGrossMargin - budgetSiteGrossMargin >= 0 ? "text-green-600" : "text-destructive"}>
                  {actualSiteGrossMargin - budgetSiteGrossMargin >= 0 ? "+" : ""}{(actualSiteGrossMargin - budgetSiteGrossMargin).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* [支出項 B] 專案特定支出 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
              <div className="w-1 h-4 bg-orange-500 rounded" />
              B. 專案特定支出
            </div>
            
            <div className="pl-4 space-y-2 border-l-2 border-orange-200 dark:border-orange-800">
              {/* 風險預留 with slider */}
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    風險預留 ({riskReserveRate}%)
                  </span>
                  <div className="flex gap-8 font-mono text-sm text-orange-700 dark:text-orange-400">
                    <span>{formatCurrency(riskReserve, 0)}</span>
                    <span>{formatCurrency(actualRiskReserve, 0)}</span>
                    <span>{formatCurrency(actualRiskReserve - riskReserve, 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-orange-500 w-5">0%</span>
                  <Slider
                    value={[riskReserveRate]}
                    onValueChange={(value) => setRiskReserveRate(value[0])}
                    min={0}
                    max={10}
                    step={0.5}
                    disabled={isFinalized}
                    className="flex-1 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600"
                  />
                  <span className="text-xs text-orange-500 w-6">10%</span>
                </div>
              </div>

              <CostCompareRow
                label="仲介/開發費"
                budget={brokerage}
                actual={actualCosts.actualBrokerageCost}
                onActualChange={(v) => updateActualCost("actualBrokerageCost", v)}
                isLocked={isFinalized}
                showWarning={brokerage === 0}
                warningText="尚未設定仲介費，請於工程項目中新增。"
              />
              <CostCompareRow
                label="維運準備金"
                budget={maintenanceReserve}
                actual={actualCosts.actualMaintenanceReserve}
                onActualChange={(v) => updateActualCost("actualMaintenanceReserve", v)}
                isLocked={isFinalized}
                showWarning={maintenanceReserve === 0}
                warningText="尚未設定維運準備金，請於工程項目中新增。"
              />
            </div>
            
            <div className="flex justify-between items-center pt-2 bg-orange-50 dark:bg-orange-950/50 rounded-lg px-4 py-2">
              <span className="font-medium text-orange-700 dark:text-orange-400">專案支出小計</span>
              <div className="flex gap-8 font-mono font-medium text-orange-700 dark:text-orange-400">
                <span>{formatCurrency(projectSpecificExpenses, 0)}</span>
                <span>{formatCurrency(actualProjectExpenses, 0)}</span>
                <span className={actualProjectExpenses - projectSpecificExpenses > 0 ? "text-destructive" : actualProjectExpenses - projectSpecificExpenses < 0 ? "text-green-600" : ""}>
                  {actualProjectExpenses - projectSpecificExpenses >= 0 ? "+" : ""}{formatCurrency(actualProjectExpenses - projectSpecificExpenses, 0)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 營業利潤 */}
          <div className="bg-purple-100/50 dark:bg-purple-900/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-purple-800 dark:text-purple-300">二、營業利潤</span>
              <div className="flex gap-8 font-mono font-bold">
                <span className="text-muted-foreground">{formatCurrency(budgetOperatingProfit, 0)}</span>
                <span className={actualOperatingProfit >= budgetOperatingProfit ? "text-green-600" : "text-destructive"}>
                  {formatCurrency(actualOperatingProfit, 0)}
                </span>
                <span className={actualOperatingProfit - budgetOperatingProfit >= 0 ? "text-green-600" : "text-destructive"}>
                  {actualOperatingProfit - budgetOperatingProfit >= 0 ? "+" : ""}{formatCurrency(actualOperatingProfit - budgetOperatingProfit, 0)}
                </span>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-purple-600 dark:text-purple-400">營業利潤率</span>
              <div className="flex gap-8 font-mono">
                <span>{budgetOperatingMargin.toFixed(1)}%</span>
                <span className={actualOperatingMargin >= budgetOperatingMargin ? "text-green-600" : "text-destructive"}>
                  {actualOperatingMargin.toFixed(1)}%
                </span>
                <span className={actualOperatingMargin - budgetOperatingMargin >= 0 ? "text-green-600" : "text-destructive"}>
                  {actualOperatingMargin - budgetOperatingMargin >= 0 ? "+" : ""}{(actualOperatingMargin - budgetOperatingMargin).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* [支出項 C] 公司管銷 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
              <div className="w-1 h-4 bg-red-500 rounded" />
              C. 公司管銷
            </div>
            
            <div className="pl-4 space-y-1 border-l-2 border-red-200 dark:border-red-800">
              <div className="grid grid-cols-4 gap-4 items-center py-2">
                <span className="text-sm font-medium">印花稅 (0.1%)</span>
                <div className="text-right font-mono text-sm">{formatCurrency(stampDuty, 0)}</div>
                <div className="text-right font-mono text-sm text-muted-foreground">—</div>
                <div className="text-right font-mono text-sm text-muted-foreground">—</div>
              </div>
              <div className="grid grid-cols-4 gap-4 items-center py-2">
                <span className="text-sm font-medium">預扣營所稅 (2%)</span>
                <div className="text-right font-mono text-sm">{formatCurrency(corpTax, 0)}</div>
                <div className="text-right font-mono text-sm text-muted-foreground">—</div>
                <div className="text-right font-mono text-sm text-muted-foreground">—</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2 bg-red-50 dark:bg-red-950/50 rounded-lg px-4 py-2">
              <span className="font-medium text-red-700 dark:text-red-400">管銷費用小計</span>
              <span className="font-mono font-semibold text-red-700 dark:text-red-400">{formatCurrency(companyOverhead, 0)}</span>
            </div>
          </div>

          <Separator />

          {/* 最終淨利 - 雙欄對比 */}
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 rounded-lg p-6">
            <div className="text-center mb-4">
              <span className="text-lg font-bold text-green-800 dark:text-green-300 flex items-center justify-center gap-2">
                三、最終預估淨利
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-green-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="text-xs">扣除所有成本、專案支出及管銷後，實際可動用利潤。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 text-center">
                <div className="text-sm text-muted-foreground mb-2">預估淨利</div>
                <div className={`text-2xl font-bold font-mono ${budgetNetProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {formatCurrency(budgetNetProfit, 0)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  淨利率 {budgetNetMargin.toFixed(2)}%
                </div>
              </div>
              
              <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 text-center border-2 border-green-400 dark:border-green-600">
                <div className="text-sm text-muted-foreground mb-2 flex items-center justify-center gap-1">
                  目前實際淨利
                  {hasAnyActual && (
                    actualNetProfit >= budgetNetProfit 
                      ? <TrendingDown className="h-4 w-4 text-green-600" />
                      : <TrendingUp className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className={`text-2xl font-bold font-mono ${actualNetProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {formatCurrency(actualNetProfit, 0)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  淨利率 {actualNetMargin.toFixed(2)}%
                </div>
              </div>
            </div>
            
            {/* Variance summary */}
            <div className="mt-4 text-center">
              <span className="text-sm text-muted-foreground">淨利差異：</span>
              <span className={`ml-2 font-mono font-bold ${actualNetProfit - budgetNetProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                {actualNetProfit - budgetNetProfit >= 0 ? "+" : ""}{formatCurrency(actualNetProfit - budgetNetProfit, 0)}
              </span>
            </div>
          </div>

          {/* 說明備註 */}
          <p className="text-xs text-muted-foreground leading-relaxed text-center pt-2">
            此為預估值，實際利潤以結案結算為準。淨利 = 總收 − 直接成本 − 專案支出 − 公司管銷。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
