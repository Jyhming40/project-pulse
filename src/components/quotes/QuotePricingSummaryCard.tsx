import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Calculator, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuotePricingSummaryCardProps {
  capacityKwp: number;
  pricePerKwp: number;
  taxRate: number;
  onPricePerKwpChange: (value: number) => void;
  brokerageRate?: number;
  onBrokerageRateChange?: (value: number) => void;
  // 成本相關 props
  engineeringTotal?: number;
  modulesTotal?: number;
  invertersTotal?: number;
}

export default function QuotePricingSummaryCard({
  capacityKwp,
  pricePerKwp,
  taxRate = 0.05,
  onPricePerKwpChange,
  brokerageRate = 0,
  onBrokerageRateChange,
  engineeringTotal = 0,
  modulesTotal = 0,
  invertersTotal = 0,
}: QuotePricingSummaryCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // === 報價計算 ===
  const pricePerKwpWithTax = pricePerKwp * (1 + taxRate);
  const totalPriceExcludingTax = capacityKwp * pricePerKwp;
  const totalPriceIncludingTax = totalPriceExcludingTax * (1 + taxRate);

  // === 成本計算 ===
  const totalCost = engineeringTotal + modulesTotal + invertersTotal;
  const totalCostWithTax = totalCost * (1 + taxRate);
  const stampTax = totalCostWithTax * 0.001;
  const businessTax = totalCostWithTax * 0.02;
  const grandTotal = totalCost + stampTax + businessTax;
  
  // === 毛利計算 ===
  const grossProfit = totalPriceExcludingTax - grandTotal;
  const grossMargin = totalPriceExcludingTax > 0 ? (grossProfit / totalPriceExcludingTax) * 100 : 0;
  const isPositive = grossProfit >= 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          報價與成本摘要
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* === 精簡版：關鍵數字 === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 每kW報價輸入 */}
          <div className="space-y-1">
            <Label htmlFor="pricePerKwp" className="text-xs text-muted-foreground">
              每kW報價 (未稅)
            </Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                NT$
              </span>
              <Input
                id="pricePerKwp"
                type="number"
                value={pricePerKwp || ""}
                onChange={(e) => onPricePerKwpChange(Number(e.target.value) || 0)}
                className="pl-9 text-sm font-semibold font-mono text-primary h-9"
                placeholder="45000"
              />
            </div>
          </div>

          {/* 報價總額 */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">報價總額 (未稅)</span>
            <p className="text-lg font-bold font-mono text-foreground">
              {formatCurrency(totalPriceExcludingTax, 0)}
            </p>
          </div>

          {/* 總成本 */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">總成本</span>
            <p className="text-lg font-bold font-mono text-foreground">
              {formatCurrency(grandTotal, 0)}
            </p>
          </div>

          {/* 毛利率 - 突出顯示 */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">毛利率</span>
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={cn(
                "text-xl font-bold",
                isPositive ? "text-green-600" : "text-destructive"
              )}>
                {grossMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* === 展開詳情按鈕 === */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-center w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors gap-1">
            <span>{detailsOpen ? "收起詳情" : "展開詳情"}</span>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              detailsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pt-3 space-y-4">
            <Separator />
            
            {/* 報價明細 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">每kW (含稅)</span>
                <span className="font-mono">{formatCurrency(pricePerKwpWithTax, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">報價 (含稅)</span>
                <span className="font-mono">{formatCurrency(totalPriceIncludingTax, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">預估毛利</span>
                <span className={cn("font-mono font-medium", isPositive ? "text-green-600" : "text-destructive")}>
                  {formatCurrency(grossProfit, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">容量</span>
                <span className="font-mono">{capacityKwp.toFixed(2)} kWp</span>
              </div>
            </div>

            <Separator />

            {/* 成本明細 */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">成本明細</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">工程項目</span>
                  <span className="font-mono">{formatCurrency(engineeringTotal, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PV 模組</span>
                  <span className="font-mono text-blue-600">{formatCurrency(modulesTotal, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">逆變器</span>
                  <span className="font-mono text-amber-600">{formatCurrency(invertersTotal, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">印花稅</span>
                  <span className="font-mono">{formatCurrency(stampTax, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">營所稅</span>
                  <span className="font-mono">{formatCurrency(businessTax, 0)}</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
