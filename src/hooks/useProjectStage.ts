import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProcessStages } from './useProcessStages';

export interface ProjectCurrentStage {
  stage_id: string;
  stage_code: string;
  stage_name: string;
  stage_phase: string;
  responsible_department_id?: string;
  responsible_department_name?: string;
  consulted_departments?: { id: string; name: string }[];
  milestone_step: number | null;
  sla_days: number | null;
}

/**
 * 根據案件目前的 project.status 對應到 process_stages，
 * 並取得主責部門資訊
 */
export function useProjectStage(projectStatus: string | undefined) {
  const { stages } = useProcessStages();

  // 取得責任矩陣
  const { data: responsibilities = [] } = useQuery({
    queryKey: ['stage-responsibilities-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_responsibilities')
        .select(`
          *,
          responsible_department:departments!stage_responsibilities_responsible_department_id_fkey(id, name, code)
        `);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // 取得所有部門 (for consulted lookup)
  const { data: allDepartments = [] } = useQuery({
    queryKey: ['departments-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // 根據 project.status 找到對應的 process_stage
  const currentStage = stages.find(s => s.name === projectStatus);

  if (!currentStage || !projectStatus) {
    return { currentStage: null, isLoading: false };
  }

  // 找到該階段的責任對應
  const stageResp = responsibilities.find(r => r.stage_id === currentStage.id);
  const responsibleDept = stageResp?.responsible_department as { id: string; name: string; code: string } | null;
  
  // 找到被諮詢的部門
  const consultedDeptIds = stageResp?.consulted_department_ids || [];
  const consultedDepts = allDepartments.filter(d => consultedDeptIds.includes(d.id));

  const result: ProjectCurrentStage = {
    stage_id: currentStage.id,
    stage_code: currentStage.code,
    stage_name: currentStage.name,
    stage_phase: currentStage.phase,
    responsible_department_id: responsibleDept?.id,
    responsible_department_name: responsibleDept?.name,
    consulted_departments: consultedDepts.map(d => ({ id: d.id, name: d.name })),
    milestone_step: currentStage.milestone_step,
    sla_days: currentStage.default_sla_days,
  };

  return { currentStage: result, isLoading: false };
}

/**
 * 取得案件的完整流程進度（所有階段與目前位置）
 */
export function useProjectStageProgress(projectStatus: string | undefined) {
  const { stages } = useProcessStages();

  const currentStageIndex = stages.findIndex(s => s.name === projectStatus);
  
  return {
    stages,
    currentIndex: currentStageIndex,
    progress: currentStageIndex >= 0 ? Math.round(((currentStageIndex + 1) / stages.length) * 100) : 0,
  };
}
