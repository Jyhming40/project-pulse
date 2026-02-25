import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Loader2, HardHat, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateToolboxMeetingPdf, type ToolboxMeetingData } from '@/lib/toolboxMeetingPdf';
import { useOmFormPersistence } from '@/hooks/useOmFormPersistence';
import { OmSaveLoadBar } from '@/components/om/OmSaveLoadBar';

const WORK_LOCATIONS = ['市區', '住宅', '養殖屋舍', '房舍屋頂'];
const WORK_TYPES = ['屋頂作業', '接近活線作業', '電纜鋪設作業', '吊掛作業'];
const HAZARD_FACTORS = [
  '感電灼傷危險', '刺傷危險', '絆倒危險', '墜落危險',
  '滑倒危險', '撞擊擦傷危險', '被夾壓、衝擊', '第三人遭受意外之危險',
];

const INITIAL_DATA: ToolboxMeetingData = {
  projectName: '', contractor: '', subContractor: '',
  notifyDate: new Date().toISOString().slice(0, 10),
  workLocation: '', workDescription: '',
  selectedWorkLocations: [], selectedWorkTypes: [], selectedHazards: [],
  otherHazard: '', otherNotes: '', attendees: ['', '', '', '', ''], supervisorName: '',
};

const toRow = (d: ToolboxMeetingData) => ({
  project_name: d.projectName, contractor: d.contractor,
  sub_contractor: d.subContractor, notify_date: d.notifyDate || null,
  work_location: d.workLocation, work_description: d.workDescription,
  selected_work_locations: d.selectedWorkLocations, selected_work_types: d.selectedWorkTypes,
  selected_hazards: d.selectedHazards, other_hazard: d.otherHazard,
  other_notes: d.otherNotes, attendees: d.attendees.filter(Boolean),
  supervisor_name: d.supervisorName,
});

const fromRow = (r: Record<string, unknown>): ToolboxMeetingData => ({
  projectName: (r.project_name as string) || '',
  contractor: (r.contractor as string) || '',
  subContractor: (r.sub_contractor as string) || '',
  notifyDate: (r.notify_date as string) || '',
  workLocation: (r.work_location as string) || '',
  workDescription: (r.work_description as string) || '',
  selectedWorkLocations: (r.selected_work_locations as string[]) || [],
  selectedWorkTypes: (r.selected_work_types as string[]) || [],
  selectedHazards: (r.selected_hazards as string[]) || [],
  otherHazard: (r.other_hazard as string) || '',
  otherNotes: (r.other_notes as string) || '',
  attendees: (r.attendees as string[]) || [''],
  supervisorName: (r.supervisor_name as string) || '',
});

export default function ToolboxMeetingForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<ToolboxMeetingData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const persistence = useOmFormPersistence<ToolboxMeetingData>({ table: 'om_toolbox_meetings', toRow, fromRow });

  useEffect(() => { persistence.fetchList('project_name', 'notify_date'); }, []);

  const update = useCallback(<K extends keyof ToolboxMeetingData>(field: K, value: ToolboxMeetingData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleArray = useCallback((field: 'selectedWorkLocations' | 'selectedWorkTypes' | 'selectedHazards', value: string) => {
    setData((prev) => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  }, []);

  const updateAttendee = useCallback((index: number, value: string) => {
    setData((prev) => { const attendees = [...prev.attendees]; attendees[index] = value; return { ...prev, attendees }; });
  }, []);

  const addAttendee = useCallback(() => setData((prev) => ({ ...prev, attendees: [...prev.attendees, ''] })), []);
  const removeAttendee = useCallback((index: number) => setData((prev) => ({ ...prev, attendees: prev.attendees.filter((_, i) => i !== index) })), []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    setIsExporting(true);
    try { await generateToolboxMeetingPdf(data); toast.success('工具箱會議紀錄 PDF 已產生'); }
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
            <h1 className="text-2xl font-bold flex items-center gap-2"><HardHat className="w-6 h-6" />表 3-9：工具箱會議紀錄表</h1>
            <p className="text-sm text-muted-foreground">每日勤前教育暨危害告知單</p>
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
            <div className="space-y-1.5"><Label>工程名稱 *</Label><Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} placeholder="例：李應賀太陽能電廠" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>承攬商</Label><Input value={data.contractor} onChange={(e) => update('contractor', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>（次）承攬商</Label><Input value={data.subContractor} onChange={(e) => update('subContractor', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>告知日期</Label><Input type="date" value={data.notifyDate} onChange={(e) => update('notifyDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>作業位置</Label><Input value={data.workLocation} onChange={(e) => update('workLocation', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>作業描述</Label><Textarea value={data.workDescription} onChange={(e) => update('workDescription', e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">一、工作場所環境</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">工作地點</Label>
              <div className="flex flex-wrap gap-3">
                {WORK_LOCATIONS.map((loc) => (
                  <label key={loc} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={data.selectedWorkLocations.includes(loc)} onCheckedChange={() => toggleArray('selectedWorkLocations', loc)} />{loc}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">工作性質</Label>
              <div className="flex flex-wrap gap-3">
                {WORK_TYPES.map((wt) => (
                  <label key={wt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={data.selectedWorkTypes.includes(wt)} onCheckedChange={() => toggleArray('selectedWorkTypes', wt)} />{wt}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">二、工作場所可能之危害因素</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {HAZARD_FACTORS.map((h) => (
                <label key={h} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={data.selectedHazards.includes(h)} onCheckedChange={() => toggleArray('selectedHazards', h)} />{h}
                </label>
              ))}
            </div>
            <div className="mt-3 space-y-1.5"><Label>其他</Label><Input value={data.otherHazard} onChange={(e) => update('otherHazard', e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">其他注意事項</CardTitle></CardHeader>
          <CardContent><Textarea value={data.otherNotes} onChange={(e) => update('otherNotes', e.target.value)} rows={4} placeholder="請依當日施工重點、特殊作業或氣候等加強宣導..." /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">入場施工人員簽名</CardTitle>
            <Button variant="outline" size="sm" onClick={addAttendee}><Plus className="w-4 h-4 mr-1" /> 新增</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.attendees.map((name, i) => (
                <div key={i} className="flex gap-1">
                  <Input className="h-8 text-xs" value={name} onChange={(e) => updateAttendee(i, e.target.value)} placeholder={`人員 ${i + 1}`} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeAttendee(i)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5"><Label>工作負責人</Label><Input value={data.supervisorName} onChange={(e) => update('supervisorName', e.target.value)} className="max-w-xs" /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
