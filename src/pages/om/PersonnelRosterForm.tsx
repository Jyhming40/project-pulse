import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Users, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generatePersonnelRosterPdf, type PersonnelRosterData, type PersonnelEntry } from '@/lib/personnelRosterPdf';
import { useOmFormPersistence } from '@/hooks/useOmFormPersistence';
import { OmSaveLoadBar } from '@/components/om/OmSaveLoadBar';

const DEFAULT_ROLES = ['承攬人', '現場負責人', '職安衛生人員', '工作人員'];

function createEmptyEntry(index: number): PersonnelEntry {
  return { seq: index + 1, role: index < DEFAULT_ROLES.length ? DEFAULT_ROLES[index] : '工作人員', name: '', gender: '', birthDate: '', bloodType: '', emergencyContact: '' };
}

const INITIAL_DATA: PersonnelRosterData = {
  projectName: '', constructionDate: new Date().toISOString().slice(0, 10),
  contractor: '', personnel: Array.from({ length: 5 }, (_, i) => createEmptyEntry(i)),
};

const toRow = (d: PersonnelRosterData) => ({
  project_name: d.projectName, construction_date: d.constructionDate || null,
  contractor: d.contractor, personnel: d.personnel,
});

const fromRow = (r: Record<string, unknown>): PersonnelRosterData => ({
  projectName: (r.project_name as string) || '',
  constructionDate: (r.construction_date as string) || '',
  contractor: (r.contractor as string) || '',
  personnel: (r.personnel as PersonnelEntry[]) || [],
});

export default function PersonnelRosterForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<PersonnelRosterData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const persistence = useOmFormPersistence<PersonnelRosterData>({ table: 'om_personnel_rosters', toRow, fromRow });

  useEffect(() => { persistence.fetchList('project_name', 'construction_date'); }, []);

  const update = useCallback((field: keyof PersonnelRosterData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updatePerson = useCallback((index: number, field: keyof PersonnelEntry, value: string | number) => {
    setData((prev) => {
      const personnel = [...prev.personnel];
      personnel[index] = { ...personnel[index], [field]: value };
      return { ...prev, personnel };
    });
  }, []);

  const addPerson = useCallback(() => {
    setData((prev) => {
      if (prev.personnel.length >= 20) { toast.error('最多 20 位人員'); return prev; }
      return { ...prev, personnel: [...prev.personnel, createEmptyEntry(prev.personnel.length)] };
    });
  }, []);

  const removePerson = useCallback((index: number) => {
    setData((prev) => ({
      ...prev, personnel: prev.personnel.filter((_, i) => i !== index).map((p, i) => ({ ...p, seq: i + 1 })),
    }));
  }, []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    setIsExporting(true);
    try { await generatePersonnelRosterPdf(data); toast.success('人員名冊 PDF 已產生'); }
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
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" />表 3-8：工程進場施作人員名冊</h1>
            <p className="text-sm text-muted-foreground">填寫後產生與中租合約格式一致的 PDF</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      <OmSaveLoadBar recordId={persistence.recordId} isSaving={persistence.isSaving} isLoading={persistence.isLoading}
        savedRecords={persistence.savedRecords} onSave={() => persistence.save(data)} onLoad={handleLoad} onNew={handleNew} />

      <Card>
        <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>工程名稱 *</Label><Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} placeholder="例：李應賀太陽能電廠" /></div>
            <div className="space-y-1.5"><Label>施工日期</Label><Input type="date" value={data.constructionDate} onChange={(e) => update('constructionDate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>承攬商</Label><Input value={data.contractor} onChange={(e) => update('contractor', e.target.value)} placeholder="例：永沛新能源有限公司" /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">人員名冊（{data.personnel.length}/20）</CardTitle>
          <Button variant="outline" size="sm" onClick={addPerson} disabled={data.personnel.length >= 20}><Plus className="w-4 h-4 mr-1" /> 新增人員</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-1 w-10">#</th>
                  <th className="text-left py-2 px-1 w-28">工作職稱</th>
                  <th className="text-left py-2 px-1">姓名</th>
                  <th className="text-left py-2 px-1 w-20">性別</th>
                  <th className="text-left py-2 px-1 w-40">出生年月日</th>
                  <th className="text-left py-2 px-1 w-16">血型</th>
                  <th className="text-left py-2 px-1">緊急聯絡人／電話</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.personnel.map((person, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-1.5 px-1 text-muted-foreground">{person.seq}</td>
                    <td className="py-1.5 px-1"><Input className="h-8 text-xs" value={person.role} onChange={(e) => updatePerson(i, 'role', e.target.value)} /></td>
                    <td className="py-1.5 px-1"><Input className="h-8 text-xs" value={person.name} onChange={(e) => updatePerson(i, 'name', e.target.value)} /></td>
                    <td className="py-1.5 px-1">
                      <Select value={person.gender} onValueChange={(v) => updatePerson(i, 'gender', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="男">男</SelectItem><SelectItem value="女">女</SelectItem></SelectContent>
                      </Select>
                    </td>
                    <td className="py-1.5 px-1"><Input className="h-8 text-xs" value={person.birthDate} onChange={(e) => updatePerson(i, 'birthDate', e.target.value)} placeholder="後三碼以XXX表示" /></td>
                    <td className="py-1.5 px-1">
                      <Select value={person.bloodType} onValueChange={(v) => updatePerson(i, 'bloodType', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="O">O</SelectItem><SelectItem value="AB">AB</SelectItem></SelectContent>
                      </Select>
                    </td>
                    <td className="py-1.5 px-1"><Input className="h-8 text-xs" value={person.emergencyContact} onChange={(e) => updatePerson(i, 'emergencyContact', e.target.value)} placeholder="聯絡人／電話" /></td>
                    <td className="py-1.5 px-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePerson(i)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">※ 承攬雇主之施作人員（含臨時聘僱作業人員）應投保相關保險並應將保單證明附上</p>
        </CardContent>
      </Card>
    </div>
  );
}
