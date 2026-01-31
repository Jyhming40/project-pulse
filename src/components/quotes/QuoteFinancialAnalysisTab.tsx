import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Percent, 
  Zap, 
  Sun,
  ChevronDown,
  Home,
  Lightbulb,
  Info,
  PiggyBank,
  Building2,
  ToggleLeft,
  RefreshCw,
  Database,
} from "lucide-react";
import { QuoteParams, formatCurrency, formatPercentage } from "@/lib/quoteCalculations";
import { Plot } from "@/lib/plotly";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFitRates, SPECIAL_CONDITION_LABELS, type SpecialCondition } from "@/hooks/useFitRates";

// 收益模式類型
type RevenueMode = 'self_consumption' | 'feed_in_tariff';

interface QuoteFinancialAnalysisTabProps {
  formData: QuoteParams;
  projections: {
    projections: any[];
    summary: any;
  } | null;
}

// 根據收益模式取得對應用語
function getRevenueLabels(mode: RevenueMode) {
  if (mode === 'feed_in_tariff') {
    return {
      modeName: '躉售電力',
      modeDescription: '將太陽能發電售予台電公司',
      annualRevenue: '每年躉售收入',
      totalRevenue: '20年躉售總收入',
      rateLabel: '躉購費率',
      rateDescription: '本年度躉購費率 (含高效能加成)',
      rateUnit: '元/度',
      chartLabel: '每年躉售收入',
      netProfitLabel: '20年躉售淨利',
      savingsLabel: '累計躉售收入',
      periodCashFlowLabel: '每年躉售收入',
      costComparisonTitle: '太陽光電每度電成本分析',
      costComparisonDescription: '自發電成本與躉購費率比較',
      tableHeader: '每年躉售收入 (A)',
      tableHeaderCumulative: '累計躉售收入',
      footnote2: '「躉售收入評估」欄位數據，係依據本年度公告躉購費率評估。',
    };
  }
  
  return {
    modeName: '自用節電',
    modeDescription: '自發自用節省電費支出',
    annualRevenue: '每年節省電費',
    totalRevenue: '20年節省電費總額',
    rateLabel: '目前每度電費',
    rateDescription: '參考用戶電費帳單平均電價',
    rateUnit: '元/度',
    chartLabel: '每年節省電費',
    netProfitLabel: '20年節省淨額',
    savingsLabel: '累計節省電費',
    periodCashFlowLabel: '每年節省電費',
    costComparisonTitle: '太陽光電每度電成本分析',
    costComparisonDescription: '自發電成本與台電電價比較',
    tableHeader: '每年節省電費 (A)',
    tableHeaderCumulative: '累計節省電費',
    footnote2: '「節省電力評估」欄位數據，係參考用戶提供之電費帳單平均數據評估。',
  };
}

// 自投資模式的年度預測
interface SelfInvestYearData {
  year: number;
  generationKwh: number;
  electricitySaving: number;
  cumulativeSaving: number;
  maintenanceRate: number;
  maintenanceCost: number;
  insuranceCost: number;
  cashFlow: number;
  cumulativeCashFlow: number;
}

// 計算自投資模式的 20 年預測（支援自訂日照天數）
function calculateSelfInvestProjectionWithDays(params: QuoteParams, totalInvestment: number, sunshineDays: number = 365) {
  const data: SelfInvestYearData[] = [];
  const cashFlows: number[] = [-totalInvestment]; // 初始投資為負
  
  let cumulativeSaving = 0;
  let cumulativeCashFlow = -totalInvestment;
  let totalMaintenance = 0;
  let totalInsurance = 0;
  let paybackYear = 0;
  
  // 每年保險費 (總工程款 × 保險費率)
  const yearlyInsurance = totalInvestment * (params.insuranceRate || 0.0055);
  
  for (let year = 1; year <= 20; year++) {
    // 發電量 (每年衰減 1%) - 使用自訂日照天數
    const baseGeneration = (params.capacityKwp || 0) * (params.sunshineHours || 3.2) * sunshineDays;
    const degradation = Math.pow(1 - (params.annualDegradationRate || 0.01), year - 1);
    const generationKwh = baseGeneration * degradation;
    
    // 節省電費 (以台電電價計算)
    const electricitySaving = generationKwh * (params.tariffRate || 4.5);
    cumulativeSaving += electricitySaving;
    
    // 保固費率 (1-5年: 0%, 6-10年: 6%, 11-15年: 7%, 16-20年: 8%)
    let maintenanceRate = 0;
    if (year >= 6 && year <= 10) {
      maintenanceRate = params.maintenanceRate6To10 || 6;
    } else if (year >= 11 && year <= 15) {
      maintenanceRate = params.maintenanceRate11To15 || 7;
    } else if (year >= 16) {
      maintenanceRate = params.maintenanceRate16To20 || 8;
    }
    
    // 保固費 (基於每年發電量)
    const maintenanceCost = electricitySaving * (maintenanceRate / 100);
    totalMaintenance += maintenanceCost;
    totalInsurance += yearlyInsurance;
    
    // 年度現金流 = 節省電費 - 保固費 - 保險費
    const cashFlow = electricitySaving - maintenanceCost - yearlyInsurance;
    cumulativeCashFlow += cashFlow;
    cashFlows.push(cashFlow);
    
    // 回收年限判斷
    if (paybackYear === 0 && cumulativeCashFlow >= 0) {
      paybackYear = year;
    }
    
    data.push({
      year,
      generationKwh,
      electricitySaving,
      cumulativeSaving,
      maintenanceRate,
      maintenanceCost,
      insuranceCost: yearlyInsurance,
      cashFlow,
      cumulativeCashFlow,
    });
  }
  
  // 計算 IRR
  const irr = calculateIRR(cashFlows) * 100;
  
  // 計算總結
  const totalSaving = cumulativeSaving;
  const totalCost = totalInvestment + totalMaintenance + totalInsurance;
  const netProfit = totalSaving - totalCost;
  const totalRoi = (netProfit / totalInvestment) * 100;
  const annualRoi = totalRoi / 20;
  
  // 20年總發電量
  const totalGeneration = data.reduce((sum, d) => sum + d.generationKwh, 0);
  
  // 每度電成本
  const costPerKwh = totalGeneration > 0 ? totalCost / totalGeneration : 0;
  
  // 與台電電價比較
  const gridRate = params.tariffRate || 4.5;
  const savingsVsGrid = gridRate > 0 ? (costPerKwh / gridRate) * 100 : 0;
  
  return {
    data,
    summary: {
      totalInvestment,
      totalMaintenance,
      totalInsurance,
      totalCost,
      totalSaving,
      netProfit,
      irr,
      totalRoi,
      annualRoi,
      paybackYear: paybackYear || 20,
      totalGeneration,
      costPerKwh,
      gridRate,
      savingsVsGrid,
    },
  };
}

// 計算 IRR
function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
  const maxIterations = 100;
  const tolerance = 0.0001;
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    
    for (let j = 0; j < cashFlows.length; j++) {
      const discountFactor = Math.pow(1 + rate, j);
      npv += cashFlows[j] / discountFactor;
      if (j > 0) {
        derivative -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
      }
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate;
    }
    
    if (derivative === 0) break;
    rate = rate - npv / derivative;
  }
  
  return rate;
}

export default function QuoteFinancialAnalysisTab({
  formData,
  projections,
}: QuoteFinancialAnalysisTabProps) {
  const [showTable, setShowTable] = useState(true);
  const [roofRentalRate, setRoofRentalRate] = useState(12); // 預設 12%
  
  // 收益模式切換
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('self_consumption');
  const labels = getRevenueLabels(revenueMode);
  
  // 躉購費率查詢
  const { lookupRate, currentYear, currentPeriod, isLoading: isLoadingRates } = useFitRates();
  const [fitRateSource, setFitRateSource] = useState<'system' | 'manual'>('system');
  
  // 可調整的條件設定參數
  const [sunshineHours, setSunshineHours] = useState(formData.sunshineHours || 3.2);
  const [sunshineDays, setSunshineDays] = useState(365);
  const [electricityRate, setElectricityRate] = useState(formData.tariffRate || 4.5);
  const [fitRate, setFitRate] = useState(formData.tariffRate || 4.2); // 躉購費率
  const [insuranceRate, setInsuranceRate] = useState((formData.insuranceRate || 0.0055) * 100);
  
  // 各項加成條件開關 - 可由報價單控制
  const [includeHighEfficiency, setIncludeHighEfficiency] = useState(true); // VPC 認證模組
  const [includeRooftopGridFee, setIncludeRooftopGridFee] = useState(false); // 屋頂型併網工程費
  const [specialCondition, setSpecialCondition] = useState<'fishery' | 'agriculture' | 'highway_service' | 'school_sports' | 'school_metal_plate' | null>(null);
  
  // 判斷是否符合併網工程費條件（屋頂型 且 容量 < 500kWp）
  const isEligibleForRooftopGridFee = useMemo(() => {
    return (formData.capacityKwp || 0) < 500; // 屋頂型假設，且容量小於500kWp
  }, [formData.capacityKwp]);
  
  // 自動查詢躉購費率
  const systemFitRate = useMemo(() => {
    if (!formData.capacityKwp) return null;
    return lookupRate(formData.capacityKwp, 'rooftop', undefined, undefined, {
      includeHighEfficiency,
      includeRooftopGridFee: includeRooftopGridFee && isEligibleForRooftopGridFee,
      specialCondition,
    });
  }, [formData.capacityKwp, lookupRate, includeHighEfficiency, includeRooftopGridFee, isEligibleForRooftopGridFee, specialCondition]);
  
  // 當系統費率可用且來源為系統時，自動更新費率
  useEffect(() => {
    if (systemFitRate && fitRateSource === 'system') {
      setFitRate(systemFitRate.totalRate);
    }
  }, [systemFitRate, fitRateSource]);
  
  // 根據模式選擇使用的費率
  const effectiveRate = revenueMode === 'feed_in_tariff' ? fitRate : electricityRate;
  
  // 計算投資總額（從 formData 取得）
  const totalInvestment = useMemo(() => {
    return (formData.capacityKwp || 0) * (formData.pricePerKwp || 0);
  }, [formData.capacityKwp, formData.pricePerKwp]);
  
  // 使用自投資模式計算 - 使用本地調整後的參數
  const adjustedParams = useMemo(() => ({
    ...formData,
    sunshineHours,
    tariffRate: effectiveRate,
    insuranceRate: insuranceRate / 100,
  }), [formData, sunshineHours, effectiveRate, insuranceRate]);
  
  // 計算自投資結果 - 考慮自定義的日照天數
  const selfInvestResult = useMemo(() => {
    return calculateSelfInvestProjectionWithDays(adjustedParams as QuoteParams, totalInvestment, sunshineDays);
  }, [adjustedParams, totalInvestment, sunshineDays]);
  
  // 屋頂出租評估
  const roofRentalResult = useMemo(() => {
    const { data, summary } = selfInvestResult;
    // 年租金 = 年發電量 × 電價 × 租金比例
    const firstYearSaving = data[0]?.electricitySaving || 0;
    const yearlyRent = firstYearSaving * (roofRentalRate / 100);
    const monthlyRent = yearlyRent / 12;
    const totalRent20Year = yearlyRent * 20; // 簡化計算，實際應考慮發電衰減
    
    return {
      yearlyRent,
      monthlyRent,
      totalRent20Year,
      rentalRateOfGeneration: roofRentalRate,
    };
  }, [selfInvestResult, roofRentalRate]);

  if (!formData.capacityKwp || !formData.pricePerKwp) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        請先在「基本資訊」頁面設定容量與參數
      </div>
    );
  }

  const { data, summary } = selfInvestResult;

  // 準備圖表資料
  const years = data.map((p) => `第${p.year}年`);
  const savings = data.map((p) => p.electricitySaving);
  const cashFlows = data.map((p) => p.cashFlow);
  const cumulativeCashFlows = data.map((p) => p.cumulativeCashFlow);

  return (
    <div className="space-y-6">
      {/* 收益模式切換 */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <ToggleLeft className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold">收益模式</h3>
                <p className="text-sm text-muted-foreground">{labels.modeDescription}</p>
              </div>
            </div>
            <ToggleGroup 
              type="single" 
              value={revenueMode} 
              onValueChange={(v) => v && setRevenueMode(v as RevenueMode)}
              className="justify-start"
            >
              <ToggleGroupItem 
                value="self_consumption" 
                aria-label="自用節電模式"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4"
              >
                <Zap className="h-4 w-4 mr-2" />
                自用節電
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="feed_in_tariff" 
                aria-label="躉售電力模式"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                躉售電力
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>
      {/* 條件設定 - 可編輯 */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" />
            條件設定
            <Badge variant="outline" className="ml-2 text-xs">可調整</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            {/* 裝置容量 - 只讀 */}
            <div>
              <Label className="text-muted-foreground text-xs">裝置容量</Label>
              <p className="font-semibold mt-1">{(formData.capacityKwp || 0).toLocaleString()} kWp</p>
            </div>
            
            {/* 日照時數 - 可編輯 */}
            <div className="space-y-1">
              <Label htmlFor="sunshineHours" className="text-muted-foreground text-xs">日照時數</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="sunshineHours"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={sunshineHours}
                  onChange={(e) => setSunshineHours(parseFloat(e.target.value) || 0)}
                  className="h-8 w-20 text-right font-semibold"
                />
                <span className="text-xs text-muted-foreground">小時</span>
              </div>
            </div>
            
            {/* 日照天數 - 可編輯 */}
            <div className="space-y-1">
              <Label htmlFor="sunshineDays" className="text-muted-foreground text-xs">日照天數</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="sunshineDays"
                  type="number"
                  step="1"
                  min="1"
                  max="365"
                  value={sunshineDays}
                  onChange={(e) => setSunshineDays(parseInt(e.target.value) || 365)}
                  className="h-8 w-20 text-right font-semibold"
                />
                <span className="text-xs text-muted-foreground">天</span>
              </div>
            </div>
            
            {/* 費率設定 - 根據模式切換 */}
            <div className="space-y-1">
              <Label htmlFor="rateInput" className="text-muted-foreground text-xs">
                {labels.rateLabel}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 inline ml-1 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-48">{labels.rateDescription}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <div className="flex items-center gap-1">
                <span className="text-primary font-semibold">$</span>
                <Input
                  id="rateInput"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={revenueMode === 'feed_in_tariff' ? fitRate : electricityRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (revenueMode === 'feed_in_tariff') {
                      setFitRate(val);
                      setFitRateSource('manual'); // 使用者手動修改
                    } else {
                      setElectricityRate(val);
                    }
                  }}
                  className="h-8 w-24 text-right font-semibold text-primary"
                />
              </div>
              {/* 躉售模式顯示系統費率資訊與明細 */}
              {revenueMode === 'feed_in_tariff' && (
                <div className="mt-1 space-y-2">
                  {systemFitRate ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={fitRateSource === 'system' ? 'default' : 'secondary'} 
                          className="text-xs cursor-pointer"
                          onClick={() => {
                            if (systemFitRate) {
                              setFitRate(systemFitRate.totalRate);
                              setFitRateSource('system');
                            }
                          }}
                        >
                          <Database className="h-3 w-3 mr-1" />
                          系統 ${systemFitRate.totalRate.toFixed(4)}
                        </Badge>
                        {fitRateSource === 'manual' && (
                          <span className="text-xs text-muted-foreground">(已覆寫)</span>
                        )}
                      </div>
                      {/* 費率組成明細 */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs text-muted-foreground cursor-help bg-muted/50 rounded px-2 py-1 inline-block">
                              <span className="font-mono">
                                {systemFitRate.baseRate.toFixed(4)}
                                {includeHighEfficiency && systemFitRate.highEfficiencyBonus > 0 && (
                                  <span className="text-green-600"> + {systemFitRate.highEfficiencyBonus.toFixed(4)}</span>
                                )}
                                {includeRooftopGridFee && systemFitRate.rooftopGridFee > 0 && (
                                  <span className="text-blue-600"> + {systemFitRate.rooftopGridFee.toFixed(4)}</span>
                                )}
                                {systemFitRate.specialBonus > 0 && (
                                  <span className="text-amber-600"> + {systemFitRate.specialBonus.toFixed(4)}</span>
                                )}
                                <span className="text-foreground font-semibold"> = {systemFitRate.totalRate.toFixed(4)}</span>
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              <p className="font-semibold">費率組成明細 ({currentYear}年第{currentPeriod}期)</p>
                              <div className="flex justify-between">
                                <span>基本費率：</span>
                                <span className="font-mono">${systemFitRate.baseRate.toFixed(4)}</span>
                              </div>
                              {includeHighEfficiency && systemFitRate.highEfficiencyBonus > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>高效能模組加成 (VPC)：</span>
                                  <span className="font-mono">+${systemFitRate.highEfficiencyBonus.toFixed(4)}</span>
                                </div>
                              )}
                              {includeRooftopGridFee && systemFitRate.rooftopGridFee > 0 && (
                                <div className="flex justify-between text-blue-600">
                                  <span>屋頂型併網工程費：</span>
                                  <span className="font-mono">+${systemFitRate.rooftopGridFee.toFixed(4)}</span>
                                </div>
                              )}
                              {systemFitRate.specialBonus > 0 && systemFitRate.specialBonusType && (
                                <div className="flex justify-between text-amber-600">
                                  <span>{SPECIAL_CONDITION_LABELS[systemFitRate.specialBonusType]}：</span>
                                  <span className="font-mono">+${systemFitRate.specialBonus.toFixed(4)}</span>
                                </div>
                              )}
                              <Separator className="my-1" />
                              <div className="flex justify-between font-semibold">
                                <span>合計費率：</span>
                                <span className="font-mono">${systemFitRate.totalRate.toFixed(4)}/度</span>
                              </div>
                              <p className="text-muted-foreground pt-1">
                                ※ 模組回收費 ${systemFitRate.moduleRecyclingFee.toFixed(4)}/度 僅供參考，不計入收益
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {isLoadingRates ? '載入中...' : '無系統費率資料'}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* 每 kWp 單價 - 只讀 */}
            <div>
              <Label className="text-muted-foreground text-xs">每 kWp 單價 (未稅)</Label>
              <p className="font-semibold mt-1">{formatCurrency(formData.pricePerKwp || 0, 0)}</p>
            </div>
            
            {/* 總裝置金額 - 只讀 */}
            <div>
              <Label className="text-muted-foreground text-xs">總裝置金額 (未稅)</Label>
              <p className="font-semibold text-lg mt-1">{formatCurrency(totalInvestment, 0)}</p>
            </div>
          </div>
          
          {/* 進階參數 */}
          <Collapsible className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="h-4 w-4" />
              進階參數設定
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg">
                {/* 保險費率 */}
                <div className="space-y-1">
                  <Label htmlFor="insuranceRate" className="text-muted-foreground text-xs">年保險費率</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="insuranceRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      value={insuranceRate}
                      onChange={(e) => setInsuranceRate(parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 text-right font-semibold"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                
                {/* 年衰減率 - 顯示為資訊 */}
                <div>
                  <Label className="text-muted-foreground text-xs">年發電衰減率</Label>
                  <p className="font-semibold mt-1">{((formData.annualDegradationRate || 0.01) * 100).toFixed(1)}%</p>
                </div>
                
                {/* 維運費率說明 */}
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-xs">維運費率 (佔電費收益%)</Label>
                  <p className="text-xs mt-1">
                    1-5年: <span className="font-semibold">0%</span>、
                    6-10年: <span className="font-semibold">6%</span>、
                    11-15年: <span className="font-semibold">7%</span>、
                    16-20年: <span className="font-semibold">8%</span>
                  </p>
                </div>
              </div>
              
              {/* 躉購費率加成條件 - 僅躉售模式顯示 */}
              {revenueMode === 'feed_in_tariff' && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium">躉購費率加成條件</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">依據經濟部公告之「再生能源電能躉購費率及其計算公式」，各項加成需符合相應條件方可適用。</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* 高效能模組加成 (VPC) */}
                    <div className="flex items-center justify-between p-2 bg-background rounded border">
                      <div>
                        <p className="text-xs font-medium">高效能模組加成</p>
                        <p className="text-[10px] text-muted-foreground">需使用 VPC 認證模組</p>
                      </div>
                      <Button
                        type="button"
                        variant={includeHighEfficiency ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs min-w-16"
                        onClick={() => setIncludeHighEfficiency(!includeHighEfficiency)}
                      >
                        {includeHighEfficiency ? '適用' : '不適用'}
                      </Button>
                    </div>
                    
                    {/* 屋頂型併網工程費 */}
                    <div className="flex items-center justify-between p-2 bg-background rounded border">
                      <div>
                        <p className="text-xs font-medium">屋頂型併網工程費</p>
                        <p className="text-[10px] text-muted-foreground">
                          屋頂型且容量{'<'}500kWp
                          {!isEligibleForRooftopGridFee && <span className="text-destructive ml-1">(不符合)</span>}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={includeRooftopGridFee && isEligibleForRooftopGridFee ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs min-w-16"
                        disabled={!isEligibleForRooftopGridFee}
                        onClick={() => setIncludeRooftopGridFee(!includeRooftopGridFee)}
                      >
                        {includeRooftopGridFee && isEligibleForRooftopGridFee ? '適用' : '不適用'}
                      </Button>
                    </div>
                    
                    {/* 特殊條件選擇 */}
                    <div className="flex items-center justify-between p-2 bg-background rounded border md:col-span-2 lg:col-span-1">
                      <div>
                        <p className="text-xs font-medium">特殊條件加成</p>
                        <p className="text-[10px] text-muted-foreground">農漁業/高速公路/學校等</p>
                      </div>
                      <select
                        value={specialCondition || ''}
                        onChange={(e) => setSpecialCondition((e.target.value || null) as SpecialCondition | null)}
                        className="h-7 text-xs px-2 border rounded bg-background min-w-24"
                      >
                        <option value="">無</option>
                        <option value="fishery">漁業環境友善</option>
                        <option value="agriculture">農業經營結合綠能</option>
                        <option value="highway_service">高速公路服務區</option>
                        <option value="school_sports">學校光電運動場</option>
                        <option value="school_metal_plate">學校金屬浪板</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 條件說明 */}
                  <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t">
                    <p>• <strong>VPC 認證</strong>：模組需通過台灣自願性產品驗證 (VPC)</p>
                    <p>• <strong>屋頂型併網工程費</strong>：屋頂型設備且容量低於 500kWp 始適用</p>
                    <p>• <strong>漁業環境友善</strong>：結合漁業經營之太陽光電設施</p>
                    <p>• <strong>農業經營結合綠能</strong>：農業設施或農業用地結合綠能設置</p>
                    <p>• <strong>高速公路服務區</strong>：高速公路服務區停車場土地設置</p>
                    <p>• <strong>學校光電運動場</strong>：學校光電球場型態設施</p>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* KPI Cards - 自投資模式 */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">年化內部報酬率 (IRR)</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {summary.irr.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">回收期初</span>
            </div>
            <p className="text-2xl font-bold">
              約第 <span className="text-primary">{summary.paybackYear}</span> 年
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{labels.netProfitLabel}</span>
            </div>
            <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(summary.netProfit, 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">20年總投資報酬率</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalRoi.toFixed(2)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">平均報酬率</span>
            </div>
            <p className="text-2xl font-bold">{summary.annualRoi.toFixed(2)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">投資成本總計</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(summary.totalCost, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 太陽光電每度電成本計算 - 重點區塊 */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-yellow-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            太陽光電每度電成本分析
            <Badge variant="secondary" className="ml-2">核心指標</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 左側：成本明細 */}
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">A. 20年預估發電度數 (kWh)</span>
                <span className="font-mono font-semibold">{summary.totalGeneration.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">B. 裝置金額 (未稅)</span>
                <span className="font-mono">{formatCurrency(summary.totalInvestment, 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">C. 20年維運預估</span>
                <span className="font-mono">{formatCurrency(summary.totalMaintenance, 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">D. 20年保險費用預估 (總工程費 × {((formData.insuranceRate || 0.0055) * 100).toFixed(2)}%)</span>
                <span className="font-mono">{formatCurrency(summary.totalInsurance, 0)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 px-2 rounded">
                <span className="font-medium">E. 投資成本總計 (B+C+D)</span>
                <span className="font-mono font-bold">{formatCurrency(summary.totalCost, 0)}</span>
              </div>
            </div>
            
            {/* 右側：核心結果 */}
            <div className="flex flex-col justify-center items-center bg-card border rounded-lg p-6">
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground mb-1">太陽光電每度電價 (E÷A)</p>
                <p className="text-5xl font-bold text-primary">${summary.costPerKwh.toFixed(2)}</p>
              </div>
              <Separator className="w-full my-4" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  相較{revenueMode === 'feed_in_tariff' ? '躉購費率' : '台電電價'} (${summary.gridRate.toFixed(3)}/度)
                </p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-4xl font-bold text-green-600">{summary.savingsVsGrid.toFixed(1)}%</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>自發電成本僅為{revenueMode === 'feed_in_tariff' ? '躉購費率' : '台電電價'}的 {summary.savingsVsGrid.toFixed(1)}%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {revenueMode === 'feed_in_tariff' 
                    ? `每度電成本僅 ${summary.savingsVsGrid.toFixed(1)}%，獲利空間大` 
                    : `節省 ${(100 - summary.savingsVsGrid).toFixed(1)}% 電費成本`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 自投資評估說明 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            自投資評估說明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 投資資訊 */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">投資資訊</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>裝置金額 (每 kWp 未稅)</span>
                  <span className="font-mono">{formatCurrency(formData.pricePerKwp || 0, 0)}/kWp</span>
                </div>
                <div className="flex justify-between">
                  <span>裝置總金額 (未稅)</span>
                  <span className="font-mono font-semibold">{formatCurrency(summary.totalInvestment, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>20年維運預估</span>
                  <span className="font-mono">{formatCurrency(summary.totalMaintenance, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>保險費用預估</span>
                  <span className="font-mono">{formatCurrency(summary.totalInsurance, 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>投資成本總計</span>
                  <span className="font-mono">{formatCurrency(summary.totalCost, 0)}</span>
                </div>
              </div>
            </div>
            
            {/* 收益資訊 */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">收益資訊</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{labels.netProfitLabel} ({labels.totalRevenue}-總持有成本)</span>
                  <span className={`font-mono font-semibold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(summary.netProfit, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>20年總投資報酬率 (淨效益÷總持有成本)</span>
                  <span className="font-mono">{summary.totalRoi.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>平均報酬率 (總投資報酬率÷20年)</span>
                  <span className="font-mono">{summary.annualRoi.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>年化內部報酬率 (IRR)</span>
                  <span className="font-mono font-semibold text-primary">{summary.irr.toFixed(2)}%</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>回收期初</span>
                  <span className="font-mono">約第 {summary.paybackYear} 年</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 屋頂出租評估說明 */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4 text-amber-600" />
            屋頂出租評估說明
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">替代方案</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* 租金設定 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="roofRentalRate" className="text-sm">預估為年發電量百分比</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="roofRentalRate"
                    type="number"
                    value={roofRentalRate}
                    onChange={(e) => setRoofRentalRate(parseFloat(e.target.value) || 0)}
                    className="w-24"
                    step="0.5"
                    min="0"
                    max="100"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  依市場行情，屋頂出租約為年發電收益的 8%~15%
                </p>
              </div>
            </div>
            
            {/* 租金預估 */}
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">20年租金預估</span>
                <span className="font-mono font-semibold">{formatCurrency(roofRentalResult.totalRent20Year, 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">每年租金預估</span>
                <span className="font-mono">{formatCurrency(roofRentalResult.yearlyRent, 0)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">每月租金預估</span>
                <span className="font-mono">{formatCurrency(roofRentalResult.monthlyRent, 0)}</span>
              </div>
            </div>
            
            {/* 比較說明 */}
            <div className="flex flex-col justify-center items-center bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">預估為年發電量</p>
              <p className="text-3xl font-bold text-amber-600">{roofRentalRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                若選擇出租屋頂而非自投資，<br />
                可獲得穩定租金收入但報酬較低
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 現金流量圖 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">期間現金流量圖</CardTitle>
        </CardHeader>
        <CardContent>
          <Plot
            data={[
              {
                x: years,
                y: savings,
                type: "bar",
                name: labels.chartLabel,
                marker: { color: "hsl(173, 58%, 45%)" },
              },
              {
                x: years,
                y: cashFlows,
                type: "bar",
                name: "期間現金流量",
                marker: { color: "hsl(210, 70%, 50%)" },
              },
              {
                x: years,
                y: cumulativeCashFlows,
                type: "scatter",
                mode: "lines+markers",
                name: "累積現金流",
                yaxis: "y2",
                line: { color: "hsl(38, 92%, 50%)", width: 2 },
                marker: { size: 6 },
              },
            ]}
            layout={{
              autosize: true,
              height: 350,
              margin: { l: 60, r: 60, t: 30, b: 60 },
              showlegend: true,
              legend: { orientation: "h", y: -0.2 },
              yaxis: { title: { text: "金額 (元)" }, tickformat: ",.0f" },
              yaxis2: {
                title: { text: "累積現金流 (元)" },
                overlaying: "y",
                side: "right",
                tickformat: ",.0f",
              },
              barmode: "group",
              shapes: [
                // 零線
                {
                  type: "line",
                  x0: 0,
                  x1: 1,
                  y0: 0,
                  y1: 0,
                  xref: "paper",
                  yref: "y2",
                  line: { color: "red", width: 1, dash: "dash" },
                },
              ],
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </CardContent>
      </Card>

      {/* 20年效益評估明細表 */}
      <Collapsible open={showTable} onOpenChange={setShowTable}>
        <Card>
          <CardHeader className="pb-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-base font-semibold">20年效益評估明細</CardTitle>
              <ChevronDown className={`h-5 w-5 transition-transform ${showTable ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-center w-16">年數</TableHead>
                      <TableHead className="text-right">預估發電度數</TableHead>
                      <TableHead className="text-right">{labels.tableHeader}</TableHead>
                      <TableHead className="text-right">{labels.tableHeaderCumulative}</TableHead>
                      <TableHead className="text-center w-20">保固費%</TableHead>
                      <TableHead className="text-right">每年保固費 (C)</TableHead>
                      <TableHead className="text-right">保險費用 (D)</TableHead>
                      <TableHead className="text-right">期間現金流量<br/>(A-C-D)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* 初期投資行 */}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell className="text-center">0</TableCell>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">初期投資</TableCell>
                      <TableCell colSpan={3}></TableCell>
                      <TableCell className="text-right text-destructive font-mono">
                        -{formatCurrency(summary.totalInvestment, 0)}
                      </TableCell>
                    </TableRow>
                    
                    {data.map((year) => (
                      <TableRow key={year.year}>
                        <TableCell className="text-center text-sm font-medium">{year.year}</TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {year.generationKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {formatCurrency(year.electricitySaving, 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-muted-foreground">
                          {formatCurrency(year.cumulativeSaving, 0)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {year.maintenanceRate > 0 ? `${year.maintenanceRate}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {year.maintenanceCost > 0 ? formatCurrency(year.maintenanceCost, 0) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {formatCurrency(year.insuranceCost, 0)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-mono font-medium ${year.cumulativeCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {formatCurrency(year.cashFlow, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* 小計行 */}
                    <TableRow className="bg-muted/50 font-semibold border-t-2">
                      <TableCell className="text-center">小計</TableCell>
                      <TableCell className="text-right font-mono">
                        {summary.totalGeneration.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(summary.totalSaving, 0)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(summary.totalMaintenance, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(summary.totalInsurance, 0)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${summary.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {formatCurrency(summary.netProfit, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              {/* 說明文字 */}
              <div className="p-4 bg-muted/30 text-xs text-muted-foreground space-y-1 border-t">
                <p>1、「預估發電度數」欄位數據，係假設模組效率每年衰減 {((formData.annualDegradationRate || 0.01) * 100).toFixed(0)}% 評估。</p>
                <p>2、{labels.footnote2}</p>
                <p>3、「保固費」欄位數據，係以本系統台電費為依據：1~5年全系統保固、6~10年電費之{formData.maintenanceRate6To10 || 6}%、11~15年電費之{formData.maintenanceRate11To15 || 7}%、16~20年電費之{formData.maintenanceRate16To20 || 8}%。</p>
                <p>4、「保險費用」欄位數據，係以總工程款{((formData.insuranceRate || 0.0055) * 100).toFixed(2)}%預估，實際依產物保險公司依據產業、環境現況評估。</p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
