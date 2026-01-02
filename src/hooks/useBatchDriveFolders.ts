import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
}

interface BatchResult {
  projectId: string;
  projectCode: string;
  projectName: string;
  success: boolean;
  skipped: boolean;
  error?: string;
  folderId?: string;
  folderUrl?: string;
}

interface BatchProgress {
  total: number;
  completed: number;
  current: string;
  results: BatchResult[];
}

export function useBatchDriveFolders() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  const createFoldersForProjects = useCallback(async (projectIds: string[]) => {
    if (projectIds.length === 0) {
      toast.error('請選擇要建立資料夾的案場');
      return;
    }

    setIsRunning(true);
    setProgress({
      total: projectIds.length,
      completed: 0,
      current: '',
      results: [],
    });

    const results: BatchResult[] = [];

    for (let i = 0; i < projectIds.length; i++) {
      const projectId = projectIds[i];

      // Fetch project info for display
      const { data: project } = await supabase
        .from('projects')
        .select('id, project_code, project_name, drive_folder_id, drive_folder_url')
        .eq('id', projectId)
        .single();

      if (!project) {
        results.push({
          projectId,
          projectCode: 'Unknown',
          projectName: 'Unknown',
          success: false,
          skipped: false,
          error: '找不到案場資料',
        });
        continue;
      }

      setProgress(prev => ({
        ...prev!,
        current: `${project.project_code} - ${project.project_name}`,
      }));

      try {
        const { data, error } = await supabase.functions.invoke('create-drive-folder', {
          body: { projectId },
        });

        if (error) {
          results.push({
            projectId,
            projectCode: project.project_code,
            projectName: project.project_name,
            success: false,
            skipped: false,
            error: error.message,
          });
        } else if (data.skipped) {
          results.push({
            projectId,
            projectCode: project.project_code,
            projectName: project.project_name,
            success: true,
            skipped: true,
            folderId: data.folderId,
          });
        } else {
          results.push({
            projectId,
            projectCode: project.project_code,
            projectName: project.project_name,
            success: true,
            skipped: false,
            folderId: data.folderId,
            folderUrl: data.folderUrl,
          });
        }
      } catch (err) {
        const error = err as Error;
        results.push({
          projectId,
          projectCode: project.project_code,
          projectName: project.project_name,
          success: false,
          skipped: false,
          error: error.message || '未知錯誤',
        });
      }

      setProgress(prev => ({
        ...prev!,
        completed: i + 1,
        results: [...results],
      }));

      // Small delay to avoid rate limiting
      if (i < projectIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);

    // Summary toast
    const created = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;

    if (failed === 0) {
      toast.success(`完成！建立 ${created} 個資料夾，跳過 ${skipped} 個`);
    } else {
      toast.warning(`完成：建立 ${created} 個，跳過 ${skipped} 個，失敗 ${failed} 個`);
    }

    return results;
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    isRunning,
    progress,
    createFoldersForProjects,
    resetProgress,
  };
}
