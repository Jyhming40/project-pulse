import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Zap, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateDcTestPdf, type DcTestData, type DcTestRow } from '@/lib/dcTestPdf';

const emptyRow = (): DcTestRow => ({ stringId: '', moduleCount: 0, expectedVoc: 0, measuredVoc: 0, result: '', note: '' });

const INITIAL_DATA: DcTestData = {
  projectName: '', siteLocation: '', inverterModel: '', inverterId: '',
  testDate: new Date().toISOString().slice(0, 10), testerName: '',
  weatherCondition: '', ambientTemp: '', irradiance: '',
  rows: Array.from({ length: 5 }, emptyRow),
  reviewerName: '', note: '',
};

export default function DcTestForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<DcTestData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);

  const update = useCallback(<K extends keyof DcTestData>(field: K, value: DcTestData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateRow = useCallback((idx: number, field: keyof DcTestRow, value: string | number) => {
    setData((prev) => {
      const rows = [...prev.rows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, rows };
    });
  }, []);

  const addRow = useCallback(() => setData((prev) => ({ ...prev, rows: [...prev.rows, emptyRow()] })), []);
  const removeRow = useCallback((idx: number) => setData((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) })), []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    setIsExporting(true);
    try { await generateDcTestPdf(data); toast.success('DC 測試 PDF 已產生'); }
    catch (err) { console.error(err); toast.error('PDF 產生失敗：' + (err as Error).message); }
    finally { setIsExporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/om')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6" />表 3-3：DC 開路電壓測試自主檢查表</h1>
            <p className="text-sm text-muted-foreground">逆變器端 DC 串列開路電壓測試數據</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>工程名稱 *</Label><Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>逆變器型號</Label><Input value={data.inverterModel} onChange={(e) => update('inverterModel', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>逆變器編號</Label><Input value={data.inverterId} onChange={(e) => update('inverterId', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>測試日期</Label><Input type="date" value={data.testDate} onChange={(e) => update('testDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>測試人員</Label><Input value={data.testerName} onChange={(e) => update('testerName', e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">測試條件</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>天氣狀況</Label><Input value={data.weatherCondition} onChange={(e) => update('weatherCondition', e.target.value)} placeholder="晴/多雲/陰" /></div>
              <div className="space-y-1.5"><Label>環境溫度 (°C)</Label><Input value={data.ambientTemp} onChange={(e) => update('ambientTemp', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>日射量 (W/m²)</Label><Input value={data.irradiance} onChange={(e) => update('irradiance', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>審核人</Label><Input value={data.reviewerName} onChange={(e) => update('reviewerName', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>備註</Label><Textarea value={data.note} onChange={(e) => update('note', e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>
      </div>

      {/* Test Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">串列測試數據</CardTitle>
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-1" />新增串列</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 w-10">#</th>
                  <th className="text-left p-2">串列編號</th>
                  <th className="text-left p-2 w-24">模組數量</th>
                  <th className="text-left p-2 w-28">理論 Voc (V)</th>
                  <th className="text-left p-2 w-28">實測 Voc (V)</th>
                  <th className="text-left p-2 w-24">判定</th>
                  <th className="text-left p-2">備註</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1 text-muted-foreground">{i + 1}</td>
                    <td className="p-1"><Input className="h-8 text-xs" value={row.stringId} onChange={(e) => updateRow(i, 'stringId', e.target.value)} /></td>
                    <td className="p-1"><Input className="h-8 text-xs" type="number" value={row.moduleCount || ''} onChange={(e) => updateRow(i, 'moduleCount', parseInt(e.target.value) || 0)} /></td>
                    <td className="p-1"><Input className="h-8 text-xs" type="number" step="0.1" value={row.expectedVoc || ''} onChange={(e) => updateRow(i, 'expectedVoc', parseFloat(e.target.value) || 0)} /></td>
                    <td className="p-1"><Input className="h-8 text-xs" type="number" step="0.1" value={row.measuredVoc || ''} onChange={(e) => updateRow(i, 'measuredVoc', parseFloat(e.target.value) || 0)} /></td>
                    <td className="p-1">
                      <Select value={row.result} onValueChange={(v) => updateRow(i, 'result', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pass">合格</SelectItem>
                          <SelectItem value="fail">不合格</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1"><Input className="h-8 text-xs" value={row.note} onChange={(e) => updateRow(i, 'note', e.target.value)} /></td>
                    <td className="p-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(i)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
