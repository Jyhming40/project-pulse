import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Info,
  Settings2,
} from 'lucide-react';

interface ExtractedDate {
  type: 'submission' | 'issue' | 'meter_date' | 'unknown';
  date: string;
  context: string;
  confidence: number;
  source?: string;
}

interface OcrResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedDates: ExtractedDate[];
  fullText: string;
  currentSubmittedAt: string | null;
  currentIssuedAt: string | null;
  pvId?: string;
  pvIdContext?: string;
  energyPermitId?: string; // 能源署備案編號
  energyPermitIdContext?: string;
  // 派員訪查併聯函資料
  taipowerContractNo?: string;
  taipowerContractNoContext?: string;
  meterNumber?: string;
  meterNumberContext?: string;
  actualInstalledCapacity?: number;
  powerVoltage?: string;
  gridConnectionType?: string;
  pvModuleModel?: string;
  inverterModel?: string;
  panelWattage?: number;
  panelCount?: number;
  onConfirm: (
    submittedAt: string | null, 
    issuedAt: string | null, 
    meterDate?: string | null, 
    pvId?: string | null, 
    energyPermitId?: string | null,
    inspectionData?: {
      taipowerContractNo?: string | null;
      meterNumber?: string | null;
      actualInstalledCapacity?: number | null;
      powerVoltage?: string | null;
      gridConnectionType?: string | null;
      pvModuleModel?: string | null;
      inverterModel?: string | null;
      panelWattage?: number | null;
      panelCount?: number | null;
    }
  ) => void;
  isUpdating: boolean;
}

interface OcrSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxPages: number;
  onMaxPagesChange: (pages: number) => void;
  onStartOcr: () => void;
  isLoading: boolean;
}

export function OcrSettingsDialog({
  open,
  onOpenChange,
  maxPages,
  onMaxPagesChange,
  onStartOcr,
  isLoading,
}: OcrSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            OCR 辨識設定
          </DialogTitle>
          <DialogDescription>
            設定辨識參數後開始擷取文件日期
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="max-pages">辨識頁數</Label>
            <Select
              value={maxPages.toString()}
              onValueChange={(value) => onMaxPagesChange(parseInt(value))}
            >
              <SelectTrigger id="max-pages">
                <SelectValue placeholder="選擇頁數" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">僅第 1 頁（建議）</SelectItem>
                <SelectItem value="2">前 2 頁</SelectItem>
                <SelectItem value="3">前 3 頁</SelectItem>
                <SelectItem value="5">前 5 頁</SelectItem>
                <SelectItem value="0">全部頁面</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              函文重點通常在第一頁，建議只辨識第一頁以節省時間與資源
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button onClick={onStartOcr} disabled={isLoading}>
            {isLoading ? '辨識中...' : '開始辨識'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OcrResultDialog({
  open,
  onOpenChange,
  extractedDates,
  fullText,
  currentSubmittedAt,
  currentIssuedAt,
  pvId,
  pvIdContext,
  energyPermitId,
  energyPermitIdContext,
  taipowerContractNo,
  taipowerContractNoContext,
  meterNumber,
  meterNumberContext,
  actualInstalledCapacity,
  powerVoltage,
  gridConnectionType,
  pvModuleModel,
  inverterModel,
  panelWattage,
  panelCount,
  onConfirm,
  isUpdating,
}: OcrResultDialogProps) {
  // Find suggested dates from OCR
  const suggestedSubmission = extractedDates.find(d => d.type === 'submission');
  const suggestedIssue = extractedDates.find(d => d.type === 'issue');
  const suggestedMeterDate = extractedDates.find(d => d.type === 'meter_date');
  const unknownDates = extractedDates.filter(d => d.type === 'unknown');

  // State for user-selected dates
  const [selectedSubmittedAt, setSelectedSubmittedAt] = useState<string>('');
  const [selectedIssuedAt, setSelectedIssuedAt] = useState<string>('');
  const [selectedMeterDate, setSelectedMeterDate] = useState<string>('');
  const [selectedPvId, setSelectedPvId] = useState<string>('');
  const [selectedEnergyPermitId, setSelectedEnergyPermitId] = useState<string>('');
  
  // State for inspection data (派員訪查併聯函)
  const [selectedContractNo, setSelectedContractNo] = useState<string>('');
  const [selectedMeterNumber, setSelectedMeterNumber] = useState<string>('');
  const [selectedCapacity, setSelectedCapacity] = useState<string>('');
  const [selectedVoltage, setSelectedVoltage] = useState<string>('');
  const [selectedGridType, setSelectedGridType] = useState<string>('');
  const [selectedModuleModel, setSelectedModuleModel] = useState<string>('');
  const [selectedInverterModel, setSelectedInverterModel] = useState<string>('');
  const [selectedPanelWattage, setSelectedPanelWattage] = useState<string>('');
  const [selectedPanelCount, setSelectedPanelCount] = useState<string>('');

  // State for unknown dates field selection (default to 'none' meaning not applied)
  const [unknownDateSelections, setUnknownDateSelections] = useState<Record<number, string>>({});

  // Effect to auto-fill dates when extractedDates changes (after OCR completes)
  useEffect(() => {
    if (open && extractedDates.length > 0) {
      // Auto-fill from detected types
      if (suggestedSubmission?.date) {
        setSelectedSubmittedAt(suggestedSubmission.date);
      } else if (currentSubmittedAt) {
        setSelectedSubmittedAt(currentSubmittedAt.split('T')[0]);
      }
      
      if (suggestedIssue?.date) {
        setSelectedIssuedAt(suggestedIssue.date);
      } else if (currentIssuedAt) {
        setSelectedIssuedAt(currentIssuedAt.split('T')[0]);
      }
      
      // Auto-fill meter date if detected
      if (suggestedMeterDate?.date) {
        setSelectedMeterDate(suggestedMeterDate.date);
      }
      
      // Auto-fill PV ID if detected
      if (pvId) {
        setSelectedPvId(pvId);
      }
      
      // Auto-fill Energy Permit ID if detected
      if (energyPermitId) {
        setSelectedEnergyPermitId(energyPermitId);
      }
      
      // Auto-fill inspection data
      if (taipowerContractNo) setSelectedContractNo(taipowerContractNo);
      if (meterNumber) setSelectedMeterNumber(meterNumber);
      if (actualInstalledCapacity) setSelectedCapacity(actualInstalledCapacity.toString());
      if (powerVoltage) setSelectedVoltage(powerVoltage);
      if (gridConnectionType) setSelectedGridType(gridConnectionType);
      if (pvModuleModel) setSelectedModuleModel(pvModuleModel);
      if (inverterModel) setSelectedInverterModel(inverterModel);
      if (panelWattage) setSelectedPanelWattage(panelWattage.toString());
      if (panelCount) setSelectedPanelCount(panelCount.toString());
      
      // Reset unknown date selections
      setUnknownDateSelections({});
    }
  }, [open, extractedDates, suggestedSubmission?.date, suggestedIssue?.date, suggestedMeterDate?.date, 
      currentSubmittedAt, currentIssuedAt, pvId, energyPermitId,
      taipowerContractNo, meterNumber, actualInstalledCapacity, powerVoltage, gridConnectionType,
      pvModuleModel, inverterModel, panelWattage, panelCount]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedSubmittedAt('');
      setSelectedIssuedAt('');
      setSelectedMeterDate('');
      setSelectedPvId('');
      setSelectedEnergyPermitId('');
      setSelectedContractNo('');
      setSelectedMeterNumber('');
      setSelectedCapacity('');
      setSelectedVoltage('');
      setSelectedGridType('');
      setSelectedModuleModel('');
      setSelectedInverterModel('');
      setSelectedPanelWattage('');
      setSelectedPanelCount('');
      setUnknownDateSelections({});
    }
  }, [open]);

  const handleUnknownDateSelection = (index: number, field: string) => {
    setUnknownDateSelections(prev => ({ ...prev, [index]: field }));
    
    const dateValue = unknownDates[index]?.date;
    if (!dateValue) return;

    // Apply the date to the selected field
    if (field === 'submission') {
      setSelectedSubmittedAt(dateValue);
    } else if (field === 'issue') {
      setSelectedIssuedAt(dateValue);
    }
    // 'none' means don't apply
  };

  const handleConfirm = () => {
    const inspectionData = {
      taipowerContractNo: selectedContractNo || null,
      meterNumber: selectedMeterNumber || null,
      actualInstalledCapacity: selectedCapacity ? parseFloat(selectedCapacity) : null,
      powerVoltage: selectedVoltage || null,
      gridConnectionType: selectedGridType || null,
      pvModuleModel: selectedModuleModel || null,
      inverterModel: selectedInverterModel || null,
      panelWattage: selectedPanelWattage ? parseFloat(selectedPanelWattage) : null,
      panelCount: selectedPanelCount ? parseInt(selectedPanelCount) : null,
    };
    
    onConfirm(
      selectedSubmittedAt || null,
      selectedIssuedAt || null,
      selectedMeterDate || null,
      selectedPvId || null,
      selectedEnergyPermitId || null,
      inspectionData
    );
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'submission': return '送件日';
      case 'issue': return '核發日';
      case 'meter_date': return '實際掛表日';
      default: return '未知類型';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'submission': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'issue': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'meter_date': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  // Separate known type dates and unknown dates for display
  const knownTypeDates = extractedDates.filter(d => d.type !== 'unknown');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            OCR 辨識結果
          </DialogTitle>
          <DialogDescription>
            請確認辨識結果並選擇要套用的日期
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Extracted Dates Summary */}
            {extractedDates.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  偵測到 {extractedDates.length} 個日期
                </div>

                {/* Known type dates - display only */}
                {knownTypeDates.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">已識別類型日期（自動帶入下方欄位）：</p>
                    {knownTypeDates.map((dateInfo, index) => (
                      <div
                        key={`known-${index}`}
                        className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-green-600" />
                            <span className="font-mono font-medium">{dateInfo.date}</span>
                            <Badge className={getTypeBadgeColor(dateInfo.type)}>
                              {getTypeLabel(dateInfo.type)}
                            </Badge>
                            <span className="text-xs text-green-600 font-medium">→ 已自動帶入</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            信心度: {formatConfidence(dateInfo.confidence)}
                          </span>
                        </div>
                        {dateInfo.context && (
                          <ScrollArea className="h-16 w-full">
                            <div className="text-xs text-muted-foreground bg-background p-2 rounded whitespace-pre-wrap">
                              ...{dateInfo.context}...
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Unknown dates - with dropdown selector */}
                {unknownDates.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">其他日期（請選擇套用欄位）：</p>
                    {unknownDates.map((dateInfo, index) => (
                      <div
                        key={`unknown-${index}`}
                        className="p-3 border rounded-lg bg-muted/30 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-mono font-medium">{dateInfo.date}</span>
                            <Badge className={getTypeBadgeColor(dateInfo.type)}>
                              {getTypeLabel(dateInfo.type)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              信心度: {formatConfidence(dateInfo.confidence)}
                            </span>
                            <Select
                              value={unknownDateSelections[index] || 'none'}
                              onValueChange={(value) => handleUnknownDateSelection(index, value)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue placeholder="選擇欄位" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">不套用</SelectItem>
                                <SelectItem value="submission">送件日</SelectItem>
                                <SelectItem value="issue">核發日</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {dateInfo.context && (
                          <ScrollArea className="h-16 w-full">
                            <div className="text-xs text-muted-foreground bg-background p-2 rounded whitespace-pre-wrap">
                              ...{dateInfo.context}...
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                未偵測到日期資訊
              </div>
            )}

            <Separator />

            {/* PV ID Detection */}
            {pvId && (
              <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    台電 PV 編號
                  </Badge>
                  <span className="font-mono font-medium">{pvId}</span>
                  <span className="text-xs text-purple-600">→ 將更新至專案</span>
                </div>
                {pvIdContext && (
                  <div className="text-xs text-muted-foreground bg-background p-2 rounded">
                    ...{pvIdContext}...
                  </div>
                )}
              </div>
            )}

            {/* Energy Permit ID Detection */}
            {energyPermitId && (
              <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    能源署備案編號
                  </Badge>
                  <span className="font-mono font-medium">{energyPermitId}</span>
                  <span className="text-xs text-amber-600">→ 將更新至專案</span>
                </div>
                {energyPermitIdContext && (
                  <div className="text-xs text-muted-foreground bg-background p-2 rounded">
                    ...{energyPermitIdContext}...
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Date Selection - Final values */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="w-4 h-4 text-blue-500" />
                確認要套用的日期
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ocr-submitted-at">
                    送件日
                    {suggestedSubmission && selectedSubmittedAt === suggestedSubmission.date && (
                      <span className="ml-2 text-xs text-green-600">
                        (自動帶入)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="ocr-submitted-at"
                    type="date"
                    value={selectedSubmittedAt}
                    onChange={(e) => setSelectedSubmittedAt(e.target.value)}
                  />
                  {currentSubmittedAt && (
                    <p className="text-xs text-muted-foreground">
                      目前值: {currentSubmittedAt.split('T')[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ocr-issued-at">
                    核發日
                    {suggestedIssue && selectedIssuedAt === suggestedIssue.date && (
                      <span className="ml-2 text-xs text-green-600">
                        (自動帶入)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="ocr-issued-at"
                    type="date"
                    value={selectedIssuedAt}
                    onChange={(e) => setSelectedIssuedAt(e.target.value)}
                  />
                  {currentIssuedAt && (
                    <p className="text-xs text-muted-foreground">
                      目前值: {currentIssuedAt.split('T')[0]}
                    </p>
                  )}
                </div>
              </div>

              {/* Meter Date, PV ID, and Energy Permit ID - only show if detected */}
              {(suggestedMeterDate || pvId || energyPermitId) && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {suggestedMeterDate && (
                    <div className="space-y-2">
                      <Label htmlFor="ocr-meter-date">
                        實際掛表日
                        <span className="ml-2 text-xs text-orange-600">
                          (將更新至專案)
                        </span>
                      </Label>
                      <Input
                        id="ocr-meter-date"
                        type="date"
                        value={selectedMeterDate}
                        onChange={(e) => setSelectedMeterDate(e.target.value)}
                      />
                    </div>
                  )}
                  {pvId && (
                    <div className="space-y-2">
                      <Label htmlFor="ocr-pv-id">
                        台電 PV 編號
                        <span className="ml-2 text-xs text-purple-600">
                          (將更新至專案)
                        </span>
                      </Label>
                      <Input
                        id="ocr-pv-id"
                        type="text"
                        value={selectedPvId}
                        onChange={(e) => setSelectedPvId(e.target.value)}
                      />
                    </div>
                  )}
                  {energyPermitId && (
                    <div className="space-y-2">
                      <Label htmlFor="ocr-energy-permit-id">
                        能源署備案編號
                        <span className="ml-2 text-xs text-amber-600">
                          (將更新至專案)
                        </span>
                      </Label>
                      <Input
                        id="ocr-energy-permit-id"
                        type="text"
                        value={selectedEnergyPermitId}
                        onChange={(e) => setSelectedEnergyPermitId(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* OCR Text Preview with ScrollArea */}
            {fullText && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">OCR 辨識文字</p>
                  <ScrollArea className="h-48 w-full rounded-lg border bg-muted/30">
                    <div className="p-3 text-xs font-mono whitespace-pre-wrap">
                      {fullText}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    共 {fullText.length} 字
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isUpdating || (!selectedSubmittedAt && !selectedIssuedAt && !selectedMeterDate && !selectedPvId && !selectedEnergyPermitId)}
          >
            {isUpdating ? '更新中...' : '確認套用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}