import { useState, useRef, useCallback, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettingsRead } from "@/hooks/useAppSettings";
import ReportStylePanel from "./ReportStylePanel";
import {
  ReportStyleSettings,
  ReportTextContent,
  ReportTemplateType,
  REPORT_TEMPLATES,
  DEFAULT_REPORT_STYLE,
  DEFAULT_REPORT_TEXT,
  EngineeringSpec,
} from "@/types/investmentReport";

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
  engineeringSpec?: EngineeringSpec;
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
            className="w-full h-24 object-cover rounded-lg border"
          />
          <button
            onClick={() => onRemove(id)}
            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
          <Input
            placeholder="圖片說明"
            value={image.caption}
            onChange={(e) => onCaptionChange(id, e.target.value)}
            className="mt-1 text-xs h-7"
          />
        </div>
      ) : (
        <button
          onClick={handleClick}
          className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">上傳</span>
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
  engineeringSpec,
  companyName: propCompanyName,
  companyLogo: propCompanyLogo,
  primaryColor: propPrimaryColor,
}: InvestmentReportExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  
  // Template & Style
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateType>(() => {
    if (revenueMode === 'feed_in_tariff') return 'feed_in_tariff';
    if (investmentMode === 'rental_investment') return 'rental_investment';
    return 'self_consumption';
  });
  
  const [styleSettings, setStyleSettings] = useState<ReportStyleSettings>(() => ({
    ...DEFAULT_REPORT_STYLE,
    reportTitle: `${projectName || '太陽能發電系統'} - 投資報酬評估說明`,
    showTrec: gridConnectionType === 'internal',
    showGridFlexibility: gridConnectionType === 'internal',
  }));
  
  const [textContent, setTextContent] = useState<ReportTextContent>(DEFAULT_REPORT_TEXT);
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  
  // Custom image uploads
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadedImage>>({});

  // Get app settings for branding
  const { settings } = useAppSettingsRead();
  
  // Use settings or props for branding
  const companyName = settings?.company_name_zh || propCompanyName || '太陽能科技';
  const companyLogo = settings?.logo_light_url || propCompanyLogo;
  const primaryColor = settings?.primary_color || propPrimaryColor || '#2563eb';

  // Apply template defaults when template changes
  const handleTemplateChange = useCallback((templateId: ReportTemplateType) => {
    setSelectedTemplate(templateId);
    const template = REPORT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setStyleSettings(prev => ({
        ...prev,
        ...template.defaultStyle,
      }));
      setTextContent(prev => ({
        ...prev,
        ...template.defaultText,
      }));
    }
  }, []);

  // Initialize template on mount
  useEffect(() => {
    handleTemplateChange(selectedTemplate);
  }, []);

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

  const handleImageRemove = useCallback((id: string) => {
    setUploadedImages(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  const handleCaptionChange = useCallback((id: string, caption: string) => {
    setUploadedImages(prev => ({
      ...prev,
      [id]: { ...prev[id], caption },
    }));
  }, []);

  // Generate SVG chart for cash flow
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

    const zeroY = getY(0);
    const cumulativePath = cumulative
      .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`)
      .join(' ');

    const barWidth = chartWidth / years.length * 0.6;
    const bars = annual.map((val, idx) => {
      const x = getX(idx) - barWidth / 2;
      const y = val >= 0 ? getY(val) : getY(0);
      const h = Math.abs(getY(val) - getY(0));
      const fill = val >= 0 ? primaryColor : '#dc2626';
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${fill}" opacity="0.6" rx="2"/>`;
    }).join('');

    const yLabels = [minVal, minVal + range * 0.5, maxVal].map((val) => {
      const y = getY(val);
      return `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6b7280">${(val / 10000).toFixed(0)}萬</text>`;
    }).join('');

    const xLabels = years
      .filter((_, idx) => idx % 5 === 0 || idx === years.length - 1)
      .map((year) => {
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
        <line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
        ${bars}
        <path d="${cumulativePath}" fill="none" stroke="url(#lineGradient)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${cumulative.map((val, idx) => `<circle cx="${getX(idx)}" cy="${getY(val)}" r="4" fill="${val >= 0 ? '#22c55e' : '#dc2626'}" stroke="white" stroke-width="2"/>`).join('')}
        ${yLabels}
        ${xLabels}
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

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
  }, [sensitivityAnalysis]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setProgress(10);
    setGenerationStatus('generating');

    try {
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
          includeAI: styleSettings.showAIContent,
        },
      });

      if (error) throw error;

      setProgress(60);
      setAiContent(data.content);

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
    const s = styleSettings;
    const t = textContent;
    
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

    const cashFlowChart = s.showCharts ? generateCashFlowChartSvg() : '';
    const irrChart = s.showCharts && sensitivityAnalysis ? generateIrrChartSvg() : '';

    // LCOE Section
    let lcoeSection = '';
    if (s.showLcoeCalculation) {
      lcoeSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            💡 建置太陽能發電系統，一度電的成本是多少?
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: ${s.tableFontSize}px;">
            <tbody>
              <tr>
                <td style="padding: 10px; background: #f9fafb; width: 50%; font-weight: 500;">A. 20年預估發電度數 (kWh)</td>
                <td style="padding: 10px; text-align: right;">${Math.round(summary.totalGeneration).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">B. 裝置金額 (未稅)</td>
                <td style="padding: 10px; text-align: right;">${totalInvestment.toLocaleString()} 元</td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">C. 20年維運費用預估</td>
                <td style="padding: 10px; text-align: right;">${Math.round(summary.totalMaintenance).toLocaleString()} 元</td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">D. 20年保險費用預估</td>
                <td style="padding: 10px; text-align: right;">${Math.round(summary.totalInsurance).toLocaleString()} 元</td>
              </tr>
              <tr style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);">
                <td style="padding: 10px; font-weight: 600;">E. 投資成本總計 (B+C+D)</td>
                <td style="padding: 10px; text-align: right; font-weight: 600;">${Math.round(summary.totalCost).toLocaleString()} 元</td>
              </tr>
              <tr style="background: linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}25 100%);">
                <td style="padding: 10px; font-weight: 700; color: ${primaryColor};">F. 太陽光電每度電價格 (E÷A)</td>
                <td style="padding: 10px; text-align: right; font-weight: 700; font-size: ${s.subtitleFontSize}px; color: ${primaryColor};">$${summary.costPerKwh.toFixed(2)} 元/度</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Grid Flexibility Section
    let gridFlexibilitySection = '';
    if (s.showGridFlexibility && gridConnectionType === 'internal' && t.gridFlexibilityContent) {
      gridFlexibilitySection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            ⚡ ${t.gridFlexibilityTitle || '併內線的靈活設計'}
          </h3>
          <div style="background: #f8fafc; border-left: 4px solid ${primaryColor}; padding: 16px 20px; border-radius: 0 12px 12px 0; font-size: ${s.bodyFontSize}px; line-height: 1.8; white-space: pre-line;">
            ${t.gridFlexibilityContent}
          </div>
        </div>
      `;
    }

    // T-REC Section
    let trecSection = '';
    if (s.showTrec && trecEstimation && gridConnectionType === 'internal') {
      trecSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            🌱 T-REC 綠能憑證估算
          </h3>
          <p style="color: #6b7280; font-size: ${s.bodyFontSize}px; margin-bottom: 12px;">併內線系統可申請綠能憑證，為企業創造額外收益與碳中和效益。</p>
          <table style="width: 100%; border-collapse: collapse; font-size: ${s.tableFontSize}px;">
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

    // Sensitivity Section
    let sensitivitySection = '';
    if (s.showSensitivity && sensitivityAnalysis && sensitivityAnalysis.length > 0) {
      const sensitivityRows = sensitivityAnalysis.map(sa => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${sa.label}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${sa.irr >= 8 ? '#16a34a' : sa.irr >= 5 ? '#ca8a04' : '#dc2626'};">${sa.irr.toFixed(2)}%</td>
        </tr>
      `).join('');

      sensitivitySection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            📈 電價敏感度分析
          </h3>
          <p style="color: #6b7280; font-size: ${s.bodyFontSize}px; margin-bottom: 12px;">不同電價成長情境下的預估報酬率變化：</p>
          <div style="display: flex; gap: 24px; align-items: flex-start;">
            <table style="width: 40%; border-collapse: collapse; font-size: ${s.tableFontSize}px;">
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
            ${s.showCharts && irrChart ? `<div style="flex: 1;">${irrChart}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Advantage & Risk Section
    let advantageRiskSection = '';
    if (s.showAdvantageRisk && (t.advantageItems.length > 0 || t.riskItems.length > 0)) {
      const advantageList = t.advantageItems.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <h4 style="font-size: ${s.bodyFontSize}px; font-weight: 600; color: #16a34a; margin-bottom: 8px;">✅ ${t.advantageTitle || '方案優勢'}</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: ${s.bodyFontSize}px; line-height: 1.8;">
            ${t.advantageItems.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}
          </ul>
        </div>
      ` : '';

      const riskList = t.riskItems.length > 0 ? `
        <div>
          <h4 style="font-size: ${s.bodyFontSize}px; font-weight: 600; color: #ca8a04; margin-bottom: 8px;">⚠️ ${t.riskTitle || '須留意事項'}</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: ${s.bodyFontSize}px; line-height: 1.8;">
            ${t.riskItems.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}
          </ul>
        </div>
      ` : '';

      advantageRiskSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            📋 方案優勢與風險評估
          </h3>
          <div style="background: #f8fafc; padding: 16px 20px; border-radius: 12px;">
            ${advantageList}
            ${riskList}
          </div>
        </div>
      `;
    }

    // Engineering Specs Section
    let engineeringSection = '';
    if (s.showEngineeringSpecs && engineeringSpec) {
      engineeringSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            🔧 工程概要規格
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: ${s.tableFontSize}px;">
            <tbody>
              <tr>
                <td style="padding: 10px; background: #f9fafb; width: 25%; font-weight: 500;">太陽能模組</td>
                <td style="padding: 10px;">${engineeringSpec.moduleBrand} ${engineeringSpec.moduleModel} (${engineeringSpec.moduleWattage}W)</td>
                <td style="padding: 10px; background: #f9fafb; width: 20%; font-weight: 500;">數量</td>
                <td style="padding: 10px;">${engineeringSpec.moduleCount} 片</td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">逆變器</td>
                <td style="padding: 10px;">${engineeringSpec.inverterBrand} ${engineeringSpec.inverterModel}</td>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">數量</td>
                <td style="padding: 10px;">${engineeringSpec.inverterCount} 台</td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">支架類型</td>
                <td style="padding: 10px;">${engineeringSpec.rackType}</td>
                <td style="padding: 10px; background: #f9fafb; font-weight: 500;">併網類型</td>
                <td style="padding: 10px;">${engineeringSpec.connectionType}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Custom Images Section
    let customImagesSection = '';
    const imageEntries = Object.values(uploadedImages);
    if (s.showCustomImages && imageEntries.length > 0) {
      const imageCards = imageEntries.map(img => `
        <div style="break-inside: avoid; margin-bottom: 16px;">
          <img src="${img.dataUrl}" alt="${img.caption || img.name}" style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb;"/>
          ${img.caption ? `<p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 8px;">${img.caption}</p>` : ''}
        </div>
      `).join('');

      customImagesSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            📷 專案附圖
          </h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            ${imageCards}
          </div>
        </div>
      `;
    }

    // Conclusion Section
    let conclusionSection = '';
    if (t.conclusionContent) {
      conclusionSection = `
        <div style="margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: ${primaryColor}; font-size: ${s.subtitleFontSize}px; margin-bottom: 12px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px;">
            📝 ${t.conclusionTitle || '結論'}
          </h3>
          <div style="background: linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%); border: 1px solid ${primaryColor}30; padding: 16px 20px; border-radius: 12px; font-size: ${s.bodyFontSize}px; line-height: 1.8; white-space: pre-line;">
            ${t.conclusionContent}
          </div>
        </div>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${s.reportTitle || projectName}</title>
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
      font-size: ${s.bodyFontSize}px;
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
      font-size: ${s.titleFontSize}px;
      margin: 0;
    }
    .header .company {
      text-align: right;
      font-size: 12px;
      color: #6b7280;
    }
    .header .company img {
      max-height: ${s.logoSize}px;
      max-width: 180px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-title {
      color: ${primaryColor};
      font-size: ${s.subtitleFontSize}px;
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
      font-size: ${s.bodyFontSize}px;
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
      <h1>${s.reportTitle || `${projectName} - 投資報酬評估說明`}</h1>
      <p style="color: #6b7280; margin: 4px 0 0 0; font-size: ${s.subtitleFontSize}px;">
        ${s.reportSubtitle || (projectLocation ? `📍 ${projectLocation} | 裝置容量：${capacityKwp} kWp` : `裝置容量：${capacityKwp} kWp`)}
      </p>
    </div>
    <div class="company">
      ${companyLogo ? `<img src="${companyLogo}" alt="Logo" />` : `<div style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-bottom: 4px;">${companyName}</div>`}
      <div>${companyName}</div>
      <div>${new Date().toLocaleDateString('zh-TW')}</div>
    </div>
  </div>

  ${s.showAIContent ? `
  <div class="section">
    <div class="ai-content">
      ${content.opening}
    </div>
  </div>
  ` : ''}

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

  <div class="section">
    <h3 class="section-title">⚡ 系統規劃概要</h3>
    <table style="font-size: ${s.tableFontSize}px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
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

  ${lcoeSection}
  ${gridFlexibilitySection}

  ${s.showCharts && cashFlowChart ? `
  <div class="section">
    <h3 class="section-title">📈 20年現金流預估圖</h3>
    <div class="chart-container">
      ${cashFlowChart}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h3 class="section-title">💰 20年現金流量預估</h3>
    <table style="font-size: ${s.tableFontSize}px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
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
    <p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">* 表格顯示第 1、5、10、15、20 年數據摘要。</p>
  </div>

  ${trecSection}
  ${sensitivitySection}
  ${advantageRiskSection}
  ${engineeringSection}
  ${customImagesSection}
  ${conclusionSection}

  ${s.showAIContent ? `
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
  ` : ''}

  <div class="footer">
    <p>本報告僅供投資評估參考，實際收益可能因天候、設備效能、電價政策等因素而異。</p>
    <p>報告生成日期：${new Date().toLocaleString('zh-TW')} | ${companyName}</p>
  </div>
</body>
</html>
    `;

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            產生投資報酬評估報告
          </DialogTitle>
          <DialogDescription>
            選擇報告範本並自訂樣式與內容
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4" />
                報告設定
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                圖片上傳
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-4">
              <ReportStylePanel
                style={styleSettings}
                text={textContent}
                selectedTemplate={selectedTemplate}
                companyLogo={companyLogo}
                onStyleChange={(updates) => setStyleSettings(prev => ({ ...prev, ...updates }))}
                onTextChange={(updates) => setTextContent(prev => ({ ...prev, ...updates }))}
                onTemplateChange={handleTemplateChange}
              />
            </TabsContent>

            <TabsContent value="images" className="mt-4 space-y-4">
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
            </TabsContent>
          </Tabs>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2 mt-4">
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
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg mt-4">
              <CheckCircle className="h-4 w-4" />
              報告已生成完成！請在新視窗中列印或儲存為 PDF。
            </div>
          )}

          {generationStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-4">
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
                <Sparkles className="h-4 w-4" />
                生成報告
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
