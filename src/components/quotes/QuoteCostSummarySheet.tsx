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
  
  // 直接工程成本 = 工程項目總計 - 公司管銷費用（用於明細顯示）
  const directEngineeringCost = engineeringTotal - overheadTotal;
  
  // 總成本 = 全部工程成本 + PV模組 + 逆變器（含管銷）
  const totalCost = engineeringTotal + modulesTotal + invertersTotal;
  
  // 毛利計算：基於總成本（含管銷），反映真實獲利
  const grossProfit = sellingPrice - totalCost;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

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
      <SheetContent side="right" className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">成本摘要</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* 直接成本明細 */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">直接成本</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">工程項目成本</span>
              <span className="font-mono font-medium">{formatCurrency(directEngineeringCost, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PV 模組成本</span>
              <span className="font-mono font-medium text-blue-600">{formatCurrency(modulesTotal, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">逆變器成本</span>
              <span className="font-mono font-medium text-amber-600">{formatCurrency(invertersTotal, 0)}</span>
            </div>
          </div>

          {/* 公司管銷費用（獨立區塊，僅顯示明細） */}
          {hasOverhead && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">公司管銷費用</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">
                          營所稅、印花稅等屬於公司層級的費用，獨立於工程成本顯示，以便更清楚區分毛利與淨利。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {overheadBreakdown?.stampDuty ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">印花稅 (千分之一)</span>
                    <span className="font-mono font-medium text-orange-600">
                      {formatCurrency(overheadBreakdown.stampDuty, 0)}
                    </span>
                  </div>
                ) : null}
                {overheadBreakdown?.corpTax ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">營所稅 (2%)</span>
                    <span className="font-mono font-medium text-orange-600">
                      {formatCurrency(overheadBreakdown.corpTax, 0)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm pt-1 border-t border-dashed">
                  <span className="font-medium">管銷費用小計</span>
                  <span className="font-mono font-semibold text-orange-600">{formatCurrency(overheadTotal, 0)}</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* 總計 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">報價金額 (未稅)</span>
              <span className="text-lg font-semibold font-mono">{formatCurrency(sellingPrice, 0)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">總成本</span>
              <span className="text-lg font-semibold font-mono">{formatCurrency(totalCost, 0)}</span>
            </div>
            
            {/* 毛利（基於總成本，含管銷） */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">預估毛利</span>
              <span className={`text-lg font-semibold font-mono ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(grossProfit, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">毛利率</span>
              <span className={`text-lg font-semibold ${grossMargin >= 0 ? "text-green-600" : "text-destructive"}`}>
                {grossMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          <Separator />

          {/* 說明 */}
          <p className="text-xs text-muted-foreground">
            毛利 = 報價金額 - 總成本（含管銷費用）。
            {hasOverhead && " 上方管銷明細顯示印花稅與營所稅的個別金額。"}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
