import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Receipt, 
  Wallet, 
  DollarSign,
  BarChart3,
  PiggyBank,
  Info
} from 'lucide-react';
import { 
  KPICard, 
  KPICardSkeleton,
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard 
} from '@/components/workspace';
import { useFinanceKPIs, formatKPINumber } from '@/hooks/useModuleKPIs';

export default function FinanceModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useFinanceKPIs();

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
              value={kpis?.pendingPayments ? formatKPINumber(kpis.pendingPayments) : '—'} 
              icon={PiggyBank}
              color="amber"
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

      {/* Summary Section */}
      <ActionRequiredCard
        title="財務摘要"
        description="投資組合整體表現"
        icon={Info}
        iconColor="text-info"
        emptyMessage="財務摘要功能開發中"
      />
    </div>
  );
}
