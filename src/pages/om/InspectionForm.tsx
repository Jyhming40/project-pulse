import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Download, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateInspectionPdf, DEFAULT_SECTIONS, type InspectionData, type InspectionSection } from '@/lib/inspectionPdf';

function deepCloneSections(): InspectionSection[] {
  return DEFAULT_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.map(item => ({ ...item })),
  }));
}

const INITIAL_DATA: InspectionData = {
  projectName: '', siteLocation: '', capacityKw: '',
  inspectionDate: new Date().toISOString().slice(0, 10),
  inspectionType: 'quarterly',
  inspectorName: '', weatherCondition: '', ambientTemp: '',
  sections: deepCloneSections(),
  overallNote: '', reviewerName: '',
};

export default function InspectionForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<InspectionData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);

  const update = useCallback(<K extends keyof InspectionData>(field: K, value: InspectionData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateItem = useCallback((secIdx: number, itemIdx: number, field: 'result' | 'note', value: string) => {
    setData((prev) => {
      const sections = prev.sections.map((sec, si) => {
        if (si !== secIdx) return sec;
        return {
          ...sec,
          items: sec.items.map((item, ii) => ii === itemIdx ? { ...item, [field]: value } : item),
        };
      });
      return { ...prev, sections };
    });
  }, []);

  const setAllInSection = useCallback((secIdx: number, result: 'normal' | 'abnormal') => {
    setData((prev) => {
      const sections = prev.sections.map((sec, si) => {
        if (si !== secIdx) return sec;
        return { ...sec, items: sec.items.map(item => ({ ...item, result })) };
      });
      return { ...prev, sections };
    });
  }, []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    setIsExporting(true);
    try { await generateInspectionPdf(data); toast.success('巡檢紀錄 PDF 已產生'); }
    catch (err) { console.error(err); toast.error('PDF 產生失敗：' + (err as Error).message); }
    finally { setIsExporting(false); }
  };

  const totalItems = data.sections.reduce((s, sec) => s + sec.items.length, 0);
  const normalCount = data.sections.reduce((s, sec) => s + sec.items.filter(i => i.result === 'normal').length, 0);
  const abnormalCount = data.sections.reduce((s, sec) => s + sec.items.filter(i => i.result === 'abnormal').length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/om')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" />表 3-2：維護保養檢查表</h1>
            <p className="text-sm text-muted-foreground">太陽光電系統 11 大檢查區塊巡檢紀錄</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs">共 {totalItems} 項</Badge>
        <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3 mr-1" />正常 {normalCount}
        </Badge>
        <Badge variant="outline" className="text-xs border-red-500/30 text-red-600 dark:text-red-400">
          <AlertCircle className="w-3 h-3 mr-1" />異常 {abnormalCount}
        </Badge>
        <Badge variant="outline" className="text-xs">未檢 {totalItems - normalCount - abnormalCount}</Badge>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>工程名稱 *</Label><Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>電廠地點</Label><Input value={data.siteLocation} onChange={(e) => update('siteLocation', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>裝置容量 (kW)</Label><Input value={data.capacityKw} onChange={(e) => update('capacityKw', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>巡檢日期</Label><Input type="date" value={data.inspectionDate} onChange={(e) => update('inspectionDate', e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>巡檢類型</Label>
                <Select value={data.inspectionType} onValueChange={(v) => update('inspectionType', v as InspectionData['inspectionType'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">月檢</SelectItem>
                    <SelectItem value="quarterly">季檢</SelectItem>
                    <SelectItem value="annual">年檢</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>巡檢人員</Label><Input value={data.inspectorName} onChange={(e) => update('inspectorName', e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">環境與審核</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>天氣狀況</Label><Input value={data.weatherCondition} onChange={(e) => update('weatherCondition', e.target.value)} placeholder="晴/多雲/陰/雨" /></div>
              <div className="space-y-1.5"><Label>環境溫度 (°C)</Label><Input value={data.ambientTemp} onChange={(e) => update('ambientTemp', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>審核人</Label><Input value={data.reviewerName} onChange={(e) => update('reviewerName', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>總體備註</Label><Textarea value={data.overallNote} onChange={(e) => update('overallNote', e.target.value)} rows={3} /></div>
          </CardContent>
        </Card>
      </div>

      {/* 11 Inspection Sections */}
      <Accordion type="multiple" defaultValue={data.sections.map(sec => sec.id)} className="space-y-2">
        {data.sections.map((sec, secIdx) => {
          const secNormal = sec.items.filter(i => i.result === 'normal').length;
          const secAbnormal = sec.items.filter(i => i.result === 'abnormal').length;
          return (
            <AccordionItem key={sec.id} value={sec.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{sec.title}</span>
                  <Badge variant="outline" className="text-[10px]">{sec.items.length} 項</Badge>
                  {secNormal > 0 && <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 dark:text-green-400">{secNormal} 正常</Badge>}
                  {secAbnormal > 0 && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 dark:text-red-400">{secAbnormal} 異常</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex gap-2 mb-3">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setAllInSection(secIdx, 'normal')}>全部正常</Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setAllInSection(secIdx, 'abnormal')}>全部異常</Button>
                </div>
                <div className="space-y-2">
                  {sec.items.map((item, itemIdx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 text-sm">{item.label}</div>
                      <div className="col-span-2">
                        <Select value={item.result} onValueChange={(v) => updateItem(secIdx, itemIdx, 'result', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="未檢" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">正常</SelectItem>
                            <SelectItem value="abnormal">異常</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-5">
                        <Input className="h-8 text-xs" value={item.note} onChange={(e) => updateItem(secIdx, itemIdx, 'note', e.target.value)} placeholder="備註/異常說明" />
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
