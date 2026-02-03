import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  Receipt, 
  Wallet, 
  DollarSign,
  BarChart3,
  PiggyBank,
  Info,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { 
  KPICard, 
  KPICardSkeleton,
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard,
  ActionItem
} from '@/components/workspace';
import { useFinanceKPIs, formatKPINumber } from '@/hooks/useModuleKPIs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePaymentSummary, usePaymentMilestones } from '@/hooks/usePaymentTracking';

// Hook to get recent quotes with financial data
function useRecentFinancialQuotes(limit = 5) {
  return useQuery({
    queryKey: ['finance-recent-quotes', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_quotes')
        .select(`
          id,
          quote_number,
          capacity_kwp,
          total_price_with_tax,
          irr_20_year,
          payback_years,
          is_finalized,
          created_at,
          project_id,
          projects:project_id (
            project_name,
            investor_id,
            investors:investor_id (company_name)
          )
        `)
        .eq('quote_status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function FinanceModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useFinanceKPIs();
  const { data: recentQuotes = [], isLoading: isLoadingQuotes } = useRecentFinancialQuotes(5);
  const { data: paymentSummary, isLoading: isLoadingPayment } = usePaymentSummary();
  const { data: milestones = [] } = usePaymentMilestones();

  const formatCurrency = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}億`;
    }
    if (amount >= 10000000) {
      return `${(amount / 10000000).toFixed(1)}千萬`;
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}萬`;
    }
    return amount.toLocaleString();
  };

  const collectionRate = paymentSummary 
    ? ((paymentSummary.totalPaid) / (paymentSummary.totalPending + paymentSummary.totalInvoiced + paymentSummary.totalPaid || 1) * 100)
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="財務與投資"
        subtitle="ROI 分析、現金流追蹤、收益管理"
        icon={TrendingUp}
        badge="Finance"
        color="violet"
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
              title="總投資額" 
              value={kpis?.totalInvestment ? formatKPINumber(kpis.totalInvestment) : '—'} 
              icon={DollarSign}
              color="emerald"
              subtitle={kpis?.totalCapacity ? `${kpis.totalCapacity.toLocaleString()} kWp` : undefined}
            />
            <KPICard 
              title="預期年收益" 
              value={kpis?.expectedAnnualRevenue ? formatKPINumber(kpis.expectedAnnualRevenue) : '—'} 
              icon={TrendingUp}
              color="blue"
            />
            <KPICard 
              title="平均 IRR" 
              value={kpis?.avgIRR ? `${kpis.avgIRR}%` : '—%'} 
              icon={BarChart3}
              color="teal"
            />
            <KPICard 
              title="待收款項" 
              value={paymentSummary?.totalPending ? formatCurrency(paymentSummary.totalPending + paymentSummary.totalInvoiced) : '—'} 
              icon={PiggyBank}
              color="amber"
              subtitle={paymentSummary ? `收款率 ${collectionRate.toFixed(0)}%` : undefined}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="報價財務分析"
          description="檢視報價單的投資分析"
          icon={Receipt}
          color="violet"
          onClick={() => navigate('/quotes')}
        />
        <QuickActionCard
          title="案場財務資訊"
          description="各案場投資與收益追蹤"
          icon={Wallet}
          color="emerald"
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="投資人管理"
          description="客戶應收帳款管理"
          icon={DollarSign}
          color="blue"
          onClick={() => navigate('/investors')}
        />
      </div>

      {/* Financial Summary Section */}
      <ActionRequiredCard
        title="財務摘要"
        description="投資組合整體表現"
        icon={Info}
        iconColor="text-info"
        emptyMessage="尚無財務數據"
      >
        {isLoadingQuotes || isLoadingPayment ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Payment Collection Status */}
            {paymentSummary && (paymentSummary.pendingCount > 0 || paymentSummary.invoicedCount > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">收款狀態</p>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground">待請款</p>
                          <p className="text-lg font-bold">{paymentSummary.pendingCount}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(paymentSummary.totalPending)}</p>
                        </div>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-info/5">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground">已開票</p>
                          <p className="text-lg font-bold">{paymentSummary.invoicedCount}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(paymentSummary.totalInvoiced)}</p>
                        </div>
                        <FileText className="w-4 h-4 text-info" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-success/5">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground">已收款</p>
                          <p className="text-lg font-bold">{paymentSummary.paidCount}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(paymentSummary.totalPaid)}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Recent Accepted Quotes */}
            {recentQuotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">近期成交案件</p>
                {recentQuotes.map((quote) => {
                  const projectName = (quote.projects as any)?.project_name || '未指定案場';
                  const investorName = (quote.projects as any)?.investors?.company_name;
                  
                  return (
                    <ActionItem
                      key={quote.id}
                      title={`${projectName}`}
                      subtitle={`${investorName ? investorName + ' · ' : ''}${quote.capacity_kwp} kWp · ${formatCurrency(quote.total_price_with_tax || 0)}${quote.irr_20_year ? ` · IRR ${quote.irr_20_year.toFixed(1)}%` : ''}`}
                      icon={quote.is_finalized ? CheckCircle2 : Receipt}
                      status={quote.is_finalized ? 'info' : 'warning'}
                      onClick={() => navigate(`/quotes/${quote.id}`)}
                    />
                  );
                })}
              </div>
            )}

            {/* Quick Actions */}
            {(paymentSummary?.pendingCount ?? 0) > 0 && (
              <div className="flex gap-2 pt-2 border-t">
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => navigate('/projects?payment_status=pending')}
                >
                  待請款案場
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => navigate('/projects?payment_status=invoiced')}
                >
                  已開票未收款
                </Badge>
              </div>
            )}

            {/* Empty state fallback */}
            {!paymentSummary && recentQuotes.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                尚無財務數據
              </div>
            )}
          </div>
        )}
      </ActionRequiredCard>
    </div>
  );
}
