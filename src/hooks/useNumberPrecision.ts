import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * 數值精度設定類型
 */
export interface NumberPrecisionConfig {
  // 金額類型
  currency_twd: number;        // 新台幣金額 (預設 0)
  currency_usd: number;        // 美元金額 (預設 2)
  
  // 費率/百分比類型
  rate_percent: number;        // 百分比 (預設 2)
  rate_tariff: number;         // 躉購/電價費率 (預設 4)
  rate_insurance: number;      // 保險費率 (預設 4)
  rate_interest: number;       // 利率 (預設 4)
  
  // 發電/容量類型
  capacity_kwp: number;        // 容量 kWp (預設 2)
  generation_kwh: number;      // 發電度數 (預設 2)
  
  // 比例/係數類型
  ratio_degradation: number;   // 衰減率 (預設 4)
  ratio_exchange: number;      // 匯率 (預設 2)
  
  // 時間類型
  years: number;               // 年數 (預設 1)
}

/**
 * 預設精度值
 */
export const DEFAULT_PRECISION: NumberPrecisionConfig = {
  currency_twd: 0,
  currency_usd: 2,
  rate_percent: 2,
  rate_tariff: 4,
  rate_insurance: 4,
  rate_interest: 4,
  capacity_kwp: 2,
  generation_kwh: 2,
  ratio_degradation: 4,
  ratio_exchange: 2,
  years: 1,
};

/**
 * 精度設定欄位描述
 */
export const PRECISION_FIELD_LABELS: Record<keyof NumberPrecisionConfig, { label: string; description: string; category: string }> = {
  currency_twd: { label: '新台幣金額', description: '所有新台幣金額的小數位數', category: '金額' },
  currency_usd: { label: '美元金額', description: '美元金額的小數位數', category: '金額' },
  rate_percent: { label: '百分比', description: '一般百分比數值 (如 ROI、利潤率)', category: '費率' },
  rate_tariff: { label: '電力費率', description: '躉購費率、電價費率 (元/度)', category: '費率' },
  rate_insurance: { label: '保險費率', description: '年保險費率百分比', category: '費率' },
  rate_interest: { label: '貸款利率', description: '年貸款利率百分比', category: '費率' },
  capacity_kwp: { label: '裝置容量', description: '太陽能裝置容量 (kWp)', category: '發電' },
  generation_kwh: { label: '發電度數', description: '發電量 (kWh)', category: '發電' },
  ratio_degradation: { label: '衰減率', description: '模組年衰減率', category: '係數' },
  ratio_exchange: { label: '匯率', description: '美元對新台幣匯率', category: '係數' },
  years: { label: '年數', description: '投資回收年數等', category: '其他' },
};

const SETTING_KEY = 'number_precision';

/**
 * Hook: 管理數值精度設定
 */
export function useNumberPrecision() {
  const queryClient = useQueryClient();

  const { data: precisionConfig, isLoading } = useQuery({
    queryKey: ['number-precision'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_settings')
        .select('*')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        // 合併預設值與儲存的值
        return { ...DEFAULT_PRECISION, ...(data.setting_value as Partial<NumberPrecisionConfig>) };
      }

      return DEFAULT_PRECISION;
    },
    staleTime: 1000 * 60 * 5, // 5 分鐘快取
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NumberPrecisionConfig>) => {
      const newConfig = { ...precisionConfig, ...updates };

      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('progress_settings')
        .select('id')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('progress_settings')
          .update({
            setting_value: newConfig as any,
            updated_at: new Date().toISOString(),
            updated_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .eq('setting_key', SETTING_KEY);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('progress_settings')
          .insert({
            setting_key: SETTING_KEY,
            setting_value: newConfig as any,
            description: '數值顯示精度設定',
            updated_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (error) throw error;
      }

      return newConfig;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['number-precision'], data);
      toast.success('精度設定已更新');
    },
    onError: (error) => {
      console.error('Failed to update precision settings:', error);
      toast.error('更新失敗');
    },
  });

  const resetToDefaults = () => {
    updateMutation.mutate(DEFAULT_PRECISION);
  };

  return {
    precisionConfig: precisionConfig || DEFAULT_PRECISION,
    isLoading,
    updatePrecision: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    resetToDefaults,
  };
}

/**
 * Hook: 只讀取精度設定（用於格式化）
 */
export function useNumberPrecisionRead() {
  const { data: precisionConfig } = useQuery({
    queryKey: ['number-precision'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_settings')
        .select('*')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        return { ...DEFAULT_PRECISION, ...(data.setting_value as Partial<NumberPrecisionConfig>) };
      }

      return DEFAULT_PRECISION;
    },
    staleTime: 1000 * 60 * 5,
  });

  return precisionConfig || DEFAULT_PRECISION;
}
