import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Edit2, Trash2, Download, Upload, Info, Zap } from "lucide-react";
import { useFitRates, FitRateSchedule, FIT_RATES_115 } from "@/hooks/useFitRates";

const INSTALLATION_TYPE_LABELS: Record<string, string> = {
  rooftop: '屋頂型',
  ground: '地面型',
  floating: '水面型(浮力式)',
};

export default function FitRatesPanel() {
  const {
    rates,
    isLoading,
    availableYears,
    currentYear,
    saveRate,
    deleteRate,
    importRates,
  } = useFitRates();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [editingRate, setEditingRate] = useState<FitRateSchedule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<FitRateSchedule>>({
    installationType: 'rooftop',
    isActive: true,
  });

  // 篩選顯示的費率
  const filteredRates = useMemo(() => {
    return rates
      .filter(r => r.effectiveYear === selectedYear)
      .sort((a, b) => {
        // 先按類型排序，再按容量排序
        const typeOrder = { rooftop: 1, ground: 2, floating: 3 };
        const typeCompare = typeOrder[a.installationType] - typeOrder[b.installationType];
        if (typeCompare !== 0) return typeCompare;
        return a.capacityMinKwp - b.capacityMinKwp;
      });
  }, [rates, selectedYear]);

  // 檢查 115 年資料是否已存在
  const has115Data = useMemo(() => {
    return rates.some(r => r.effectiveYear === 115);
  }, [rates]);

  const handleEditRate = (rate: FitRateSchedule) => {
    setEditingRate(rate);
    setFormData({
      effectiveYear: rate.effectiveYear,
      installationType: rate.installationType,
      capacityMinKwp: rate.capacityMinKwp,
      capacityMaxKwp: rate.capacityMaxKwp,
      ratePerKwh: rate.ratePerKwh,
      highEfficiencyBonus: rate.highEfficiencyBonus,
      note: rate.note || '',
      isActive: rate.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleAddRate = () => {
    setEditingRate(null);
    setFormData({
      effectiveYear: selectedYear || currentYear,
      installationType: 'rooftop',
      capacityMinKwp: 1,
      capacityMaxKwp: 100,
      ratePerKwh: 4.0,
      highEfficiencyBonus: 0.2,
      note: '',
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    await saveRate(
      editingRate ? { ...editingRate, ...formData } : formData
    );
    setIsDialogOpen(false);
    setEditingRate(null);
    setFormData({ installationType: 'rooftop', isActive: true });
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
              管理太陽能光電發電設備電能躉購費率（依年度、容量級距）
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">年度：</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(Number(v))}
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
                      這將匯入經濟部公告的 115 年度太陽光電躉購費率（附表三），包含屋頂型、地面型、水面型等類別。確定要繼續嗎？
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleAddRate}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增費率
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingRate ? '編輯躉購費率' : '新增躉購費率'}
                  </DialogTitle>
                  <DialogDescription>
                    設定容量範圍及對應的躉購費率
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>年度 (民國)</Label>
                      <Input
                        type="number"
                        value={formData.effectiveYear || ''}
                        onChange={(e) => setFormData({ ...formData, effectiveYear: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>裝置類型</Label>
                      <Select
                        value={formData.installationType}
                        onValueChange={(v) => setFormData({ ...formData, installationType: v as any })}
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
                      <Label>高效能加成 (元/度)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.highEfficiencyBonus || ''}
                        onChange={(e) => setFormData({ ...formData, highEfficiencyBonus: Number(e.target.value) })}
                      />
                    </div>
                  </div>
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
          <div>
            <p className="text-muted-foreground">
              躉購費率依容量級距與裝置類型訂定，系統會根據專案容量自動帶入適用費率。
              使用「躉售電力」模式時，財務分析將使用此費率計算收益。
            </p>
          </div>
        </div>

        {/* 費率表格 */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>裝置類型</TableHead>
              <TableHead>容量範圍 (kWp)</TableHead>
              <TableHead className="text-right">基本費率</TableHead>
              <TableHead className="text-right">高效能加成</TableHead>
              <TableHead className="text-right">合計費率</TableHead>
              <TableHead>備註</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell>
                  <Badge variant="outline">
                    {INSTALLATION_TYPE_LABELS[rate.installationType]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rate.capacityMinKwp.toLocaleString()} ~ {rate.capacityMaxKwp >= 99999 ? '∞' : rate.capacityMaxKwp.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${rate.ratePerKwh.toFixed(4)}
                </TableCell>
                <TableCell className="text-right font-mono text-green-600">
                  +${rate.highEfficiencyBonus.toFixed(4)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">
                  ${(rate.ratePerKwh + rate.highEfficiencyBonus).toFixed(4)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
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
            {filteredRates.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  尚無 {selectedYear} 年度費率資料
                  {!has115Data && selectedYear === 115 && (
                    <span className="block mt-2">
                      可點擊「匯入 115 年度費率」快速載入
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
