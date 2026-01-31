import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FitRateSchedule {
  id: string;
  effectiveYear: number;
  capacityMinKwp: number;
  capacityMaxKwp: number;
  ratePerKwh: number;
  highEfficiencyBonus: number;
  installationType: 'rooftop' | 'ground' | 'floating';
  note: string | null;
  isActive: boolean;
}

export interface FitRateLookupResult {
  baseRate: number;
  highEfficiencyBonus: number;
  totalRate: number;
  note: string | null;
  source: 'system' | 'manual';
}

// 目前期數判斷 (上半年: 1-6月, 下半年: 7-12月)
function getCurrentPeriod(): number {
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

  // 取得當前年度
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
        .order('capacity_min_kwp', { ascending: true });

      if (queryError) throw queryError;

      const mapped: FitRateSchedule[] = (data || []).map((row: any) => ({
        id: row.id,
        effectiveYear: row.effective_year,
        capacityMinKwp: Number(row.capacity_min_kwp),
        capacityMaxKwp: Number(row.capacity_max_kwp),
        ratePerKwh: Number(row.rate_per_kwh),
        highEfficiencyBonus: Number(row.high_efficiency_bonus || 0),
        installationType: row.installation_type as 'rooftop' | 'ground' | 'floating',
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
    installationType: 'rooftop' | 'ground' | 'floating' = 'rooftop',
    year?: number,
    includeHighEfficiency: boolean = true
  ): FitRateLookupResult | null => {
    if (capacityKwp <= 0) return null;

    const targetYear = year || currentYear;
    
    // 先找指定年度，找不到則找最近的年度
    let matchingRates = rates.filter(r => 
      r.effectiveYear === targetYear && 
      r.installationType === installationType
    );
    
    if (matchingRates.length === 0) {
      // 找最近年度的費率
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
    const applicableRate = matchingRates.find(r => 
      capacityKwp >= r.capacityMinKwp && 
      capacityKwp < r.capacityMaxKwp
    );

    if (!applicableRate) {
      // 如果超過最大級距，使用最大的那個
      const maxRate = matchingRates.reduce((max, r) => 
        r.capacityMinKwp > max.capacityMinKwp ? r : max
      , matchingRates[0]);
      
      if (capacityKwp >= maxRate.capacityMinKwp) {
        return {
          baseRate: maxRate.ratePerKwh,
          highEfficiencyBonus: includeHighEfficiency ? maxRate.highEfficiencyBonus : 0,
          totalRate: maxRate.ratePerKwh + (includeHighEfficiency ? maxRate.highEfficiencyBonus : 0),
          note: maxRate.note,
          source: 'system',
        };
      }
      return null;
    }

    return {
      baseRate: applicableRate.ratePerKwh,
      highEfficiencyBonus: includeHighEfficiency ? applicableRate.highEfficiencyBonus : 0,
      totalRate: applicableRate.ratePerKwh + (includeHighEfficiency ? applicableRate.highEfficiencyBonus : 0),
      note: applicableRate.note,
      source: 'system',
    };
  }, [rates, currentYear]);

  // 取得特定年度的所有費率
  const getRatesForYear = useCallback((year: number, installationType?: 'rooftop' | 'ground' | 'floating') => {
    return rates.filter(r => 
      r.effectiveYear === year && 
      (!installationType || r.installationType === installationType)
    ).sort((a, b) => a.capacityMinKwp - b.capacityMinKwp);
  }, [rates]);

  // 取得可用年度列表
  const availableYears = useMemo(() => {
    const years = [...new Set(rates.map(r => r.effectiveYear))];
    return years.sort((a, b) => b - a);
  }, [rates]);

  // 新增或更新費率
  const saveRate = useCallback(async (rate: Partial<FitRateSchedule>) => {
    try {
      const payload = {
        effective_year: rate.effectiveYear,
        capacity_min_kwp: rate.capacityMinKwp,
        capacity_max_kwp: rate.capacityMaxKwp,
        rate_per_kwh: rate.ratePerKwh,
        high_efficiency_bonus: rate.highEfficiencyBonus || 0,
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
        capacity_min_kwp: rate.capacityMinKwp,
        capacity_max_kwp: rate.capacityMaxKwp,
        rate_per_kwh: rate.ratePerKwh,
        high_efficiency_bonus: rate.highEfficiencyBonus || 0,
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
    lookupRate,
    getRatesForYear,
    saveRate,
    deleteRate,
    importRates,
    refresh: fetchRates,
  };
}

/**
 * 115 年度躉購費率預設資料 (根據附表三)
 */
export const FIT_RATES_115: Omit<FitRateSchedule, 'id'>[] = [
  // 屋頂型
  { effectiveYear: 115, installationType: 'rooftop', capacityMinKwp: 1, capacityMaxKwp: 10, ratePerKwh: 5.6279, highEfficiencyBonus: 0.3377, note: '1瓩以上不及10瓩', isActive: true },
  { effectiveYear: 115, installationType: 'rooftop', capacityMinKwp: 10, capacityMaxKwp: 20, ratePerKwh: 5.3819, highEfficiencyBonus: 0.3229, note: '10瓩以上不及20瓩', isActive: true },
  { effectiveYear: 115, installationType: 'rooftop', capacityMinKwp: 20, capacityMaxKwp: 50, ratePerKwh: 4.2505, highEfficiencyBonus: 0.2550, note: '20瓩以上不及50瓩', isActive: true },
  { effectiveYear: 115, installationType: 'rooftop', capacityMinKwp: 50, capacityMaxKwp: 100, ratePerKwh: 4.0459, highEfficiencyBonus: 0.2428, note: '50瓩以上不及100瓩', isActive: true },
  { effectiveYear: 115, installationType: 'rooftop', capacityMinKwp: 100, capacityMaxKwp: 500, ratePerKwh: 3.7152, highEfficiencyBonus: 0.2229, note: '100瓩以上不及500瓩', isActive: true },
  { effectiveYear: 115, installationType: 'rooftop', capacityMinKwp: 500, capacityMaxKwp: 99999, ratePerKwh: 3.6236, highEfficiencyBonus: 0.2174, note: '500瓩以上', isActive: true },
  // 地面型
  { effectiveYear: 115, installationType: 'ground', capacityMinKwp: 1, capacityMaxKwp: 99999, ratePerKwh: 3.5037, highEfficiencyBonus: 0.2102, note: '1瓩以上', isActive: true },
  // 水面型 (浮力式)
  { effectiveYear: 115, installationType: 'floating', capacityMinKwp: 1, capacityMaxKwp: 99999, ratePerKwh: 3.8948, highEfficiencyBonus: 0.2337, note: '1瓩以上', isActive: true },
];
