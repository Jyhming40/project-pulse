import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Cpu } from "lucide-react";
import { ModuleItem, generateId, calculateModulePrice } from "@/hooks/useQuoteEngineering";
import { formatCurrency } from "@/lib/quoteCalculations";

interface EquipmentModulesCardProps {
  modules: ModuleItem[];
  onUpdate: (modules: ModuleItem[]) => void;
  exchangeRate: number;
  onExchangeRateChange: (rate: number) => void;
}

export default function EquipmentModulesCard({
  modules,
  onUpdate,
  exchangeRate,
  onExchangeRateChange,
}: EquipmentModulesCardProps) {
  // 計算總價
  const totalPrice = modules.reduce((sum, m) => {
    return sum + calculateModulePrice({ ...m, exchangeRate });
  }, 0);

  // 計算總容量
  const totalCapacityKwp = modules.reduce((sum, m) => {
    return sum + (m.wattagePerPanel * m.panelCount) / 1000;
  }, 0);

  // 更新單一模組
  const handleUpdateModule = (index: number, updates: Partial<ModuleItem>) => {
    const newModules = [...modules];
    newModules[index] = { ...newModules[index], ...updates };
    newModules[index].priceNtd = calculateModulePrice({ ...newModules[index], exchangeRate });
    onUpdate(newModules);
  };

  // 新增模組
  const handleAddModule = () => {
    const newModule: ModuleItem = {
      id: generateId(),
      moduleModel: "",
      wattagePerPanel: 495,
      panelCount: 20,
      pricePerWattUsd: 0.22,
      exchangeRate,
      priceNtd: 0,
      sortOrder: modules.length,
    };
    newModule.priceNtd = calculateModulePrice(newModule);
    onUpdate([...modules, newModule]);
  };

  // 刪除模組
  const handleDeleteModule = (index: number) => {
    const newModules = modules.filter((_, i) => i !== index);
    onUpdate(newModules);
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-5 w-5 text-blue-500" />
            PV 模組
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">目前匯率:</span>
              <Input
                type="number"
                value={exchangeRate}
                onChange={(e) => onExchangeRateChange(parseFloat(e.target.value) || 30)}
                className="h-8 w-20 text-right"
                step="0.01"
              />
            </div>
            <Badge variant="secondary" className="font-mono">
              {totalCapacityKwp.toFixed(2)} kWp
            </Badge>
            <Badge className="font-mono bg-blue-500">
              {formatCurrency(totalPrice, 0)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>型號</TableHead>
              <TableHead className="w-24 text-right">單片容量(W)</TableHead>
              <TableHead className="w-20 text-right">數量</TableHead>
              <TableHead className="w-28 text-right">每W價格(USD)</TableHead>
              <TableHead className="w-28 text-right">台幣$(NTD)</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((module, index) => {
              const priceNtd = calculateModulePrice({ ...module, exchangeRate });
              return (
                <TableRow key={module.id}>
                  <TableCell>
                    <Input
                      value={module.moduleModel || ""}
                      onChange={(e) => handleUpdateModule(index, { moduleModel: e.target.value })}
                      className="h-8 border-none shadow-none focus-visible:ring-1"
                      placeholder="型號"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={module.wattagePerPanel}
                      onChange={(e) => handleUpdateModule(index, { wattagePerPanel: parseInt(e.target.value) || 0 })}
                      className="h-8 w-24 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={module.panelCount}
                      onChange={(e) => handleUpdateModule(index, { panelCount: parseInt(e.target.value) || 0 })}
                      className="h-8 w-20 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={module.pricePerWattUsd}
                      onChange={(e) => handleUpdateModule(index, { pricePerWattUsd: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-28 text-right"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium font-mono text-blue-600">
                    {formatCurrency(priceNtd, 0)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteModule(index)}
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
          onClick={handleAddModule}
        >
          <Plus className="h-4 w-4 mr-1" />
          新增模組型號
        </Button>
      </CardContent>
    </Card>
  );
}
