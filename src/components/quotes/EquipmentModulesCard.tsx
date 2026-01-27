import { useState, useEffect } from "react";
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
import { Plus, Trash2, Cpu, ChevronDown, RefreshCw } from "lucide-react";
import { ModuleItem, generateId, calculateModulePrice } from "@/hooks/useQuoteEngineering";
import { formatCurrency } from "@/lib/quoteCalculations";
import { toast } from "sonner";

interface EquipmentModulesCardProps {
  modules: ModuleItem[];
  onUpdate: (modules: ModuleItem[]) => void;
  exchangeRate: number;
  onExchangeRateChange: (rate: number) => void;
}

// Fetch latest USD/TWD exchange rate
async function fetchExchangeRate(): Promise<number | null> {
  try {
    // Using exchangerate-api.com free tier
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!response.ok) throw new Error("Failed to fetch");
    const data = await response.json();
    return data.rates?.TWD || null;
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
    return null;
  }
}

export default function EquipmentModulesCard({
  modules,
  onUpdate,
  exchangeRate,
  onExchangeRateChange,
}: EquipmentModulesCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  // Fetch exchange rate on mount
  useEffect(() => {
    const loadRate = async () => {
      setIsFetchingRate(true);
      const rate = await fetchExchangeRate();
      if (rate) {
        onExchangeRateChange(Math.round(rate * 100) / 100);
      }
      setIsFetchingRate(false);
    };
    loadRate();
  }, []);

  const handleRefreshRate = async () => {
    setIsFetchingRate(true);
    const rate = await fetchExchangeRate();
    if (rate) {
      onExchangeRateChange(Math.round(rate * 100) / 100);
      toast.success(`匯率已更新: ${rate.toFixed(2)}`);
    } else {
      toast.error("無法取得最新匯率");
    }
    setIsFetchingRate(false);
  };

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-blue-500">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-500" />
                PV 模組
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </CardTitle>
              <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">目前匯率:</span>
                  <Input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => onExchangeRateChange(parseFloat(e.target.value) || 30)}
                    className="h-8 w-20 text-right text-sm"
                    step="0.01"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRefreshRate}
                    disabled={isFetchingRate}
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetchingRate ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <Badge variant="secondary" className="font-mono text-sm">
                  {totalCapacityKwp.toFixed(2)} kWp
                </Badge>
                <Badge className="font-mono text-sm bg-blue-500">
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
                      <TableCell className="text-right font-medium font-mono text-sm text-blue-600">
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
              className="mt-2 text-sm text-muted-foreground"
              onClick={handleAddModule}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              新增模組型號
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
