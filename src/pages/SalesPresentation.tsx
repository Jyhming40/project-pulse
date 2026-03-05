import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Sparkles, Building2, FileText, Users, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { usePresentationData } from '@/hooks/usePresentationData';
import Plotly from 'plotly.js-dist-min';

type PresentationMode = 'company' | 'project' | 'investor' | 'market';

interface AIContent {
  executive_summary: string;
  highlights: string[];
  analysis: string;
  recommendation: string;
}

// Generate chart as static image
async function chartToImage(
  data: Plotly.Data[],
  layout: Partial<Plotly.Layout>,
  width = 600,
  height = 360
): Promise<string> {
  const div = document.createElement('div');
  div.style.width = `${width}px`;
  div.style.height = `${height}px`;
  document.body.appendChild(div);
  try {
    await Plotly.newPlot(div, data, {
      ...layout,
      paper_bgcolor: '#fff',
      plot_bgcolor: '#fff',
      width,
      height,
    }, { staticPlot: true });
    const url = await Plotly.toImage(div, { format: 'png', width, height, scale: 2 });
    return url;
  } finally {
    Plotly.purge(div);
    document.body.removeChild(div);
  }
}

export default function SalesPresentation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings: appSettings } = useAppSettingsRead();
  const { data: presData, isLoading: dataLoading } = usePresentationData();
  const printRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<PresentationMode>(
    (searchParams.get('mode') as PresentationMode) || 'company'
  );
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('project') || '');
  const [selectedInvestorId, setSelectedInvestorId] = useState(searchParams.get('investor') || '');
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [chartImages, setChartImages] = useState<Record<string, string>>({});
  const [isGeneratingCharts, setIsGeneratingCharts] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [showAI, setShowAI] = useState(true);

  const companyName = appSettings?.company_name_zh || appSettings?.company_name_en || '太陽能公司';
  const logoUrl = appSettings?.logo_light_url;

  // Filtered data based on mode
  const selectedProject = useMemo(() => {
    if (mode !== 'project' || !selectedProjectId || !presData) return null;
    return presData.projects.find(p => p.id === selectedProjectId);
  }, [mode, selectedProjectId, presData]);

  const selectedInvestor = useMemo(() => {
    if (mode !== 'investor' || !selectedInvestorId || !presData) return null;
    return presData.investors.find(i => i.id === selectedInvestorId);
  }, [mode, selectedInvestorId, presData]);

  const investorProjects = useMemo(() => {
    if (!selectedInvestor || !presData) return [];
    return presData.projects.filter(p => p.investor_id === selectedInvestorId);
  }, [selectedInvestor, selectedInvestorId, presData]);

  // Generate chart images
  const generateCharts = useCallback(async () => {
    if (!presData) return;
    setIsGeneratingCharts(true);
    const images: Record<string, string> = {};
    const projects = presData.projects;

    try {
      // Type distribution (pie)
      const typeMap: Record<string, number> = {};
      projects.forEach(p => {
        const t = p.installation_type || '未設定';
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
      if (typeEntries.length > 0) {
        images.type = await chartToImage(
          [{
            type: 'pie', labels: typeEntries.map(e => e[0]), values: typeEntries.map(e => e[1]),
            hole: 0.4, textinfo: 'label+percent' as const, textposition: 'inside',
            textfont: { size: 11 },
            marker: { colors: ['hsl(0,84%,60%)', 'hsl(221,83%,53%)', 'hsl(142,71%,45%)', 'hsl(47,96%,53%)', 'hsl(262,83%,58%)', 'hsl(210,70%,50%)', 'hsl(150,60%,45%)', 'hsl(35,90%,50%)'] }
          }],
          { margin: { t: 20, b: 20, l: 20, r: 20 }, showlegend: true, legend: { orientation: 'h', y: -0.05, x: 0.5, xanchor: 'center', font: { size: 10 } } }
        );
      }

      // Region distribution (horizontal bar)
      const regionMap: Record<string, number> = {};
      projects.forEach(p => { const c = p.city || '未設定'; regionMap[c] = (regionMap[c] || 0) + 1; });
      const regionEntries = Object.entries(regionMap).sort((a, b) => b[1] - a[1]).slice(0, 10).reverse();
      if (regionEntries.length > 0) {
        images.region = await chartToImage(
          [{
            type: 'bar', orientation: 'h',
            y: regionEntries.map(e => e[0]), x: regionEntries.map(e => e[1]),
            marker: { color: 'hsl(47,96%,53%)' },
            text: regionEntries.map(e => `${e[1]} 件`), textposition: 'outside',
          }],
          { margin: { t: 10, b: 30, l: 70, r: 50 }, showlegend: false, xaxis: { title: { text: '案件數', font: { size: 11 } } } }
        );
      }

      // Yearly trend (bar + line)
      const yearMap: Record<number, { applied: number; closed: number }> = {};
      projects.forEach(p => {
        const y = p.intake_year || p.fiscal_year;
        if (!y) return;
        if (!yearMap[y]) yearMap[y] = { applied: 0, closed: 0 };
        yearMap[y].applied++;
        if (p.status && !['取消', '暫停'].includes(p.status)) yearMap[y].closed++;
      });
      const years = Object.keys(yearMap).map(Number).sort();
      if (years.length > 0) {
        const rate = years.map(y => yearMap[y].applied > 0 ? Math.round(yearMap[y].closed / yearMap[y].applied * 100) : 0);
        images.yearly = await chartToImage(
          [
            { type: 'bar', name: '申請案件數', x: years.map(String), y: years.map(y => yearMap[y].applied), marker: { color: 'hsl(221,83%,53%)' } },
            { type: 'bar', name: '成案案件數', x: years.map(String), y: years.map(y => yearMap[y].closed), marker: { color: 'hsl(142,71%,45%)' } },
            { type: 'scatter', mode: 'lines+markers', name: '成案率', x: years.map(String), y: rate, yaxis: 'y2', marker: { color: 'hsl(0,84%,60%)', size: 8 }, line: { color: 'hsl(0,84%,60%)', width: 2 } },
          ],
          { margin: { t: 10, b: 40, l: 50, r: 50 }, barmode: 'group', showlegend: true, legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { size: 10 } }, yaxis: { title: { text: '案件數', font: { size: 11 } } }, yaxis2: { overlaying: 'y', side: 'right', range: [0, 100], ticksuffix: '%', title: { text: '成案率', font: { size: 11 } } } }
        );
      }

      // Capacity distribution (stacked bar)
      const brackets = [
        { key: '<100kWp', min: 0, max: 100 }, { key: '100-200', min: 100, max: 200 },
        { key: '200-300', min: 200, max: 300 }, { key: '300-400', min: 300, max: 400 },
        { key: '400-500', min: 400, max: 500 }, { key: '500kWp+', min: 500, max: Infinity },
      ];
      const capYears: Record<number, Record<string, number>> = {};
      projects.forEach(p => {
        const y = p.intake_year || p.fiscal_year;
        if (!y) return;
        if (!capYears[y]) { capYears[y] = {}; brackets.forEach(b => capYears[y][b.key] = 0); }
        const c = p.capacity_kwp || 0;
        const b = brackets.find(b => c >= b.min && c < b.max);
        if (b) capYears[y][b.key]++;
      });
      const capYearsSorted = Object.keys(capYears).map(Number).sort();
      const bracketColors = ['hsl(221,83%,53%)', 'hsl(142,71%,45%)', 'hsl(47,96%,53%)', 'hsl(262,83%,58%)', 'hsl(0,84%,60%)', 'hsl(210,70%,50%)'];
      if (capYearsSorted.length > 0) {
        images.capacity = await chartToImage(
          brackets.map((b, i) => ({
            type: 'bar' as const, name: b.key,
            x: capYearsSorted.map(String),
            y: capYearsSorted.map(y => capYears[y]?.[b.key] || 0),
            marker: { color: bracketColors[i] },
          })),
          { margin: { t: 10, b: 40, l: 40, r: 10 }, barmode: 'stack', showlegend: true, legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { size: 10 } }, yaxis: { title: { text: '案件數', font: { size: 11 } } } }
        );
      }
    } catch (e) {
      console.error('Chart generation error:', e);
      toast.error('圖表生成失敗');
    }

    setChartImages(images);
    setIsGeneratingCharts(false);
  }, [presData]);

  // Generate AI summary
  const generateAISummary = useCallback(async () => {
    if (!presData) return;
    setIsGeneratingAI(true);
    try {
      let requestData: Record<string, any> = {};

      switch (mode) {
        case 'company':
          requestData = presData.summary;
          break;
        case 'project':
          if (!selectedProject) { toast.error('請先選擇案場'); setIsGeneratingAI(false); return; }
          const quote = presData.quotes.find(q => q.project_id === selectedProject.id);
          requestData = {
            projectName: selectedProject.project_name,
            projectCode: selectedProject.project_code,
            investorName: presData.investors.find(i => i.id === selectedProject.investor_id)?.company_name,
            capacityKwp: selectedProject.capacity_kwp,
            installationType: selectedProject.installation_type,
            city: selectedProject.city,
            district: selectedProject.district,
            status: selectedProject.status,
            overallProgress: selectedProject.overall_progress,
            quoteAmount: quote?.total_price_with_tax || 0,
            pricePerKw: quote && quote.capacity_kwp ? Math.round((quote.total_price_with_tax || 0) / quote.capacity_kwp) : 0,
            annualGeneration: Math.round((selectedProject.capacity_kwp || 0) * 1100),
            annualRevenue: Math.round((selectedProject.capacity_kwp || 0) * 1100 * 4.5),
          };
          break;
        case 'investor':
          if (!selectedInvestor) { toast.error('請先選擇投資人'); setIsGeneratingAI(false); return; }
          const totalCap = investorProjects.reduce((s, p) => s + (p.capacity_kwp || 0), 0);
          requestData = {
            investorName: selectedInvestor.company_name,
            investorCode: selectedInvestor.investor_code,
            projectCount: investorProjects.length,
            totalCapacity: Math.round(totalCap),
            avgProgress: investorProjects.length > 0
              ? Math.round(investorProjects.reduce((s, p) => s + (p.overall_progress || 0), 0) / investorProjects.length)
              : 0,
            completedCount: investorProjects.filter(p => p.status === '已結案' || p.status === '運維中').length,
            projects: investorProjects.map(p => ({
              name: p.project_name, code: p.project_code,
              capacity: p.capacity_kwp, status: p.status, progress: p.overall_progress,
            })),
          };
          break;
        case 'market':
          requestData = presData.summary;
          break;
      }

      const { data, error } = await supabase.functions.invoke('generate-sales-presentation', {
        body: { mode, data: requestData, companyName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiContent(data as AIContent);
      toast.success('AI 摘要生成完成');
    } catch (e: any) {
      console.error('AI generation error:', e);
      toast.error(e.message || 'AI 生成失敗');
    }
    setIsGeneratingAI(false);
  }, [mode, presData, selectedProject, selectedInvestor, investorProjects, companyName]);

  // Auto-generate charts on data load
  useEffect(() => {
    if (presData && Object.keys(chartImages).length === 0) {
      generateCharts();
    }
  }, [presData, generateCharts, chartImages]);

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  const getModeTitle = () => {
    switch (mode) {
      case 'company': return '公司營運概況簡報';
      case 'project': return `案場投資提案 - ${selectedProject?.project_name || ''}`;
      case 'investor': return `投資人專屬報告 - ${selectedInvestor?.company_name || ''}`;
      case 'market': return '市場趨勢分析報告';
    }
  };

  if (dataLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Toolbar - hidden in print */}
      <div className="print:hidden p-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/w/sales')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">業務簡報產生器</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode selector */}
            <Select value={mode} onValueChange={(v) => { setMode(v as PresentationMode); setAiContent(null); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company"><div className="flex items-center gap-2"><Building2 className="w-4 h-4" />公司營運概況</div></SelectItem>
                <SelectItem value="project"><div className="flex items-center gap-2"><FileText className="w-4 h-4" />特定案場提案</div></SelectItem>
                <SelectItem value="investor"><div className="flex items-center gap-2"><Users className="w-4 h-4" />投資人報告</div></SelectItem>
                <SelectItem value="market"><div className="flex items-center gap-2"><MapPin className="w-4 h-4" />市場分析</div></SelectItem>
              </SelectContent>
            </Select>

            {/* Sub-selectors */}
            {mode === 'project' && presData && (
              <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setAiContent(null); }}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="選擇案場" />
                </SelectTrigger>
                <SelectContent>
                  {presData.projects.slice(0, 50).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_code} - {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {mode === 'investor' && presData && (
              <Select value={selectedInvestorId} onValueChange={v => { setSelectedInvestorId(v); setAiContent(null); }}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="選擇投資人" />
                </SelectTrigger>
                <SelectContent>
                  {presData.investors.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.investor_code} - {i.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-2">
              <Switch id="show-charts" checked={showCharts} onCheckedChange={setShowCharts} />
              <Label htmlFor="show-charts" className="text-sm">圖表</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-ai" checked={showAI} onCheckedChange={setShowAI} />
              <Label htmlFor="show-ai" className="text-sm">AI 摘要</Label>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <Button variant="outline" size="sm" onClick={generateAISummary} disabled={isGeneratingAI}>
              {isGeneratingAI ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {aiContent ? '重新生成' : '生成 AI 摘要'}
            </Button>

            <Button variant="outline" size="sm" onClick={generateCharts} disabled={isGeneratingCharts}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingCharts ? 'animate-spin' : ''}`} />
              重新生成圖表
            </Button>

            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              列印 / 存為 PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="max-w-[210mm] mx-auto bg-white text-black print:max-w-none">
        {/* Cover / Header */}
        <div className="p-8 print:p-12">
          {/* Logo & Company */}
          <div className="flex items-center justify-between mb-8 border-b-2 border-primary pb-4 print:border-b-2">
            <div className="flex items-center gap-4">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">{companyName}</h2>
                {appSettings?.website && (
                  <p className="text-sm text-gray-500">{appSettings.website}</p>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{today}</p>
              <p>機密文件</p>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{getModeTitle()}</h1>
          <p className="text-gray-500 mb-8">報告日期：{today}</p>

          {/* AI Executive Summary */}
          {showAI && aiContent && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 print:text-amber-600" />
                執行摘要
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed print:bg-gray-50">
                {typeof aiContent.executive_summary === 'string'
                  ? aiContent.executive_summary.split('\n').map((p, i) => <p key={i} className="mb-2">{p}</p>)
                  : null}
              </div>

              {aiContent.highlights && aiContent.highlights.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-base font-semibold text-gray-800 mb-2">重點亮點</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {aiContent.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* KPI Summary Cards */}
          {(mode === 'company' || mode === 'market') && presData && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">關鍵營運指標</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPIBox label="專案總數" value={`${presData.summary.totalProjects}`} unit="件" />
                <KPIBox label="總裝置容量" value={`${(presData.summary.totalCapacity / 1000).toFixed(1)}`} unit="MWp" />
                <KPIBox label="成交率" value={`${presData.summary.conversionRate}`} unit="%" />
                <KPIBox label="平均進度" value={`${presData.summary.avgProgress}`} unit="%" />
              </div>
            </div>
          )}

          {mode === 'project' && selectedProject && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">案場基本資料</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KPIBox label="案場代碼" value={selectedProject.project_code || '-'} />
                <KPIBox label="裝置容量" value={`${selectedProject.capacity_kwp || 0}`} unit="kWp" />
                <KPIBox label="案場類型" value={selectedProject.installation_type || '-'} />
                <KPIBox label="所在地區" value={`${selectedProject.city || ''} ${selectedProject.district || ''}`} />
                <KPIBox label="目前狀態" value={selectedProject.status || '-'} />
                <KPIBox label="整體進度" value={`${selectedProject.overall_progress || 0}`} unit="%" />
              </div>
            </div>
          )}

          {mode === 'investor' && selectedInvestor && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">投資人概況</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPIBox label="案場總數" value={`${investorProjects.length}`} unit="件" />
                <KPIBox label="總容量" value={`${investorProjects.reduce((s, p) => s + (p.capacity_kwp || 0), 0).toFixed(0)}`} unit="kWp" />
                <KPIBox label="平均進度" value={`${investorProjects.length > 0 ? Math.round(investorProjects.reduce((s, p) => s + (p.overall_progress || 0), 0) / investorProjects.length) : 0}`} unit="%" />
                <KPIBox label="已完成" value={`${investorProjects.filter(p => p.status === '已結案' || p.status === '運維中').length}`} unit="件" />
              </div>

              {/* Investor project table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-100">
                      <th className="text-left p-2 border">案場代碼</th>
                      <th className="text-left p-2 border">案場名稱</th>
                      <th className="text-right p-2 border">容量 (kWp)</th>
                      <th className="text-left p-2 border">狀態</th>
                      <th className="text-right p-2 border">進度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investorProjects.map(p => (
                      <tr key={p.id} className="even:bg-gray-50">
                        <td className="p-2 border font-mono text-xs">{p.project_code}</td>
                        <td className="p-2 border">{p.project_name}</td>
                        <td className="p-2 border text-right">{p.capacity_kwp || 0}</td>
                        <td className="p-2 border">{p.status}</td>
                        <td className="p-2 border text-right">{p.overall_progress || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts */}
          {showCharts && (mode === 'company' || mode === 'market') && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">數據分析圖表</h2>

              {isGeneratingCharts ? (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  正在生成圖表...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {chartImages.type && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">案場類型分佈</h3>
                      <img src={chartImages.type} alt="案場類型分佈" className="w-full border rounded" />
                    </div>
                  )}
                  {chartImages.yearly && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">年度案件趨勢</h3>
                      <img src={chartImages.yearly} alt="年度案件趨勢" className="w-full border rounded" />
                    </div>
                  )}
                  {chartImages.capacity && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">容量級距分佈</h3>
                      <img src={chartImages.capacity} alt="容量級距分佈" className="w-full border rounded" />
                    </div>
                  )}
                  {chartImages.region && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">地區分佈 (Top 10)</h3>
                      <img src={chartImages.region} alt="地區分佈" className="w-full border rounded" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Analysis & Recommendation */}
          {showAI && aiContent && (
            <>
              {aiContent.analysis && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">數據分析</h2>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {typeof aiContent.analysis === 'string'
                      ? aiContent.analysis.split('\n').map((p, i) => <p key={i} className="mb-2">{p}</p>)
                      : null}
                  </div>
                </div>
              )}
              {aiContent.recommendation && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">建議與展望</h2>
                  <div className="text-sm text-gray-700 leading-relaxed bg-blue-50 rounded-lg p-4 print:bg-blue-50">
                    {typeof aiContent.recommendation === 'string'
                      ? aiContent.recommendation.split('\n').map((p, i) => <p key={i} className="mb-2">{p}</p>)
                      : null}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="mt-12 pt-4 border-t text-xs text-gray-400 flex justify-between">
            <span>{companyName} · {today}</span>
            <span>本文件為機密資料，未經授權不得轉載</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI display box
function KPIBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="border rounded-lg p-3 print:border">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}
