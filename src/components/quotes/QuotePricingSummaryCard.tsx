import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Calculator } from "lucide-react";

interface QuotePricingSummaryCardProps {
  capacityKwp: number;
  pricePerKwp: number;
  taxRate: number;
}

export default function QuotePricingSummaryCard({
  capacityKwp,
  pricePerKwp,
  taxRate = 0.05,
}: QuotePricingSummaryCardProps) {
  // 報價金額 (未稅)
  const totalPriceExcludingTax = capacityKwp * pricePerKwp;
  // 報價金額 (含稅)
  const totalPriceIncludingTax = totalPriceExcludingTax * (1 + taxRate);
  // 每kW報價 (含稅)
  const pricePerKwpWithTax = capacityKwp > 0 ? totalPriceIncludingTax / capacityKwp : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          報價金額摘要
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {/* 每kW報價 */}
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">每kW報價 (未稅)</span>
            <p className="text-lg font-bold font-mono text-primary">
              {formatCurrency(pricePerKwp, 0)}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">每kW報價 (含稅)</span>
            <p className="text-lg font-bold font-mono text-primary">
              {formatCurrency(pricePerKwpWithTax, 0)}
            </p>
          </div>

          <Separator className="col-span-2" />

          {/* 總建置價格 */}
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">總建置價格 (未稅)</span>
            <p className="text-xl font-bold font-mono">
              {formatCurrency(totalPriceExcludingTax, 0)}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">總建置價格 (含稅)</span>
            <p className="text-xl font-bold font-mono">
              {formatCurrency(totalPriceIncludingTax, 0)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
