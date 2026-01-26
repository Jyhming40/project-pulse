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
import { Plus, Edit2, Trash2, AlertCircle, Database, FileCode } from "lucide-react";
import { useTieredPricing, PricingType, PricingTier } from "@/hooks/useTieredPricing";
import { formatCurrency } from "@/lib/quoteCalculations";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TieredPricingPanel() {
  const {
    pricingTypes,
    isLoading,
    useDatabase,
    getTiersForType,
    saveTier,
    deleteTier,
  } = useTieredPricing();

  const [activeTab, setActiveTab] = useState<string>(pricingTypes[0]?.typeCode || 'structural_engineer');
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<PricingTier>>({});

  const currentTiers = useMemo(() => {
    return getTiersForType(activeTab);
  }, [activeTab, getTiersForType]);

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
    const activeType = pricingTypes.find(t => t.typeCode === activeTab);
    if (!activeType) return;

    await saveTier(
      editingTier ? { ...editingTier, ...formData } : formData,
      activeType.id
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
              管理工程報價中使用的階梯式定價級距
            </CardDescription>
          </div>
          <Badge variant={useDatabase ? "default" : "secondary"} className="gap-1">
            {useDatabase ? (
              <>
                <Database className="h-3 w-3" />
                資料庫模式
              </>
            ) : (
              <>
                <FileCode className="h-3 w-3" />
                預設模式
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!useDatabase && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              目前使用系統預設定價資料。若需自訂級距，請聯繫系統管理員建立資料庫表格。
              <br />
              <span className="text-muted-foreground text-xs">
                備註：預設資料仍可正常使用於報價計算中。
              </span>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {pricingTypes.map((type) => (
              <TabsTrigger key={type.typeCode} value={type.typeCode}>
                {type.typeName}
                {type.isSystem && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    系統
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {pricingTypes.map((type) => (
            <TabsContent key={type.typeCode} value={type.typeCode}>
              <div className="space-y-4">
                {type.description && (
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                )}

                <div className="flex justify-end">
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={handleAddTier} disabled={!useDatabase}>
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
                            <Label htmlFor="minimumFee">最低收費 (選填)</Label>
                            <Input
                              id="minimumFee"
                              type="number"
                              value={formData.minimumFee || ''}
                              onChange={(e) => setFormData({ ...formData, minimumFee: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="如 10000"
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
                      <TableHead className="text-right">最低收費</TableHead>
                      {useDatabase && <TableHead className="w-24">操作</TableHead>}
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
                          {formatCurrency(tier.perKwPrice, 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {tier.minimumFee ? formatCurrency(tier.minimumFee, 0) : '-'}
                        </TableCell>
                        {useDatabase && (
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
                        )}
                      </TableRow>
                    ))}
                    {getTiersForType(type.typeCode).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={useDatabase ? 6 : 5} className="text-center text-muted-foreground py-8">
                          尚無級距資料
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
