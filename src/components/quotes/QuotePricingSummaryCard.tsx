import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Calculator, ChevronDown, TrendingUp, TrendingDown, Layers, Receipt } from "lucide-react";
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
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          報價與成本摘要
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* === 精簡版：關鍵數字 === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* 每kW報價輸入 */}
          <div className="space-y-2">
            <Label htmlFor="pricePerKwp" className="text-sm font-medium text-foreground">
              每kW報價 (未稅)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/70 text-sm font-medium">
                NT$
              </span>
              <Input
                id="pricePerKwp"
                type="number"
                value={pricePerKwp || ""}
                onChange={(e) => onPricePerKwpChange(Number(e.target.value) || 0)}
                className="pl-12 text-lg font-bold font-mono text-primary h-11"
                placeholder="45000"
              />
            </div>
          </div>

          {/* 報價總額 - 重點突出 */}
          <div className="space-y-2 p-3 rounded-lg bg-primary/10">
            <span className="text-sm font-medium text-foreground">報價總額 (未稅)</span>
            <p className="text-2xl font-bold font-mono text-primary">
              {formatCurrency(totalPriceExcludingTax, 0)}
            </p>
          </div>

          {/* 總成本 */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">總成本</span>
            <p className="text-2xl font-bold font-mono text-foreground">
              {formatCurrency(grandTotal, 0)}
            </p>
          </div>

          {/* 毛利率 - 最重點 */}
          <div className={cn(
            "space-y-2 p-3 rounded-lg",
            isPositive ? "bg-green-500/10" : "bg-destructive/10"
          )}>
            <span className="text-sm font-medium text-foreground">毛利率</span>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-destructive" />
              )}
              <span className={cn(
                "text-3xl font-bold",
                isPositive ? "text-green-600" : "text-destructive"
              )}>
                {grossMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* === 展開詳情按鈕 === */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-center w-full py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors gap-1.5">
            <span>{detailsOpen ? "收起詳情" : "展開詳情"}</span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform duration-200",
              detailsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pt-4 space-y-5">
            <Separator />
            
            {/* 報價明細區塊 */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Receipt className="h-4 w-4 text-primary" />
                報價明細
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">每kW (含稅)</span>
                  <p className="text-base font-semibold font-mono">{formatCurrency(pricePerKwpWithTax, 0)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">報價 (含稅)</span>
                  <p className="text-base font-semibold font-mono">{formatCurrency(totalPriceIncludingTax, 0)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">預估毛利</span>
                  <p className={cn("text-lg font-bold font-mono", isPositive ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(grossProfit, 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">建置容量</span>
                  <p className="text-base font-semibold font-mono">{capacityKwp.toFixed(2)} kWp</p>
                </div>
              </div>
            </div>

            {/* 成本明細區塊 */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers className="h-4 w-4 text-amber-600" />
                成本明細
              </div>
              <div className="grid grid-cols-3 gap-4">
                {/* 主要成本 */}
                <div className="space-y-1 p-3 rounded-md bg-muted/50">
                  <span className="text-xs text-muted-foreground">工程項目</span>
                  <p className="text-lg font-bold font-mono">{formatCurrency(engineeringTotal, 0)}</p>
                </div>
                <div className="space-y-1 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30">
                  <span className="text-xs text-muted-foreground">PV 模組</span>
                  <p className="text-lg font-bold font-mono text-blue-600">{formatCurrency(modulesTotal, 0)}</p>
                </div>
                <div className="space-y-1 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30">
                  <span className="text-xs text-muted-foreground">逆變器</span>
                  <p className="text-lg font-bold font-mono text-amber-600">{formatCurrency(invertersTotal, 0)}</p>
                </div>
              </div>
              
              {/* 稅費 */}
              <Separator className="my-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">印花稅 (千分之一)</span>
                  <p className="text-base font-semibold font-mono">{formatCurrency(stampTax, 0)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">營所稅 (2%)</span>
                  <p className="text-base font-semibold font-mono">{formatCurrency(businessTax, 0)}</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
