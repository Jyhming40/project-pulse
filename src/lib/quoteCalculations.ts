/**
 * 報價與投資評估計算邏輯
 * 移植自 Excel 評估工具
 */

// =====================
// 類型定義
// =====================

export interface QuoteParams {
  // 基本參數
  capacityKwp: number;           // 規劃容量 (kWp)
  panelWattage: number;          // 單片模組功率 (W)
  panelCount: number;            // 模組數量
  inverterCapacityKw: number;    // 逆變器容量 (kW)
  inverterCount: number;         // 逆變器數量
  
  // 價格參數
  pricePerKwp: number;           // 每 kWp 報價 (未稅)
  taxRate: number;               // 稅率 (default 0.05)
  
  // 躉購費率參數
  tariffRate: number;            // 躉購費率 (元/度)
  highEfficiencyBonus: number;   // 高效能模組加成
  
  // 發電效益參數
  sunshineHours: number;         // 日照時數 (default 3.2)
  annualDegradationRate: number; // 年衰減率 (default 0.01)
  
  // 貸款參數
  loanPercentage: number;        // 貸款比例 (%) (default 70)
  loanInterestRate: number;      // 年利率 (default 0.0245)
  loanTermMonths: number;        // 貸款期數 (月) (default 180)
  
  // 費用參數
  insuranceRate: number;         // 保險費率 (總工程款%) (default 0.0055)
  maintenanceRate6To10: number;  // 6-10年保固費率 (發電收入%) (default 6)
  maintenanceRate11To15: number; // 11-15年保固費率 (default 7)
  maintenanceRate16To20: number; // 16-20年保固費率 (default 8)
  rentRate: number;              // 租金費率 (發電收入%) (default 8)
}

export interface QuoteLineItem {
  id?: string;
  category: 'contractor' | 'investor' | 'special';
  itemOrder: number;
  itemCode: string;
  itemName: string;
  itemDescription?: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  subtotal: number;
  subtotalWithTax: number;
  isOptional: boolean;
  note?: string;
}

export interface YearlyProjection {
  yearNumber: number;
  estimatedGenerationKwh: number;
  electricityRate: number;
  electricityRevenue: number;
  cumulativeRevenue: number;
  loanPayment: number;
  maintenanceRate: number;
  maintenanceCost: number;
  insuranceCost: number;
  rentCost: number;
  annualCashFlow: number;
  cumulativeCashFlow: number;
  loanBalance: number;
  principalPayment: number;
  interestPayment: number;
}

export interface QuoteSummary {
  // 價格摘要
  totalPrice: number;            // 總建置價格 (未稅)
  totalPriceWithTax: number;     // 總建置價格 (含稅)
  estimatedProfit: number;       // 預計利潤
  grossMarginRate: number;       // 毛利率 (%)
  
  // 成本分類
  contractorCost: number;        // 承裝業成本
  investorCost: number;          // 投資者成本
  specialCost: number;           // 其他特殊成本
  
  // 投資報酬摘要
  irr20Year: number;             // 20年 IRR
  totalRevenue20Year: number;    // 20年總收益
  paybackYears: number;          // 回收年限
  netProfit20Year: number;       // 20年淨利
  totalRoi: number;              // 總投資報酬率
  annualRoi: number;             // 年平均報酬率
  
  // 費用摘要
  totalInsurance20Year: number;  // 20年保險費
  totalMaintenance20Year: number;// 20年保固費
  totalRent20Year: number;       // 20年租金
}

// =====================
// 預設工程項目範本
// =====================

export const DEFAULT_LINE_ITEMS: Omit<QuoteLineItem, 'id' | 'subtotal' | 'subtotalWithTax'>[] = [
  // 承裝業項目
  { category: 'contractor', itemOrder: 1, itemCode: '1', itemName: '舖板', unitPrice: 800, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 2, itemCode: '2', itemName: '鋼構', unitPrice: 11000, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 3, itemCode: '3', itemName: '維修步道', unitPrice: 900, unit: '公尺', quantity: 10, isOptional: false },
  { category: 'contractor', itemOrder: 4, itemCode: '', itemName: '防墜鋼索', unitPrice: 450, unit: '公尺', quantity: 0, isOptional: true },
  { category: 'contractor', itemOrder: 5, itemCode: '4', itemName: '維修梯', unitPrice: 7500, unit: '支', quantity: 2, isOptional: false },
  { category: 'contractor', itemOrder: 6, itemCode: '5', itemName: '機電', unitPrice: 3000, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 7, itemCode: '', itemName: '線材、材料', unitPrice: 4000, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 8, itemCode: '', itemName: '箱體', unitPrice: 4500, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 9, itemCode: '', itemName: '水路/加壓馬達', unitPrice: 100, unit: '公尺', quantity: 20, isOptional: true },
  { category: 'contractor', itemOrder: 10, itemCode: '', itemName: '網路監控系統', unitPrice: 40000, unit: '式', quantity: 1, isOptional: false },
  { category: 'contractor', itemOrder: 11, itemCode: '6', itemName: '結構技師(設計+簽證)', unitPrice: 737, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 12, itemCode: '7', itemName: '電機技師', unitPrice: 330, unit: 'kWp', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 13, itemCode: '8', itemName: '行政作業費用', unitPrice: 1000, unit: '式', quantity: 0, isOptional: false },
  { category: 'contractor', itemOrder: 14, itemCode: '9', itemName: '其他工程需求', unitPrice: 1010, unit: '式', quantity: 1, isOptional: true },
  { category: 'contractor', itemOrder: 15, itemCode: '10', itemName: '5年維運成本', unitPrice: 3030, unit: '式', quantity: 1, isOptional: false },
  
  // 投資者項目
  { category: 'investor', itemOrder: 1, itemCode: '11', itemName: '逆變器', unitPrice: 30000, unit: '台', quantity: 0, isOptional: false },
  { category: 'investor', itemOrder: 2, itemCode: '', itemName: 'PV模組', unitPrice: 4158, unit: '片', quantity: 0, isOptional: false },
  
  // 其他特殊項目
  { category: 'special', itemOrder: 1, itemCode: '12', itemName: '印花稅(含稅總價之千分之一)', unitPrice: 0, unit: '元', quantity: 1, isOptional: false },
  { category: 'special', itemOrder: 2, itemCode: '', itemName: '仲介費用+9%稅', unitPrice: 4000, unit: 'kWp', quantity: 0, isOptional: true },
  { category: 'special', itemOrder: 3, itemCode: '', itemName: '營所稅 (含稅總價之2%)', unitPrice: 0, unit: '元', quantity: 1, isOptional: false },
];

// =====================
// 預設甘特圖時程範本
// =====================

export interface ScheduleItem {
  id?: string;
  phase: 'pre_work' | 'construction' | 'completion' | 'closing';
  itemOrder: number;
  itemCode: string;
  itemName: string;
  itemDescription?: string;
  responsibleUnit?: string;
  startDate?: Date;
  endDate?: Date;
  durationDays?: number;
  paymentMilestone?: string;
  status: 'pending' | 'in_progress' | 'completed';
  note?: string;
}

export const DEFAULT_SCHEDULE_ITEMS: Omit<ScheduleItem, 'id' | 'startDate' | 'endDate'>[] = [
  // 前置作業
  { phase: 'pre_work', itemOrder: 1, itemCode: '1', itemName: '取得能源署同意備案', durationDays: 3, status: 'pending' },
  { phase: 'pre_work', itemOrder: 2, itemCode: '2', itemName: '現場勘查確認爬梯位置及受水塔影響模組配置', durationDays: 1, paymentMilestone: '第一期款 訂金 (20%)', status: 'pending' },
  { phase: 'pre_work', itemOrder: 3, itemCode: '3', itemName: '工程合約簽訂', durationDays: 4, status: 'pending' },
  { phase: 'pre_work', itemOrder: 4, itemCode: '4', itemName: '送電機技師簽證及台電審圖', durationDays: 62, itemDescription: '預計約2個月', status: 'pending' },
  { phase: 'pre_work', itemOrder: 5, itemCode: '5', itemName: '結構技師簽證及免雜第一階段申請', durationDays: 10, status: 'pending' },
  { phase: 'pre_work', itemOrder: 6, itemCode: '6', itemName: '爬梯進場施作', durationDays: 1, status: 'pending' },
  
  // 工程進行
  { phase: 'construction', itemOrder: 1, itemCode: '7', itemName: '鼎立支架進場', durationDays: 3, paymentMilestone: '第二期款 材料進場 (30%)', status: 'pending' },
  { phase: 'construction', itemOrder: 2, itemCode: '8', itemName: '支架組裝工班進場施工', durationDays: 10, status: 'pending' },
  { phase: 'construction', itemOrder: 3, itemCode: '9', itemName: '模組進場及組裝', durationDays: 7, status: 'pending' },
  { phase: 'construction', itemOrder: 4, itemCode: '10', itemName: '結構技師簽證及免雜完竣申請', durationDays: 14, status: 'pending' },
  { phase: 'construction', itemOrder: 5, itemCode: '11', itemName: '逆變器及箱體進場及機電工班施工', durationDays: 13, status: 'pending' },
  { phase: 'construction', itemOrder: 6, itemCode: '12', itemName: '電表箱基礎施工並固定電表箱', durationDays: 2, status: 'pending' },
  { phase: 'construction', itemOrder: 7, itemCode: '13', itemName: '等候台電線補費', durationDays: 25, itemDescription: '視台電進度', status: 'pending' },
  { phase: 'construction', itemOrder: 8, itemCode: '14', itemName: '協調廠方停電進行銜接點併接', durationDays: 19, itemDescription: '擇一天', status: 'pending' },
  
  // 工程結尾
  { phase: 'completion', itemOrder: 1, itemCode: '15', itemName: '台電躉售合約簽訂', durationDays: 30, status: 'pending' },
  { phase: 'completion', itemOrder: 2, itemCode: '16', itemName: '技師完竣證明及台電報竣流程', durationDays: 7, status: 'pending' },
  { phase: 'completion', itemOrder: 3, itemCode: '17', itemName: '台電安排掛表', durationDays: 5, paymentMilestone: '第三期款 竣工掛錶款 (40%)', status: 'pending' },
  
  // 結案階段
  { phase: 'closing', itemOrder: 1, itemCode: '18', itemName: '取得台電派員訪查併聯函', durationDays: 15, status: 'pending' },
  { phase: 'closing', itemOrder: 2, itemCode: '19', itemName: '能源局設備登記', durationDays: 20, paymentMilestone: '第四期款 設備登記 (10%)', status: 'pending' },
];

// =====================
// 計算函數
// =====================

/**
 * 計算單年發電量 (考慮衰減)
 */
export function calculateAnnualGeneration(
  capacityKwp: number,
  sunshineHours: number,
  yearNumber: number,
  annualDegradationRate: number
): number {
  const baseGeneration = capacityKwp * sunshineHours * 365;
  const degradationFactor = Math.pow(1 - annualDegradationRate, yearNumber - 1);
  return baseGeneration * degradationFactor;
}

/**
 * 計算保固費率 (依年份)
 */
export function getMaintenanceRate(
  yearNumber: number,
  rate6To10: number,
  rate11To15: number,
  rate16To20: number
): number {
  if (yearNumber <= 5) return 0;
  if (yearNumber <= 10) return rate6To10;
  if (yearNumber <= 15) return rate11To15;
  return rate16To20;
}

/**
 * 計算月付本息 (本利平均攤還)
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal === 0 || termMonths === 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

/**
 * 計算貸款攤還表
 */
export function calculateLoanSchedule(
  principal: number,
  annualRate: number,
  termMonths: number
): { balance: number; principalPayment: number; interestPayment: number }[] {
  const schedule: { balance: number; principalPayment: number; interestPayment: number }[] = [];
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  let balance = principal;
  const monthlyRate = annualRate / 12;
  
  for (let month = 1; month <= termMonths; month++) {
    const interest = balance * monthlyRate;
    const principalPmt = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPmt);
    
    schedule.push({
      balance,
      principalPayment: principalPmt,
      interestPayment: interest,
    });
  }
  
  return schedule;
}

/**
 * 計算 IRR (內部報酬率)
 */
export function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
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

/**
 * 計算 20 年財務預測
 */
export function calculate20YearProjection(params: QuoteParams): {
  projections: YearlyProjection[];
  summary: QuoteSummary;
} {
  const projections: YearlyProjection[] = [];
  const totalPrice = params.capacityKwp * params.pricePerKwp;
  const totalPriceWithTax = totalPrice * (1 + params.taxRate);
  
  // 計算貸款
  const loanAmount = totalPrice * (params.loanPercentage / 100);
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    params.loanInterestRate,
    params.loanTermMonths
  );
  const yearlyLoanPayment = monthlyPayment * 12;
  const loanSchedule = calculateLoanSchedule(
    loanAmount,
    params.loanInterestRate,
    params.loanTermMonths
  );
  
  // 保險費 (每年固定)
  const yearlyInsurance = totalPrice * params.insuranceRate;
  
  let cumulativeRevenue = 0;
  let cumulativeCashFlow = -totalPrice; // 初始投資為負
  const cashFlows: number[] = [-totalPrice];
  
  let totalMaintenance = 0;
  let totalRent = 0;
  let paybackYear = 0;
  
  for (let year = 1; year <= 20; year++) {
    // 發電量計算
    const generation = calculateAnnualGeneration(
      params.capacityKwp,
      params.sunshineHours,
      year,
      params.annualDegradationRate
    );
    
    // 電費收入
    const rate = params.tariffRate + params.highEfficiencyBonus;
    const revenue = generation * rate;
    cumulativeRevenue += revenue;
    
    // 保固費
    const maintenanceRate = getMaintenanceRate(
      year,
      params.maintenanceRate6To10,
      params.maintenanceRate11To15,
      params.maintenanceRate16To20
    );
    const maintenanceCost = revenue * (maintenanceRate / 100);
    totalMaintenance += maintenanceCost;
    
    // 租金
    const rentCost = revenue * (params.rentRate / 100);
    totalRent += rentCost;
    
    // 貸款 (前15年)
    let loanPayment = 0;
    let loanBalance = 0;
    let principalPayment = 0;
    let interestPayment = 0;
    
    if (year <= Math.ceil(params.loanTermMonths / 12)) {
      loanPayment = yearlyLoanPayment;
      const startMonth = (year - 1) * 12;
      const endMonth = Math.min(year * 12, params.loanTermMonths);
      
      for (let m = startMonth; m < endMonth; m++) {
        if (m < loanSchedule.length) {
          principalPayment += loanSchedule[m].principalPayment;
          interestPayment += loanSchedule[m].interestPayment;
        }
      }
      loanBalance = endMonth < loanSchedule.length ? loanSchedule[endMonth - 1].balance : 0;
    }
    
    // 年度現金流
    const annualCashFlow = revenue - loanPayment - maintenanceCost - yearlyInsurance - rentCost;
    cumulativeCashFlow += annualCashFlow;
    cashFlows.push(annualCashFlow);
    
    // 回收年限判斷
    if (paybackYear === 0 && cumulativeCashFlow >= 0) {
      paybackYear = year;
    }
    
    projections.push({
      yearNumber: year,
      estimatedGenerationKwh: generation,
      electricityRate: rate,
      electricityRevenue: revenue,
      cumulativeRevenue,
      loanPayment,
      maintenanceRate,
      maintenanceCost,
      insuranceCost: yearlyInsurance,
      rentCost,
      annualCashFlow,
      cumulativeCashFlow,
      loanBalance,
      principalPayment,
      interestPayment,
    });
  }
  
  // 計算 IRR
  const irr = calculateIRR(cashFlows) * 100;
  
  // 計算總結
  const netProfit = cumulativeCashFlow;
  const totalRoi = (netProfit / totalPrice) * 100;
  const annualRoi = totalRoi / 20;
  
  const summary: QuoteSummary = {
    totalPrice,
    totalPriceWithTax,
    estimatedProfit: 0, // 需從細項計算
    grossMarginRate: 0,
    contractorCost: 0,
    investorCost: 0,
    specialCost: 0,
    irr20Year: irr,
    totalRevenue20Year: cumulativeRevenue,
    paybackYears: paybackYear || 20,
    netProfit20Year: netProfit,
    totalRoi,
    annualRoi,
    totalInsurance20Year: yearlyInsurance * 20,
    totalMaintenance20Year: totalMaintenance,
    totalRent20Year: totalRent,
  };
  
  return { projections, summary };
}

/**
 * 計算工程細項小計
 */
export function calculateLineItemSubtotal(
  item: Omit<QuoteLineItem, 'subtotal' | 'subtotalWithTax'>,
  capacityKwp: number,
  totalPriceWithTax?: number,
  taxRate: number = 0.05
): { subtotal: number; subtotalWithTax: number } {
  let quantity = item.quantity;
  
  // 自動填入容量相關的數量
  if (item.unit === 'kWp' && quantity === 0) {
    quantity = capacityKwp;
  }
  
  let subtotal = item.unitPrice * quantity;
  
  // 特殊項目計算
  if (item.itemName.includes('印花稅') && totalPriceWithTax) {
    subtotal = totalPriceWithTax * 0.001;
  } else if (item.itemName.includes('營所稅') && totalPriceWithTax) {
    subtotal = totalPriceWithTax * 0.02;
  }
  
  return {
    subtotal,
    subtotalWithTax: subtotal * (1 + taxRate),
  };
}

/**
 * 計算報價摘要（從細項）
 */
export function calculateQuoteSummaryFromItems(
  lineItems: QuoteLineItem[],
  taxRate: number = 0.05
): Pick<QuoteSummary, 'contractorCost' | 'investorCost' | 'specialCost' | 'estimatedProfit' | 'grossMarginRate'> {
  const contractorCost = lineItems
    .filter(item => item.category === 'contractor')
    .reduce((sum, item) => sum + (item.subtotal || 0), 0);
  
  const investorCost = lineItems
    .filter(item => item.category === 'investor')
    .reduce((sum, item) => sum + (item.subtotal || 0), 0);
  
  const specialCost = lineItems
    .filter(item => item.category === 'special')
    .reduce((sum, item) => sum + (item.subtotal || 0), 0);
  
  const totalCost = contractorCost + investorCost + specialCost;
  
  return {
    contractorCost,
    investorCost,
    specialCost,
    estimatedProfit: 0, // 需要知道報價才能計算
    grossMarginRate: 0,
  };
}

/**
 * 格式化數字為貨幣
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 從容量查詢適用費率
 */
export function getTariffRateForCapacity(
  capacityKwp: number,
  installationType: string,
  tariffRates: { capacity_min: number; capacity_max: number | null; base_rate: number; high_efficiency_rate: number }[]
): { baseRate: number; highEfficiencyRate: number } | null {
  const matchingRate = tariffRates.find(rate => {
    const minMatch = capacityKwp >= rate.capacity_min;
    const maxMatch = rate.capacity_max === null || capacityKwp < rate.capacity_max;
    return minMatch && maxMatch;
  });
  
  if (!matchingRate) return null;
  
  return {
    baseRate: matchingRate.base_rate,
    highEfficiencyRate: matchingRate.high_efficiency_rate,
  };
}

/**
 * 生成報價單編號
 */
export function generateQuoteNumber(year: number, sequence: number): string {
  return `Q-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * 計算甘特圖日期（從開始日期推算）
 */
export function calculateScheduleDates(
  scheduleItems: ScheduleItem[],
  projectStartDate: Date
): ScheduleItem[] {
  const result: ScheduleItem[] = [];
  let currentDate = new Date(projectStartDate);
  
  // 按 phase 和 itemOrder 排序
  const phaseOrder = { pre_work: 1, construction: 2, completion: 3, closing: 4 };
  const sorted = [...scheduleItems].sort((a, b) => {
    const phaseCompare = phaseOrder[a.phase] - phaseOrder[b.phase];
    if (phaseCompare !== 0) return phaseCompare;
    return a.itemOrder - b.itemOrder;
  });
  
  for (const item of sorted) {
    const startDate = item.startDate || new Date(currentDate);
    const duration = item.durationDays || 1;
    const endDate = item.endDate || new Date(startDate.getTime() + (duration - 1) * 24 * 60 * 60 * 1000);
    
    result.push({
      ...item,
      startDate,
      endDate,
      durationDays: duration,
    });
    
    // 下一項目從這項結束後開始
    currentDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return result;
}
