import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeadlineReminder {
  id: string;
  project_id: string;
  project_name: string;
  project_code: string | null;
  investor_code: string | null;
  consent_issued_at: string;
  reminder_type: 'electrical_cert' | 'tpc_contract';
  deadline: string;
  days_remaining: number;
  is_overdue: boolean;
}

/**
 * Hook to fetch deadline reminders for projects that have received MOEA consent
 * 
 * Rules:
 * 1. After receiving 同意備案 (MOEA_CONSENT):
 *    - Must submit electrical engineer certification within 14 days
 *    - Must complete TPC contract (躉購合約) within 60 days
 */
export function useDeadlineReminders() {
  return useQuery({
    queryKey: ['deadline-reminders'],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Find projects with MOEA_CONSENT but without TPC_CONTRACT
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_name,
          project_code,
          status,
          approval_date,
          investors (
            investor_code
          )
        `)
        .eq('is_deleted', false)
        .not('status', 'in', '("暫停","取消","已結案","運維中")');

      if (error) throw error;
      if (!projects || projects.length === 0) return [];

      const projectIds = projects.map(p => p.id);

      // Get MOEA_CONSENT documents with issued_at
      const { data: consentDocs, error: consentError } = await supabase
        .from('documents')
        .select('project_id, issued_at')
        .in('project_id', projectIds)
        .eq('doc_type_code', 'MOEA_CONSENT')
        .eq('is_deleted', false)
        .not('issued_at', 'is', null);

      if (consentError) throw consentError;

      // Get TPC_CONTRACT documents with issued_at (completed)
      const { data: contractDocs, error: contractError } = await supabase
        .from('documents')
        .select('project_id, issued_at')
        .in('project_id', projectIds)
        .eq('doc_type_code', 'TPC_CONTRACT')
        .eq('is_deleted', false)
        .not('issued_at', 'is', null);

      if (contractError) throw contractError;

      // Create sets for quick lookup
      const consentMap = new Map<string, string>();
      consentDocs?.forEach(doc => {
        consentMap.set(doc.project_id, doc.issued_at);
      });

      const completedContractIds = new Set(contractDocs?.map(doc => doc.project_id) || []);

      const reminders: DeadlineReminder[] = [];

      projects.forEach(project => {
        const consentDate = consentMap.get(project.id);
        if (!consentDate) return; // No consent yet
        if (completedContractIds.has(project.id)) return; // Already completed

        const consentDateObj = new Date(consentDate);
        const investors = project.investors as { investor_code: string } | null;

        // Reminder 1: Electrical cert submission (14 days from consent)
        const electricalDeadline = new Date(consentDateObj);
        electricalDeadline.setDate(electricalDeadline.getDate() + 14);
        const electricalDaysRemaining = Math.ceil(
          (electricalDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Only show if within 21 days of deadline (7 days buffer for overdue)
        if (electricalDaysRemaining >= -7 && electricalDaysRemaining <= 14) {
          reminders.push({
            id: `${project.id}-electrical`,
            project_id: project.id,
            project_name: project.project_name,
            project_code: project.project_code,
            investor_code: investors?.investor_code || null,
            consent_issued_at: consentDate,
            reminder_type: 'electrical_cert',
            deadline: electricalDeadline.toISOString().split('T')[0],
            days_remaining: electricalDaysRemaining,
            is_overdue: electricalDaysRemaining < 0,
          });
        }

        // Reminder 2: TPC contract completion (60 days from consent)
        const contractDeadline = new Date(consentDateObj);
        contractDeadline.setDate(contractDeadline.getDate() + 60);
        const contractDaysRemaining = Math.ceil(
          (contractDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Only show if within 67 days of deadline (7 days buffer for overdue)
        if (contractDaysRemaining >= -7 && contractDaysRemaining <= 30) {
          reminders.push({
            id: `${project.id}-contract`,
            project_id: project.id,
            project_name: project.project_name,
            project_code: project.project_code,
            investor_code: investors?.investor_code || null,
            consent_issued_at: consentDate,
            reminder_type: 'tpc_contract',
            deadline: contractDeadline.toISOString().split('T')[0],
            days_remaining: contractDaysRemaining,
            is_overdue: contractDaysRemaining < 0,
          });
        }
      });

      // Sort: overdue first, then by days remaining
      reminders.sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) {
          return a.is_overdue ? -1 : 1;
        }
        return a.days_remaining - b.days_remaining;
      });

      return reminders;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
