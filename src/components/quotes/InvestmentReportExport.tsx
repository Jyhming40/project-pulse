import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileDown,
  Sparkles,
  Loader2,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface InvestmentReportExportProps {
  projectName: string;
  projectLocation?: string;
  capacityKwp: number;
  pricePerKwp: number;
  totalInvestment: number;
  revenueMode: 'self_consumption' | 'feed_in_tariff';
  gridConnectionType: 'internal' | 'external';
  investmentMode: 'self_owned' | 'rental_investment';
  tariffRate: number;
  sunshineHours: number;
  sunshineDays: number;
  insuranceRate: number;
  projections: any[];
  summary: {
    totalGeneration: number;
    totalSaving: number;
    totalMaintenance: number;
    totalInsurance: number;
    totalRent: number;
    totalCost: number;
    netProfit: number;
    irr: number;
    paybackYear: number;
    costPerKwh: number;
  };
  trecEstimation?: {
    certificateCount: number;
    scenarios: {
      conservative: { totalRevenue: number };
      baseline: { totalRevenue: number };
      optimistic: { totalRevenue: number };
    };
  };
  sensitivityAnalysis?: Array<{
    growthRate: number;
    irr: number;
    label: string;
  }>;
  companyName?: string;
  companyLogo?: string;
  primaryColor?: string;
}

interface AIContent {
  opening: string;
  summary: string;
  risk: string;
}

export default function InvestmentReportExport({
  projectName,
  projectLocation,
  capacityKwp,
  pricePerKwp,
  totalInvestment,
  revenueMode,
  gridConnectionType,
  investmentMode,
  tariffRate,
  sunshineHours,
  sunshineDays,
  insuranceRate,
  projections,
  summary,
  trecEstimation,
  sensitivityAnalysis,
  companyName = "太陽能科技",
  companyLogo,
  primaryColor = "#2563eb",
}: InvestmentReportExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [includeAI, setIncludeAI] = useState(true);
  const [includeTrec, setIncludeTrec] = useState(gridConnectionType === 'internal');
  const [includeSensitivity, setIncludeSensitivity] = useState(true);
  const [reportTitle, setReportTitle] = useState(
    `${projectName || '太陽能發電系統'} - 投資報酬評估說明`
  );
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setProgress(10);
    setGenerationStatus('generating');

    try {
      // Step 1: Generate AI content
      setProgress(20);
      
      const reportData = {
        projectName,
        projectLocation: projectLocation || '',
        capacityKwp,
        pricePerKwp,
        totalInvestment,
        revenueMode,
        gridConnectionType,
        investmentMode,
        tariffRate,
        sunshineHours,
        sunshineDays,
        insuranceRate,
        projections: projections.map(p => ({
          year: p.year,
          generationKwh: p.generationKwh,
          revenue: p.electricitySaving,
          maintenanceCost: p.maintenanceCost,
          insuranceCost: p.insuranceCost,
          rentCost: p.rentCost || 0,
          cashFlow: p.cashFlow,
          cumulativeCashFlow: p.cumulativeCashFlow,
        })),
        summary: {
          totalGeneration: summary.totalGeneration,
          totalRevenue: summary.totalSaving,
          totalMaintenance: summary.totalMaintenance,
          totalInsurance: summary.totalInsurance,
          totalRent: summary.totalRent || 0,
          totalCost: summary.totalCost,
          netProfit: summary.netProfit,
          irr: summary.irr,
          paybackYear: summary.paybackYear,
          costPerKwh: summary.costPerKwh,
        },
        trecEstimation,
        sensitivityAnalysis,
      };

      setProgress(40);

      const { data, error } = await supabase.functions.invoke('generate-investment-report', {
        body: {
          reportData,
          includeAI,
        },
      });

      if (error) throw error;

      setProgress(60);
      setAiContent(data.content);

      // Step 2: Generate and open print preview
      setProgress(80);
      generatePrintPreview(data.content);

      setProgress(100);
      setGenerationStatus('ready');
      toast.success('報告已生成，請列印或儲存為 PDF');
    } catch (error) {
      console.error('Report generation error:', error);
      setGenerationStatus('error');
      toast.error('報告生成失敗', {
        description: error instanceof Error ? error.message : '請稍後再試',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePrintPreview = (content: AIContent) => {
    const modeLabels = {
      revenueMode: revenueMode === 'feed_in_tariff' ? '躉售電力' : '自用節電',
      gridType: gridConnectionType === 'internal' ? '併內線（可取得 T-REC）' : '併外線',
      investMode: investmentMode === 'self_owned' ? '自有場地' : '租賃投資',
    };

    // Build cash flow table rows (show years 1, 5, 10, 15, 20)
    const keyYears = [0, 4, 9, 14, 19];
    const cashFlowRows = keyYears
      .filter(i => projections[i])
      .map(i => {
        const p = projections[i];
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${p.year}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(p.generationKwh).toLocaleString()}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(p.electricitySaving).toLocaleString()}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(p.maintenanceCost + p.insuranceCost + (p.rentCost || 0)).toLocaleString()}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(p.cashFlow).toLocaleString()}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: ${p.cumulativeCashFlow >= 0 ? '600' : '400'}; color: ${p.cumulativeCashFlow >= 0 ? '#16a34a' : '#dc2626'};">${Math.round(p.cumulativeCashFlow).toLocaleString()}</td>
          </tr>
        `;
      })
      .join('');

    // Build T-REC section if applicable
    let trecSection = '';
    if (includeTrec && trecEstimation && gridConnectionType === 'internal') {
      trecSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: 16px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            🌱 T-REC 綠能憑證估算
          </h3>
          <p style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">併內線系統可申請綠能憑證，為企業創造額外收益與碳中和效益。</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f0fdf4;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #22c55e;">情境</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #22c55e;">單價（元/張）</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #22c55e;">20年預估收益</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">保守估計</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">3,000</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(trecEstimation.scenarios.conservative.totalRevenue).toLocaleString()}</td>
              </tr>
              <tr style="background: #f0fdf4; font-weight: 600;">
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">基準情境</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">3,500</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(trecEstimation.scenarios.baseline.totalRevenue).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">樂觀估計</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">4,600</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(trecEstimation.scenarios.optimistic.totalRevenue).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">* 預估可取得 ${trecEstimation.certificateCount.toLocaleString()} 張憑證（每 1,000 度 = 1 張）</p>
        </div>
      `;
    }

    // Build sensitivity analysis section
    let sensitivitySection = '';
    if (includeSensitivity && sensitivityAnalysis && sensitivityAnalysis.length > 0) {
      const sensitivityRows = sensitivityAnalysis.map(s => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${s.label}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${s.irr >= 8 ? '#16a34a' : s.irr >= 5 ? '#ca8a04' : '#dc2626'};">${s.irr.toFixed(2)}%</td>
        </tr>
      `).join('');

      sensitivitySection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: 16px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            📈 電價敏感度分析
          </h3>
          <p style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">不同電價成長情境下的預估報酬率變化：</p>
          <table style="width: 50%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">情境</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">IRR</th>
              </tr>
            </thead>
            <tbody>
              ${sensitivityRows}
            </tbody>
          </table>
        </div>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
      font-size: 14px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${primaryColor};
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      color: ${primaryColor};
      font-size: 22px;
      margin: 0;
    }
    .header .company {
      text-align: right;
      font-size: 12px;
      color: #6b7280;
    }
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-title {
      color: ${primaryColor};
      font-size: 16px;
      margin-bottom: 12px;
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 4px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 700;
      color: ${primaryColor};
    }
    .kpi-label {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
    }
    .ai-content {
      background: #f8fafc;
      border-left: 4px solid ${primaryColor};
      padding: 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
      white-space: pre-line;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 8px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${reportTitle}</h1>
      <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 13px;">
        ${projectLocation ? `📍 ${projectLocation}` : ''} | 裝置容量：${capacityKwp} kWp
      </p>
    </div>
    <div class="company">
      ${companyLogo ? `<img src="${companyLogo}" alt="Logo" style="height: 40px; margin-bottom: 4px;">` : ''}
      <div>${companyName}</div>
      <div>${new Date().toLocaleDateString('zh-TW')}</div>
    </div>
  </div>

  <!-- AI Opening -->
  <div class="section">
    <div class="ai-content">
      ${content.opening}
    </div>
  </div>

  <!-- Key Metrics -->
  <div class="section">
    <h3 class="section-title">📊 關鍵財務指標</h3>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${summary.irr.toFixed(2)}%</div>
        <div class="kpi-label">內部報酬率 (IRR)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${summary.paybackYear} 年</div>
        <div class="kpi-label">投資回收期</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #16a34a;">${Math.round(summary.netProfit).toLocaleString()}</div>
        <div class="kpi-label">20年淨利（元）</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${summary.costPerKwh.toFixed(2)}</div>
        <div class="kpi-label">每度電成本（元）</div>
      </div>
    </div>
  </div>

  <!-- System Overview -->
  <div class="section">
    <h3 class="section-title">⚡ 系統規劃概要</h3>
    <table style="font-size: 13px;">
      <tr>
        <td style="padding: 6px 12px; background: #f9fafb; width: 25%;">收益模式</td>
        <td style="padding: 6px 12px;">${modeLabels.revenueMode}</td>
        <td style="padding: 6px 12px; background: #f9fafb; width: 25%;">併網類型</td>
        <td style="padding: 6px 12px;">${modeLabels.gridType}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; background: #f9fafb;">投資模式</td>
        <td style="padding: 6px 12px;">${modeLabels.investMode}</td>
        <td style="padding: 6px 12px; background: #f9fafb;">每kW單價</td>
        <td style="padding: 6px 12px;">${pricePerKwp.toLocaleString()} 元</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; background: #f9fafb;">總投資金額</td>
        <td style="padding: 6px 12px; font-weight: 600;">${totalInvestment.toLocaleString()} 元</td>
        <td style="padding: 6px 12px; background: #f9fafb;">${revenueMode === 'feed_in_tariff' ? '躉購費率' : '電費單價'}</td>
        <td style="padding: 6px 12px;">${tariffRate.toFixed(4)} 元/度</td>
      </tr>
    </table>
  </div>

  <!-- Cash Flow Summary -->
  <div class="section">
    <h3 class="section-title">💰 20年現金流量預估</h3>
    <table style="font-size: 12px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border-bottom: 2px solid ${primaryColor};">年度</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">發電量 (度)</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">${revenueMode === 'feed_in_tariff' ? '躉售收入' : '節省電費'}</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">營運成本</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">年度現金流</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">累計現金流</th>
        </tr>
      </thead>
      <tbody>
        ${cashFlowRows}
      </tbody>
      <tfoot>
        <tr style="background: #f0f9ff; font-weight: 600;">
          <td style="padding: 8px;">合計</td>
          <td style="padding: 8px; text-align: right;">${Math.round(summary.totalGeneration).toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${Math.round(summary.totalSaving).toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${Math.round(summary.totalMaintenance + summary.totalInsurance + (summary.totalRent || 0)).toLocaleString()}</td>
          <td colspan="2" style="padding: 8px; text-align: right; color: ${summary.netProfit >= 0 ? '#16a34a' : '#dc2626'};">
            淨利：${Math.round(summary.netProfit).toLocaleString()} 元
          </td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">* 表格顯示第 1、5、10、15、20 年數據摘要。完整 20 年試算表請另行參閱。</p>
  </div>

  ${trecSection}
  ${sensitivitySection}

  <!-- AI Summary & Risk -->
  <div class="section" style="page-break-before: auto;">
    <h3 class="section-title">💡 投資建議</h3>
    <div class="ai-content">
      ${content.summary}
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">⚠️ 風險評估</h3>
    <div class="ai-content">
      ${content.risk}
    </div>
  </div>

  <div class="footer">
    <p>本報告僅供投資評估參考，實際收益可能因天候、設備效能、電價政策等因素而異。</p>
    <p>報告生成日期：${new Date().toLocaleString('zh-TW')} | ${companyName}</p>
  </div>
</body>
</html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    } else {
      toast.error('無法開啟列印視窗', { description: '請檢查瀏覽器是否封鎖彈出視窗' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileDown className="h-4 w-4" />
          匯出投資報告
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            產生投資報酬評估報告
          </DialogTitle>
          <DialogDescription>
            生成專業的 PDF 投資報告，可搭配 AI 自動產生客製化內容
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Title */}
          <div className="space-y-2">
            <Label htmlFor="reportTitle">報告標題</Label>
            <Input
              id="reportTitle"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="輸入報告標題"
            />
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI 客製化內容
                </Label>
                <p className="text-xs text-muted-foreground">
                  自動生成開場白、投資建議與風險評估
                </p>
              </div>
              <Switch
                checked={includeAI}
                onCheckedChange={setIncludeAI}
              />
            </div>

            {gridConnectionType === 'internal' && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>T-REC 綠能憑證估算</Label>
                  <p className="text-xs text-muted-foreground">
                    顯示三情境憑證收益試算
                  </p>
                </div>
                <Switch
                  checked={includeTrec}
                  onCheckedChange={setIncludeTrec}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>電價敏感度分析</Label>
                <p className="text-xs text-muted-foreground">
                  顯示不同電價成長情境的 IRR 變化
                </p>
              </div>
              <Switch
                checked={includeSensitivity}
                onCheckedChange={setIncludeSensitivity}
              />
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress < 40 && '正在生成 AI 內容...'}
                {progress >= 40 && progress < 80 && '正在組裝報告...'}
                {progress >= 80 && '準備列印預覽...'}
              </p>
            </div>
          )}

          {/* Status */}
          {generationStatus === 'ready' && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              報告已生成完成！請在新視窗中列印或儲存為 PDF。
            </div>
          )}

          {generationStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              報告生成失敗，請稍後再試。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                生成報告
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
