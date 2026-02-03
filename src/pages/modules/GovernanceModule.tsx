import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  FolderOpen, 
  Upload, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Archive,
  ChevronRight
} from 'lucide-react';
import { 
  KPICard, 
  KPICardSkeleton,
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard,
  ActionItem
} from '@/components/workspace';
import { useGovernanceKPIs } from '@/hooks/useModuleKPIs';

// Hook to get pending documents for the action required section
function usePendingDocuments(limit = 5) {
  return useQuery({
    queryKey: ['governance-pending-documents', limit],
    queryFn: async () => {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          doc_type,
          doc_type_code,
          doc_status,
          due_at,
          created_at,
          project_id,
          projects:project_id (
            project_name,
            project_code
          )
        `)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .in('doc_status', ['draft', 'submitted', 'pending', '未開始', '作業中'])
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Add priority info
      return (data || []).map(doc => ({
        ...doc,
        isDueSoon: doc.due_at ? new Date(doc.due_at) <= sevenDaysLater && new Date(doc.due_at) >= now : false,
        isOverdue: doc.due_at ? new Date(doc.due_at) < now : false,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to count total pending documents
function usePendingDocumentsCount() {
  return useQuery({
    queryKey: ['governance-pending-documents-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .in('doc_status', ['draft', 'submitted', 'pending', '未開始', '作業中']);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function GovernanceModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useGovernanceKPIs();
  const { data: pendingDocs = [], isLoading: isLoadingDocs } = usePendingDocuments(5);
  const { data: totalPendingCount = 0 } = usePendingDocumentsCount();

  const remainingCount = Math.max(0, totalPendingCount - pendingDocs.length);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      submitted: '已送審',
      pending: '待審核',
      '未開始': '未開始',
      '作業中': '作業中',
    };
    return labels[status] || status;
  };

  const formatDueDate = (dueAt: string | null) => {
    if (!dueAt) return '';
    const due = new Date(dueAt);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `已逾期 ${Math.abs(diffDays)} 天`;
    } else if (diffDays === 0) {
      return '今天到期';
    } else if (diffDays <= 7) {
      return `${diffDays} 天後到期`;
    }
    return `${due.getMonth() + 1}/${due.getDate()} 到期`;
  };

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
      >
        {isLoadingDocs ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : pendingDocs.length > 0 ? (
          <div className="space-y-2">
            {pendingDocs.map((doc) => {
              const projectName = (doc.projects as any)?.project_name || '未指定案場';
              const projectCode = (doc.projects as any)?.project_code;
              
              return (
                <ActionItem
                  key={doc.id}
                  title={`${doc.doc_type} · ${projectName}`}
                  subtitle={`${projectCode ? projectCode + ' · ' : ''}${getStatusLabel(doc.doc_status)}${doc.due_at ? ' · ' + formatDueDate(doc.due_at) : ''}`}
                  icon={doc.isOverdue ? AlertTriangle : doc.isDueSoon ? Clock : FileText}
                  status={doc.isOverdue ? 'danger' : doc.isDueSoon ? 'warning' : 'info'}
                  onClick={() => navigate(`/projects/${doc.project_id}`)}
                />
              );
            })}
            {remainingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => navigate('/documents?status=pending')}
              >
                查看其他 {remainingCount} 份待處理文件
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        ) : null}
      </ActionRequiredCard>
    </div>
  );
}
