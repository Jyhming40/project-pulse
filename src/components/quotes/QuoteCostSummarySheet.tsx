import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calculator, Info, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/quoteCalculations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OverheadBreakdown {
  stampDuty: number;
  corpTax: number;
}

interface ProjectExpenseBreakdown {
  brokerage: number;       // 仲介費/開發費
  maintenanceReserve: number; // 維運準備金
}

interface QuoteCostSummarySheetProps {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  sellingPrice: number;
  taxRate?: number;
  overheadBreakdown?: OverheadBreakdown;
  projectExpenseBreakdown?: ProjectExpenseBreakdown;
}

export default function QuoteCostSummarySheet({
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  sellingPrice,
  taxRate = 0.05,
  overheadBreakdown,
  projectExpenseBreakdown,
}: QuoteCostSummarySheetProps) {
  const [open, setOpen] = useState(false);
  const [riskReserveRate, setRiskReserveRate] = useState(3); // 預設 3%
  
  // [支出項 C] 公司管銷費用
  const stampDuty = overheadBreakdown?.stampDuty || 0;
  const corpTax = overheadBreakdown?.corpTax || 0;
  const companyOverhead = stampDuty + corpTax;
  
  // [支出項 B] 專案特定支出 (不含風險預留，因為是動態計算)
  const brokerage = projectExpenseBreakdown?.brokerage || 0;
  const maintenanceReserve = projectExpenseBreakdown?.maintenanceReserve || 0;
  
  // [支出項 A] 直接成本 = 工程費用(不含管銷、仲介、維運) + PV模組 + 逆變器
  // 從工程總計中扣除: 公司管銷 + 仲介費 + 維運準備金
  const directCost = (engineeringTotal - companyOverhead - brokerage - maintenanceReserve) + modulesTotal + invertersTotal;
  
  // 風險預留 (動態百分比) - 基於直接成本
  const riskReserve = directCost * (riskReserveRate / 100);
  
  // 專案特定支出總計 (含風險預留)
  const projectSpecificExpenses = riskReserve + brokerage + maintenanceReserve;
  
  // 三層利潤計算
  // 層次一：案場毛利 = 專案總收 - [支出項 A] 直接成本
  const siteGrossProfit = sellingPrice - directCost;
  const siteGrossMargin = sellingPrice > 0 ? (siteGrossProfit / sellingPrice) * 100 : 0;
  
  // 層次二：營業利潤 = 案場毛利 - [支出項 B] 專案特定支出
  const operatingProfit = siteGrossProfit - projectSpecificExpenses;
  const operatingMargin = sellingPrice > 0 ? (operatingProfit / sellingPrice) * 100 : 0;
  
  // 層次三：最終預估淨利 = 營業利潤 - [支出項 C] 公司管銷
  const netProfit = operatingProfit - companyOverhead;
  const netMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

  // 檢查是否有缺失數據
  const hasMissingBrokerage = brokerage === 0;
  const hasMissingMaintenance = maintenanceReserve === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="fixed right-4 top-1/2 -translate-y-1/2 z-40 shadow-lg bg-background hover:bg-primary hover:text-primary-foreground"
        >
          <Calculator className="h-4 w-4 mr-1" />
          成本摘要
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            成本與利潤分析
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
            
            <div className="space-y-1.5 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">工程費用</span>
                <span className="font-mono">{formatCurrency(engineeringTotal - companyOverhead - brokerage - maintenanceReserve, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PV 模組</span>
                <span className="font-mono text-blue-600">{formatCurrency(modulesTotal, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">逆變器</span>
                <span className="font-mono text-amber-600">{formatCurrency(invertersTotal, 0)}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-1 bg-slate-50 dark:bg-slate-900/50 rounded px-2 py-1.5">
              <span className="text-sm font-medium">直接成本小計</span>
              <span className="font-mono font-semibold">{formatCurrency(directCost, 0)}</span>
            </div>
          </div>

          {/* 層次一：案場毛利 */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">一、案場毛利</span>
              <span className={`text-lg font-bold font-mono ${siteGrossProfit >= 0 ? "text-blue-700 dark:text-blue-400" : "text-destructive"}`}>
                {formatCurrency(siteGrossProfit, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-600 dark:text-blue-400/80">毛利率</span>
              <span className={`font-medium ${siteGrossMargin >= 0 ? "text-blue-700 dark:text-blue-400" : "text-destructive"}`}>
                {siteGrossMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          <Separator />

          {/* [支出項 B] 專案特定支出 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">B. 專案特定支出</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">針對此專案產生的額外費用，包含風險緩衝、仲介費及維運準備金。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="space-y-2 pl-2 border-l-2 border-orange-200 dark:border-orange-800">
              {/* 風險預留 with slider */}
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-md px-2 py-2 space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-orange-700 dark:text-orange-400">
                      風險預留 ({riskReserveRate}%)
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-orange-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[180px]">
                          <p className="text-xs">預留應對施工風險、材料損耗等。</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="font-mono text-sm font-medium text-orange-700 dark:text-orange-400">
                    {formatCurrency(riskReserve, 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-orange-500 w-5">0%</span>
                  <Slider
                    value={[riskReserveRate]}
                    onValueChange={(value) => setRiskReserveRate(value[0])}
                    min={0}
                    max={10}
                    step={0.5}
                    className="flex-1 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                  <span className="text-[10px] text-orange-500 w-6">10%</span>
                </div>
              </div>

              {/* 仲介費 */}
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">仲介/開發費</span>
                  {hasMissingBrokerage && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">尚未設定仲介費，請於工程項目中新增。</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <span className={`font-mono ${hasMissingBrokerage ? "text-muted-foreground" : ""}`}>
                  {formatCurrency(brokerage, 0)}
                </span>
              </div>

              {/* 維運準備金 */}
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">維運準備金</span>
                  {hasMissingMaintenance && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">尚未設定維運準備金，請於工程項目中新增。</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <span className={`font-mono ${hasMissingMaintenance ? "text-muted-foreground" : ""}`}>
                  {formatCurrency(maintenanceReserve, 0)}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-1 bg-orange-50/50 dark:bg-orange-900/20 rounded px-2 py-1.5">
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">專案支出小計</span>
              <span className="font-mono font-semibold text-orange-700 dark:text-orange-400">{formatCurrency(projectSpecificExpenses, 0)}</span>
            </div>
          </div>

          {/* 層次二：營業利潤 */}
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">二、營業利潤</span>
              <span className={`text-lg font-bold font-mono ${operatingProfit >= 0 ? "text-purple-700 dark:text-purple-400" : "text-destructive"}`}>
                {formatCurrency(operatingProfit, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-600 dark:text-purple-400/80">營業利潤率</span>
              <span className={`font-medium ${operatingMargin >= 0 ? "text-purple-700 dark:text-purple-400" : "text-destructive"}`}>
                {operatingMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          <Separator />

          {/* [支出項 C] 公司管銷 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">C. 公司管銷</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">公司層級的稅務費用，從營業利潤中扣除。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
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

          {/* 層次三：最終預估淨利 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-green-800 dark:text-green-300">三、最終預估淨利</span>
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
              <span className={`text-xl font-bold font-mono ${netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                {formatCurrency(netProfit, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-700 dark:text-green-400">預估淨利率</span>
              <span className={`text-lg font-bold ${netMargin >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                {netMargin.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* 說明備註 */}
          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            此為預估值，實際利潤以結案結算為準。淨利 = 總收 − 直接成本 − 專案支出 − 公司管銷。
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}