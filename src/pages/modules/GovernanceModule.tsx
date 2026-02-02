import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  FolderOpen, 
  Upload, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Archive
} from 'lucide-react';
import { 
  KPICard, 
  KPICardSkeleton,
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard 
} from '@/components/workspace';
import { useGovernanceKPIs } from '@/hooks/useModuleKPIs';

export default function GovernanceModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useGovernanceKPIs();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="文件治理"
        subtitle="版本控管、歸檔管理、法規遵循"
        icon={FileText}
        badge="Governance"
        color="emerald"
        actions={
          <Button onClick={() => navigate('/import-batch')} size="sm" variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            批次匯入
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
              title="待送審文件" 
              value={kpis?.pendingReview ?? 0} 
              icon={Clock}
              color="amber"
              onClick={() => navigate('/documents?status=draft')}
            />
            <KPICard 
              title="已核准" 
              value={kpis?.approved ?? 0} 
              icon={CheckCircle2}
              color="emerald"
              onClick={() => navigate('/documents?status=approved')}
            />
            <KPICard 
              title="即將到期" 
              value={kpis?.dueSoon ?? 0} 
              icon={AlertTriangle}
              color={kpis?.dueSoon && kpis.dueSoon > 0 ? 'rose' : 'emerald'}
              onClick={() => navigate('/documents?due=soon')}
            />
            <KPICard 
              title="已歸檔" 
              value={kpis?.archived ?? 0} 
              icon={Archive}
              color="blue"
              subtitle={`共 ${kpis?.total ?? 0} 份文件`}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="文件管理"
          description="檢視與管理所有文件"
          icon={FileText}
          color="emerald"
          onClick={() => navigate('/documents')}
        />
        <QuickActionCard
          title="批次匯入"
          description="批量上傳與建立文件"
          icon={Upload}
          color="blue"
          onClick={() => navigate('/import-batch')}
        />
        <QuickActionCard
          title="案場文件"
          description="依案場檢視相關文件"
          icon={FolderOpen}
          color="teal"
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Action Required Section */}
      <ActionRequiredCard
        title="待處理文件"
        description="需要送審或更新的文件"
        icon={AlertTriangle}
        emptyMessage="目前沒有待處理文件"
      />
    </div>
  );
}
