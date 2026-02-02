import { useNavigate } from 'react-router-dom';
import { 
  HardHat, 
  Building2, 
  Scale, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users
} from 'lucide-react';
import { 
  KPICard, 
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard 
} from '@/components/workspace';

export default function ExecutionModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="工程與行政"
        subtitle="時程管理、里程碑追蹤、多單位協調"
        icon={HardHat}
        badge="Execution"
        color="amber"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="進行中案件" 
          value="—" 
          icon={Clock}
          color="blue"
        />
        <KPICard 
          title="本月完成" 
          value="—" 
          icon={CheckCircle2}
          color="emerald"
        />
        <KPICard 
          title="逾期警示" 
          value="—" 
          icon={AlertTriangle}
          color="amber"
        />
        <KPICard 
          title="平均週期" 
          value="— 天" 
          icon={Scale}
          color="teal"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="案場列表"
          description="檢視所有案場工程進度"
          icon={Building2}
          color="blue"
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="進度比較"
          description="跨案場時程分析與比對"
          icon={Scale}
          color="amber"
          onClick={() => navigate('/projects/compare')}
        />
        <QuickActionCard
          title="施工夥伴"
          description="管理合作廠商與派工"
          icon={Users}
          color="emerald"
          onClick={() => navigate('/partners')}
        />
      </div>

      {/* Action Required Section */}
      <ActionRequiredCard
        title="需關注案件"
        description="逾期或即將到期的里程碑"
        icon={AlertTriangle}
        iconColor="text-amber-500"
        emptyMessage="目前沒有需關注的案件"
      />
    </div>
  );
}
