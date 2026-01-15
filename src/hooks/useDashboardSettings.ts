import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// 儀表板區塊定義
export interface DashboardSection {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

// 預設篩選條件
export interface DashboardFilters {
  investor: string;
  status: string;
  constructionStatus: string;
}

// 儀表板設定
export interface DashboardSettings {
  sections: DashboardSection[];
  defaultFilters: DashboardFilters;
}

// 預設區塊配置
export const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: 'phase-overview', label: '兩階段流程概覽', visible: true, order: 0 },
  { id: 'phase2-tracks', label: '第二階段多軌追蹤', visible: true, order: 1 },
  { id: 'health-kpis', label: '健康指標 KPI', visible: true, order: 2 },
  { id: 'action-required', label: '待處理事項', visible: true, order: 3 },
  { id: 'advanced-analysis', label: '進階分析', visible: true, order: 4 },
];

// 預設篩選條件
export const DEFAULT_FILTERS: DashboardFilters = {
  investor: 'all',
  status: 'all',
  constructionStatus: 'all',
};

// 預設設定
export const DEFAULT_SETTINGS: DashboardSettings = {
  sections: DEFAULT_SECTIONS,
  defaultFilters: DEFAULT_FILTERS,
};

export function useDashboardSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 取得使用者的儀表板設定
  const { data: settings, isLoading } = useQuery({
    queryKey: ['dashboard-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_SETTINGS;

      // 使用 RPC 或直接查詢，繞過型別檢查
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch dashboard settings:', error);
        return DEFAULT_SETTINGS;
      }

      // 從 data 取得 dashboard_settings (繞過 TypeScript 檢查)
      const dashboardSettings = (data as any)?.dashboard_settings;
      if (!dashboardSettings) {
        return DEFAULT_SETTINGS;
      }

      // 合併預設設定與使用者設定，確保新增的區塊也會出現
      const userSettings = dashboardSettings as DashboardSettings;
      const mergedSections = DEFAULT_SECTIONS.map(defaultSection => {
        const userSection = userSettings.sections?.find(s => s.id === defaultSection.id);
        return userSection || defaultSection;
      });

      return {
        sections: mergedSections.sort((a, b) => a.order - b.order),
        defaultFilters: userSettings.defaultFilters || DEFAULT_FILTERS,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 分鐘快取
  });

  // 儲存設定
  const saveMutation = useMutation({
    mutationFn: async (newSettings: DashboardSettings) => {
      if (!user?.id) throw new Error('User not authenticated');

      // 先檢查是否存在記錄
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // 更新現有記錄
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({ dashboard_settings: newSettings } as any)
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      } else {
        // 建立新記錄
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            dashboard_settings: newSettings as any,
          } as any);
        if (insertError) throw insertError;
      }

      return newSettings;
    },
    onSuccess: (newSettings) => {
      queryClient.setQueryData(['dashboard-settings', user?.id], newSettings);
      toast.success('儀表板設定已儲存');
    },
    onError: (error) => {
      console.error('Failed to save dashboard settings:', error);
      toast.error('儲存設定失敗');
    },
  });

  // 更新區塊可見性
  const toggleSectionVisibility = useCallback((sectionId: string) => {
    const currentSettings = settings || DEFAULT_SETTINGS;
    const newSections = currentSettings.sections.map(section =>
      section.id === sectionId
        ? { ...section, visible: !section.visible }
        : section
    );
    saveMutation.mutate({
      ...currentSettings,
      sections: newSections,
    });
  }, [settings, saveMutation]);

  // 更新區塊順序
  const reorderSections = useCallback((newOrder: DashboardSection[]) => {
    const currentSettings = settings || DEFAULT_SETTINGS;
    const reorderedSections = newOrder.map((section, index) => ({
      ...section,
      order: index,
    }));
    saveMutation.mutate({
      ...currentSettings,
      sections: reorderedSections,
    });
  }, [settings, saveMutation]);

  // 更新預設篩選條件
  const updateDefaultFilters = useCallback((filters: DashboardFilters) => {
    const currentSettings = settings || DEFAULT_SETTINGS;
    saveMutation.mutate({
      ...currentSettings,
      defaultFilters: filters,
    });
  }, [settings, saveMutation]);

  // 重設為預設值
  const resetToDefaults = useCallback(() => {
    saveMutation.mutate(DEFAULT_SETTINGS);
  }, [saveMutation]);

  return {
    settings: settings || DEFAULT_SETTINGS,
    isLoading,
    isSaving: saveMutation.isPending,
    toggleSectionVisibility,
    reorderSections,
    updateDefaultFilters,
    resetToDefaults,
  };
}
