import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type InstallationType = 'rooftop' | 'ground' | 'floating';
export type SpecialCondition = 'fishery' | 'agriculture' | 'highway_service' | 'school_sports' | 'school_metal_plate';

export interface FitRateSchedule {
  id: string;
  effectiveYear: number;
  period: 1 | 2; // 1=上半年, 2=下半年
  capacityMinKwp: number;
  capacityMaxKwp: number;
  ratePerKwh: number;
  highEfficiencyBonus: number;
  moduleRecyclingFee: number;
  rooftopGridFee: number;
  fisheryBonus: number;
  agricultureBonus: number;
  highwayServiceBonus: number;
  schoolSportsBonus: number;
  schoolMetalPlateBonus: number;
  installationType: InstallationType;
  note: string | null;
  isActive: boolean;
}

export interface FitRateLookupOptions {
  includeHighEfficiency?: boolean; // 是否使用 VPC 認證模組
  includeRooftopGridFee?: boolean; // 是否適用屋頂型併網工程費
  specialCondition?: SpecialCondition | null; // 特殊條件加成
}

export interface FitRateLookupResult {
  baseRate: number;
  highEfficiencyBonus: number;
  rooftopGridFee: number;
  specialBonus: number;
  specialBonusType: SpecialCondition | null;
  totalRate: number;
  moduleRecyclingFee: number; // 僅供參考，不計入總費率
  note: string | null;
  source: 'system' | 'manual';
  period: 1 | 2;
  effectiveYear: number;
}

// 目前期數判斷 (上半年: 1-6月, 下半年: 7-12月)
function getCurrentPeriod(): 1 | 2 {
  const month = new Date().getMonth() + 1;
  return month <= 6 ? 1 : 2;
}

// 民國年轉換
function getROCYear(): number {
  return new Date().getFullYear() - 1911;
}

/**
 * Hook 用於查詢與管理躉購費率
 */
export function useFitRates() {
  const [rates, setRates] = useState<FitRateSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 取得當前年度與期數
  const currentYear = useMemo(() => getROCYear(), []);
  const currentPeriod = useMemo(() => getCurrentPeriod(), []);

  // 載入所有費率資料
  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('system_tariff_rates')
        .select('*')
        .eq('is_active', true)
        .order('effective_year', { ascending: false })
        .order('period', { ascending: true })
        .order('capacity_min_kwp', { ascending: true });

      if (queryError) throw queryError;

      const mapped: FitRateSchedule[] = (data || []).map((row: any) => ({
        id: row.id,
        effectiveYear: row.effective_year,
        period: (row.period || 1) as 1 | 2,
        capacityMinKwp: Number(row.capacity_min_kwp),
        capacityMaxKwp: Number(row.capacity_max_kwp),
        ratePerKwh: Number(row.rate_per_kwh),
        highEfficiencyBonus: Number(row.high_efficiency_bonus || 0),
        moduleRecyclingFee: Number(row.module_recycling_fee || 0),
        rooftopGridFee: Number(row.rooftop_grid_fee || 0),
        fisheryBonus: Number(row.fishery_bonus || 0),
        agricultureBonus: Number(row.agriculture_bonus || 0),
        highwayServiceBonus: Number(row.highway_service_bonus || 0),
        schoolSportsBonus: Number(row.school_sports_bonus || 0),
        schoolMetalPlateBonus: Number(row.school_metal_plate_bonus || 0),
        installationType: row.installation_type as InstallationType,
        note: row.note,
        isActive: row.is_active,
      }));

      setRates(mapped);
    } catch (err: any) {
      console.error('Error fetching FIT rates:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // 根據容量與類型查詢適用費率
  const lookupRate = useCallback((
    capacityKwp: number,
    installationType: InstallationType = 'rooftop',
    year?: number,
    period?: 1 | 2,
    options: FitRateLookupOptions = {}
  ): FitRateLookupResult | null => {
    if (capacityKwp <= 0) return null;

    const {
      includeHighEfficiency = false,
      includeRooftopGridFee = false,
      specialCondition = null,
    } = options;

    const targetYear = year || currentYear;
    const targetPeriod = period || currentPeriod;
    
    // 先找指定年度與期數
    let matchingRates = rates.filter(r => 
      r.effectiveYear === targetYear && 
      r.period === targetPeriod &&
      r.installationType === installationType
    );
    
    // 找不到則嘗試同年度另一期
    if (matchingRates.length === 0) {
      matchingRates = rates.filter(r => 
        r.effectiveYear === targetYear && 
        r.installationType === installationType
      );
    }
    
    // 還是找不到則找最近年度的費率
    if (matchingRates.length === 0) {
      const latestYear = rates
        .filter(r => r.installationType === installationType)
        .reduce((max, r) => Math.max(max, r.effectiveYear), 0);
      
      matchingRates = rates.filter(r => 
        r.effectiveYear === latestYear && 
        r.installationType === installationType
      );
    }

    if (matchingRates.length === 0) return null;

    // 根據容量找到適用的級距
    let applicableRate = matchingRates.find(r => 
      capacityKwp >= r.capacityMinKwp && 
      capacityKwp < r.capacityMaxKwp
    );

    // 如果超過最大級距，使用最大的那個
    if (!applicableRate) {
      const maxRate = matchingRates.reduce((max, r) => 
        r.capacityMinKwp > max.capacityMinKwp ? r : max
      , matchingRates[0]);
      
      if (capacityKwp >= maxRate.capacityMinKwp) {
        applicableRate = maxRate;
      }
    }

    if (!applicableRate) return null;

    // 計算各項加成
    const highEffBonus = includeHighEfficiency ? applicableRate.highEfficiencyBonus : 0;
    
    // 屋頂型併網工程費只適用於屋頂型
    const gridFee = (includeRooftopGridFee && installationType === 'rooftop') 
      ? applicableRate.rooftopGridFee 
      : 0;
    
    // 特殊條件加成
    let specialBonus = 0;
    if (specialCondition) {
      switch (specialCondition) {
        case 'fishery':
          specialBonus = applicableRate.fisheryBonus;
          break;
        case 'agriculture':
          specialBonus = applicableRate.agricultureBonus;
          break;
        case 'highway_service':
          specialBonus = applicableRate.highwayServiceBonus;
          break;
        case 'school_sports':
          specialBonus = applicableRate.schoolSportsBonus;
          break;
        case 'school_metal_plate':
          specialBonus = applicableRate.schoolMetalPlateBonus;
          break;
      }
    }

    // 總費率 = 基本費率 + 高效能加成 + 併網工程費 + 特殊條件加成
    // 注意：模組回收費不計入
    const totalRate = applicableRate.ratePerKwh + highEffBonus + gridFee + specialBonus;

    return {
      baseRate: applicableRate.ratePerKwh,
      highEfficiencyBonus: highEffBonus,
      rooftopGridFee: gridFee,
      specialBonus,
      specialBonusType: specialCondition,
      totalRate,
      moduleRecyclingFee: applicableRate.moduleRecyclingFee, // 僅供參考
      note: applicableRate.note,
      source: 'system',
      period: applicableRate.period,
      effectiveYear: applicableRate.effectiveYear,
    };
  }, [rates, currentYear, currentPeriod]);

  // 取得特定年度/期數的所有費率
  const getRatesForYear = useCallback((
    year: number, 
    period?: 1 | 2,
    installationType?: InstallationType
  ) => {
    return rates.filter(r => 
      r.effectiveYear === year && 
      (!period || r.period === period) &&
      (!installationType || r.installationType === installationType)
    ).sort((a, b) => a.capacityMinKwp - b.capacityMinKwp);
  }, [rates]);

  // 取得可用年度列表
  const availableYears = useMemo(() => {
    const years = [...new Set(rates.map(r => r.effectiveYear))];
    return years.sort((a, b) => b - a);
  }, [rates]);

  // 取得特定年度的可用期數
  const getAvailablePeriods = useCallback((year: number) => {
    const periods = [...new Set(rates.filter(r => r.effectiveYear === year).map(r => r.period))];
    return periods.sort((a, b) => a - b);
  }, [rates]);

  // 新增或更新費率
  const saveRate = useCallback(async (rate: Partial<FitRateSchedule>) => {
    try {
      const payload = {
        effective_year: rate.effectiveYear,
        period: rate.period || 1,
        capacity_min_kwp: rate.capacityMinKwp,
        capacity_max_kwp: rate.capacityMaxKwp,
        rate_per_kwh: rate.ratePerKwh,
        high_efficiency_bonus: rate.highEfficiencyBonus || 0,
        module_recycling_fee: rate.moduleRecyclingFee || 0,
        rooftop_grid_fee: rate.rooftopGridFee || 0,
        fishery_bonus: rate.fisheryBonus || 0,
        agriculture_bonus: rate.agricultureBonus || 0,
        highway_service_bonus: rate.highwayServiceBonus || 0,
        school_sports_bonus: rate.schoolSportsBonus || 0,
        school_metal_plate_bonus: rate.schoolMetalPlateBonus || 0,
        installation_type: rate.installationType,
        note: rate.note,
        is_active: rate.isActive ?? true,
        updated_at: new Date().toISOString(),
      };

      if (rate.id) {
        const { error } = await supabase
          .from('system_tariff_rates')
          .update(payload)
          .eq('id', rate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_tariff_rates')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('已儲存躉購費率');
      await fetchRates();
    } catch (err: any) {
      console.error('Error saving FIT rate:', err);
      toast.error('儲存失敗: ' + err.message);
    }
  }, [fetchRates]);

  // 刪除費率
  const deleteRate = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('system_tariff_rates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      toast.success('已刪除躉購費率');
      await fetchRates();
    } catch (err: any) {
      console.error('Error deleting FIT rate:', err);
      toast.error('刪除失敗: ' + err.message);
    }
  }, [fetchRates]);

  // 批次匯入費率（用於新年度資料）
  const importRates = useCallback(async (newRates: Omit<FitRateSchedule, 'id'>[]) => {
    try {
      const payloads = newRates.map(rate => ({
        effective_year: rate.effectiveYear,
        period: rate.period || 1,
        capacity_min_kwp: rate.capacityMinKwp,
        capacity_max_kwp: rate.capacityMaxKwp,
        rate_per_kwh: rate.ratePerKwh,
        high_efficiency_bonus: rate.highEfficiencyBonus || 0,
        module_recycling_fee: rate.moduleRecyclingFee || 0,
        rooftop_grid_fee: rate.rooftopGridFee || 0,
        fishery_bonus: rate.fisheryBonus || 0,
        agriculture_bonus: rate.agricultureBonus || 0,
        highway_service_bonus: rate.highwayServiceBonus || 0,
        school_sports_bonus: rate.schoolSportsBonus || 0,
        school_metal_plate_bonus: rate.schoolMetalPlateBonus || 0,
        installation_type: rate.installationType,
        note: rate.note,
        is_active: true,
      }));

      const { error } = await supabase
        .from('system_tariff_rates')
        .insert(payloads);
      
      if (error) throw error;
      
      toast.success(`已匯入 ${newRates.length} 筆費率資料`);
      await fetchRates();
    } catch (err: any) {
      console.error('Error importing FIT rates:', err);
      toast.error('匯入失敗: ' + err.message);
    }
  }, [fetchRates]);

  return {
    rates,
    isLoading,
    error,
    currentYear,
    currentPeriod,
    availableYears,
    getAvailablePeriods,
    lookupRate,
    getRatesForYear,
    saveRate,
    deleteRate,
    importRates,
    refresh: fetchRates,
  };
}

/**
 * 特殊條件加成類型對照
 */
export const SPECIAL_CONDITION_LABELS: Record<SpecialCondition, string> = {
  fishery: '漁業環境友善公積金',
  agriculture: '農業經營結合綠能',
  highway_service: '高速公路服務區停車場',
  school_sports: '學校光電運動場',
  school_metal_plate: '學校光電運動場金屬浪板',
};

/**
 * 115 年度躉購費率預設資料 (根據附表三)
 * 注意：模組回收費僅記錄不計入總費率
 */
export const FIT_RATES_115: Omit<FitRateSchedule, 'id'>[] = [
  // 屋頂型 - 第一期
  { effectiveYear: 115, period: 1, installationType: 'rooftop', capacityMinKwp: 1, capacityMaxKwp: 10, ratePerKwh: 5.6279, highEfficiencyBonus: 0.3377, moduleRecyclingFee: 0.0299, rooftopGridFee: 0.0531, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '1瓩以上不及10瓩', isActive: true },
  { effectiveYear: 115, period: 1, installationType: 'rooftop', capacityMinKwp: 10, capacityMaxKwp: 20, ratePerKwh: 5.3819, highEfficiencyBonus: 0.3229, moduleRecyclingFee: 0.0286, rooftopGridFee: 0.0507, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '10瓩以上不及20瓩', isActive: true },
  { effectiveYear: 115, period: 1, installationType: 'rooftop', capacityMinKwp: 20, capacityMaxKwp: 50, ratePerKwh: 4.2505, highEfficiencyBonus: 0.2550, moduleRecyclingFee: 0.0226, rooftopGridFee: 0.0401, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '20瓩以上不及50瓩', isActive: true },
  { effectiveYear: 115, period: 1, installationType: 'rooftop', capacityMinKwp: 50, capacityMaxKwp: 100, ratePerKwh: 4.0459, highEfficiencyBonus: 0.2428, moduleRecyclingFee: 0.0215, rooftopGridFee: 0.0381, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '50瓩以上不及100瓩', isActive: true },
  { effectiveYear: 115, period: 1, installationType: 'rooftop', capacityMinKwp: 100, capacityMaxKwp: 500, ratePerKwh: 3.7152, highEfficiencyBonus: 0.2229, moduleRecyclingFee: 0.0197, rooftopGridFee: 0.0350, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '100瓩以上不及500瓩', isActive: true },
  { effectiveYear: 115, period: 1, installationType: 'rooftop', capacityMinKwp: 500, capacityMaxKwp: 99999, ratePerKwh: 3.6236, highEfficiencyBonus: 0.2174, moduleRecyclingFee: 0.0193, rooftopGridFee: 0, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '500瓩以上（不適用併網工程費）', isActive: true },
  
  // 地面型 - 第一期
  { effectiveYear: 115, period: 1, installationType: 'ground', capacityMinKwp: 1, capacityMaxKwp: 99999, ratePerKwh: 3.5037, highEfficiencyBonus: 0.2102, moduleRecyclingFee: 0.0186, rooftopGridFee: 0, fisheryBonus: 0.1134, agricultureBonus: 0.1560, highwayServiceBonus: 0.1000, schoolSportsBonus: 0.3700, schoolMetalPlateBonus: 0.5000, note: '1瓩以上', isActive: true },
  
  // 水面型 (浮力式) - 第一期
  { effectiveYear: 115, period: 1, installationType: 'floating', capacityMinKwp: 1, capacityMaxKwp: 99999, ratePerKwh: 3.8948, highEfficiencyBonus: 0.2337, moduleRecyclingFee: 0.0207, rooftopGridFee: 0, fisheryBonus: 0.1260, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '1瓩以上', isActive: true },
  
  // 第二期費率 (115年度兩期相同)
  { effectiveYear: 115, period: 2, installationType: 'rooftop', capacityMinKwp: 1, capacityMaxKwp: 10, ratePerKwh: 5.6279, highEfficiencyBonus: 0.3377, moduleRecyclingFee: 0.0299, rooftopGridFee: 0.0531, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '1瓩以上不及10瓩', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'rooftop', capacityMinKwp: 10, capacityMaxKwp: 20, ratePerKwh: 5.3819, highEfficiencyBonus: 0.3229, moduleRecyclingFee: 0.0286, rooftopGridFee: 0.0507, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '10瓩以上不及20瓩', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'rooftop', capacityMinKwp: 20, capacityMaxKwp: 50, ratePerKwh: 4.2505, highEfficiencyBonus: 0.2550, moduleRecyclingFee: 0.0226, rooftopGridFee: 0.0401, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '20瓩以上不及50瓩', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'rooftop', capacityMinKwp: 50, capacityMaxKwp: 100, ratePerKwh: 4.0459, highEfficiencyBonus: 0.2428, moduleRecyclingFee: 0.0215, rooftopGridFee: 0.0381, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '50瓩以上不及100瓩', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'rooftop', capacityMinKwp: 100, capacityMaxKwp: 500, ratePerKwh: 3.7152, highEfficiencyBonus: 0.2229, moduleRecyclingFee: 0.0197, rooftopGridFee: 0.0350, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '100瓩以上不及500瓩', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'rooftop', capacityMinKwp: 500, capacityMaxKwp: 99999, ratePerKwh: 3.6236, highEfficiencyBonus: 0.2174, moduleRecyclingFee: 0.0193, rooftopGridFee: 0, fisheryBonus: 0, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '500瓩以上（不適用併網工程費）', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'ground', capacityMinKwp: 1, capacityMaxKwp: 99999, ratePerKwh: 3.5037, highEfficiencyBonus: 0.2102, moduleRecyclingFee: 0.0186, rooftopGridFee: 0, fisheryBonus: 0.1134, agricultureBonus: 0.1560, highwayServiceBonus: 0.1000, schoolSportsBonus: 0.3700, schoolMetalPlateBonus: 0.5000, note: '1瓩以上', isActive: true },
  { effectiveYear: 115, period: 2, installationType: 'floating', capacityMinKwp: 1, capacityMaxKwp: 99999, ratePerKwh: 3.8948, highEfficiencyBonus: 0.2337, moduleRecyclingFee: 0.0207, rooftopGridFee: 0, fisheryBonus: 0.1260, agricultureBonus: 0, highwayServiceBonus: 0, schoolSportsBonus: 0, schoolMetalPlateBonus: 0, note: '1瓩以上', isActive: true },
];
