import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Edit2, Trash2, Upload, Info, Zap, RefreshCw, AlertCircle, ChevronDown } from "lucide-react";
import { useFitRates, FitRateSchedule, FIT_RATES_115, InstallationType, SPECIAL_CONDITION_LABELS } from "@/hooks/useFitRates";

const INSTALLATION_TYPE_LABELS: Record<InstallationType, string> = {
  rooftop: '屋頂型',
  ground: '地面型',
  floating: '水面型(浮力式)',
};

const PERIOD_LABELS: Record<1 | 2, string> = {
  1: '上半年',
  2: '下半年',
};

export default function FitRatesPanel() {
  const {
    rates,
    isLoading,
    availableYears,
    currentYear,
    currentPeriod,
    getAvailablePeriods,
    saveRate,
    deleteRate,
    importRates,
    refresh,
  } = useFitRates();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 2>(currentPeriod);
  const [editingRate, setEditingRate] = useState<FitRateSchedule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<Partial<FitRateSchedule>>({
    installationType: 'rooftop',
    period: 1,
    isActive: true,
  });

  // 取得當前年度可用的期數
  const availablePeriods = useMemo(() => {
    return getAvailablePeriods(selectedYear);
  }, [selectedYear, getAvailablePeriods]);

  // 篩選顯示的費率
  const filteredRates = useMemo(() => {
    return rates
      .filter(r => r.effectiveYear === selectedYear && r.period === selectedPeriod)
      .sort((a, b) => {
        const typeOrder: Record<InstallationType, number> = { rooftop: 1, ground: 2, floating: 3 };
        const typeCompare = typeOrder[a.installationType] - typeOrder[b.installationType];
        if (typeCompare !== 0) return typeCompare;
        return a.capacityMinKwp - b.capacityMinKwp;
      });
  }, [rates, selectedYear, selectedPeriod]);

  // 按類型分組
  const groupedRates = useMemo(() => {
    const groups: Record<InstallationType, FitRateSchedule[]> = {
      rooftop: [],
      ground: [],
      floating: [],
    };
    filteredRates.forEach(r => {
      groups[r.installationType].push(r);
    });
    return groups;
  }, [filteredRates]);

  // 檢查 115 年資料是否已存在
  const has115Data = useMemo(() => {
    return rates.some(r => r.effectiveYear === 115);
  }, [rates]);

  const handleEditRate = (rate: FitRateSchedule) => {
    setEditingRate(rate);
    setFormData({ ...rate });
    setShowAdvanced(true);
    setIsDialogOpen(true);
  };

  const handleAddRate = () => {
    setEditingRate(null);
    setFormData({
      effectiveYear: selectedYear || currentYear,
      period: selectedPeriod,
      installationType: 'rooftop',
      capacityMinKwp: 1,
      capacityMaxKwp: 100,
      ratePerKwh: 4.0,
      highEfficiencyBonus: 0.2,
      moduleRecyclingFee: 0.02,
      rooftopGridFee: 0.04,
      fisheryBonus: 0,
      agricultureBonus: 0,
      highwayServiceBonus: 0,
      schoolSportsBonus: 0,
      schoolMetalPlateBonus: 0,
      note: '',
      isActive: true,
    });
    setShowAdvanced(false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    await saveRate(
      editingRate ? { ...editingRate, ...formData } : formData
    );
    setIsDialogOpen(false);
    setEditingRate(null);
    setFormData({ installationType: 'rooftop', period: 1, isActive: true });
  };

  const handleDelete = async (id: string) => {
    await deleteRate(id);
  };

  const handleImport115 = async () => {
    await importRates(FIT_RATES_115);
    setSelectedYear(115);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>躉購費率設定</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              躉購費率設定
            </CardTitle>
            <CardDescription>
              管理太陽能光電發電設備電能躉購費率（依年度、期別、容量級距）
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={refresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重新載入費率資料</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">年度：</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => {
                  setSelectedYear(Number(v));
                  // 重設期數到該年度可用的第一期
                  const periods = getAvailablePeriods(Number(v));
                  if (periods.length > 0 && !periods.includes(selectedPeriod)) {
                    setSelectedPeriod(periods[0]);
                  }
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      民國 {year} 年
                    </SelectItem>
                  ))}
                  {!availableYears.includes(115) && (
                    <SelectItem value="115">民國 115 年</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">期別：</Label>
              <Select
                value={selectedPeriod.toString()}
                onValueChange={(v) => setSelectedPeriod(Number(v) as 1 | 2)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">上半年</SelectItem>
                  <SelectItem value="2">下半年</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!has115Data && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    匯入 115 年度費率
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>匯入 115 年度躉購費率</AlertDialogTitle>
                    <AlertDialogDescription>
                      這將匯入經濟部公告的 115 年度太陽光電躉購費率（附表三），包含：
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>屋頂型、地面型、水面型基本費率</li>
                        <li>高效能太陽光電模組加成（需 VPC 認證）</li>
                        <li>模組回收費（僅記錄，不計入躉購費率）</li>
                        <li>屋頂型併網工程費（限特定容量）</li>
                        <li>特殊條件加成（農漁業、學校等）</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleImport115}>
                      確認匯入
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  自動更新
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>自動更新功能</AlertDialogTitle>
                  <AlertDialogDescription>
                    <div className="flex items-start gap-2 mt-2">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p>此功能目前尚未開放。</p>
                        <p className="mt-2 text-sm">
                          由於經濟部能源署尚未提供公開 API，目前無法自動取得最新費率。
                          您可以在每年度公告後手動匯入或新增費率資料。
                        </p>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction>了解</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleAddRate}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增費率
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingRate ? '編輯躉購費率' : '新增躉購費率'}
                  </DialogTitle>
                  <DialogDescription>
                    設定容量範圍及對應的躉購費率與各項加成
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* 基本資訊 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>年度 (民國)</Label>
                      <Input
                        type="number"
                        value={formData.effectiveYear || ''}
                        onChange={(e) => setFormData({ ...formData, effectiveYear: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>期別</Label>
                      <Select
                        value={formData.period?.toString()}
                        onValueChange={(v) => setFormData({ ...formData, period: Number(v) as 1 | 2 })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">上半年</SelectItem>
                          <SelectItem value="2">下半年</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>裝置類型</Label>
                      <Select
                        value={formData.installationType}
                        onValueChange={(v) => setFormData({ ...formData, installationType: v as InstallationType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rooftop">屋頂型</SelectItem>
                          <SelectItem value="ground">地面型</SelectItem>
                          <SelectItem value="floating">水面型(浮力式)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>最小容量 (kWp)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.capacityMinKwp || ''}
                        onChange={(e) => setFormData({ ...formData, capacityMinKwp: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>最大容量 (kWp)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.capacityMaxKwp || ''}
                        onChange={(e) => setFormData({ ...formData, capacityMaxKwp: Number(e.target.value) })}
                        placeholder="99999 表示無上限"
                      />
                    </div>
                  </div>
                  
                  {/* 基本費率 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>基本費率 (元/度)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.ratePerKwh || ''}
                        onChange={(e) => setFormData({ ...formData, ratePerKwh: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        高效能加成 (元/度)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>需使用 VPC 認證模組才適用</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.highEfficiencyBonus || ''}
                        onChange={(e) => setFormData({ ...formData, highEfficiencyBonus: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* 進階設定 */}
                  <Accordion type="single" collapsible value={showAdvanced ? "advanced" : ""} onValueChange={(v) => setShowAdvanced(v === "advanced")}>
                    <AccordionItem value="advanced" className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-medium">
                        進階費率設定（併網工程費、特殊條件加成）
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              模組回收費 (元/度)
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>僅供記錄，不計入躉購費率</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>
                            <Input
                              type="number"
                              step="0.0001"
                              value={formData.moduleRecyclingFee || ''}
                              onChange={(e) => setFormData({ ...formData, moduleRecyclingFee: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              併網工程費 (元/度)
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>僅適用屋頂型特定容量級距</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>
                            <Input
                              type="number"
                              step="0.0001"
                              value={formData.rooftopGridFee || ''}
                              onChange={(e) => setFormData({ ...formData, rooftopGridFee: Number(e.target.value) })}
                              disabled={formData.installationType !== 'rooftop'}
                            />
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <Label className="text-sm font-medium mb-3 block">特殊條件加成 (元/度)</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">漁業環境友善公積金</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                value={formData.fisheryBonus || ''}
                                onChange={(e) => setFormData({ ...formData, fisheryBonus: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">農業經營結合綠能</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                value={formData.agricultureBonus || ''}
                                onChange={(e) => setFormData({ ...formData, agricultureBonus: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">高速公路服務區停車場</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                value={formData.highwayServiceBonus || ''}
                                onChange={(e) => setFormData({ ...formData, highwayServiceBonus: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">學校光電運動場</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                value={formData.schoolSportsBonus || ''}
                                onChange={(e) => setFormData({ ...formData, schoolSportsBonus: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label className="text-xs text-muted-foreground">學校光電運動場金屬浪板</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                value={formData.schoolMetalPlateBonus || ''}
                                onChange={(e) => setFormData({ ...formData, schoolMetalPlateBonus: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="space-y-2">
                    <Label>備註</Label>
                    <Input
                      value={formData.note || ''}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="例：1瓩以上不及10瓩"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSave}>
                    儲存
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 說明區塊 */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-muted-foreground space-y-1">
            <p>
              躉購費率依年度、期別、容量級距與裝置類型訂定。系統會根據專案條件自動帶入適用費率。
            </p>
            <p className="text-xs">
              <span className="text-green-600 font-medium">高效能加成</span>：需使用 VPC 認證模組 ｜ 
              <span className="text-amber-600 font-medium ml-2">模組回收費</span>：僅記錄不計入 ｜
              <span className="text-blue-600 font-medium ml-2">併網工程費</span>：僅適用屋頂型
            </p>
          </div>
        </div>

        {/* 費率表格 - 按類型分組 */}
        <Tabs defaultValue="rooftop" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rooftop" className="flex items-center gap-1">
              屋頂型
              <Badge variant="secondary" className="ml-1 text-xs">
                {groupedRates.rooftop.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ground" className="flex items-center gap-1">
              地面型
              <Badge variant="secondary" className="ml-1 text-xs">
                {groupedRates.ground.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="floating" className="flex items-center gap-1">
              水面型
              <Badge variant="secondary" className="ml-1 text-xs">
                {groupedRates.floating.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {(['rooftop', 'ground', 'floating'] as InstallationType[]).map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>容量範圍</TableHead>
                    <TableHead className="text-right">基本費率</TableHead>
                    <TableHead className="text-right">高效能加成</TableHead>
                    {type === 'rooftop' && (
                      <TableHead className="text-right">併網工程費</TableHead>
                    )}
                    <TableHead className="text-right text-muted-foreground">回收費</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead className="w-20">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRates[type].map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">
                        {rate.capacityMinKwp.toLocaleString()} ~ {rate.capacityMaxKwp >= 99999 ? '∞' : rate.capacityMaxKwp.toLocaleString()} kWp
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${rate.ratePerKwh.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        +${rate.highEfficiencyBonus.toFixed(4)}
                      </TableCell>
                      {type === 'rooftop' && (
                        <TableCell className="text-right font-mono text-blue-600">
                          {rate.rooftopGridFee > 0 ? `+$${rate.rooftopGridFee.toFixed(4)}` : '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {rate.moduleRecyclingFee > 0 ? `$${rate.moduleRecyclingFee.toFixed(4)}` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {rate.note || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditRate(rate)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>確定要刪除此費率？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作無法復原。刪除後，使用此費率的報價將需要手動輸入費率。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(rate.id)}>
                                  確認刪除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {groupedRates[type].length === 0 && (
                    <TableRow>
                      <TableCell colSpan={type === 'rooftop' ? 7 : 6} className="text-center text-muted-foreground py-8">
                        {selectedYear} 年度第 {selectedPeriod === 1 ? '一' : '二'} 期尚無{INSTALLATION_TYPE_LABELS[type]}費率資料
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* 特殊條件加成顯示 (僅地面型和水面型) */}
              {type !== 'rooftop' && groupedRates[type].length > 0 && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">可適用之特殊條件加成 (元/度)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {groupedRates[type][0]?.fisheryBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">漁業環境友善公積金:</span>
                        <span className="font-mono">+${groupedRates[type][0].fisheryBonus.toFixed(4)}</span>
                      </div>
                    )}
                    {groupedRates[type][0]?.agricultureBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">農業經營結合綠能:</span>
                        <span className="font-mono">+${groupedRates[type][0].agricultureBonus.toFixed(4)}</span>
                      </div>
                    )}
                    {groupedRates[type][0]?.highwayServiceBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">高速公路服務區:</span>
                        <span className="font-mono">+${groupedRates[type][0].highwayServiceBonus.toFixed(4)}</span>
                      </div>
                    )}
                    {groupedRates[type][0]?.schoolSportsBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">學校光電運動場:</span>
                        <span className="font-mono">+${groupedRates[type][0].schoolSportsBonus.toFixed(4)}</span>
                      </div>
                    )}
                    {groupedRates[type][0]?.schoolMetalPlateBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">學校金屬浪板:</span>
                        <span className="font-mono">+${groupedRates[type][0].schoolMetalPlateBonus.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
