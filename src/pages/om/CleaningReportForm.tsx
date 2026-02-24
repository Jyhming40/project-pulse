import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Download, Loader2, FileText, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { generateCleaningReportPdf, type CleaningReportData } from '@/lib/cleaningReportPdf';

const INITIAL_DATA: CleaningReportData = {
  siteCode: '',
  siteName: '',
  siteLocation: '',
  moduleCount: '',
  contractor: '',
  inspectionDate: new Date().toISOString().slice(0, 10),
  workers: '',
  ownerInspector: '',
  roofLeak: 'no',
  moduleDamage: 'no',
  damagedCount: '',
  description: '',
  managerName: '',
  handlerName: '',
  contractorSignName: '',
};

export default function CleaningReportForm() {
  const navigate = useNavigate();
  const [data, setData] = useState<CleaningReportData>(INITIAL_DATA);
  const [isExporting, setIsExporting] = useState(false);

  const update = useCallback((field: keyof CleaningReportData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleExport = async () => {
    if (!data.siteName) {
      toast.error('請填寫案場名稱');
      return;
    }
    setIsExporting(true);
    try {
      await generateCleaningReportPdf(data);
      toast.success('清洗報告 PDF 已產生');
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Droplets className="w-6 h-6" />
              表 3-5：模組清洗報告
            </h1>
            <p className="text-sm text-muted-foreground">
              填寫後產生與中租合約格式一致的 PDF，可列印提交請款
            </p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting} size="lg">
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isExporting ? '產生中...' : '產生 PDF'}
        </Button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 案場資訊 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              案場資訊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>案場代號</Label>
                <Input value={data.siteCode} onChange={(e) => update('siteCode', e.target.value)} placeholder="例：A001" />
              </div>
              <div className="space-y-1.5">
                <Label>案場名稱 *</Label>
                <Input value={data.siteName} onChange={(e) => update('siteName', e.target.value)} placeholder="例：李應賀" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>案場地點</Label>
              <Input value={data.siteLocation} onChange={(e) => update('siteLocation', e.target.value)} placeholder="例：雲林縣土庫鎮..." />
            </div>
            <div className="space-y-1.5">
              <Label>模組片數</Label>
              <Input value={data.moduleCount} onChange={(e) => update('moduleCount', e.target.value)} placeholder="例：500" type="number" />
            </div>
          </CardContent>
        </Card>

        {/* 施工資訊 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">施工資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>施工廠商</Label>
                <Input value={data.contractor} onChange={(e) => update('contractor', e.target.value)} placeholder="例：永沛新能源有限公司" />
              </div>
              <div className="space-y-1.5">
                <Label>驗收日期</Label>
                <Input type="date" value={data.inspectionDate} onChange={(e) => update('inspectionDate', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>施工人員</Label>
                <Input value={data.workers} onChange={(e) => update('workers', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>甲方驗收人員</Label>
                <Input value={data.ownerInspector} onChange={(e) => update('ownerInspector', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 清洗前確認 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">清洗前請確認</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-medium">屋頂漏水狀況</Label>
                <RadioGroup value={data.roofLeak} onValueChange={(v) => update('roofLeak', v)}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="roof-no" />
                    <Label htmlFor="roof-no" className="cursor-pointer">屋頂無漏水現象</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="roof-yes" />
                    <Label htmlFor="roof-yes" className="cursor-pointer text-destructive">屋頂有漏水現象（請於清洗前通知甲方）</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label className="font-medium">模組破損狀況</Label>
                <RadioGroup value={data.moduleDamage} onValueChange={(v) => update('moduleDamage', v)}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="mod-no" />
                    <Label htmlFor="mod-no" className="cursor-pointer">模組無破損</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="mod-yes" />
                    <Label htmlFor="mod-yes" className="cursor-pointer text-destructive">模組有破損（請於清洗前通知甲方）</Label>
                  </div>
                </RadioGroup>
                {data.moduleDamage === 'yes' && (
                  <Input
                    className="mt-2 w-32"
                    value={data.damagedCount}
                    onChange={(e) => update('damagedCount', e.target.value)}
                    placeholder="破損片數"
                    type="number"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>說明</Label>
              <Textarea
                value={data.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="補充說明事項..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* 照片提示 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">照片區域</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              PDF 中已預留「清洗前照片」、「清洗中照片」、「清洗後照片」三個區塊供列印後黏貼或手寫填入。
              後續版本將支援直接上傳照片嵌入 PDF。
            </p>
          </CardContent>
        </Card>

        {/* 簽章區 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">簽章區</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>主管</Label>
                <Input value={data.managerName} onChange={(e) => update('managerName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>承辦人</Label>
                <Input value={data.handlerName} onChange={(e) => update('handlerName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>施工廠商</Label>
                <Input value={data.contractorSignName} onChange={(e) => update('contractorSignName', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
