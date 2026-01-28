import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Calculator, ChevronDown, DollarSign, TrendingUp } from "lucide-react";
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
  const [pricingOpen, setPricingOpen] = useState(true);
  const [costOpen, setCostOpen] = useState(true);
  const [profitOpen, setProfitOpen] = useState(true);

  // === 報價計算 ===
  // 每kW報價 (含稅)
  const pricePerKwpWithTax = pricePerKwp * (1 + taxRate);
  // 報價金額 (未稅)
  const totalPriceExcludingTax = capacityKwp * pricePerKwp;
  // 報價金額 (含稅)
  const totalPriceIncludingTax = totalPriceExcludingTax * (1 + taxRate);

  // === 成本計算 ===
  const totalCost = engineeringTotal + modulesTotal + invertersTotal;
  const totalCostWithTax = totalCost * (1 + taxRate);
  
  // 印花稅 (含稅總價之千分之一)
  const stampTax = totalCostWithTax * 0.001;
  // 營所稅 (含稅總價之2%)
  const businessTax = totalCostWithTax * 0.02;
  
  const grandTotal = totalCost + stampTax + businessTax;
  const grossProfit = totalPriceExcludingTax - grandTotal;
  const grossMargin = totalPriceExcludingTax > 0 ? (grossProfit / totalPriceExcludingTax) * 100 : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          報價與成本摘要
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* === 報價金額區塊 === */}
        <Collapsible open={pricingOpen} onOpenChange={setPricingOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-primary" />
              報價金額
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              pricingOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {/* 每kW報價 (未稅) - 可編輯 */}
              <div className="space-y-2">
                <Label htmlFor="pricePerKwp" className="text-sm text-muted-foreground">
                  每kW報價 (未稅)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    NT$
                  </span>
                  <Input
                    id="pricePerKwp"
                    type="number"
                    value={pricePerKwp || ""}
                    onChange={(e) => onPricePerKwpChange(Number(e.target.value) || 0)}
                    className="pl-12 text-base font-semibold font-mono text-primary h-10"
                    placeholder="45000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">每kW報價 (含稅)</span>
                <p className="text-base font-semibold font-mono text-primary h-10 flex items-center">
                  {formatCurrency(pricePerKwpWithTax, 0)}
                </p>
              </div>

              {/* 總建置價格 */}
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">總建置價格 (未稅)</span>
                <p className="text-lg font-semibold font-mono">
                  {formatCurrency(totalPriceExcludingTax, 0)}
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">總建置價格 (含稅)</span>
                <p className="text-lg font-semibold font-mono">
                  {formatCurrency(totalPriceIncludingTax, 0)}
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* === 成本明細區塊 === */}
        <Collapsible open={costOpen} onOpenChange={setCostOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4 text-amber-600" />
              成本明細
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              costOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
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
            
            <Separator className="my-2" />
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">印花稅 (千分之一)</span>
              <span className="font-mono font-medium">{formatCurrency(stampTax, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">營所稅 (2%)</span>
              <span className="font-mono font-medium">{formatCurrency(businessTax, 0)}</span>
            </div>
            
            <Separator className="my-2" />
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">總成本</span>
              <span className="text-lg font-bold font-mono">{formatCurrency(grandTotal, 0)}</span>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* === 毛利分析區塊 === */}
        <Collapsible open={profitOpen} onOpenChange={setProfitOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-green-600" />
              毛利分析
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              profitOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">報價金額 (未稅)</span>
              <span className="text-lg font-semibold font-mono">{formatCurrency(totalPriceExcludingTax, 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">預估毛利</span>
              <span className={cn(
                "text-xl font-bold font-mono",
                grossProfit >= 0 ? "text-green-600" : "text-destructive"
              )}>
                {formatCurrency(grossProfit, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">毛利率</span>
              <span className={cn(
                "text-xl font-bold",
                grossMargin >= 0 ? "text-green-600" : "text-destructive"
              )}>
                {grossMargin.toFixed(1)}%
              </span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
