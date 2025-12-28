import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface AppSettings {
  id: string;
  system_name_zh: string;
  system_name_en: string | null;
  company_name_zh: string | null;
  company_name_en: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export type AppSettingsUpdate = Partial<Omit<AppSettings, 'id' | 'created_at' | 'updated_at'>>;

// Convert HEX to HSL values
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Apply primary color to CSS variables
function applyPrimaryColor(hexColor: string | null) {
  if (!hexColor) {
    // Reset to default
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--ring');
    document.documentElement.style.removeProperty('--sidebar-primary');
    document.documentElement.style.removeProperty('--sidebar-ring');
    return;
  }

  const hsl = hexToHsl(hexColor);
  if (!hsl) return;

  const hslValue = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  document.documentElement.style.setProperty('--primary', hslValue);
  document.documentElement.style.setProperty('--ring', hslValue);
  document.documentElement.style.setProperty('--sidebar-primary', hslValue);
  document.documentElement.style.setProperty('--sidebar-ring', hslValue);
}

export function useAppSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      // Using any to bypass type check since app_settings is new
      const { data, error } = await (supabase as any)
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as AppSettings | null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in garbage collection for 30 minutes
  });

  // Apply primary color when settings change
  useEffect(() => {
    if (settings?.primary_color) {
      applyPrimaryColor(settings.primary_color);
    }
  }, [settings?.primary_color]);

  const updateMutation = useMutation({
    mutationFn: async (updates: AppSettingsUpdate) => {
      if (!settings?.id) throw new Error('No settings found');

      const { data, error } = await (supabase as any)
        .from('app_settings')
        .update({
          ...updates,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;

      // Log to audit - use UPDATE since BRANDING_UPDATE may not be in types yet
      try {
        await supabase.rpc('log_audit_action', {
          p_table_name: 'app_settings',
          p_record_id: settings.id,
          p_action: 'UPDATE' as any,
          p_old_data: settings as any,
          p_new_data: data as any,
          p_reason: 'Branding settings update',
        });
      } catch (auditError) {
        console.warn('Audit log failed:', auditError);
      }

      return data as AppSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data);
      toast.success('品牌設定已更新');
    },
    onError: (error) => {
      console.error('Failed to update settings:', error);
      toast.error('更新失敗');
    },
  });

  // Upload file to branding bucket
  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('branding')
        .upload(path, file, { upsert: true });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('branding')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('檔案上傳失敗');
      return null;
    }
  };

  // Delete file from branding bucket
  const deleteFile = async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('branding')
        .remove([path]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      return false;
    }
  };

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    uploadFile,
    deleteFile,
  };
}

// Simple hook for read-only access (for Layout, etc.)
export function useAppSettingsRead() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as AppSettings | null;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // Apply primary color when settings load
  useEffect(() => {
    if (settings?.primary_color) {
      applyPrimaryColor(settings.primary_color);
    }
  }, [settings?.primary_color]);

  return { settings, isLoading };
}
