import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Zap, ChevronDown } from "lucide-react";
import { InverterItem, generateId, calculateInverterPrice } from "@/hooks/useQuoteEngineering";
import { formatCurrency } from "@/lib/quoteCalculations";

interface EquipmentInvertersCardProps {
  inverters: InverterItem[];
  onUpdate: (inverters: InverterItem[]) => void;
}

export default function EquipmentInvertersCard({
  inverters,
  onUpdate,
}: EquipmentInvertersCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  // 計算總價
  const totalPrice = inverters.reduce((sum, inv) => {
    return sum + calculateInverterPrice(inv);
  }, 0);

  // 計算總容量
  const totalCapacityKw = inverters.reduce((sum, inv) => {
    return sum + inv.capacityKw * inv.inverterCount;
  }, 0);

  // 更新單一逆變器
  const handleUpdateInverter = (index: number, updates: Partial<InverterItem>) => {
    const newInverters = [...inverters];
    newInverters[index] = { ...newInverters[index], ...updates };
    newInverters[index].totalPriceNtd = calculateInverterPrice(newInverters[index]);
    onUpdate(newInverters);
  };

  // 新增逆變器
  const handleAddInverter = () => {
    const newInverter: InverterItem = {
      id: generateId(),
      inverterModel: "",
      capacityKw: 5,
      inverterCount: 1,
      pricePerUnitNtd: 30000,
      totalPriceNtd: 30000,
      sortOrder: inverters.length,
    };
    onUpdate([...inverters, newInverter]);
  };

  // 刪除逆變器
  const handleDeleteInverter = (index: number) => {
    const newInverters = inverters.filter((_, i) => i !== index);
    onUpdate(newInverters);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-amber-500">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                逆變器
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </CardTitle>
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="font-mono text-sm">
                  {totalCapacityKw.toFixed(1)} kW
                </Badge>
                <Badge className="font-mono text-sm bg-amber-500">
                  {formatCurrency(totalPrice, 0)}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>型號</TableHead>
                  <TableHead className="w-24 text-right">容量(kW)</TableHead>
                  <TableHead className="w-20 text-right">數量</TableHead>
                  <TableHead className="w-28 text-right">單價(NTD)</TableHead>
                  <TableHead className="w-28 text-right">小計(NTD)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inverters.map((inverter, index) => {
                  const totalPriceNtd = calculateInverterPrice(inverter);
                  return (
                    <TableRow key={inverter.id}>
                      <TableCell>
                        <Input
                          value={inverter.inverterModel || ""}
                          onChange={(e) => handleUpdateInverter(index, { inverterModel: e.target.value })}
                          className="h-8 border-none shadow-none focus-visible:ring-1"
                          placeholder="型號"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={inverter.capacityKw}
                          onChange={(e) => handleUpdateInverter(index, { capacityKw: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-24 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={inverter.inverterCount}
                          onChange={(e) => handleUpdateInverter(index, { inverterCount: parseInt(e.target.value) || 0 })}
                          className="h-8 w-20 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={inverter.pricePerUnitNtd}
                          onChange={(e) => handleUpdateInverter(index, { pricePerUnitNtd: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-28 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono text-sm text-amber-600">
                        {formatCurrency(totalPriceNtd, 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteInverter(index)}
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
              onClick={handleAddInverter}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              新增逆變器型號
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
