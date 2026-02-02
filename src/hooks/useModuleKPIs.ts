import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Sales Module KPIs
export function useSalesKPIs() {
  return useQuery({
    queryKey: ['sales-kpis'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get quotes data
      const { data: quotes } = await supabase
        .from('project_quotes')
        .select('id, quote_status, created_at, project_id');

      // Get projects in development stage
      const { data: projects } = await supabase
        .from('project_analytics_view')
        .select('project_id, current_project_status');

      // Calculate KPIs
      const pendingQuotes = quotes?.filter(q => q.quote_status === 'draft')?.length || 0;
      const inProgressQuotes = quotes?.filter(q => q.quote_status === 'sent' || q.quote_status === 'pending')?.length || 0;
      const closedThisMonth = quotes?.filter(q => {
        return q.quote_status === 'accepted' && new Date(q.created_at) >= startOfMonth;
      })?.length || 0;
      
      const totalQuotes = quotes?.length || 0;
      const acceptedQuotes = quotes?.filter(q => q.quote_status === 'accepted')?.length || 0;
      const conversionRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

      // Fallback to project data if no quotes
      const developingProjects = projects?.filter(p => p.current_project_status === '開發中')?.length || 0;

      return {
        pendingQuotes: pendingQuotes || developingProjects,
        inProgressQuotes,
        closedThisMonth,
        conversionRate,
        totalQuotes,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Execution Module KPIs
export function useExecutionKPIs() {
  return useQuery({
    queryKey: ['execution-kpis'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get project analytics
      const { data: projects } = await supabase
        .from('project_analytics_view')
        .select('project_id, current_project_status, construction_status, overall_progress_percent, has_risk, created_at, updated_at');

      // Active statuses (in progress)
      const activeStatuses = ['開發中', '台電送件', '台電審查', '同意備案', '設備登記'];
      const activeProjects = projects?.filter(p => activeStatuses.includes(p.current_project_status)) || [];
      const inProgress = activeProjects.length;

      // Completed this month
      const completedThisMonth = projects?.filter(p => 
        p.current_project_status === '已結案' && 
        p.updated_at && 
        new Date(p.updated_at) >= startOfMonth
      )?.length || 0;

      // Overdue warnings (projects with risk in active status)
      const overdueWarnings = activeProjects.filter(p => p.has_risk).length;

      // Get average days calculation from project_issues
      const { data: delays } = await supabase
        .from('project_issues')
        .select('start_date, end_date')
        .eq('issue_type', 'delay')
        .eq('is_resolved', false);

      let avgCycleDays = 0;
      if (delays && delays.length > 0) {
        const totalDays = delays.reduce((sum, d) => {
          if (d.start_date && d.end_date) {
            const days = Math.ceil((new Date(d.end_date).getTime() - new Date(d.start_date).getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }
          return sum;
        }, 0);
        avgCycleDays = Math.round(totalDays / delays.length);
      }

      return {
        inProgress,
        completedThisMonth,
        overdueWarnings,
        avgCycleDays,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Governance Module KPIs
export function useGovernanceKPIs() {
  return useQuery({
    queryKey: ['governance-kpis'],
    queryFn: async () => {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get all documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id, doc_status, is_archived, due_at')
        .eq('is_deleted', false);

      if (!documents) {
        return { pendingReview: 0, approved: 0, dueSoon: 0, archived: 0, total: 0 };
      }

      // Pending review (draft or submitted)
      const pendingReview = documents.filter(d => 
        d.doc_status === 'draft' || d.doc_status === 'submitted' || d.doc_status === 'pending'
      ).length;

      // Approved
      const approved = documents.filter(d => d.doc_status === 'approved' || d.doc_status === 'issued').length;

      // Due soon (within 7 days)
      const dueSoon = documents.filter(d => {
        if (!d.due_at) return false;
        const dueDate = new Date(d.due_at);
        return dueDate <= sevenDaysLater && dueDate >= now && d.doc_status !== 'approved';
      }).length;

      // Archived
      const archived = documents.filter(d => d.is_archived).length;

      return {
        pendingReview,
        approved,
        dueSoon,
        archived,
        total: documents.length,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Finance Module KPIs
export function useFinanceKPIs() {
  return useQuery({
    queryKey: ['finance-kpis'],
    queryFn: async () => {
      // Get projects with capacity for investment calculations
      const { data: projects } = await supabase
        .from('projects')
        .select('id, capacity_kwp, actual_installed_capacity, status')
        .eq('is_deleted', false);

      // Calculate total capacity (using actual if available, else planned)
      const totalCapacity = projects?.reduce((sum, p) => {
        return sum + (p.actual_installed_capacity || p.capacity_kwp || 0);
      }, 0) || 0;

      // Rough investment estimate (假設每 kWp 約 4.5 萬元)
      const avgCostPerKwp = 45000;
      const totalInvestment = totalCapacity * avgCostPerKwp;

      // Average FIT rate estimate (roughly 4.5 NTD/kWh for reference)
      const avgFitRate = 4.5;
      // Annual hours estimate (1100 kWh per kWp per year in Taiwan)
      const annualHoursPerKwp = 1100;
      const expectedAnnualRevenue = totalCapacity * annualHoursPerKwp * avgFitRate;

      // Calculate rough IRR (simplified)
      const avgIRR = totalInvestment > 0 ? Math.round((expectedAnnualRevenue / totalInvestment) * 100 * 10) / 10 : 0;

      // Pending payments (placeholder - would need payment tracking table)
      const pendingPayments = 0;

      return {
        totalInvestment,
        expectedAnnualRevenue,
        avgIRR,
        pendingPayments,
        totalCapacity,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Risk Module KPIs
export function useRiskKPIs() {
  return useQuery({
    queryKey: ['risk-kpis'],
    queryFn: async () => {
      // Get projects with risk
      const { data: projects } = await supabase
        .from('project_analytics_view')
        .select('project_id, has_risk, current_project_status');

      // Exclude cancelled and completed projects for risk count
      const activeProjects = projects?.filter(p => 
        !['已結案', '取消', '運維中'].includes(p.current_project_status)
      ) || [];
      const riskProjects = activeProjects.filter(p => p.has_risk).length;

      // Get issues (disputes)
      const { data: issues } = await supabase
        .from('project_issues')
        .select('id, issue_type, is_resolved, severity');

      const disputes = issues?.filter(i => i.issue_type === 'dispute') || [];
      const ongoingDisputes = disputes.filter(i => !i.is_resolved).length;
      const pendingIssues = issues?.filter(i => !i.is_resolved).length || 0;
      const resolvedIssues = issues?.filter(i => i.is_resolved).length || 0;

      return {
        riskProjects,
        ongoingDisputes,
        pendingIssues,
        resolvedIssues,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Helper function to format numbers
export function formatKPINumber(value: number, suffix?: string): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}億${suffix || ''}`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}萬${suffix || ''}`;
  }
  return `${value.toLocaleString()}${suffix || ''}`;
}
