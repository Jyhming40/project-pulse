import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Aggregated data for presentation
export function usePresentationData() {
  return useQuery({
    queryKey: ['presentation-data'],
    queryFn: async () => {
      // Fetch projects (expanded fields for milestones)
      const { data: projects = [] } = await (supabase as any)
        .from('projects')
        .select('id, project_name, project_code, capacity_kwp, actual_installed_capacity, status, installation_type, city, district, intake_year, fiscal_year, overall_progress, admin_progress, investor_id, is_deleted, created_at, initial_survey_date, contract_signed_at, construction_start_date, actual_meter_date, construction_status')
        .eq('is_deleted', false);

      // Fetch investors
      const { data: investors = [] } = await supabase
        .from('investors')
        .select('id, company_name, investor_code')
        .eq('is_deleted', false);

      // Fetch quotes
      const { data: quotes = [] } = await supabase
        .from('project_quotes')
        .select('id, quote_number, quote_status, total_price_with_tax, capacity_kwp, project_id, created_at');

      // Fetch documents (aggregated stats)
      const { data: documents = [] } = await supabase
        .from('documents')
        .select('id, project_id, doc_status, doc_type, is_deleted')
        .eq('is_deleted', false);

      // Fetch EPC financial metrics
      const { data: epcMetrics = [] } = await (supabase as any)
        .from('project_epc_financial_metrics')
        .select('project_id, contract_amount, direct_cost, gross_profit, gross_margin_rate, net_expected_profit');

      // Fetch payments
      const { data: payments = [] } = await supabase
        .from('project_payments')
        .select('project_id, payment_status, invoiced_amount, paid_amount');

      // Fetch departments
      const { data: departments = [] } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('is_active', true);

      // Fetch project issues
      const { data: issues = [] } = await supabase
        .from('project_issues')
        .select('id, project_id, is_resolved, severity, created_at');

      // Type distribution
      const typeDistribution: Record<string, number> = {};
      projects.forEach(p => {
        const t = p.installation_type || '未設定';
        typeDistribution[t] = (typeDistribution[t] || 0) + 1;
      });

      // Region distribution
      const regionDistribution: Record<string, number> = {};
      projects.forEach(p => {
        const c = p.city || '未設定';
        regionDistribution[c] = (regionDistribution[c] || 0) + 1;
      });

      // Yearly trend
      const yearlyTrend: Record<number, { applied: number; closed: number }> = {};
      projects.forEach(p => {
        const y = p.intake_year || p.fiscal_year;
        if (!y) return;
        if (!yearlyTrend[y]) yearlyTrend[y] = { applied: 0, closed: 0 };
        yearlyTrend[y].applied += 1;
        if (p.status && !['取消', '暫停'].includes(p.status)) {
          yearlyTrend[y].closed += 1;
        }
      });

      // Capacity distribution
      const capacityDistribution: Record<string, number> = {
        '<100kWp': 0, '100-200': 0, '200-300': 0, '300-400': 0, '400-500': 0, '500kWp+': 0,
      };
      projects.forEach(p => {
        const c = p.capacity_kwp || 0;
        if (c < 100) capacityDistribution['<100kWp']++;
        else if (c < 200) capacityDistribution['100-200']++;
        else if (c < 300) capacityDistribution['200-300']++;
        else if (c < 400) capacityDistribution['300-400']++;
        else if (c < 500) capacityDistribution['400-500']++;
        else capacityDistribution['500kWp+']++;
      });

      // Quote stats
      const totalQuotes = quotes.length;
      const acceptedQuotes = quotes.filter(q => q.quote_status === 'accepted').length;
      const conversionRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const closedThisMonth = quotes.filter(q =>
        q.quote_status === 'accepted' && new Date(q.created_at) >= startOfMonth
      ).length;

      // Capacity breakdown by status category
      const closedStatuses = ['已結案', '運維中'];
      const excludedStatuses = ['取消', '暫停'];

      const closedProjects = projects.filter(p => closedStatuses.includes(p.status || ''));
      const inProgressProjects = projects.filter(p => !closedStatuses.includes(p.status || '') && !excludedStatuses.includes(p.status || ''));
      const cancelledProjects = projects.filter(p => excludedStatuses.includes(p.status || ''));

      const completedCapacity = closedProjects.reduce((s, p) => s + (p.actual_installed_capacity || p.capacity_kwp || 0), 0);
      const inProgressCapacity = inProgressProjects.reduce((s, p) => s + (p.capacity_kwp || 0), 0);
      const totalAppliedCapacity = projects.reduce((s, p) => s + (p.capacity_kwp || 0), 0);

      const activeProjects = projects.filter(p => !excludedStatuses.includes(p.status || ''));
      const avgProgress = activeProjects.length > 0
        ? Math.round(activeProjects.reduce((s, p) => s + (p.overall_progress || 0), 0) / activeProjects.length)
        : 0;
      const riskCount = activeProjects.filter(p => {
        const age = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
        return age > 180 && (p.overall_progress || 0) < 25;
      }).length;

      const projectConversionRate = projects.length > 0
        ? Math.round((closedProjects.length / projects.length) * 100)
        : 0;

      // === Financial summary ===
      const totalContractAmount = epcMetrics.reduce((s: number, m: any) => s + (m.contract_amount || 0), 0);
      const totalDirectCost = epcMetrics.reduce((s: number, m: any) => s + (m.direct_cost || 0), 0);
      const totalGrossProfit = epcMetrics.reduce((s: number, m: any) => s + (m.gross_profit || 0), 0);
      const avgGrossMargin = epcMetrics.length > 0
        ? Math.round(epcMetrics.reduce((s: number, m: any) => s + (m.gross_margin_rate || 0), 0) / epcMetrics.length * 10) / 10
        : 0;

      const totalInvoiced = payments.reduce((s: number, p: any) => s + (p.invoiced_amount || 0), 0);
      const totalPaid = payments.reduce((s: number, p: any) => s + (p.paid_amount || 0), 0);
      const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

      // Per-kW average price from quotes
      const quotesWithCap = quotes.filter(q => q.capacity_kwp && q.capacity_kwp > 0 && q.total_price_with_tax);
      const avgPricePerKw = quotesWithCap.length > 0
        ? Math.round(quotesWithCap.reduce((s, q) => s + (q.total_price_with_tax || 0) / q.capacity_kwp!, 0) / quotesWithCap.length)
        : 0;

      // === Document progress ===
      const totalDocs = documents.length;
      const completedDocs = documents.filter(d => d.doc_status === '已核准' || d.doc_status === '已發文').length;
      const docCompletionRate = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

      // Doc status distribution
      const docStatusDist: Record<string, number> = {};
      documents.forEach(d => {
        const s = d.doc_status || '未知';
        docStatusDist[s] = (docStatusDist[s] || 0) + 1;
      });

      // === Department performance (based on project_stages ownership) ===
      const deptProjectMap: Record<string, Set<string>> = {};
      // We don't have department_id on projects, so we'll just provide department list
      const deptStats: Record<string, { name: string; projectCount: number; totalCapacity: number; completedCount: number }> = {};
      departments.forEach(d => {
        deptStats[d.id] = {
          name: d.name,
          projectCount: 0,
          totalCapacity: 0,
          completedCount: 0,
        };
      });

      // === Milestone timeline stats ===
      const milestoneDurations = {
        surveyToContract: [] as number[],
        contractToMeter: [] as number[],
        constructionToMeter: [] as number[],
      };
      activeProjects.forEach(p => {
        const survey = p.initial_survey_date ? new Date(p.initial_survey_date).getTime() : null;
        const contract = p.contract_signed_at ? new Date(p.contract_signed_at).getTime() : null;
        const conStart = p.construction_start_date ? new Date(p.construction_start_date).getTime() : null;
        const meter = p.actual_meter_date ? new Date(p.actual_meter_date).getTime() : null;
        const DAY = 1000 * 60 * 60 * 24;

        if (survey && contract) milestoneDurations.surveyToContract.push(Math.round((contract - survey) / DAY));
        if (contract && meter) milestoneDurations.contractToMeter.push(Math.round((meter - contract) / DAY));
        if (conStart && meter) milestoneDurations.constructionToMeter.push(Math.round((meter - conStart) / DAY));
      });

      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

      // Issue summary
      const openIssues = issues.filter((i: any) => !i.is_resolved).length;
      const criticalIssues = issues.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length;

      return {
        projects,
        investors,
        quotes,
        documents,
        epcMetrics,
        payments,
        departments,
        issues,
        summary: {
          totalProjects: projects.length,
          completedCapacity: Math.round(completedCapacity),
          inProgressCapacity: Math.round(inProgressCapacity),
          totalAppliedCapacity: Math.round(totalAppliedCapacity),
          completedCount: closedProjects.length,
          inProgressCount: inProgressProjects.length,
          cancelledCount: cancelledProjects.length,
          cancelledCapacity: Math.round(cancelledProjects.reduce((s, p) => s + (p.capacity_kwp || 0), 0)),
          avgProgress,
          riskCount,
          totalQuotes,
          conversionRate,
          projectConversionRate,
          closedThisMonth,
          typeDistribution,
          regionDistribution,
          yearlyTrend,
          capacityDistribution,
          // Financial
          totalContractAmount,
          totalDirectCost,
          totalGrossProfit,
          avgGrossMargin,
          avgPricePerKw,
          totalInvoiced,
          totalPaid,
          collectionRate,
          // Documents
          totalDocs,
          completedDocs,
          docCompletionRate,
          docStatusDist,
          // Departments
          deptStats,
          // Milestones
          avgSurveyToContract: avg(milestoneDurations.surveyToContract),
          avgContractToMeter: avg(milestoneDurations.contractToMeter),
          avgConstructionToMeter: avg(milestoneDurations.constructionToMeter),
          // Issues
          openIssues,
          criticalIssues,
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
