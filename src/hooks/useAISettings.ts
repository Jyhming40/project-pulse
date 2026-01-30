import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AISettings {
  id: string;
  setting_key: string;
  setting_value: string | null;
  is_enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchAISettings(): Promise<AISettings[]> {
  // Using type assertion to work with a table not in generated types
  const client = supabase as any;
  const { data, error } = await client
    .from('ai_settings')
    .select('*')
    .order('setting_key');
  
  if (error) throw error;
  return (data as AISettings[]) || [];
}

async function updateAISetting({ 
  settingKey, 
  value, 
  isEnabled 
}: { 
  settingKey: string; 
  value?: string | null; 
  isEnabled?: boolean;
}): Promise<void> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (value !== undefined) {
    updateData.setting_value = value;
  }
  if (isEnabled !== undefined) {
    updateData.is_enabled = isEnabled;
  }
  
  const client = supabase as any;
  const { error } = await client
    .from('ai_settings')
    .update(updateData)
    .eq('setting_key', settingKey);
  
  if (error) throw error;
}

export function useAISettings() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading, error } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: fetchAISettings,
  });

  const updateSettingMutation = useMutation({
    mutationFn: updateAISetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success('設定已儲存');
    },
    onError: (error: Error) => {
      console.error('Failed to update AI setting:', error);
      toast.error('儲存失敗：' + error.message);
    },
  });

  const geminiKey = settings.find(s => s.setting_key === 'gemini_api_key');
  const openaiKey = settings.find(s => s.setting_key === 'openai_api_key');
  const defaultProvider = settings.find(s => s.setting_key === 'default_ai_provider');

  return {
    settings,
    isLoading,
    error,
    geminiKey,
    openaiKey,
    defaultProvider,
    updateSetting: updateSettingMutation.mutate,
    isUpdating: updateSettingMutation.isPending,
  };
}
