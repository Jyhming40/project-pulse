import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Percent, Zap } from "lucide-react";
import { QuoteParams, formatCurrency, formatPercentage } from "@/lib/quoteCalculations";
import { Plot } from "@/lib/plotly";

interface QuoteFinancialAnalysisTabProps {
  formData: QuoteParams;
  projections: {
    projections: any[];
    summary: any;
  } | null;
}

export default function QuoteFinancialAnalysisTab({
  formData,
  projections,
}: QuoteFinancialAnalysisTabProps) {
  if (!projections) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        請先在「基本資訊」頁面設定容量與參數
      </div>
    );
  }

  const { projections: yearlyData, summary } = projections;

  // Prepare chart data
  const years = yearlyData.map((p) => `第${p.yearNumber}年`);
  const revenues = yearlyData.map((p) => p.electricityRevenue);
  const cashFlows = yearlyData.map((p) => p.annualCashFlow);
  const cumulativeCashFlows = yearlyData.map((p) => p.cumulativeCashFlow);
  const loanPayments = yearlyData.map((p) => p.loanPayment);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">20年 IRR</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatPercentage(summary.irr20Year)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">回收年限</span>
            </div>
            <p className="text-2xl font-bold">{summary.paybackYears} 年</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">20年總收益</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue20Year, 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm text-muted-foreground">20年淨利</span>
            </div>
            <p className={`text-2xl font-bold ${summary.netProfit20Year >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(summary.netProfit20Year, 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">總投資報酬率</span>
            </div>
            <p className="text-2xl font-bold">{formatPercentage(summary.totalRoi)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">年均報酬率</span>
            </div>
            <p className="text-2xl font-bold">{formatPercentage(summary.annualRoi)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">現金流量圖</CardTitle>
        </CardHeader>
        <CardContent>
          <Plot
            data={[
              {
                x: years,
                y: revenues,
                type: "bar",
                name: "電費收入",
                marker: { color: "hsl(173, 58%, 45%)" },
              },
              {
                x: years,
                y: cashFlows,
                type: "bar",
                name: "年度現金流",
                marker: { color: "hsl(210, 70%, 50%)" },
              },
              {
                x: years,
                y: cumulativeCashFlows,
                type: "scatter",
                mode: "lines+markers",
                name: "累積現金流",
                yaxis: "y2",
                line: { color: "hsl(38, 92%, 50%)", width: 2 },
                marker: { size: 6 },
              },
            ]}
            layout={{
              autosize: true,
              height: 350,
              margin: { l: 60, r: 60, t: 30, b: 60 },
              showlegend: true,
              legend: { orientation: "h", y: -0.2 },
              yaxis: { title: { text: "金額 (元)" }, tickformat: ",.0f" },
              yaxis2: {
                title: { text: "累積現金流 (元)" },
                overlaying: "y",
                side: "right",
                tickformat: ",.0f",
              },
              barmode: "group",
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">20年保險費用</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(summary.totalInsurance20Year, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">20年保固費用</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(summary.totalMaintenance20Year, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">20年租金費用</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(summary.totalRent20Year, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Yearly Projection Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">20年財務預測明細</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-center">年度</TableHead>
                  <TableHead className="text-right">發電量 (kWh)</TableHead>
                  <TableHead className="text-right">電費收入</TableHead>
                  <TableHead className="text-right">貸款還款</TableHead>
                  <TableHead className="text-right">保固費</TableHead>
                  <TableHead className="text-right">保險費</TableHead>
                  <TableHead className="text-right">租金</TableHead>
                  <TableHead className="text-right">年度現金流</TableHead>
                  <TableHead className="text-right">累積現金流</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearlyData.map((year: any) => (
                  <TableRow key={year.yearNumber}>
                    <TableCell className="text-center font-medium">第 {year.yearNumber} 年</TableCell>
                    <TableCell className="text-right">{year.estimatedGenerationKwh.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(year.electricityRevenue, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(year.loanPayment, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(year.maintenanceCost, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(year.insuranceCost, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(year.rentCost, 0)}</TableCell>
                    <TableCell className={`text-right font-medium ${year.annualCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(year.annualCashFlow, 0)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${year.cumulativeCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(year.cumulativeCashFlow, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
