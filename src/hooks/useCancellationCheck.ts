import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Milestones that indicate costs have been incurred
const ADMIN_COST_THRESHOLD = 'ADMIN_04_ENERGY_APPROVAL'; // 能源署同意備案
const ENGINEERING_COST_THRESHOLDS = [
  'ENG_03_MATERIAL_ORDER', // 材料採購下單
  'ENG_04_STRUCTURE',       // 鋼構/支架完成
  'ENG_05_MODULE',          // 模組安裝完成
  'ENG_07_INVERTER',        // 逆變器/箱體完成
];

export interface CancellationCheckResult {
  canCancelFreely: boolean;
  hasAdminCost: boolean;
  hasEngineeringCost: boolean;
  adminMilestone: string | null;
  engineeringMilestones: string[];
  warningMessage: string | null;
}

export function useCancellationCheck(projectId: string | undefined) {
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['project-milestones-for-cancel', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_milestones')
        .select('milestone_code, is_completed, completed_at')
        .eq('project_id', projectId)
        .eq('is_completed', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const completedCodes = new Set(milestones.map(m => m.milestone_code));
  
  // Check admin cost threshold
  const hasAdminCost = completedCodes.has(ADMIN_COST_THRESHOLD);
  
  // Check engineering cost thresholds
  const completedEngineeringCosts = ENGINEERING_COST_THRESHOLDS.filter(code => 
    completedCodes.has(code)
  );
  const hasEngineeringCost = completedEngineeringCosts.length > 0;
  
  // Determine warning message
  let warningMessage: string | null = null;
  if (hasAdminCost && hasEngineeringCost) {
    warningMessage = '此案件已取得同意備案且設備已進場，取消將產生行政及工程費用。';
  } else if (hasAdminCost) {
    warningMessage = '此案件已取得同意備案，取消可能產生行政相關費用。';
  } else if (hasEngineeringCost) {
    warningMessage = '此案件設備已進場，取消將產生工程費用。';
  }

  // Map codes to readable names
  const milestoneNames: Record<string, string> = {
    ADMIN_04_ENERGY_APPROVAL: '能源署同意備案',
    ENG_03_MATERIAL_ORDER: '材料採購下單',
    ENG_04_STRUCTURE: '鋼構/支架完成',
    ENG_05_MODULE: '模組安裝完成',
    ENG_07_INVERTER: '逆變器/箱體完成',
  };

  return {
    isLoading,
    canCancelFreely: !hasAdminCost && !hasEngineeringCost,
    hasAdminCost,
    hasEngineeringCost,
    adminMilestone: hasAdminCost ? milestoneNames[ADMIN_COST_THRESHOLD] : null,
    engineeringMilestones: completedEngineeringCosts.map(code => milestoneNames[code] || code),
    warningMessage,
  };
}
