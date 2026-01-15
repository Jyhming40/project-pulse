import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// 共用查詢：取得所有專案（含投資方）
export function useAuditProjects() {
  return useQuery({
    queryKey: ['audit-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(id, company_name, investor_code)')
        .eq('is_deleted', false);
      if (error) throw error;
      return data;
    },
  });
}

// 共用查詢：取得 project_analytics_view 資料
export function useAuditAnalyticsView() {
  return useQuery({
    queryKey: ['audit-analytics-view'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_analytics_view?select=*`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch analytics view');
      return await response.json();
    },
  });
}

// 共用查詢：取得付款資料
export function useAuditPayments() {
  return useQuery({
    queryKey: ['audit-payments'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments?select=*,projects(id,project_code,project_name,is_deleted)`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch payments');
      return await response.json();
    },
  });
}

// 指標定義類型
export interface MetricDefinition {
  id: string;
  name: string;
  category: string;
  definition: string;
  dataSource: string;
  condition: string;
  value: number | string;
  details: Array<{
    id: string;
    project_code?: string;
    project_name?: string;
    status?: string;
    construction_status?: string;
    key_date?: string;
    key_value?: string | number;
  }>;
}

// 計算所有指標
export function useAuditMetrics() {
  const { data: projects = [], isLoading: projectsLoading } = useAuditProjects();
  const { data: analyticsView = [], isLoading: analyticsLoading } = useAuditAnalyticsView();
  const { data: payments = [], isLoading: paymentsLoading } = useAuditPayments();

  const metrics = useMemo<MetricDefinition[]>(() => {
    if (projectsLoading || analyticsLoading || paymentsLoading) return [];

    const now = new Date();
    const result: MetricDefinition[] = [];

    // ========== HealthKPICards ==========
    // 1. 總案場數
    result.push({
      id: 'total-projects',
      name: '總案場數',
      category: 'HealthKPICards',
      definition: '從 project_analytics_view 取得所有記錄的數量（view 已排除 is_deleted）',
      dataSource: 'project_analytics_view',
      condition: '無額外條件',
      value: analyticsView.length,
      details: analyticsView.map((p: any) => ({
        id: p.project_id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.current_project_status,
      })),
    });

    // 2. 風險案場（排除暫停/取消）
    const activeAnalytics = analyticsView.filter((p: any) => 
      !['暫停', '取消'].includes(p.current_project_status)
    );
    const riskProjects = activeAnalytics.filter((p: any) => p.has_risk === true);
    result.push({
      id: 'at-risk-count',
      name: '風險案場',
      category: 'HealthKPICards',
      definition: '從 project_analytics_view 取得 has_risk=true 且 status 不為「暫停」「取消」的記錄數',
      dataSource: 'project_analytics_view',
      condition: 'has_risk=true AND current_project_status NOT IN (暫停, 取消)',
      value: riskProjects.length,
      details: riskProjects.map((p: any) => ({
        id: p.project_id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.current_project_status,
        key_value: p.risk_reasons?.join(', ') || '無',
      })),
    });

    // 3. 待補件
    const pendingFixProjects = projects.filter((p: any) => p.status === '台電審查');
    result.push({
      id: 'pending-fix-count',
      name: '待補件',
      category: 'HealthKPICards',
      definition: '從 projects 表取得 status="台電審查" 且 is_deleted=false 的記錄數',
      dataSource: 'projects',
      condition: "status='台電審查' AND is_deleted=false",
      value: pendingFixProjects.length,
      details: pendingFixProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        key_date: p.updated_at,
      })),
    });

    // 4. 平均進度
    const avgProgress = activeAnalytics.length > 0
      ? activeAnalytics.reduce((sum: number, p: any) => sum + (p.overall_progress_percent || 0), 0) / activeAnalytics.length
      : 0;
    result.push({
      id: 'average-progress',
      name: '平均進度',
      category: 'HealthKPICards',
      definition: '從 project_analytics_view 計算 overall_progress_percent 的平均值（排除暫停/取消）',
      dataSource: 'project_analytics_view',
      condition: 'current_project_status NOT IN (暫停, 取消)',
      value: `${Math.round(avgProgress * 10) / 10}%`,
      details: activeAnalytics.map((p: any) => ({
        id: p.project_id,
        project_code: p.project_code,
        project_name: p.project_name,
        key_value: `${p.overall_progress_percent}%`,
      })),
    });

    // ========== ActionRequiredSection ==========
    // 5. 超時未更新（14天）
    const stuckThresholdDays = 14;
    const thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() - stuckThresholdDays);
    
    const stuckProjects = projects.filter((p: any) => {
      if (['暫停', '取消', '運維中'].includes(p.status)) return false;
      const updatedAt = new Date(p.updated_at);
      return updatedAt < thresholdDate;
    }).map((p: any) => ({
      ...p,
      daysStuck: Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    }));

    result.push({
      id: 'stuck-projects',
      name: '超時未更新',
      category: 'ActionRequiredSection',
      definition: `從 projects 表取得 updated_at < (now - ${stuckThresholdDays} days) 且 status 不為「暫停」「取消」「運維中」的記錄`,
      dataSource: 'projects',
      condition: `updated_at < ${thresholdDate.toISOString().split('T')[0]} AND status NOT IN (暫停, 取消, 運維中)`,
      value: stuckProjects.length,
      details: stuckProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        key_date: p.updated_at,
        key_value: `${p.daysStuck} 天`,
      })),
    });

    // ========== PhaseOverviewSection ==========
    const PHASE1_STATUSES = ['開發中', '土地確認', '結構簽證', '台電送件', '台電審查', '能源署送件', '無饋線'];
    const PHASE2_STATUSES = ['同意備案', '工程施工', '報竣掛表', '設備登記', '運維中'];
    const INACTIVE_STATUSES = ['暫停', '取消'];

    const activeProjects = projects.filter((p: any) => !INACTIVE_STATUSES.includes(p.status));
    const phase1Projects = activeProjects.filter((p: any) => PHASE1_STATUSES.includes(p.status));
    const phase2Projects = activeProjects.filter((p: any) => PHASE2_STATUSES.includes(p.status));

    // 6. Phase 1 總數
    result.push({
      id: 'phase1-total',
      name: 'Phase 1 總數',
      category: 'PhaseOverviewSection',
      definition: '從 projects 表取得 status 在 Phase 1 狀態清單中的記錄數',
      dataSource: 'projects',
      condition: `status IN (${PHASE1_STATUSES.join(', ')}) AND status NOT IN (${INACTIVE_STATUSES.join(', ')})`,
      value: phase1Projects.length,
      details: phase1Projects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
      })),
    });

    // 7. Phase 2 總數
    result.push({
      id: 'phase2-total',
      name: 'Phase 2 總數',
      category: 'PhaseOverviewSection',
      definition: '從 projects 表取得 status 在 Phase 2 狀態清單中的記錄數',
      dataSource: 'projects',
      condition: `status IN (${PHASE2_STATUSES.join(', ')})`,
      value: phase2Projects.length,
      details: phase2Projects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
      })),
    });

    // 8. 暫停案場
    const pausedProjects = projects.filter((p: any) => p.status === '暫停');
    result.push({
      id: 'paused-projects',
      name: '暫停案場',
      category: 'PhaseOverviewSection',
      definition: '從 projects 表取得 status="暫停" 的記錄數',
      dataSource: 'projects',
      condition: "status='暫停'",
      value: pausedProjects.length,
      details: pausedProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
      })),
    });

    // ========== AdministrativeSection ==========
    // 9. 送審中
    const submittingProjects = activeProjects.filter((p: any) => 
      ['台電送件', '能源署送件'].includes(p.status)
    );
    result.push({
      id: 'admin-submitting',
      name: '送審中',
      category: 'AdministrativeSection',
      definition: '從 projects 表取得 status 為「台電送件」或「能源署送件」的記錄數',
      dataSource: 'projects',
      condition: "status IN ('台電送件', '能源署送件') AND status NOT IN ('暫停', '取消')",
      value: submittingProjects.length,
      details: submittingProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
      })),
    });

    // 10. 已備案
    const approvedProjects = projects.filter((p: any) => p.status === '同意備案');
    result.push({
      id: 'admin-approved',
      name: '已備案',
      category: 'AdministrativeSection',
      definition: '從 projects 表取得 status="同意備案" 的記錄數',
      dataSource: 'projects',
      condition: "status='同意備案'",
      value: approvedProjects.length,
      details: approvedProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
      })),
    });

    // ========== EngineeringSection ==========
    // 11. 尚未開工
    const notStartedProjects = activeProjects.filter((p: any) => 
      p.construction_status === '尚未開工' || !p.construction_status
    );
    result.push({
      id: 'eng-not-started',
      name: '尚未開工',
      category: 'EngineeringSection',
      definition: '從 projects 表取得 construction_status="尚未開工" 或 NULL 的記錄數',
      dataSource: 'projects',
      condition: "construction_status='尚未開工' OR construction_status IS NULL",
      value: notStartedProjects.length,
      details: notStartedProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        construction_status: p.construction_status || '(NULL)',
      })),
    });

    // 12. 已開工
    const startedProjects = activeProjects.filter((p: any) => p.construction_status === '已開工');
    result.push({
      id: 'eng-started',
      name: '已開工',
      category: 'EngineeringSection',
      definition: '從 projects 表取得 construction_status="已開工" 的記錄數',
      dataSource: 'projects',
      condition: "construction_status='已開工'",
      value: startedProjects.length,
      details: startedProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        construction_status: p.construction_status,
      })),
    });

    // 13. 已掛錶
    const completedProjects = activeProjects.filter((p: any) => p.construction_status === '已掛錶');
    result.push({
      id: 'eng-completed',
      name: '已掛錶',
      category: 'EngineeringSection',
      definition: '從 projects 表取得 construction_status="已掛錶" 的記錄數',
      dataSource: 'projects',
      condition: "construction_status='已掛錶'",
      value: completedProjects.length,
      details: completedProjects.map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        construction_status: p.construction_status,
      })),
    });

    // ========== Financial ==========
    // 14. 待請款金額
    const pendingPayments = payments.filter((p: any) => p.payment_status === 'pending');
    const pendingAmount = pendingPayments.reduce((sum: number, p: any) => sum + (p.contract_amount || 0), 0);
    result.push({
      id: 'fin-pending-amount',
      name: '待請款金額',
      category: 'Phase2TracksSection (Financial)',
      definition: '從 project_payments 表取得 payment_status="pending" 的 contract_amount 總和',
      dataSource: 'project_payments',
      condition: "payment_status='pending'",
      value: `${(pendingAmount / 10000).toFixed(0)} 萬`,
      details: pendingPayments.map((p: any) => ({
        id: p.id,
        project_code: p.projects?.project_code,
        project_name: p.projects?.project_name,
        key_value: `${(p.contract_amount || 0).toLocaleString()} (${p.payment_code})`,
      })),
    });

    // 15. 已收款金額
    const paidPayments = payments.filter((p: any) => p.payment_status === 'paid');
    const paidAmount = paidPayments.reduce((sum: number, p: any) => sum + (p.paid_amount || 0), 0);
    result.push({
      id: 'fin-paid-amount',
      name: '已收款金額',
      category: 'Phase2TracksSection (Financial)',
      definition: '從 project_payments 表取得 payment_status="paid" 的 paid_amount 總和',
      dataSource: 'project_payments',
      condition: "payment_status='paid'",
      value: `${(paidAmount / 10000).toFixed(0)} 萬`,
      details: paidPayments.map((p: any) => ({
        id: p.id,
        project_code: p.projects?.project_code,
        project_name: p.projects?.project_name,
        key_value: `${(p.paid_amount || 0).toLocaleString()} (${p.payment_code})`,
      })),
    });

    // ========== StatusDistribution ==========
    // 16. 案場狀態分佈
    const statusDistribution: Record<string, number> = {};
    analyticsView.forEach((p: any) => {
      statusDistribution[p.current_project_status] = (statusDistribution[p.current_project_status] || 0) + 1;
    });
    result.push({
      id: 'status-distribution',
      name: '案場狀態分佈',
      category: 'StatusDistributionChart',
      definition: '從 project_analytics_view 按 current_project_status 分組計數',
      dataSource: 'project_analytics_view',
      condition: 'GROUP BY current_project_status',
      value: Object.entries(statusDistribution).map(([k, v]) => `${k}: ${v}`).join(', '),
      details: Object.entries(statusDistribution).flatMap(([status, count]) => 
        analyticsView
          .filter((p: any) => p.current_project_status === status)
          .map((p: any) => ({
            id: p.project_id,
            project_code: p.project_code,
            project_name: p.project_name,
            status: status,
            key_value: count,
          }))
      ),
    });

    return result;
  }, [projects, analyticsView, payments, projectsLoading, analyticsLoading, paymentsLoading]);

  return {
    metrics,
    isLoading: projectsLoading || analyticsLoading || paymentsLoading,
  };
}
