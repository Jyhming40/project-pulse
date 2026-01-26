import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/quoteCalculations";

interface QuoteCostSummaryCardProps {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  sellingPrice: number;
  taxRate?: number;
}

export default function QuoteCostSummaryCard({
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  sellingPrice,
  taxRate = 0.05,
}: QuoteCostSummaryCardProps) {
  const totalCost = engineeringTotal + modulesTotal + invertersTotal;
  const totalCostWithTax = totalCost * (1 + taxRate);
  
  // 印花稅 (含稅總價之千分之一)
  const stampTax = totalCostWithTax * 0.001;
  // 營所稅 (含稅總價之2%)
  const businessTax = totalCostWithTax * 0.02;
  
  const grandTotal = totalCost + stampTax + businessTax;
  const grossProfit = sellingPrice - grandTotal;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">成本摘要</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 成本明細 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">工程項目成本</span>
            <span className="font-mono">{formatCurrency(engineeringTotal, 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">PV 模組成本</span>
            <span className="font-mono text-blue-600">{formatCurrency(modulesTotal, 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">逆變器成本</span>
            <span className="font-mono text-amber-600">{formatCurrency(invertersTotal, 0)}</span>
          </div>
        </div>

        <Separator />

        {/* 其他費用 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">印花稅 (千分之一)</span>
            <span className="font-mono">{formatCurrency(stampTax, 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">營所稅 (2%)</span>
            <span className="font-mono">{formatCurrency(businessTax, 0)}</span>
          </div>
        </div>

        <Separator />

        {/* 總計 */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="font-medium">總成本</span>
            <span className="text-xl font-bold font-mono">{formatCurrency(grandTotal, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">報價金額 (未稅)</span>
            <span className="text-xl font-bold font-mono">{formatCurrency(sellingPrice, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">預估毛利</span>
            <span className={`text-xl font-bold font-mono ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(grossProfit, 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">毛利率</span>
            <span className={`text-xl font-bold ${grossMargin >= 0 ? "text-green-600" : "text-destructive"}`}>
              {grossMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
