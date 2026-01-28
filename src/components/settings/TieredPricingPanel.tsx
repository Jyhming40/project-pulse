import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Calculator, Info } from "lucide-react";
import { useTieredPricing, PricingTier } from "@/hooks/useTieredPricing";
import { formatCurrency } from "@/lib/quoteCalculations";
import { getTieredPricingDescription } from "@/lib/tieredPricing";

export default function TieredPricingPanel() {
  const {
    pricingTypes,
    isLoading,
    getTiersForType,
    getStructuralDataPoints,
    getStructuralPer500kwFee,
    saveTier,
    deleteTier,
    calculatePrice,
  } = useTieredPricing();

  const [activeTab, setActiveTab] = useState<string>(pricingTypes[0]?.typeCode || 'structural_engineer');
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<PricingTier>>({});
  const [testCapacity, setTestCapacity] = useState<number>(100);

  const currentTiers = useMemo(() => {
    return getTiersForType(activeTab);
  }, [activeTab, getTiersForType]);

  const activeType = pricingTypes.find(t => t.typeCode === activeTab);
  const isInterpolationType = activeType?.calculationMethod === 'interpolation';

  // 測試計算結果
  const testResult = useMemo(() => {
    if (testCapacity <= 0) return null;
    return calculatePrice(testCapacity, activeTab);
  }, [testCapacity, activeTab, calculatePrice]);

  const handleEditTier = (tier: PricingTier) => {
    setEditingTier(tier);
    setFormData({
      minKw: tier.minKw,
      maxKw: tier.maxKw,
      coefficient: tier.coefficient,
      perKwPrice: tier.perKwPrice,
      minimumFee: tier.minimumFee,
      sortOrder: tier.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleAddTier = () => {
    setEditingTier(null);
    const lastTier = currentTiers[currentTiers.length - 1];
    setFormData({
      minKw: lastTier ? lastTier.maxKw + 1 : 1,
      maxKw: lastTier ? lastTier.maxKw + 100 : 99,
      perKwPrice: lastTier?.perKwPrice || 1000,
      sortOrder: (lastTier?.sortOrder || 0) + 1,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const activeTypeObj = pricingTypes.find(t => t.typeCode === activeTab);
    if (!activeTypeObj) return;

    await saveTier(
      editingTier ? { ...editingTier, ...formData } : formData,
      activeTypeObj.id
    );
    setIsDialogOpen(false);
    setEditingTier(null);
    setFormData({});
  };

  const handleDelete = async (tierId: string) => {
    if (confirm('確定要刪除此級距嗎？')) {
      await deleteTier(tierId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>階梯定價設定</CardTitle>
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
            <CardTitle>階梯定價設定</CardTitle>
            <CardDescription>
              管理工程報價中使用的階梯式定價級距（結構技師、電機技師、明群環能）
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {pricingTypes.map((type) => (
              <TabsTrigger key={type.typeCode} value={type.typeCode}>
                {type.typeName}
              </TabsTrigger>
            ))}
          </TabsList>

          {pricingTypes.map((type) => (
            <TabsContent key={type.typeCode} value={type.typeCode}>
              <div className="space-y-4">
                {/* 類型說明 */}
                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium">{type.typeName}</span>
                    <span className="text-muted-foreground ml-2">
                      {getTieredPricingDescription(type.typeCode as any)}
                    </span>
                    {type.calculationMethod === 'interpolation' && (
                      <Badge variant="outline" className="ml-2">內插法</Badge>
                    )}
                    {type.calculationMethod === 'tiered' && (
                      <Badge variant="outline" className="ml-2">階梯定價</Badge>
                    )}
                  </div>
                </div>

                {/* 計算測試區 */}
                <div className="p-4 border rounded-lg bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4" />
                    <span className="font-medium text-sm">即時計算測試</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="testCapacity" className="text-xs">裝置容量 (kW)</Label>
                      <Input
                        id="testCapacity"
                        type="number"
                        value={testCapacity}
                        onChange={(e) => setTestCapacity(Number(e.target.value))}
                        className="w-32"
                        min={0}
                      />
                    </div>
                    {testResult && (
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">計算金額：</span>
                          <span className="font-mono font-semibold text-primary ml-1">
                            {formatCurrency(testResult.total, 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">平均每kW：</span>
                          <span className="font-mono ml-1">
                            {formatCurrency(testResult.perKwPrice, 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 結構技師內插法資料 */}
                {type.typeCode === 'structural_engineer' && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">內插法資料點</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>容量 (kW)</TableHead>
                          <TableHead className="text-right">對應價格</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getStructuralDataPoints().map((point, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{point.kw.toLocaleString()} kW</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(point.price, 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                      <p>• &lt;10kW: 固定收費 $8,000</p>
                      <p>• 10-499kW: 使用上表資料點進行線性內插</p>
                      <p>• ≥500kW: 每 500kW = {formatCurrency(getStructuralPer500kwFee(), 0)}，餘數另計</p>
                      <p className="mt-1">例：800kW = 500kW + 300kW = $23,000 + $21,000 = $44,000</p>
                    </div>
                  </div>
                )}

                {/* 電機技師與明群環能的階梯表格 */}
                {type.typeCode !== 'structural_engineer' && (
                  <>
                    <div className="flex justify-end">
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={handleAddTier}>
                            <Plus className="h-4 w-4 mr-1" />
                            新增級距
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {editingTier ? '編輯級距' : '新增級距'}
                            </DialogTitle>
                            <DialogDescription>
                              設定容量範圍及對應的每 kW 單價
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="minKw">最小容量 (kW)</Label>
                                <Input
                                  id="minKw"
                                  type="number"
                                  value={formData.minKw || ''}
                                  onChange={(e) => setFormData({ ...formData, minKw: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="maxKw">最大容量 (kW)</Label>
                                <Input
                                  id="maxKw"
                                  type="number"
                                  value={formData.maxKw || ''}
                                  onChange={(e) => setFormData({ ...formData, maxKw: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="perKwPrice">每 kW 單價 (元)</Label>
                              <Input
                                id="perKwPrice"
                                type="number"
                                value={formData.perKwPrice || ''}
                                onChange={(e) => setFormData({ ...formData, perKwPrice: Number(e.target.value) })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="coefficient">係數 (選填)</Label>
                                <Input
                                  id="coefficient"
                                  type="number"
                                  step="0.01"
                                  value={formData.coefficient || ''}
                                  onChange={(e) => setFormData({ ...formData, coefficient: e.target.value ? Number(e.target.value) : undefined })}
                                  placeholder="如 1.33"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="minimumFee">最低/固定收費 (選填)</Label>
                                <Input
                                  id="minimumFee"
                                  type="number"
                                  value={formData.minimumFee || ''}
                                  onChange={(e) => setFormData({ ...formData, minimumFee: e.target.value ? Number(e.target.value) : undefined })}
                                  placeholder="如 7000"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sortOrder">排序</Label>
                              <Input
                                id="sortOrder"
                                type="number"
                                value={formData.sortOrder || ''}
                                onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
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

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">排序</TableHead>
                          <TableHead>容量範圍 (kW)</TableHead>
                          <TableHead className="text-right">係數</TableHead>
                          <TableHead className="text-right">每 kW 單價</TableHead>
                          <TableHead className="text-right">固定/最低收費</TableHead>
                          <TableHead className="w-24">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTiersForType(type.typeCode).map((tier) => (
                          <TableRow key={tier.id}>
                            <TableCell className="text-muted-foreground">
                              {tier.sortOrder}
                            </TableCell>
                            <TableCell>
                              {tier.minKw.toLocaleString()} ~ {tier.maxKw >= 99999 ? '∞' : tier.maxKw.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {tier.coefficient ? `${(tier.coefficient * 100).toFixed(0)}%` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {tier.perKwPrice === 0 ? '-' : formatCurrency(tier.perKwPrice, 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {tier.minimumFee ? formatCurrency(tier.minimumFee, 0) : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditTier(tier)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(tier.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {getTiersForType(type.typeCode).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              尚無級距資料
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
