import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Aggregated data for presentation
export function usePresentationData() {
  return useQuery({
    queryKey: ['presentation-data'],
    queryFn: async () => {
      // Fetch projects
      const { data: projects = [] } = await supabase
        .from('projects')
        .select('id, project_name, project_code, capacity_kwp, actual_installed_capacity, status, installation_type, city, district, intake_year, fiscal_year, overall_progress, investor_id, is_deleted, created_at')
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

      const totalCapacity = projects.reduce((s, p) => s + (p.actual_installed_capacity || p.capacity_kwp || 0), 0);
      const activeProjects = projects.filter(p => !['暫停', '取消'].includes(p.status || ''));
      const avgProgress = activeProjects.length > 0
        ? Math.round(activeProjects.reduce((s, p) => s + (p.overall_progress || 0), 0) / activeProjects.length)
        : 0;
      const riskCount = activeProjects.filter(p => {
        const age = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
        return age > 180 && (p.overall_progress || 0) < 25;
      }).length;

      return {
        projects,
        investors,
        quotes,
        summary: {
          totalProjects: projects.length,
          totalCapacity: Math.round(totalCapacity),
          avgProgress,
          riskCount,
          totalQuotes,
          conversionRate,
          closedThisMonth,
          typeDistribution,
          regionDistribution,
          yearlyTrend,
          capacityDistribution,
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
