import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  FileWarning,
  Clock,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  History,
  Check,
} from 'lucide-react';
import type { ProjectAnalytics } from '@/hooks/useProjectAnalytics';
import { useActionItemResolutions, type ResolutionType } from '@/hooks/useActionItemResolutions';
import { ResolveActionDialog } from './ResolveActionDialog';
import { ActionHistoryTab } from './ActionHistoryTab';

interface Project {
  id: string;
  project_name: string;
  project_code?: string;
  status: string;
  admin_progress: number | null;
  updated_at: string;
  investors?: { investor_code: string; company_name: string } | null;
}

interface ActionRequiredSectionProps {
  riskProjects: ProjectAnalytics[];
  allProjects: Project[];
  stuckThresholdDays?: number;
  maxDisplayCount?: number;
  isLoading?: boolean;
}

interface ResolveDialogState {
  open: boolean;
  projectId: string;
  projectName: string;
  type: ResolutionType;
}

export function ActionRequiredSection({
  riskProjects,
  allProjects,
  stuckThresholdDays = 14,
  maxDisplayCount = 5,
  isLoading = false,
}: ActionRequiredSectionProps) {
  const navigate = useNavigate();
  const {
    resolutions,
    resolvedProjectIds,
    resolve,
    isResolving,
    unresolve,
    isUnresolving,
  } = useActionItemResolutions();

  const [resolveDialog, setResolveDialog] = useState<ResolveDialogState>({
    open: false,
    projectId: '',
    projectName: '',
    type: 'risk',
  });

  // Get resolved IDs for each type
  const resolvedRiskIds = resolvedProjectIds('risk');
  const resolvedPendingIds = resolvedProjectIds('pending');
  const resolvedStuckIds = resolvedProjectIds('stuck');

  // Filter out resolved projects from risk list
  const activeRiskProjects = useMemo(() => {
    return riskProjects.filter(p => !resolvedRiskIds.has(p.project_id));
  }, [riskProjects, resolvedRiskIds]);

  // 待補件案場 (台電審查狀態) - filtered
  const pendingFixProjects = useMemo(() => {
    return allProjects
      .filter(p => p.status === '台電審查' && !resolvedPendingIds.has(p.id))
      .slice(0, maxDisplayCount);
  }, [allProjects, maxDisplayCount, resolvedPendingIds]);

  // 超時未更新案場 - filtered
  const stuckProjects = useMemo(() => {
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() - stuckThresholdDays);

    return allProjects
      .filter(p => {
        // 排除不需追蹤的狀態：暫停、取消、運維中、已結案
        if (['暫停', '取消', '運維中', '已結案'].includes(p.status)) return false;
        if (resolvedStuckIds.has(p.id)) return false;
        const updatedAt = new Date(p.updated_at);
        return updatedAt < thresholdDate;
      })
      .map(p => ({
        ...p,
        daysStuck: Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.daysStuck - a.daysStuck)
      .slice(0, maxDisplayCount);
  }, [allProjects, stuckThresholdDays, maxDisplayCount, resolvedStuckIds]);

  const totalActionItems = activeRiskProjects.length + pendingFixProjects.length + stuckProjects.length;
  const historyCount = resolutions.length;

  const handleResolveClick = (projectId: string, projectName: string, type: ResolutionType) => {
    setResolveDialog({ open: true, projectId, projectName, type });
  };

  const handleConfirmResolve = (note: string) => {
    resolve({
      projectId: resolveDialog.projectId,
      type: resolveDialog.type,
      note,
    });
    setResolveDialog({ ...resolveDialog, open: false });
  };

  if (isLoading) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base font-medium">載入中...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            載入待處理事項...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalActionItems === 0 && historyCount === 0) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-12 h-12 text-success mb-3" />
            <h3 className="text-lg font-medium text-foreground">一切正常</h3>
            <p className="text-sm text-muted-foreground mt-1">
              目前沒有需要立即處理的案場
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={totalActionItems > 0 ? "border-destructive/30" : "border-muted"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {totalActionItems > 0 ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-success" />
              )}
              今日待處理
              {totalActionItems > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {totalActionItems}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={totalActionItems > 0 ? "risk" : "history"} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 h-auto">
              <TabsTrigger value="risk" className="text-xs px-2 py-2 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>風險案場</span>
                </div>
                <Badge variant={activeRiskProjects.length > 0 ? "destructive" : "secondary"} className="text-xs">
                  {activeRiskProjects.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs px-2 py-2 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <FileWarning className="w-3 h-3" />
                  <span>待補件</span>
                </div>
                <Badge variant={pendingFixProjects.length > 0 ? "outline" : "secondary"} className={`text-xs ${pendingFixProjects.length > 0 ? 'border-warning text-warning' : ''}`}>
                  {pendingFixProjects.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="stuck" className="text-xs px-2 py-2 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>超時未更新</span>
                </div>
                <Badge variant={stuckProjects.length > 0 ? "outline" : "secondary"} className={`text-xs ${stuckProjects.length > 0 ? 'border-warning text-warning' : ''}`}>
                  {stuckProjects.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-2 py-2 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  <span>歷史記錄</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {historyCount}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* 風險案場 */}
            <TabsContent value="risk" className="mt-4">
              {activeRiskProjects.length === 0 ? (
                <EmptyState message="目前沒有風險案場" />
              ) : (
                <div className="space-y-2">
                  {activeRiskProjects.slice(0, maxDisplayCount).map((project) => (
                    <ActionItem
                      key={project.project_id}
                      projectId={project.project_id}
                      title={project.project_code || project.project_name}
                      subtitle={project.project_name}
                      badge={project.current_project_status}
                      progress={project.overall_progress_percent}
                      tags={project.risk_reasons?.slice(0, 2)}
                      variant="destructive"
                      onClick={() => navigate(`/projects/${project.project_id}`)}
                      onResolve={() => handleResolveClick(project.project_id, project.project_code || project.project_name, 'risk')}
                    />
                  ))}
                  {activeRiskProjects.length > maxDisplayCount && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => navigate('/projects?filter=risk')}
                    >
                      查看全部 {activeRiskProjects.length} 項 <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* 待補件 */}
            <TabsContent value="pending" className="mt-4">
              {pendingFixProjects.length === 0 ? (
                <EmptyState message="目前沒有待補件案場" />
              ) : (
                <div className="space-y-2">
                  {pendingFixProjects.map((project) => (
                    <ActionItem
                      key={project.id}
                      projectId={project.id}
                      title={project.project_name}
                      subtitle={`${project.investors?.investor_code || '-'} • ${project.status}`}
                      badge="台電審查"
                      progress={project.admin_progress || 0}
                      variant="warning"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      onResolve={() => handleResolveClick(project.id, project.project_name, 'pending')}
                    />
                  ))}
                  {pendingFixProjects.length >= maxDisplayCount && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => navigate('/projects?status=台電審查')}
                    >
                      查看全部 <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* 超時未更新 */}
            <TabsContent value="stuck" className="mt-4">
              {stuckProjects.length === 0 ? (
                <EmptyState message="所有案場進度正常更新" />
              ) : (
                <div className="space-y-2">
                  {stuckProjects.map((project) => (
                    <ActionItem
                      key={project.id}
                      projectId={project.id}
                      title={project.project_name}
                      subtitle={`${project.investors?.investor_code || '-'} • ${project.status}`}
                      badge={`${project.daysStuck} 天`}
                      progress={project.admin_progress || 0}
                      variant="warning"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      onResolve={() => handleResolveClick(project.id, project.project_name, 'stuck')}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 歷史記錄 */}
            <TabsContent value="history" className="mt-4">
              <ActionHistoryTab
                resolutions={resolutions}
                onUnresolve={unresolve}
                isUnresolving={isUnresolving}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ResolveActionDialog
        open={resolveDialog.open}
        onOpenChange={(open) => setResolveDialog({ ...resolveDialog, open })}
        onConfirm={handleConfirmResolve}
        isLoading={isResolving}
        projectName={resolveDialog.projectName}
        resolutionType={resolveDialog.type}
      />
    </>
  );
}

// 單一待處理項目
function ActionItem({
  projectId,
  title,
  subtitle,
  badge,
  progress,
  tags,
  variant = 'destructive',
  onClick,
  onResolve,
}: {
  projectId: string;
  title: string;
  subtitle: string;
  badge: string;
  progress: number;
  tags?: string[];
  variant?: 'destructive' | 'warning';
  onClick: () => void;
  onResolve: () => void;
}) {
  const bgColor = variant === 'destructive' ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10' : 'bg-warning/5 border-warning/20 hover:bg-warning/10';
  
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${bgColor} transition-colors`}
    >
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{title}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {badge}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        
        <div className="flex items-center gap-2 mt-2">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs font-medium w-10 text-right">{progress}%</span>
        </div>

        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className={`text-xs ${variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          title="查看詳情"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
          onClick={(e) => {
            e.stopPropagation();
            onResolve();
          }}
          title="標記已處理"
        >
          <Check className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
      <CheckCircle2 className="w-8 h-8 text-success mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
