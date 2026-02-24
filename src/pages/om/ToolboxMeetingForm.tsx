import { useState, useCallback } from 'react';
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

const SAFETY_PLEDGES = [
  '進入工地穿戴適當安全帽、安全鞋、護目鏡、識別背心及安全衛生法規規定之防護器具。',
  '工作前、工作中絕不飲用酒精性飲料，不得於非指定吸煙區吸煙及食用檳榔。',
  '出入廠區均應聽從出入口警衛管制及盤查，物品攜出須有物品攜出放行單。',
  '作業中聽到緊急警告聲時應立即疏散至安全集合地點避難並接受點名。',
  '高度 2 公尺以上之高架作業需全程使用背負式安全帶。',
  '臨時用電設備會置放滅火器，並檢查壓力表及有效期間。',
  '使用合梯的構造應堅固且與地面角度 75 度以內，兩梯腳間有繫材扣牢。',
  '使用切割機時會先檢查切割機械之防護罩。',
  '未經主管許可，絕不跨越護欄及警示帶。',
  '會將用電設備接在規定的電源插座上，絕不私自亂接。',
  '未經主管許可，絕不拆除護欄、護蓋、安全網、安全母索、警示帶、施工架踏板、漏電斷路器等安全防護裝置或使其失去功能。',
];

const WORK_LOCATIONS = ['市區', '住宅', '養殖屋舍', '房舍屋頂'];
const WORK_TYPES = ['屋頂作業', '接近活線作業', '電纜鋪設作業', '吊掛作業'];
const HAZARD_FACTORS = [
  '感電灼傷危險', '刺傷危險', '絆倒危險', '墜落危險',
  '滑倒危險', '撞擊擦傷危險', '被夾壓、衝擊', '第三人遭受意外之危險',
];

const INITIAL_DATA: ToolboxMeetingData = {
  projectName: '',
  contractor: '',
  subContractor: '',
  notifyDate: new Date().toISOString().slice(0, 10),
  workLocation: '',
  workDescription: '',
  selectedWorkLocations: [],
  selectedWorkTypes: [],
  selectedHazards: [],
  otherHazard: '',
  otherNotes: '',
  attendees: ['', '', '', '', ''],
  supervisorName: '',
};

export default function ToolboxMeetingForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<ToolboxMeetingData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);

  const update = useCallback(<K extends keyof ToolboxMeetingData>(field: K, value: ToolboxMeetingData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleArray = useCallback((field: 'selectedWorkLocations' | 'selectedWorkTypes' | 'selectedHazards', value: string) => {
    setData((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }, []);

  const updateAttendee = useCallback((index: number, value: string) => {
    setData((prev) => {
      const attendees = [...prev.attendees];
      attendees[index] = value;
      return { ...prev, attendees };
    });
  }, []);

  const addAttendee = useCallback(() => {
    setData((prev) => ({
      ...prev,
      attendees: [...prev.attendees, ''],
    }));
  }, []);

  const removeAttendee = useCallback((index: number) => {
    setData((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index),
    }));
  }, []);

  const handleExport = async () => {
    if (!data.projectName) {
      toast.error('請填寫工程名稱');
      return;
    }
    setIsExporting(true);
    try {
      await generateToolboxMeetingPdf(data);
      toast.success('工具箱會議紀錄 PDF 已產生');
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
              <HardHat className="w-6 h-6" />
              表 3-9：工具箱會議紀錄表
            </h1>
            <p className="text-sm text-muted-foreground">
              每日勤前教育暨危害告知單
            </p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>工程名稱 *</Label>
              <Input value={data.projectName} onChange={(e) => update('projectName', e.target.value)} placeholder="例：李應賀太陽能電廠" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>承攬商</Label>
                <Input value={data.contractor} onChange={(e) => update('contractor', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>（次）承攬商</Label>
                <Input value={data.subContractor} onChange={(e) => update('subContractor', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>告知日期</Label>
                <Input type="date" value={data.notifyDate} onChange={(e) => update('notifyDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>作業位置</Label>
                <Input value={data.workLocation} onChange={(e) => update('workLocation', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>作業描述</Label>
              <Textarea value={data.workDescription} onChange={(e) => update('workDescription', e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Work Environment */}
        <Card>
          <CardHeader><CardTitle className="text-base">一、工作場所環境</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">工作地點</Label>
              <div className="flex flex-wrap gap-3">
                {WORK_LOCATIONS.map((loc) => (
                  <label key={loc} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={data.selectedWorkLocations.includes(loc)}
                      onCheckedChange={() => toggleArray('selectedWorkLocations', loc)}
                    />
                    {loc}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">工作性質</Label>
              <div className="flex flex-wrap gap-3">
                {WORK_TYPES.map((wt) => (
                  <label key={wt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={data.selectedWorkTypes.includes(wt)}
                      onCheckedChange={() => toggleArray('selectedWorkTypes', wt)}
                    />
                    {wt}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hazard Factors */}
        <Card>
          <CardHeader><CardTitle className="text-base">二、工作場所可能之危害因素</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {HAZARD_FACTORS.map((h) => (
                <label key={h} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={data.selectedHazards.includes(h)}
                    onCheckedChange={() => toggleArray('selectedHazards', h)}
                  />
                  {h}
                </label>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              <Label>其他</Label>
              <Input value={data.otherHazard} onChange={(e) => update('otherHazard', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Other Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">其他注意事項</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={data.otherNotes}
              onChange={(e) => update('otherNotes', e.target.value)}
              rows={4}
              placeholder="請依當日施工重點、特殊作業或氣候等加強宣導..."
            />
          </CardContent>
        </Card>

        {/* Attendees */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">入場施工人員簽名</CardTitle>
            <Button variant="outline" size="sm" onClick={addAttendee}>
              <Plus className="w-4 h-4 mr-1" /> 新增
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.attendees.map((name, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    className="h-8 text-xs"
                    value={name}
                    onChange={(e) => updateAttendee(i, e.target.value)}
                    placeholder={`人員 ${i + 1}`}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeAttendee(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5">
              <Label>工作負責人</Label>
              <Input value={data.supervisorName} onChange={(e) => update('supervisorName', e.target.value)} className="max-w-xs" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
