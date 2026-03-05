import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  Receipt, 
  Users, 
  Plus,
  Clock,
  TrendingUp,
  AlertCircle,
  Building2,
  ChevronRight,
  Presentation,
} from 'lucide-react';
import { 
  KPICard, 
  KPICardSkeleton,
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard,
  ActionItem
} from '@/components/workspace';
import { useSalesKPIs } from '@/hooks/useModuleKPIs';

// Hook to get pending quotes for the action required section
function usePendingQuotes(limit = 5) {
  return useQuery({
    queryKey: ['sales-pending-quotes', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_quotes')
        .select(`
          id,
          quote_number,
          capacity_kwp,
          total_price_with_tax,
          quote_status,
          created_at,
          valid_until,
          project_id,
          projects:project_id (
            project_name,
            investor_id,
            investors:investor_id (company_name)
          )
        `)
        .in('quote_status', ['draft', 'sent', 'pending'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to count total pending quotes
function usePendingQuotesCount() {
  return useQuery({
    queryKey: ['sales-pending-quotes-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('project_quotes')
        .select('id', { count: 'exact', head: true })
        .in('quote_status', ['draft', 'sent', 'pending']);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function SalesModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useSalesKPIs();
  const { data: pendingQuotes = [], isLoading: isLoadingQuotes } = usePendingQuotes(5);
  const { data: totalPendingCount = 0 } = usePendingQuotesCount();

  const remainingCount = Math.max(0, totalPendingCount - pendingQuotes.length);

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `${(amount / 10000000).toFixed(1)}千萬`;
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}萬`;
    }
    return amount.toLocaleString();
  };

  const getQuoteStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      sent: '已送出',
      pending: '待確認',
    };
    return labels[status] || status;
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="接案與報價"
        subtitle="管理案源、製作報價單、追蹤成交進度"
        icon={Briefcase}
        badge="Sales"
        color="blue"
        actions={
          <Button onClick={() => navigate('/quotes/new')} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            新增報價
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard 
              title="待報價案件" 
              value={kpis?.pendingQuotes ?? 0} 
              icon={Clock}
              color="amber"
              onClick={() => navigate('/quotes?status=draft')}
            />
            <KPICard 
              title="報價中" 
              value={kpis?.inProgressQuotes ?? 0} 
              icon={Receipt}
              color="blue"
              onClick={() => navigate('/quotes?status=sent')}
            />
            <KPICard 
              title="本月成交" 
              value={kpis?.closedThisMonth ?? 0} 
              icon={TrendingUp}
              color="emerald"
              trend={kpis?.closedThisMonth && kpis.closedThisMonth > 0 ? 'up' : 'neutral'}
            />
            <KPICard 
              title="成交率" 
              value={`${kpis?.conversionRate ?? 0}%`} 
              icon={Briefcase}
              color="violet"
              subtitle={`共 ${kpis?.totalQuotes ?? 0} 份報價`}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="報價管理"
          description="檢視與編輯所有報價單"
          icon={Receipt}
          color="blue"
          onClick={() => navigate('/quotes')}
        />
        <QuickActionCard
          title="投資人管理"
          description="管理客戶與業務來源"
          icon={Users}
          color="violet"
          onClick={() => navigate('/investors')}
        />
        <QuickActionCard
          title="案場列表"
          description="檢視所有案場進度"
          icon={Building2}
          color="teal"
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="業務簡報"
          description="產生含 KPI 圖表與 AI 摘要的簡報"
          icon={Presentation}
          color="amber"
          onClick={() => navigate('/sales/presentation')}
        />
      </div>

      {/* Action Required Section */}
      <ActionRequiredCard
        title="待處理事項"
        description="需要您關注的案件與報價"
        icon={AlertCircle}
        emptyMessage="目前沒有待處理事項"
      >
        {isLoadingQuotes ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : pendingQuotes.length > 0 ? (
          <div className="space-y-2">
            {pendingQuotes.map((quote) => {
              const projectName = (quote.projects as any)?.project_name || '未指定案場';
              const investorName = (quote.projects as any)?.investors?.company_name;
              const expired = isExpired(quote.valid_until);
              
              return (
                <ActionItem
                  key={quote.id}
                  title={`${quote.quote_number} · ${projectName}`}
                  subtitle={`${investorName ? investorName + ' · ' : ''}${quote.capacity_kwp} kWp · ${formatCurrency(quote.total_price_with_tax || 0)} · ${getQuoteStatusLabel(quote.quote_status)}${expired ? ' · 已過期' : ''}`}
                  icon={expired ? AlertCircle : Receipt}
                  status={expired ? 'danger' : 'warning'}
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                />
              );
            })}
            {remainingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => navigate('/quotes?status=draft,sent,pending')}
              >
                查看其他 {remainingCount} 份待處理報價
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        ) : null}
      </ActionRequiredCard>
    </div>
  );
}
