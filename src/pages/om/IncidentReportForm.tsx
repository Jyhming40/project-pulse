import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { generateIncidentReportPdf, type IncidentReportData } from '@/lib/incidentReportPdf';
import { useOmFormPersistence } from '@/hooks/useOmFormPersistence';
import { OmSaveLoadBar } from '@/components/om/OmSaveLoadBar';

const INCIDENT_CATEGORIES = [
  '模組異常', '逆變器異常', '線路異常', '結構異常',
  '監控系統異常', '接地異常', '環境因素', '其他',
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: '輕微 — 不影響發電' },
  { value: 'medium', label: '中度 — 部分影響發電' },
  { value: 'high', label: '嚴重 — 停機或大幅降載' },
  { value: 'critical', label: '緊急 — 安全風險' },
];

const INITIAL_DATA: IncidentReportData = {
  projectName: '', siteLocation: '', reportNumber: '',
  reportDate: new Date().toISOString().slice(0, 10),
  reporterName: '', reporterPhone: '', incidentDate: '', incidentTime: '',
  discoveredBy: '', categories: [], otherCategory: '', severity: 'medium',
  incidentDescription: '', immediateAction: '', arrivalDate: '', arrivalTime: '',
  repairDate: '', repairTime: '', repairDescription: '', repairResult: '',
  preventiveMeasures: '', affectedCapacityKw: 0, estimatedLossKwh: 0,
  partsReplaced: '', reviewerName: '', reviewerTitle: '', status: 'open', note: '',
};

const toRow = (d: IncidentReportData) => ({
  project_name: d.projectName, site_location: d.siteLocation,
  report_number: d.reportNumber, report_date: d.reportDate || null,
  reporter_name: d.reporterName, reporter_phone: d.reporterPhone,
  incident_date: d.incidentDate || null, incident_time: d.incidentTime,
  discovered_by: d.discoveredBy, categories: d.categories,
  other_category: d.otherCategory, severity: d.severity,
  incident_description: d.incidentDescription, immediate_action: d.immediateAction,
  arrival_date: d.arrivalDate || null, arrival_time: d.arrivalTime,
  repair_date: d.repairDate || null, repair_time: d.repairTime,
  repair_description: d.repairDescription, repair_result: d.repairResult,
  preventive_measures: d.preventiveMeasures,
  affected_capacity_kw: d.affectedCapacityKw, estimated_loss_kwh: d.estimatedLossKwh,
  parts_replaced: d.partsReplaced, reviewer_name: d.reviewerName,
  reviewer_title: d.reviewerTitle, status: d.status, note: d.note,
});

const fromRow = (r: Record<string, unknown>): IncidentReportData => ({
  projectName: (r.project_name as string) || '',
  siteLocation: (r.site_location as string) || '',
  reportNumber: (r.report_number as string) || '',
  reportDate: (r.report_date as string) || '',
  reporterName: (r.reporter_name as string) || '',
  reporterPhone: (r.reporter_phone as string) || '',
  incidentDate: (r.incident_date as string) || '',
  incidentTime: (r.incident_time as string) || '',
  discoveredBy: (r.discovered_by as string) || '',
  categories: (r.categories as string[]) || [],
  otherCategory: (r.other_category as string) || '',
  severity: (r.severity as IncidentReportData['severity']) || 'medium',
  incidentDescription: (r.incident_description as string) || '',
  immediateAction: (r.immediate_action as string) || '',
  arrivalDate: (r.arrival_date as string) || '',
  arrivalTime: (r.arrival_time as string) || '',
  repairDate: (r.repair_date as string) || '',
  repairTime: (r.repair_time as string) || '',
  repairDescription: (r.repair_description as string) || '',
  repairResult: (r.repair_result as string) || '',
  preventiveMeasures: (r.preventive_measures as string) || '',
  affectedCapacityKw: (r.affected_capacity_kw as number) || 0,
  estimatedLossKwh: (r.estimated_loss_kwh as number) || 0,
  partsReplaced: (r.parts_replaced as string) || '',
  reviewerName: (r.reviewer_name as string) || '',
  reviewerTitle: (r.reviewer_title as string) || '',
  status: (r.status as IncidentReportData['status']) || 'open',
  note: (r.note as string) || '',
});

export default function IncidentReportForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<IncidentReportData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const persistence = useOmFormPersistence<IncidentReportData>({ table: 'om_incident_reports', toRow, fromRow });

  useEffect(() => { persistence.fetchList('project_name', 'report_date'); }, []);

  const update = useCallback(<K extends keyof IncidentReportData>(field: K, value: IncidentReportData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }, []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    setIsExporting(true);
    try { await generateIncidentReportPdf(data); toast.success('異常處理單 PDF 已產生'); }
    catch (err) { console.error(err); toast.error('PDF 產生失敗：' + (err as Error).message); }
    finally { setIsExporting(false); }
  };

  const handleLoad = async (id: string) => { const loaded = await persistence.loadRecord(id); if (loaded) setData(loaded); };
  const handleNew = () => { setData(INITIAL_DATA); persistence.resetRecord(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/om')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6" />表 3-6：電廠異常處理單</h1>
            <p className="text-sm text-muted-foreground">異常通報、處理追蹤與結案紀錄</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      <OmSaveLoadBar recordId={persistence.recordId} isSaving={persistence.isSaving} isLoading={persistence.isLoading}
        savedRecords={persistence.savedRecords} onSave={() => persistence.save(data)} onLoad={handleLoad} onNew={handleNew} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">通報資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>工程名稱 *</Label><Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} placeholder="例：李應賀太陽能電廠" /></div>
            <div className="space-y-1.5"><Label>電廠地點</Label><Input value={data.siteLocation} onChange={(e) => update('siteLocation', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>通報單號</Label><Input value={data.reportNumber} onChange={(e) => update('reportNumber', e.target.value)} placeholder="自動或手動編號" /></div>
              <div className="space-y-1.5"><Label>通報日期</Label><Input type="date" value={data.reportDate} onChange={(e) => update('reportDate', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>通報人</Label><Input value={data.reporterName} onChange={(e) => update('reporterName', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>通報人電話</Label><Input value={data.reporterPhone} onChange={(e) => update('reporterPhone', e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">異常狀況</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>發生日期</Label><Input type="date" value={data.incidentDate} onChange={(e) => update('incidentDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>發生時間</Label><Input type="time" value={data.incidentTime} onChange={(e) => update('incidentTime', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>發現人</Label><Input value={data.discoveredBy} onChange={(e) => update('discoveredBy', e.target.value)} /></div>
            <div>
              <Label className="mb-2 block">異常類別（可複選）</Label>
              <div className="grid grid-cols-2 gap-2">
                {INCIDENT_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={data.categories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                    {cat}
                  </label>
                ))}
              </div>
              {data.categories.includes('其他') && (
                <Input className="mt-2" value={data.otherCategory} onChange={(e) => update('otherCategory', e.target.value)} placeholder="請說明其他異常類別" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>嚴重程度</Label>
              <Select value={data.severity} onValueChange={(v) => update('severity', v as IncidentReportData['severity'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITY_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>異常描述</Label><Textarea value={data.incidentDescription} onChange={(e) => update('incidentDescription', e.target.value)} rows={3} placeholder="詳述異常現象、影響範圍..." /></div>
            <div className="space-y-1.5"><Label>即時處置</Label><Textarea value={data.immediateAction} onChange={(e) => update('immediateAction', e.target.value)} rows={2} placeholder="第一時間採取的應急措施..." /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">到場與修復追蹤</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>到場日期</Label><Input type="date" value={data.arrivalDate} onChange={(e) => update('arrivalDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>到場時間</Label><Input type="time" value={data.arrivalTime} onChange={(e) => update('arrivalTime', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>修復完成日期</Label><Input type="date" value={data.repairDate} onChange={(e) => update('repairDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>修復完成時間</Label><Input type="time" value={data.repairTime} onChange={(e) => update('repairTime', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>修復內容</Label><Textarea value={data.repairDescription} onChange={(e) => update('repairDescription', e.target.value)} rows={3} /></div>
            <div className="space-y-1.5"><Label>修復結果</Label><Input value={data.repairResult} onChange={(e) => update('repairResult', e.target.value)} placeholder="例：已恢復正常發電" /></div>
            <div className="space-y-1.5"><Label>預防改善措施</Label><Textarea value={data.preventiveMeasures} onChange={(e) => update('preventiveMeasures', e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">影響評估與結案</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>受影響容量 (kW)</Label><Input type="number" min={0} value={data.affectedCapacityKw} onChange={(e) => update('affectedCapacityKw', parseFloat(e.target.value) || 0)} /></div>
              <div className="space-y-1.5"><Label>估計損失發電量 (kWh)</Label><Input type="number" min={0} value={data.estimatedLossKwh} onChange={(e) => update('estimatedLossKwh', parseFloat(e.target.value) || 0)} /></div>
            </div>
            <div className="space-y-1.5"><Label>更換零件</Label><Input value={data.partsReplaced} onChange={(e) => update('partsReplaced', e.target.value)} placeholder="例：逆變器 SN-12345" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>審核人</Label><Input value={data.reviewerName} onChange={(e) => update('reviewerName', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>審核人職稱</Label><Input value={data.reviewerTitle} onChange={(e) => update('reviewerTitle', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>處理狀態</Label>
              <Select value={data.status} onValueChange={(v) => update('status', v as IncidentReportData['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">處理中</SelectItem>
                  <SelectItem value="resolved">已修復</SelectItem>
                  <SelectItem value="closed">已結案</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>備註</Label><Textarea value={data.note} onChange={(e) => update('note', e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
