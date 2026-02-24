import { useState, useCallback } from 'react';
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
  projectName: '',
  siteLocation: '',
  reportNumber: '',
  reportDate: new Date().toISOString().slice(0, 10),
  reporterName: '',
  reporterPhone: '',
  incidentDate: '',
  incidentTime: '',
  discoveredBy: '',
  categories: [],
  otherCategory: '',
  severity: 'medium',
  incidentDescription: '',
  immediateAction: '',
  arrivalDate: '',
  arrivalTime: '',
  repairDate: '',
  repairTime: '',
  repairDescription: '',
  repairResult: '',
  preventiveMeasures: '',
  affectedCapacityKw: 0,
  estimatedLossKwh: 0,
  partsReplaced: '',
  reviewerName: '',
  reviewerTitle: '',
  status: 'open',
  note: '',
};

export default function IncidentReportForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<IncidentReportData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);

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
    try {
      await generateIncidentReportPdf(data);
      toast.success('異常處理單 PDF 已產生');
    } catch (err) {
      console.error(err);
      toast.error('PDF 產生失敗：' + (err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/om')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              表 3-6：電廠異常處理單
            </h1>
            <p className="text-sm text-muted-foreground">異常通報、處理追蹤與結案紀錄</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project & Report Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">通報資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>工程名稱 *</Label>
              <Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} placeholder="例：李應賀太陽能電廠" />
            </div>
            <div className="space-y-1.5">
              <Label>電廠地點</Label>
              <Input value={data.siteLocation} onChange={(e) => update('siteLocation', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>通報單號</Label>
                <Input value={data.reportNumber} onChange={(e) => update('reportNumber', e.target.value)} placeholder="自動或手動編號" />
              </div>
              <div className="space-y-1.5">
                <Label>通報日期</Label>
                <Input type="date" value={data.reportDate} onChange={(e) => update('reportDate', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>通報人</Label>
                <Input value={data.reporterName} onChange={(e) => update('reporterName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>通報人電話</Label>
                <Input value={data.reporterPhone} onChange={(e) => update('reporterPhone', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incident Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">異常狀況</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>發生日期</Label>
                <Input type="date" value={data.incidentDate} onChange={(e) => update('incidentDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>發生時間</Label>
                <Input type="time" value={data.incidentTime} onChange={(e) => update('incidentTime', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>發現人</Label>
              <Input value={data.discoveredBy} onChange={(e) => update('discoveredBy', e.target.value)} />
            </div>
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
                <SelectContent>
                  {SEVERITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>異常描述</Label>
              <Textarea value={data.incidentDescription} onChange={(e) => update('incidentDescription', e.target.value)} rows={3} placeholder="詳述異常現象、影響範圍..." />
            </div>
            <div className="space-y-1.5">
              <Label>即時處置</Label>
              <Textarea value={data.immediateAction} onChange={(e) => update('immediateAction', e.target.value)} rows={2} placeholder="第一時間採取的應急措施..." />
            </div>
          </CardContent>
        </Card>

        {/* Response Timeline */}
        <Card>
          <CardHeader><CardTitle className="text-base">到場與修復追蹤</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>到場日期</Label>
                <Input type="date" value={data.arrivalDate} onChange={(e) => update('arrivalDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>到場時間</Label>
                <Input type="time" value={data.arrivalTime} onChange={(e) => update('arrivalTime', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>修復完成日期</Label>
                <Input type="date" value={data.repairDate} onChange={(e) => update('repairDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>修復完成時間</Label>
                <Input type="time" value={data.repairTime} onChange={(e) => update('repairTime', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>修復內容</Label>
              <Textarea value={data.repairDescription} onChange={(e) => update('repairDescription', e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>修復結果</Label>
              <Input value={data.repairResult} onChange={(e) => update('repairResult', e.target.value)} placeholder="例：已恢復正常發電" />
            </div>
            <div className="space-y-1.5">
              <Label>預防改善措施</Label>
              <Textarea value={data.preventiveMeasures} onChange={(e) => update('preventiveMeasures', e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Impact & Review */}
        <Card>
          <CardHeader><CardTitle className="text-base">影響評估與結案</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>受影響容量 (kW)</Label>
                <Input type="number" min={0} value={data.affectedCapacityKw} onChange={(e) => update('affectedCapacityKw', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>估計損失發電量 (kWh)</Label>
                <Input type="number" min={0} value={data.estimatedLossKwh} onChange={(e) => update('estimatedLossKwh', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>更換零件</Label>
              <Input value={data.partsReplaced} onChange={(e) => update('partsReplaced', e.target.value)} placeholder="例：逆變器 SN-12345" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>審核人</Label>
                <Input value={data.reviewerName} onChange={(e) => update('reviewerName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>審核人職稱</Label>
                <Input value={data.reviewerTitle} onChange={(e) => update('reviewerTitle', e.target.value)} />
              </div>
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
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={data.note} onChange={(e) => update('note', e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
