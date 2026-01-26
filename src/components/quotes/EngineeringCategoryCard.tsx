import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { EngineeringCategory, EngineeringItem, calculateItemSubtotal, generateId } from "@/hooks/useQuoteEngineering";
import { formatCurrency } from "@/lib/quoteCalculations";

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
    const qty = item.unit === "kWp" && item.quantity === 0 ? capacityKwp : item.quantity;
    const itemWithQty = { ...item, quantity: qty };
    return sum + calculateItemSubtotal(itemWithQty);
  }, 0);

  // 更新單一項目
  const handleUpdateItem = (index: number, updates: Partial<EngineeringItem>) => {
    const newItems = [...category.items];
    newItems[index] = { ...newItems[index], ...updates };
    // 重算小計
    const qty = newItems[index].unit === "kWp" && newItems[index].quantity === 0 
      ? capacityKwp 
      : newItems[index].quantity;
    newItems[index].subtotal = calculateItemSubtotal({ ...newItems[index], quantity: qty });
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
      unit: "式",
      quantity: 1,
      isLumpSum: false,
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
    <Card className="border-l-4 border-l-primary/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
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
                    className="text-base cursor-pointer hover:text-primary"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    {category.categoryName}
                  </CardTitle>
                )}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
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
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>項目名稱</TableHead>
                  <TableHead className="w-24 text-right">單價</TableHead>
                  <TableHead className="w-20">單位</TableHead>
                  <TableHead className="w-20 text-right">數量</TableHead>
                  <TableHead className="w-20 text-center">1式</TableHead>
                  <TableHead className="w-28 text-right">小計</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.items.map((item, index) => {
                  const effectiveQty = item.unit === "kWp" && item.quantity === 0 ? capacityKwp : item.quantity;
                  const subtotal = item.isLumpSum 
                    ? (item.lumpSumAmount || 0) 
                    : item.unitPrice * effectiveQty;
                  
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
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-24 text-right"
                          disabled={item.isLumpSum}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.unit}
                          onChange={(e) => handleUpdateItem(index, { unit: e.target.value })}
                          className="h-8 w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unit === "kWp" && item.quantity === 0 ? capacityKwp : item.quantity}
                          onChange={(e) => handleUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-20 text-right"
                          disabled={item.isLumpSum || item.unit === "kWp"}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Checkbox
                            checked={item.isLumpSum}
                            onCheckedChange={(checked) => handleUpdateItem(index, { isLumpSum: !!checked })}
                          />
                          {item.isLumpSum && (
                            <Input
                              type="number"
                              value={item.lumpSumAmount || 0}
                              onChange={(e) => handleUpdateItem(index, { lumpSumAmount: parseFloat(e.target.value) || 0 })}
                              className="h-8 w-24 text-right"
                              placeholder="金額"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono">
                        {formatCurrency(subtotal, 0)}
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
              className="mt-2 text-muted-foreground"
              onClick={handleAddItem}
            >
              <Plus className="h-4 w-4 mr-1" />
              新增項目
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
