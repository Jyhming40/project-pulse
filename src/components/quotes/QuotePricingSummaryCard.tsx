import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Calculator } from "lucide-react";

interface QuotePricingSummaryCardProps {
  capacityKwp: number;
  pricePerKwp: number;
  taxRate: number;
  onPricePerKwpChange: (value: number) => void;
}

export default function QuotePricingSummaryCard({
  capacityKwp,
  pricePerKwp,
  taxRate = 0.05,
  onPricePerKwpChange,
}: QuotePricingSummaryCardProps) {
  // 每kW報價 (含稅)
  const pricePerKwpWithTax = pricePerKwp * (1 + taxRate);
  // 報價金額 (未稅)
  const totalPriceExcludingTax = capacityKwp * pricePerKwp;
  // 報價金額 (含稅)
  const totalPriceIncludingTax = totalPriceExcludingTax * (1 + taxRate);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          報價金額摘要
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
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

          <Separator className="col-span-2" />

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
      </CardContent>
    </Card>
  );
}
