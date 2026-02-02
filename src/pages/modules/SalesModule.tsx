import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  Receipt, 
  Users, 
  Plus,
  Clock,
  TrendingUp,
  AlertCircle,
  Building2
} from 'lucide-react';
import { 
  KPICard, 
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard 
} from '@/components/workspace';

export default function SalesModule() {
  const navigate = useNavigate();

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
        <KPICard 
          title="待報價案件" 
          value="—" 
          icon={Clock}
          color="amber"
        />
        <KPICard 
          title="報價中" 
          value="—" 
          icon={Receipt}
          color="blue"
        />
        <KPICard 
          title="本月成交" 
          value="—" 
          icon={TrendingUp}
          color="emerald"
          trend="up"
        />
        <KPICard 
          title="成交率" 
          value="—%" 
          icon={Briefcase}
          color="violet"
        />
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
      </div>

      {/* Action Required Section */}
      <ActionRequiredCard
        title="待處理事項"
        description="需要您關注的案件與報價"
        icon={AlertCircle}
        emptyMessage="目前沒有待處理事項"
      />
    </div>
  );
}
