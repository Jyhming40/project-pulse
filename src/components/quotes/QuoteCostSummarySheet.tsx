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
import { Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/quoteCalculations";

interface QuoteCostSummarySheetProps {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  sellingPrice: number;
  taxRate?: number;
}

export default function QuoteCostSummarySheet({
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  sellingPrice,
  taxRate = 0.05,
}: QuoteCostSummarySheetProps) {
  const [open, setOpen] = useState(false);
  
  // 總成本 = 工程項目 + PV模組 + 逆變器
  // 注意：印花稅和營所稅如果已在工程項目中以項目形式存在，則已包含在 engineeringTotal
  const totalCost = engineeringTotal + modulesTotal + invertersTotal;
  
  const grossProfit = sellingPrice - totalCost;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

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
          {/* 成本明細 */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">工程項目成本</span>
              <span className="font-mono font-medium">{formatCurrency(engineeringTotal, 0)}</span>
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

          <Separator />

          {/* 總計 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">總成本</span>
              <span className="text-lg font-semibold font-mono">{formatCurrency(totalCost, 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">報價金額 (未稅)</span>
              <span className="text-lg font-semibold font-mono">{formatCurrency(sellingPrice, 0)}</span>
            </div>
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
            印花稅、營所稅等費用如已在工程項目中設定，將自動納入「工程項目成本」計算。
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
