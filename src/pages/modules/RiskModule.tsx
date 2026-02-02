import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Shield, 
  FileWarning, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Scale
} from 'lucide-react';
import { 
  KPICard, 
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard 
} from '@/components/workspace';

export default function RiskModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="風險與爭議"
        subtitle="證據管理、爭議日誌、法律狀態追蹤"
        icon={AlertTriangle}
        badge="Risk & Legal"
        color="rose"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="風險案件" 
          value="—" 
          icon={AlertTriangle}
          color="rose"
        />
        <KPICard 
          title="進行中爭議" 
          value="—" 
          icon={Scale}
          color="amber"
        />
        <KPICard 
          title="待處理" 
          value="—" 
          icon={Clock}
          color="blue"
        />
        <KPICard 
          title="已解決" 
          value="—" 
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="風險案件列表"
          description="檢視所有標記為風險的案件"
          icon={AlertCircle}
          color="rose"
          onClick={() => navigate('/projects?risk=true')}
        />
        <QuickActionCard
          title="爭議管理"
          description="管理案件爭議與處理進度"
          icon={Scale}
          color="amber"
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="文件證據"
          description="相關證據文件管理"
          icon={FileWarning}
          color="teal"
          onClick={() => navigate('/documents')}
        />
      </div>

      {/* Risk Overview Section */}
      <ActionRequiredCard
        title="風險總覽"
        description="系統風險狀態摘要"
        icon={Shield}
        iconColor="text-primary"
        emptyMessage="目前沒有標記為風險的案件"
      />
    </div>
  );
}
