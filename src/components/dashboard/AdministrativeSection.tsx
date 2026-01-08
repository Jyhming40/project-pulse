import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  FileCheck, 
  FileWarning, 
  FileX, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  status: string;
  admin_progress: number | null;
  updated_at: string;
  investors?: { investor_code: string; company_name: string } | null;
}

interface AdministrativeSectionProps {
  projects: Project[];
  stuckThresholdDays?: number;
  maxDisplayCount?: number;
}

// 行政相關狀態
const ADMIN_STATUSES = {
  SUBMITTING: ['台電送件', '能源署送件'],
  PENDING_FIX: ['台電審查'], // 需要補件的狀態
  APPROVED: ['同意備案'],
  PENDING_METER: ['報竣掛表'],
};

export function AdministrativeSection({ 
  projects, 
  stuckThresholdDays = 14,
  maxDisplayCount = 5
}: AdministrativeSectionProps) {
  const navigate = useNavigate();

  // 計算 KPI
  const kpis = useMemo(() => {
    const validProjects = projects.filter(p => !['暫停', '取消'].includes(p.status));
    
    const submitting = validProjects.filter(p => 
      ADMIN_STATUSES.SUBMITTING.includes(p.status)
    ).length;
    
    const pendingFix = validProjects.filter(p => 
      ADMIN_STATUSES.PENDING_FIX.includes(p.status)
    ).length;
    
    const approved = validProjects.filter(p => 
      ADMIN_STATUSES.APPROVED.includes(p.status)
    ).length;
    
    const pendingMeter = validProjects.filter(p => 
      ADMIN_STATUSES.PENDING_METER.includes(p.status)
    ).length;

    return { submitting, pendingFix, approved, pendingMeter };
  }, [projects]);

  // 找出行政卡關案場（停留超過 X 天）
  const stuckProjects = useMemo(() => {
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() - stuckThresholdDays);

    return projects
      .filter(p => {
        if (['暫停', '取消', '運維中'].includes(p.status)) return false;
        const updatedAt = new Date(p.updated_at);
        return updatedAt < thresholdDate;
      })
      .map(p => ({
        ...p,
        daysStuck: Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.daysStuck - a.daysStuck)
      .slice(0, maxDisplayCount);
  }, [projects, stuckThresholdDays, maxDisplayCount]);

  return (
    <div className="space-y-4">
      {/* 行政 KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?status=台電送件,能源署送件')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">送審中</p>
                <p className="text-2xl font-bold">{kpis.submitting}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?status=台電審查')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">待補件</p>
                <p className="text-2xl font-bold">{kpis.pendingFix}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <FileWarning className="w-4 h-4 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?status=同意備案')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">已備案</p>
                <p className="text-2xl font-bold">{kpis.approved}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?status=報竣掛表')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">待掛表</p>
                <p className="text-2xl font-bold">{kpis.pendingMeter}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 行政卡關清單 */}
      <Card className="border-warning/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            行政卡關案場
            <Badge variant="outline" className="ml-2 text-xs">
              超過 {stuckThresholdDays} 天未更新
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stuckProjects.length > 0 ? (
            <div className="space-y-2">
              {stuckProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 hover:bg-warning/10 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{project.project_name}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{project.investors?.investor_code || '-'}</span>
                      <span>•</span>
                      <span>{project.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <Progress value={Number(project.admin_progress) || 0} className="h-2 w-16" />
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {project.daysStuck} 天
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-success mb-2" />
              <p className="text-sm">所有案場行政進度正常</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
