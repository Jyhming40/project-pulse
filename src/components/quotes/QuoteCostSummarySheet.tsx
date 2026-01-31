import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calculator, Info } from "lucide-react";
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

interface QuoteCostSummarySheetProps {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  sellingPrice: number;
  taxRate?: number;
  overheadBreakdown?: OverheadBreakdown;
}

export default function QuoteCostSummarySheet({
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  sellingPrice,
  taxRate = 0.05,
  overheadBreakdown,
}: QuoteCostSummarySheetProps) {
  const [open, setOpen] = useState(false);
  
  // 公司管銷費用總計
  const overheadTotal = overheadBreakdown 
    ? (overheadBreakdown.stampDuty + overheadBreakdown.corpTax)
    : 0;
  
  // 直接成本 = 全部工程成本 - 公司管銷 + PV模組 + 逆變器
  const directCost = (engineeringTotal - overheadTotal) + modulesTotal + invertersTotal;
  
  // 風險預留 (3%)
  const riskReserveRate = 0.03;
  const riskReserve = directCost * riskReserveRate;
  
  // 預估毛利 = 專案總收 - 直接成本 - 風險預留
  const grossProfit = sellingPrice - directCost - riskReserve;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
  
  // 最終預估淨利 = 毛利 - 公司管銷
  const netProfit = grossProfit - overheadTotal;
  const netMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

  const hasOverhead = overheadTotal > 0;

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
      <SheetContent side="right" className="w-[360px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            成本與利潤分析
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-5">
          {/* 專案總收 */}
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">專案總收 (未稅)</span>
              <span className="text-xl font-bold font-mono">{formatCurrency(sellingPrice, 0)}</span>
            </div>
          </div>

          <Separator />

          {/* 成本區塊 */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">成本結構</p>
            
            {/* 直接成本明細 */}
            <div className="space-y-2 pl-2 border-l-2 border-muted">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">├ 工程費用</span>
                <span className="font-mono">{formatCurrency(engineeringTotal - overheadTotal, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">├ PV 模組</span>
                <span className="font-mono text-blue-600">{formatCurrency(modulesTotal, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">└ 逆變器</span>
                <span className="font-mono text-amber-600">{formatCurrency(invertersTotal, 0)}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-medium">直接成本小計</span>
              <span className="font-mono font-semibold">{formatCurrency(directCost, 0)}</span>
            </div>
            
            {/* 風險預留 */}
            <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-950/30 rounded-md px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">風險預留 ({(riskReserveRate * 100).toFixed(0)}%)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-orange-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs">
                        預留應對施工風險、材料損耗、不可預見費用等緩衝金額。
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="font-mono font-medium text-orange-700 dark:text-orange-400">
                {formatCurrency(riskReserve, 0)}
              </span>
            </div>
          </div>

          <Separator />

          {/* 毛利區塊 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">預估毛利</span>
              <div className="text-right">
                <span className={`text-lg font-bold font-mono ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(grossProfit, 0)}
                </span>
                <span className={`ml-2 text-sm ${grossMargin >= 0 ? "text-green-600" : "text-destructive"}`}>
                  ({grossMargin.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* 公司管銷費用 */}
          {hasOverhead && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">公司管銷費用</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">
                          營所稅、印花稅等屬於公司層級的費用，從毛利中扣除以計算淨利。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-orange-200 dark:border-orange-800">
                  {overheadBreakdown?.stampDuty ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">├ 印花稅 (千分之一)</span>
                      <span className="font-mono text-orange-600">
                        {formatCurrency(overheadBreakdown.stampDuty, 0)}
                      </span>
                    </div>
                  ) : null}
                  {overheadBreakdown?.corpTax ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">└ 預扣營所稅 (2%)</span>
                      <span className="font-mono text-orange-600">
                        {formatCurrency(overheadBreakdown.corpTax, 0)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-medium">管銷費用小計</span>
                  <span className="font-mono font-semibold text-orange-600">{formatCurrency(overheadTotal, 0)}</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* 最終淨利 - 重點強調 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-green-800 dark:text-green-300">最終預估淨利</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-green-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="text-xs">
                        扣除所有成本、風險預留及管銷費用後，實際可動用的利潤金額。
                      </p>
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

          {/* 說明 */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            淨利 = 總收 − 直接成本 − 風險預留 − 管銷費用。此為預估值，實際利潤以結案結算為準。
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
