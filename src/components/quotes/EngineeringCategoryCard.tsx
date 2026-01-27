import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, GripVertical } from "lucide-react";
import { 
  EngineeringCategory, 
  EngineeringItem, 
  BillingMethod,
  calculateItemSubtotal, 
  generateId 
} from "@/hooks/useQuoteEngineering";
import { formatCurrency } from "@/lib/quoteCalculations";
import { TieredPricingType, calculateTieredPrice, getTieredPricingLabel } from "@/lib/tieredPricing";

interface EngineeringCategoryCardProps {
  category: EngineeringCategory;
  onUpdate: (category: EngineeringCategory) => void;
  onDelete: () => void;
  capacityKwp?: number;
}

export default function EngineeringCategoryCard({
  category,
  onUpdate,
  onDelete,
  capacityKwp = 0,
}: EngineeringCategoryCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(category.categoryName);

  // 計算類別小計
  const categoryTotal = category.items.reduce((sum, item) => {
    return sum + calculateItemSubtotal(item, capacityKwp);
  }, 0);

  // 更新單一項目
  const handleUpdateItem = (index: number, updates: Partial<EngineeringItem>) => {
    const newItems = [...category.items];
    newItems[index] = { ...newItems[index], ...updates };
    // 重算小計
    newItems[index].subtotal = calculateItemSubtotal(newItems[index], capacityKwp);
    onUpdate({ ...category, items: newItems });
  };

  // 新增項目
  const handleAddItem = () => {
    const newItem: EngineeringItem = {
      id: generateId(),
      categoryCode: category.categoryCode,
      categoryName: category.categoryName,
      itemName: "新項目",
      unitPrice: 0,
      unit: "kWp",
      quantity: 1,
      billingMethod: 'per_kw',
      subtotal: 0,
      sortOrder: category.items.length,
    };
    onUpdate({ ...category, items: [...category.items, newItem] });
  };

  // 刪除項目
  const handleDeleteItem = (index: number) => {
    const newItems = category.items.filter((_, i) => i !== index);
    onUpdate({ ...category, items: newItems });
  };

  // 儲存類別名稱
  const handleSaveCategoryName = () => {
    onUpdate({ ...category, categoryName: editedName });
    setIsEditing(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-primary/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                {isEditing ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleSaveCategoryName}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveCategoryName()}
                    className="h-7 w-40"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <CardTitle
                    className="text-sm font-semibold cursor-pointer hover:text-primary"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    {category.categoryName}
                  </CardTitle>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant="secondary" className="font-mono text-sm">
                  {formatCurrency(categoryTotal, 0)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>項目名稱</TableHead>
                  <TableHead className="w-28">計費方式</TableHead>
                  <TableHead className="w-16">單位</TableHead>
                  <TableHead className="w-24 text-right">單價</TableHead>
                  <TableHead className="w-32 text-right whitespace-nowrap">數量/容量</TableHead>
                  <TableHead className="w-28 text-right">小計</TableHead>
                  <TableHead className="w-24 text-right whitespace-nowrap">每kW單價</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.items.map((item, index) => {
                  const method = item.billingMethod || 'per_kw';
                  const subtotal = calculateItemSubtotal(item, capacityKwp);
                  
                  // 取得階梯定價資訊
                  const tieredInfo = method === 'tiered' && item.tieredPricingType 
                    ? calculateTieredPrice(capacityKwp, item.tieredPricingType)
                    : null;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">
                        <GripVertical className="h-4 w-4 cursor-move" />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.itemName}
                          onChange={(e) => handleUpdateItem(index, { itemName: e.target.value })}
                          className="h-8 border-none shadow-none focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={method}
                          onValueChange={(value: BillingMethod) => handleUpdateItem(index, { billingMethod: value })}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_kw">每kW計價</SelectItem>
                            <SelectItem value="per_unit">單位計價</SelectItem>
                            <SelectItem value="lump_sum">一式計價</SelectItem>
                            <SelectItem value="tiered">階梯定價</SelectItem>
                          </SelectContent>
                        </Select>
                        {method === 'tiered' && (
                          <Select
                            value={item.tieredPricingType || 'none'}
                            onValueChange={(value: TieredPricingType) => handleUpdateItem(index, { tieredPricingType: value })}
                          >
                            <SelectTrigger className="h-7 w-28 mt-1 text-xs">
                              <SelectValue placeholder="選擇級距" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="structural_engineer">結構技師</SelectItem>
                              <SelectItem value="electrical_engineer">電機技師</SelectItem>
                              <SelectItem value="environmental">明群環能</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {method === 'per_unit' ? (
                          <Select
                            value={item.unit || "個"}
                            onValueChange={(value) => handleUpdateItem(index, { unit: value })}
                          >
                            <SelectTrigger className="h-8 w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="個">個</SelectItem>
                              <SelectItem value="台">台</SelectItem>
                              <SelectItem value="組">組</SelectItem>
                              <SelectItem value="式">式</SelectItem>
                              <SelectItem value="座">座</SelectItem>
                              <SelectItem value="片">片</SelectItem>
                              <SelectItem value="批">批</SelectItem>
                              <SelectItem value="趟">趟</SelectItem>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="m²">m²</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : method === 'per_kw' ? (
                          <span className="text-sm text-muted-foreground">kW</span>
                        ) : method === 'lump_sum' ? (
                          <span className="text-sm text-muted-foreground">式</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {method === 'per_kw' || method === 'per_unit' ? (
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24 text-right"
                          />
                        ) : method === 'lump_sum' ? (
                          <Input
                            type="number"
                            value={item.lumpSumAmount || 0}
                            onChange={(e) => handleUpdateItem(index, { lumpSumAmount: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24 text-right"
                            placeholder="金額"
                          />
                        ) : tieredInfo ? (
                          <span className="text-sm text-muted-foreground">
                            ${tieredInfo.perKwPrice}/kW
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {method === 'per_kw' || method === 'tiered' ? (
                          <span className="text-sm font-medium whitespace-nowrap">{capacityKwp} kW</span>
                        ) : method === 'per_unit' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                              className="h-8 w-20 text-right"
                            />
                            <span className="text-sm text-muted-foreground">{item.unit || "個"}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground whitespace-nowrap">1 式</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono text-sm">
                        {formatCurrency(subtotal, 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground font-mono">
                        {capacityKwp > 0 ? formatCurrency(subtotal / capacityKwp, 0) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-sm text-muted-foreground"
              onClick={handleAddItem}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              新增項目
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
