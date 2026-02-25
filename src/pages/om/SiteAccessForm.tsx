import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { generateSiteAccessPdf, type SiteAccessData } from '@/lib/siteAccessPdf';
import { useOmFormPersistence } from '@/hooks/useOmFormPersistence';
import { OmSaveLoadBar } from '@/components/om/OmSaveLoadBar';

const INITIAL_DATA: SiteAccessData = {
  projectName: '', siteLocation: '', applicantCompany: '', applicantName: '',
  applicantPhone: '', applicantEmail: '', applyDate: new Date().toISOString().slice(0, 10),
  startDate: '', endDate: '', workPurpose: '', workContent: '',
  personnelCount: 1, vehicleCount: 0, vehicleDetails: '', toolsEquipment: '',
  safetyMeasures: '', insuranceCoverage: '', insuranceExpiry: '',
  approverName: '', approverTitle: '', approvalStatus: 'pending', note: '',
};

const toRow = (d: SiteAccessData) => ({
  project_name: d.projectName, site_location: d.siteLocation,
  applicant_company: d.applicantCompany, applicant_name: d.applicantName,
  applicant_phone: d.applicantPhone, applicant_email: d.applicantEmail,
  apply_date: d.applyDate || null, start_date: d.startDate || null,
  end_date: d.endDate || null, work_purpose: d.workPurpose,
  work_content: d.workContent, personnel_count: d.personnelCount,
  vehicle_count: d.vehicleCount, vehicle_details: d.vehicleDetails,
  tools_equipment: d.toolsEquipment, safety_measures: d.safetyMeasures,
  insurance_coverage: d.insuranceCoverage, insurance_expiry: d.insuranceExpiry || null,
  approver_name: d.approverName, approver_title: d.approverTitle,
  approval_status: d.approvalStatus, note: d.note,
});

const fromRow = (r: Record<string, unknown>): SiteAccessData => ({
  projectName: (r.project_name as string) || '',
  siteLocation: (r.site_location as string) || '',
  applicantCompany: (r.applicant_company as string) || '',
  applicantName: (r.applicant_name as string) || '',
  applicantPhone: (r.applicant_phone as string) || '',
  applicantEmail: (r.applicant_email as string) || '',
  applyDate: (r.apply_date as string) || '',
  startDate: (r.start_date as string) || '',
  endDate: (r.end_date as string) || '',
  workPurpose: (r.work_purpose as string) || '',
  workContent: (r.work_content as string) || '',
  personnelCount: (r.personnel_count as number) || 1,
  vehicleCount: (r.vehicle_count as number) || 0,
  vehicleDetails: (r.vehicle_details as string) || '',
  toolsEquipment: (r.tools_equipment as string) || '',
  safetyMeasures: (r.safety_measures as string) || '',
  insuranceCoverage: (r.insurance_coverage as string) || '',
  insuranceExpiry: (r.insurance_expiry as string) || '',
  approverName: (r.approver_name as string) || '',
  approverTitle: (r.approver_title as string) || '',
  approvalStatus: (r.approval_status as SiteAccessData['approvalStatus']) || 'pending',
  note: (r.note as string) || '',
});

export default function SiteAccessForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<SiteAccessData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const persistence = useOmFormPersistence<SiteAccessData>({ table: 'om_site_access_requests', toRow, fromRow });

  useEffect(() => { persistence.fetchList('project_name', 'apply_date'); }, []);

  const update = useCallback(<K extends keyof SiteAccessData>(field: K, value: SiteAccessData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleExport = async () => {
    if (!data.projectName) { toast.error('請填寫工程名稱'); return; }
    if (!data.applicantCompany) { toast.error('請填寫申請單位'); return; }
    setIsExporting(true);
    try { await generateSiteAccessPdf(data); toast.success('進場申請單 PDF 已產生'); }
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
            <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" />表 3-7：工程進場施作申請單</h1>
            <p className="text-sm text-muted-foreground">進場施作申請與核准紀錄</p>
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
          <CardHeader><CardTitle className="text-base">工程資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>工程名稱 *</Label><Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} placeholder="例：李應賀太陽能電廠" /></div>
            <div className="space-y-1.5"><Label>工程地點</Label><Input value={data.siteLocation} onChange={(e) => update('siteLocation', e.target.value)} placeholder="例：台南市善化區..." /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">申請人資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>申請單位 *</Label><Input value={data.applicantCompany} onChange={(e) => update('applicantCompany', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>申請人</Label><Input value={data.applicantName} onChange={(e) => update('applicantName', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>聯絡電話</Label><Input value={data.applicantPhone} onChange={(e) => update('applicantPhone', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={data.applicantEmail} onChange={(e) => update('applicantEmail', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>申請日期</Label><Input type="date" value={data.applyDate} onChange={(e) => update('applyDate', e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">施工期間與內容</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>預計進場日期</Label><Input type="date" value={data.startDate} onChange={(e) => update('startDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>預計離場日期</Label><Input type="date" value={data.endDate} onChange={(e) => update('endDate', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>施工目的</Label><Input value={data.workPurpose} onChange={(e) => update('workPurpose', e.target.value)} placeholder="例：定期維護保養、模組清洗..." /></div>
            <div className="space-y-1.5"><Label>施工內容</Label><Textarea value={data.workContent} onChange={(e) => update('workContent', e.target.value)} rows={3} placeholder="詳述施工內容..." /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">人員與車輛</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>進場人數</Label><Input type="number" min={1} value={data.personnelCount} onChange={(e) => update('personnelCount', parseInt(e.target.value) || 1)} /></div>
              <div className="space-y-1.5"><Label>車輛數</Label><Input type="number" min={0} value={data.vehicleCount} onChange={(e) => update('vehicleCount', parseInt(e.target.value) || 0)} /></div>
            </div>
            <div className="space-y-1.5"><Label>車輛說明</Label><Input value={data.vehicleDetails} onChange={(e) => update('vehicleDetails', e.target.value)} placeholder="車牌號碼、車種..." /></div>
            <div className="space-y-1.5"><Label>攜帶工具/設備</Label><Textarea value={data.toolsEquipment} onChange={(e) => update('toolsEquipment', e.target.value)} rows={2} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">安全與保險</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>安全防護措施</Label><Textarea value={data.safetyMeasures} onChange={(e) => update('safetyMeasures', e.target.value)} rows={2} placeholder="已備妥之安全防護器具與措施..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>保險承保範圍</Label><Input value={data.insuranceCoverage} onChange={(e) => update('insuranceCoverage', e.target.value)} placeholder="例：雇主責任險、第三人責任險" /></div>
              <div className="space-y-1.5"><Label>保險到期日</Label><Input type="date" value={data.insuranceExpiry} onChange={(e) => update('insuranceExpiry', e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">核准資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>核准人姓名</Label><Input value={data.approverName} onChange={(e) => update('approverName', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>核准人職稱</Label><Input value={data.approverTitle} onChange={(e) => update('approverTitle', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>核准狀態</Label>
              <Select value={data.approvalStatus} onValueChange={(v) => update('approvalStatus', v as SiteAccessData['approvalStatus'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待審核</SelectItem>
                  <SelectItem value="approved">已核准</SelectItem>
                  <SelectItem value="rejected">不予核准</SelectItem>
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
