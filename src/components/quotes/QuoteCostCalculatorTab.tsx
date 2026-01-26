import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { QuoteParams, DEFAULT_LINE_ITEMS, formatCurrency, calculateLineItemSubtotal } from "@/lib/quoteCalculations";

interface QuoteCostCalculatorTabProps {
  formData: Partial<QuoteParams>;
  setFormData: (data: Partial<QuoteParams>) => void;
}

interface LineItem {
  id: string;
  category: "contractor" | "investor" | "special";
  itemOrder: number;
  itemCode: string;
  itemName: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  isOptional: boolean;
}

export default function QuoteCostCalculatorTab({
  formData,
  setFormData,
}: QuoteCostCalculatorTabProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(() =>
    DEFAULT_LINE_ITEMS.map((item, idx) => ({
      ...item,
      id: `item-${idx}`,
      quantity: item.unit === "kWp" ? formData.capacityKwp || 0 : item.quantity,
    }))
  );

  // Calculate subtotals
  const calculateSubtotal = (item: LineItem) => {
    let qty = item.quantity;
    if (item.unit === "kWp" && qty === 0) {
      qty = formData.capacityKwp || 0;
    }
    return item.unitPrice * qty;
  };

  // Group items by category
  const contractorItems = lineItems.filter((i) => i.category === "contractor");
  const investorItems = lineItems.filter((i) => i.category === "investor");
  const specialItems = lineItems.filter((i) => i.category === "special");

  // Calculate totals
  const contractorTotal = contractorItems.reduce((sum, i) => sum + calculateSubtotal(i), 0);
  const investorTotal = investorItems.reduce((sum, i) => sum + calculateSubtotal(i), 0);
  
  // Special items need different handling
  const totalPriceWithTax = (formData.capacityKwp || 0) * (formData.pricePerKwp || 0) * (1 + (formData.taxRate || 0.05));
  const stampTax = totalPriceWithTax * 0.001;
  const businessTax = totalPriceWithTax * 0.02;
  const specialTotal = stampTax + businessTax;

  const grandTotal = contractorTotal + investorTotal + specialTotal;
  const sellingPrice = (formData.capacityKwp || 0) * (formData.pricePerKwp || 0);
  const grossProfit = sellingPrice - grandTotal;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  // Update item
  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setLineItems(
      DEFAULT_LINE_ITEMS.map((item, idx) => ({
        ...item,
        id: `item-${idx}`,
        quantity: item.unit === "kWp" ? formData.capacityKwp || 0 : item.quantity,
      }))
    );
  };

  const renderItemTable = (items: LineItem[], title: string, categoryColor: string) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className={categoryColor}>{title}</Badge>
            <span className="text-sm font-normal text-muted-foreground">
              小計: {formatCurrency(items.reduce((sum, i) => sum + calculateSubtotal(i), 0), 0)}
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">項次</TableHead>
              <TableHead>項目名稱</TableHead>
              <TableHead className="w-24 text-right">單價</TableHead>
              <TableHead className="w-20">單位</TableHead>
              <TableHead className="w-24 text-right">數量</TableHead>
              <TableHead className="w-32 text-right">小計</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className={item.isOptional ? "opacity-60" : ""}>
                <TableCell className="font-mono text-xs">{item.itemCode || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.itemName}
                    {item.isOptional && (
                      <Badge variant="outline" className="text-xs">選配</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-24 text-right h-8"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-20 text-right h-8"
                    value={item.unit === "kWp" ? formData.capacityKwp || 0 : item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                    disabled={item.unit === "kWp"}
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(calculateSubtotal(item), 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={resetToDefaults}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重設為預設值
        </Button>
      </div>

      {/* Contractor Items */}
      {renderItemTable(contractorItems, "承裝業成本", "border-blue-500 text-blue-600")}

      {/* Investor Items */}
      {renderItemTable(investorItems, "投資者成本", "border-green-500 text-green-600")}

      {/* Special Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500 text-amber-600">其他費用</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>印花稅 (含稅總價之千分之一)</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(stampTax, 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>營所稅 (含稅總價之2%)</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(businessTax, 0)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">總成本</p>
              <p className="text-2xl font-bold">{formatCurrency(grandTotal, 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">報價金額 (未稅)</p>
              <p className="text-2xl font-bold">{formatCurrency(sellingPrice, 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">預估毛利</p>
              <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(grossProfit, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">毛利率</p>
              <p className={`text-2xl font-bold ${grossMargin >= 0 ? "text-success" : "text-destructive"}`}>
                {grossMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
