import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Zap, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateAcTestPdf, getDefaultAcRows, type AcTestData, type AcTestRow } from '@/lib/acTestPdf';
import { useOmFormPersistence } from '@/hooks/useOmFormPersistence';
import { OmSaveLoadBar } from '@/components/om/OmSaveLoadBar';

const INITIAL_DATA: AcTestData = {
  projectName: '', siteLocation: '', inverterModel: '', inverterId: '',
  testDate: new Date().toISOString().slice(0, 10), testerName: '',
  meterNumber: '', gridVoltage: '', gridFrequency: '',
  rows: getDefaultAcRows(),
  reviewerName: '', note: '',
};

const toRow = (d: AcTestData) => ({
  project_name: d.projectName, site_location: d.siteLocation,
  inverter_model: d.inverterModel, inverter_id: d.inverterId,
  test_date: d.testDate || null, tester_name: d.testerName,
  meter_number: d.meterNumber, grid_voltage: d.gridVoltage,
  grid_frequency: d.gridFrequency, rows: d.rows,
  reviewer_name: d.reviewerName, note: d.note,
});

const fromRow = (r: Record<string, unknown>): AcTestData => ({
  projectName: (r.project_name as string) || '',
  siteLocation: (r.site_location as string) || '',
  inverterModel: (r.inverter_model as string) || '',
  inverterId: (r.inverter_id as string) || '',
  testDate: (r.test_date as string) || '',
  testerName: (r.tester_name as string) || '',
  meterNumber: (r.meter_number as string) || '',
  gridVoltage: (r.grid_voltage as string) || '',
  gridFrequency: (r.grid_frequency as string) || '',
  rows: (r.rows as AcTestRow[]) || getDefaultAcRows(),
  reviewerName: (r.reviewer_name as string) || '',
  note: (r.note as string) || '',
});

export default function AcTestForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<AcTestData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const persistence = useOmFormPersistence<AcTestData>({ table: 'om_ac_tests', toRow, fromRow });

  useEffect(() => { persistence.fetchList('project_name', 'test_date'); }, []);

  const update = useCallback(<K extends keyof AcTestData>(field: K, value: AcTestData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateRow = useCallback((idx: number, field: keyof AcTestRow, value: string) => {
    setData((prev) => {
      const rows = [...prev.rows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, rows };
    });
  }, []);

  const addRow = useCallback(() => setData((prev) => ({
    ...prev, rows: [...prev.rows, { itemId: String(prev.rows.length + 1), testItem: '', standard: '', measuredValue: '', result: '', note: '' }],
  })), []);
  const removeRow = useCallback((idx: number) => setData((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) })), []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    setIsExporting(true);
    try { await generateAcTestPdf(data); toast.success('AC 測試 PDF 已產生'); }
    catch (err) { console.error(err); toast.error('PDF 產生失敗：' + (err as Error).message); }
    finally { setIsExporting(false); }
  };

  const handleLoad = async (id: string) => { const loaded = await persistence.loadRecord(id); if (loaded) setData(loaded); };
  const handleNew = () => { setData({ ...INITIAL_DATA, rows: getDefaultAcRows() }); persistence.resetRecord(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/om')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6" />表 3-4：AC 測試自主檢查表</h1>
            <p className="text-sm text-muted-foreground">AC 端電壓、電流、頻率、接地及絕緣測試</p>
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
          <CardHeader><CardTitle className="text-base">電網與設備</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>電表號碼</Label><Input value={data.meterNumber} onChange={(e) => update('meterNumber', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>市電電壓 (V)</Label><Input value={data.gridVoltage} onChange={(e) => update('gridVoltage', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>市電頻率 (Hz)</Label><Input value={data.gridFrequency} onChange={(e) => update('gridFrequency', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>審核人</Label><Input value={data.reviewerName} onChange={(e) => update('reviewerName', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>備註</Label><Textarea value={data.note} onChange={(e) => update('note', e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">AC 測試項目</CardTitle>
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-1" />新增項目</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 w-10">#</th>
                  <th className="text-left p-2">測試項目</th>
                  <th className="text-left p-2 w-32">標準值</th>
                  <th className="text-left p-2 w-28">實測值</th>
                  <th className="text-left p-2 w-24">判定</th>
                  <th className="text-left p-2">備註</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1 text-muted-foreground">{row.itemId}</td>
                    <td className="p-1"><Input className="h-8 text-xs" value={row.testItem} onChange={(e) => updateRow(i, 'testItem', e.target.value)} /></td>
                    <td className="p-1"><Input className="h-8 text-xs" value={row.standard} onChange={(e) => updateRow(i, 'standard', e.target.value)} /></td>
                    <td className="p-1"><Input className="h-8 text-xs" value={row.measuredValue} onChange={(e) => updateRow(i, 'measuredValue', e.target.value)} /></td>
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
