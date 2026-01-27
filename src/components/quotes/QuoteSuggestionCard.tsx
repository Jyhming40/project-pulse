import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Lightbulb, TrendingUp } from "lucide-react";

interface CostBreakdown {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
}

interface QuoteSuggestionCardProps {
  costs: CostBreakdown;
  capacityKwp: number;
  taxRate?: number;
}

export default function QuoteSuggestionCard({
  costs,
  capacityKwp,
  taxRate = 0.05,
}: QuoteSuggestionCardProps) {
  const { engineeringTotal, modulesTotal, invertersTotal } = costs;
  
  // 計算成本 (未稅/含稅)
  const totalCostExcludingTax = engineeringTotal + modulesTotal + invertersTotal;
  const totalCostIncludingTax = totalCostExcludingTax * (1 + taxRate);
  
  // 每kW成本
  const costPerKwpExcludingTax = capacityKwp > 0 ? totalCostExcludingTax / capacityKwp : 0;
  const costPerKwpIncludingTax = capacityKwp > 0 ? totalCostIncludingTax / capacityKwp : 0;
  
  // 分項成本每kW (未稅/含稅)
  const engineeringPerKwp = capacityKwp > 0 ? engineeringTotal / capacityKwp : 0;
  const modulesPerKwp = capacityKwp > 0 ? modulesTotal / capacityKwp : 0;
  const invertersPerKwp = capacityKwp > 0 ? invertersTotal / capacityKwp : 0;
  
  const engineeringWithTax = engineeringTotal * (1 + taxRate);
  const modulesWithTax = modulesTotal * (1 + taxRate);
  const invertersWithTax = invertersTotal * (1 + taxRate);
  
  const engineeringPerKwpWithTax = capacityKwp > 0 ? engineeringWithTax / capacityKwp : 0;
  const modulesPerKwpWithTax = capacityKwp > 0 ? modulesWithTax / capacityKwp : 0;
  const invertersPerKwpWithTax = capacityKwp > 0 ? invertersWithTax / capacityKwp : 0;

  // 毛利率目標
  const marginTargets = [15, 20, 30];
  
  // 根據毛利率計算建議報價 (未稅)
  const calculateSuggestedPrice = (marginPercent: number) => {
    // 報價 = 成本 / (1 - 毛利率)
    return totalCostExcludingTax / (1 - marginPercent / 100);
  };
  
  // 計算建議每kW報價
  const calculateSuggestedPricePerKwp = (marginPercent: number) => {
    const suggestedTotal = calculateSuggestedPrice(marginPercent);
    return capacityKwp > 0 ? suggestedTotal / capacityKwp : 0;
  };
  
  // 計算預計利潤
  const calculateProfit = (marginPercent: number) => {
    const suggestedPrice = calculateSuggestedPrice(marginPercent);
    return suggestedPrice - totalCostExcludingTax;
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          成本分析與建議報價
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 工程成本分類表 */}
        <div>
          <h4 className="text-sm font-medium mb-3">工程成本明細</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm">項目</TableHead>
                <TableHead className="text-right text-sm">金額 (未稅)</TableHead>
                <TableHead className="text-right text-sm">每kWp</TableHead>
                <TableHead className="text-right text-sm">金額 (含稅)</TableHead>
                <TableHead className="text-right text-sm">每kWp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm font-medium">工程項目成本</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatCurrency(engineeringTotal, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(engineeringPerKwp, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatCurrency(engineeringWithTax, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(engineeringPerKwpWithTax, 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">PV 模組成本</TableCell>
                <TableCell className="text-right font-mono text-sm text-blue-600">{formatCurrency(modulesTotal, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(modulesPerKwp, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-blue-600">{formatCurrency(modulesWithTax, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(modulesPerKwpWithTax, 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">逆變器成本</TableCell>
                <TableCell className="text-right font-mono text-sm text-amber-600">{formatCurrency(invertersTotal, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(invertersPerKwp, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-amber-600">{formatCurrency(invertersWithTax, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(invertersPerKwpWithTax, 0)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="text-sm font-semibold">小計</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(totalCostExcludingTax, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(costPerKwpExcludingTax, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(totalCostIncludingTax, 0)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(costPerKwpIncludingTax, 0)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <Separator />

        {/* 建議報價表 */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            建議報價 (依毛利率)
          </h4>
          <Table>
            <TableHeader>
              <TableRow className="bg-green-50 dark:bg-green-950/30">
                <TableHead className="text-sm">項目</TableHead>
                {marginTargets.map((m) => (
                  <TableHead key={m} className="text-right text-sm">
                    毛利率 {m}%
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm font-medium">每kWp建議報價 (未稅)</TableCell>
                {marginTargets.map((m) => (
                  <TableCell key={m} className="text-right font-mono text-sm font-semibold text-green-700 dark:text-green-400">
                    {formatCurrency(calculateSuggestedPricePerKwp(m), 0)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">總報價金額 (未稅)</TableCell>
                {marginTargets.map((m) => (
                  <TableCell key={m} className="text-right font-mono text-sm">
                    {formatCurrency(calculateSuggestedPrice(m), 0)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-muted/30">
                <TableCell className="text-sm font-medium">預計利潤</TableCell>
                {marginTargets.map((m) => (
                  <TableCell key={m} className="text-right font-mono text-sm text-primary font-semibold">
                    {formatCurrency(calculateProfit(m), 0)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
