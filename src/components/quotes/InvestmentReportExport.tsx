import { useState, useRef, useCallback } from "react";
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
  Upload,
  X,
  Image as ImageIcon,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettingsRead } from "@/hooks/useAppSettings";

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

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  caption: string;
}

// Image upload slot component
function ImageUploadSlot({
  id,
  label,
  image,
  onUpload,
  onRemove,
  onCaptionChange,
}: {
  id: string;
  label: string;
  image: UploadedImage | null;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('圖片大小不可超過 5MB');
        return;
      }
      onUpload(id, file);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {image ? (
        <div className="relative group">
          <img
            src={image.dataUrl}
            alt={image.caption || label}
            className="w-full h-32 object-cover rounded-lg border"
          />
          <button
            onClick={() => onRemove(id)}
            className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
          <Input
            placeholder="圖片說明（選填）"
            value={image.caption}
            onChange={(e) => onCaptionChange(id, e.target.value)}
            className="mt-2 text-xs"
          />
        </div>
      ) : (
        <button
          onClick={handleClick}
          className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Upload className="h-6 w-6" />
          <span className="text-xs">點擊上傳圖片</span>
        </button>
      )}
    </div>
  );
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
  companyName: propCompanyName,
  companyLogo: propCompanyLogo,
  primaryColor: propPrimaryColor,
}: InvestmentReportExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [includeAI, setIncludeAI] = useState(true);
  const [includeTrec, setIncludeTrec] = useState(gridConnectionType === 'internal');
  const [includeSensitivity, setIncludeSensitivity] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [reportTitle, setReportTitle] = useState(
    `${projectName || '太陽能發電系統'} - 投資報酬評估說明`
  );
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  
  // Custom image uploads
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadedImage>>({});

  // Get app settings for branding
  const { settings } = useAppSettingsRead();
  
  // Use settings or props for branding
  const companyName = settings?.company_name_zh || propCompanyName || '太陽能科技';
  const companyLogo = settings?.logo_light_url || propCompanyLogo;
  const primaryColor = settings?.primary_color || propPrimaryColor || '#2563eb';

  // Handle image upload
  const handleImageUpload = useCallback((id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImages(prev => ({
        ...prev,
        [id]: {
          id,
          name: file.name,
          dataUrl,
          caption: '',
        },
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle image removal
  const handleImageRemove = useCallback((id: string) => {
    setUploadedImages(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  // Handle caption change
  const handleCaptionChange = useCallback((id: string, caption: string) => {
    setUploadedImages(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        caption,
      },
    }));
  }, []);

  // Generate SVG chart for cash flow (inline in HTML)
  const generateCashFlowChartSvg = useCallback(() => {
    const width = 600;
    const height = 250;
    const padding = { top: 30, right: 30, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const years = projections.map(p => p.year);
    const cumulative = projections.map(p => p.cumulativeCashFlow);
    const annual = projections.map(p => p.cashFlow);

    const minVal = Math.min(...cumulative, 0);
    const maxVal = Math.max(...cumulative, ...annual);
    const range = maxVal - minVal || 1;

    const getY = (val: number) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
    const getX = (idx: number) => padding.left + (idx / (years.length - 1)) * chartWidth;

    // Zero line position
    const zeroY = getY(0);

    // Cumulative line path
    const cumulativePath = cumulative
      .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
      .join(' ');

    // Bar chart for annual
    const barWidth = chartWidth / years.length * 0.6;
    const bars = annual.map((val, idx) => {
      const x = getX(idx) - barWidth / 2;
      const y = val >= 0 ? getY(val) : getY(0);
      const h = Math.abs(getY(val) - getY(0));
      const fill = val >= 0 ? primaryColor : '#dc2626';
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${fill}" opacity="0.6" rx="2"/>`;
    }).join('');

    // Y-axis labels
    const yLabels = [minVal, minVal + range * 0.5, maxVal].map((val, idx) => {
      const y = getY(val);
      return `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6b7280">${(val / 10000).toFixed(0)}萬</text>`;
    }).join('');

    // X-axis labels (every 5 years)
    const xLabels = years
      .filter((_, idx) => idx % 5 === 0 || idx === years.length - 1)
      .map((year, idx, arr) => {
        const originalIdx = years.indexOf(year);
        const x = getX(originalIdx);
        return `<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#6b7280">第${year}年</text>`;
      }).join('');

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#22c55e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- Grid lines -->
        <line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
        <!-- Bars -->
        ${bars}
        <!-- Cumulative line -->
        <path d="${cumulativePath}" fill="none" stroke="url(#lineGradient)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Data points -->
        ${cumulative.map((val, idx) => `<circle cx="${getX(idx)}" cy="${getY(val)}" r="4" fill="${val >= 0 ? '#22c55e' : '#dc2626'}" stroke="white" stroke-width="2"/>`).join('')}
        <!-- Y axis labels -->
        ${yLabels}
        <!-- X axis labels -->
        ${xLabels}
        <!-- Legend -->
        <rect x="${width - 150}" y="10" width="12" height="12" fill="${primaryColor}" opacity="0.6" rx="2"/>
        <text x="${width - 132}" y="20" font-size="11" fill="#374151">年度現金流</text>
        <line x1="${width - 150}" y1="35" x2="${width - 138}" y2="35" stroke="url(#lineGradient)" stroke-width="3"/>
        <text x="${width - 132}" y="38" font-size="11" fill="#374151">累計現金流</text>
      </svg>
    `;
  }, [projections, primaryColor]);

  // Generate IRR comparison chart
  const generateIrrChartSvg = useCallback(() => {
    if (!sensitivityAnalysis || sensitivityAnalysis.length === 0) return '';

    const width = 400;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 50, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxIrr = Math.max(...sensitivityAnalysis.map(s => s.irr), 10);
    const barHeight = (chartHeight / sensitivityAnalysis.length) * 0.7;
    const barGap = (chartHeight / sensitivityAnalysis.length) * 0.3;

    const bars = sensitivityAnalysis.map((s, idx) => {
      const barWidth = (s.irr / maxIrr) * chartWidth;
      const y = padding.top + idx * (barHeight + barGap);
      const color = s.irr >= 8 ? '#22c55e' : s.irr >= 5 ? '#eab308' : '#dc2626';
      return `
        <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4"/>
        <text x="${padding.left + barWidth + 8}" y="${y + barHeight / 2 + 4}" font-size="12" font-weight="600" fill="${color}">${s.irr.toFixed(2)}%</text>
        <text x="${padding.left - 8}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="11" fill="#374151">${s.label}</text>
      `;
    }).join('');

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${bars}
      </svg>
    `;
  }, [sensitivityAnalysis]);

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

    // Generate charts
    const cashFlowChart = includeCharts ? generateCashFlowChartSvg() : '';
    const irrChart = includeCharts && sensitivityAnalysis ? generateIrrChartSvg() : '';

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

    // Build sensitivity analysis section with chart
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
          <div style="display: flex; gap: 24px; align-items: flex-start;">
            <table style="width: 40%; border-collapse: collapse; font-size: 13px;">
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
            ${includeCharts && irrChart ? `<div style="flex: 1;">${irrChart}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Build custom images section
    let customImagesSection = '';
    const imageEntries = Object.values(uploadedImages);
    if (imageEntries.length > 0) {
      const imageCards = imageEntries.map(img => `
        <div style="break-inside: avoid; margin-bottom: 16px;">
          <img src="${img.dataUrl}" alt="${img.caption || img.name}" style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb;"/>
          ${img.caption ? `<p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 8px;">${img.caption}</p>` : ''}
        </div>
      `).join('');

      customImagesSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: 16px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            📷 專案附圖
          </h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            ${imageCards}
          </div>
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
    .header .company img {
      max-height: 50px;
      max-width: 150px;
      object-fit: contain;
      margin-bottom: 8px;
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
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 12px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 700;
      color: ${primaryColor};
      line-height: 1.2;
    }
    .kpi-label {
      font-size: 11px;
      color: #6b7280;
      margin-top: 6px;
    }
    .ai-content {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 4px solid ${primaryColor};
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 0 12px 12px 0;
      white-space: pre-line;
      font-size: 13px;
      line-height: 1.8;
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
    .chart-container {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
      text-align: center;
    }
    .chart-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
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
      ${companyLogo ? `<img src="${companyLogo}" alt="Logo" />` : `<div style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-bottom: 4px;">${companyName}</div>`}
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
        <div class="kpi-value" style="color: #16a34a;">${Math.round(summary.netProfit / 10000).toLocaleString()}萬</div>
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
    <table style="font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 10px 12px; background: #f9fafb; width: 25%; font-weight: 500;">收益模式</td>
        <td style="padding: 10px 12px;">${modeLabels.revenueMode}</td>
        <td style="padding: 10px 12px; background: #f9fafb; width: 25%; font-weight: 500;">併網類型</td>
        <td style="padding: 10px 12px;">${modeLabels.gridType}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background: #f9fafb; font-weight: 500;">投資模式</td>
        <td style="padding: 10px 12px;">${modeLabels.investMode}</td>
        <td style="padding: 10px 12px; background: #f9fafb; font-weight: 500;">每kW單價</td>
        <td style="padding: 10px 12px;">${pricePerKwp.toLocaleString()} 元</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background: #f9fafb; font-weight: 500;">總投資金額</td>
        <td style="padding: 10px 12px; font-weight: 600; color: ${primaryColor};">${totalInvestment.toLocaleString()} 元</td>
        <td style="padding: 10px 12px; background: #f9fafb; font-weight: 500;">${revenueMode === 'feed_in_tariff' ? '躉購費率' : '電費單價'}</td>
        <td style="padding: 10px 12px;">${tariffRate.toFixed(4)} 元/度</td>
      </tr>
    </table>
  </div>

  <!-- Cash Flow Chart -->
  ${includeCharts && cashFlowChart ? `
  <div class="section">
    <h3 class="section-title">📈 20年現金流預估圖</h3>
    <div class="chart-container">
      ${cashFlowChart}
    </div>
  </div>
  ` : ''}

  <!-- Cash Flow Summary -->
  <div class="section">
    <h3 class="section-title">💰 20年現金流量預估</h3>
    <table style="font-size: 12px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);">
          <th style="padding: 10px 8px; border-bottom: 2px solid ${primaryColor};">年度</th>
          <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">發電量 (度)</th>
          <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">${revenueMode === 'feed_in_tariff' ? '躉售收入' : '節省電費'}</th>
          <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">營運成本</th>
          <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">年度現金流</th>
          <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid ${primaryColor};">累計現金流</th>
        </tr>
      </thead>
      <tbody>
        ${cashFlowRows}
      </tbody>
      <tfoot>
        <tr style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); font-weight: 600;">
          <td style="padding: 10px 8px;">合計</td>
          <td style="padding: 10px 8px; text-align: right;">${Math.round(summary.totalGeneration).toLocaleString()}</td>
          <td style="padding: 10px 8px; text-align: right;">${Math.round(summary.totalSaving).toLocaleString()}</td>
          <td style="padding: 10px 8px; text-align: right;">${Math.round(summary.totalMaintenance + summary.totalInsurance + (summary.totalRent || 0)).toLocaleString()}</td>
          <td colspan="2" style="padding: 10px 8px; text-align: right; color: ${summary.netProfit >= 0 ? '#16a34a' : '#dc2626'};">
            淨利：${Math.round(summary.netProfit).toLocaleString()} 元
          </td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">* 表格顯示第 1、5、10、15、20 年數據摘要。完整 20 年試算表請另行參閱。</p>
  </div>

  ${trecSection}
  ${sensitivitySection}
  ${customImagesSection}

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Branding Preview */}
          {companyLogo && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <img src={companyLogo} alt="Logo" className="h-10 object-contain" />
              <div className="text-sm">
                <div className="font-medium">{companyName}</div>
                <div className="text-xs text-muted-foreground">將顯示於報告頁首</div>
              </div>
            </div>
          )}

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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  圖表視覺化
                </Label>
                <p className="text-xs text-muted-foreground">
                  加入現金流折線圖與 IRR 比較圖
                </p>
              </div>
              <Switch
                checked={includeCharts}
                onCheckedChange={setIncludeCharts}
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

          <Separator />

          {/* Custom Image Uploads */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <Label>自訂圖片（選填）</Label>
              <Badge variant="outline" className="text-xs">最多 4 張</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              上傳場地照片、設備規劃圖或其他相關圖表
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ImageUploadSlot
                id="img1"
                label="圖片 1"
                image={uploadedImages['img1'] || null}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
                onCaptionChange={handleCaptionChange}
              />
              <ImageUploadSlot
                id="img2"
                label="圖片 2"
                image={uploadedImages['img2'] || null}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
                onCaptionChange={handleCaptionChange}
              />
              <ImageUploadSlot
                id="img3"
                label="圖片 3"
                image={uploadedImages['img3'] || null}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
                onCaptionChange={handleCaptionChange}
              />
              <ImageUploadSlot
                id="img4"
                label="圖片 4"
                image={uploadedImages['img4'] || null}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
                onCaptionChange={handleCaptionChange}
              />
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress < 40 && '正在生成 AI 內容...'}
                {progress >= 40 && progress < 80 && '正在組裝報告與圖表...'}
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
