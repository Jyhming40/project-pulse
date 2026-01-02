import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubfolderConfig {
  code: string;
  folder: string;
}

export interface DriveSettings {
  namingPattern: string;
  subfolders: SubfolderConfig[];
}

// Default subfolders matching the user's existing structure
export const DEFAULT_SUBFOLDERS: SubfolderConfig[] = [
  { code: 'RELATED', folder: '00-相關資料' },
  { code: 'SYSTEM_DIAGRAM', folder: '01-系統圖' },
  { code: 'TPC', folder: '02-台電' },
  { code: 'ENERGY_BUREAU', folder: '03-能源局' },
  { code: 'BUILDING_AUTH', folder: '04-建管單位' },
  { code: 'COMPLETION_MANUAL', folder: '05-完工手冊' },
  { code: 'SITE_PHOTO', folder: '06-現勘照片' },
  { code: 'CONSTRUCTION_PHOTO', folder: '07-施工照片' },
  { code: 'GREEN_PERMISSION', folder: '08-綠能容許' },
  { code: 'OFFICIAL_DOC', folder: '09-公文回函' },
  { code: 'HANDOVER', folder: '業務部轉交工程部資料' },
];

export function useDriveSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['drive-settings'],
    queryFn: async (): Promise<DriveSettings> => {
      try {
        // Read from system_options table with category 'drive_settings'
        const { data, error } = await supabase
          .from('system_options')
          .select('value, label')
          .eq('category', 'drive_settings')
          .eq('is_active', true);

        if (error || !data || data.length === 0) {
          return {
            namingPattern: '{project_code}_{project_name}',
            subfolders: DEFAULT_SUBFOLDERS,
          };
        }

        const settingsMap: Record<string, string> = {};
        for (const s of data) {
          settingsMap[s.value] = s.label;
        }

        let namingPattern = '{project_code}_{project_name}';
        let subfolders = DEFAULT_SUBFOLDERS;

        if (settingsMap['naming_pattern']) {
          namingPattern = settingsMap['naming_pattern'];
        }

        if (settingsMap['subfolders']) {
          try {
            subfolders = JSON.parse(settingsMap['subfolders']);
          } catch {
            console.log('Failed to parse subfolders, using defaults');
          }
        }

        return { namingPattern, subfolders };
      } catch (err) {
        console.log('Failed to fetch drive settings, using defaults');
        return {
          namingPattern: '{project_code}_{project_name}',
          subfolders: DEFAULT_SUBFOLDERS,
        };
      }
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<DriveSettings>) => {
      const updates = [];
      
      if (newSettings.namingPattern !== undefined) {
        // Delete existing and insert new
        await supabase
          .from('system_options')
          .delete()
          .eq('category', 'drive_settings')
          .eq('value', 'naming_pattern');

        updates.push(
          supabase
            .from('system_options')
            .insert({
              category: 'drive_settings',
              value: 'naming_pattern',
              label: newSettings.namingPattern,
              is_active: true,
              sort_order: 0,
            })
        );
      }

      if (newSettings.subfolders !== undefined) {
        await supabase
          .from('system_options')
          .delete()
          .eq('category', 'drive_settings')
          .eq('value', 'subfolders');

        updates.push(
          supabase
            .from('system_options')
            .insert({
              category: 'drive_settings',
              value: 'subfolders',
              label: JSON.stringify(newSettings.subfolders),
              is_active: true,
              sort_order: 1,
            })
        );
      }

      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) throw result.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-settings'] });
      toast.success('Drive 設定已更新');
    },
    onError: (error) => {
      console.error('Failed to update drive settings:', error);
      toast.error('更新設定失敗');
    },
  });

  return {
    settings: settings || {
      namingPattern: '{project_code}_{project_name}',
      subfolders: DEFAULT_SUBFOLDERS,
    },
    isLoading,
    updateSettings,
    DEFAULT_SUBFOLDERS,
  };
}
