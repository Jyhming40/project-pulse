import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  HardHat, 
  Clock, 
  CheckCircle2, 
  PlayCircle,
  PauseCircle,
  ExternalLink,
  Wrench
} from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  status: string;
  construction_status: string | null;
  engineering_progress: number | null;
  updated_at: string;
  investors?: { investor_code: string; company_name: string } | null;
}

interface EngineeringSectionProps {
  projects: Project[];
  maxDisplayCount?: number;
}

// 施工狀態定義
const CONSTRUCTION_STATUSES = {
  NOT_STARTED: '尚未開工',
  STARTED: '已開工',
  PENDING_METER: '待掛錶',
  COMPLETED: '已掛錶',
  PAUSED: '暫緩',
  CANCELLED: '取消',
};

export function EngineeringSection({ 
  projects, 
  maxDisplayCount = 5 
}: EngineeringSectionProps) {
  const navigate = useNavigate();

  // 計算 KPI
  const kpis = useMemo(() => {
    const validProjects = projects.filter(p => !['暫停', '取消'].includes(p.status));
    
    const notStarted = validProjects.filter(p => 
      p.construction_status === CONSTRUCTION_STATUSES.NOT_STARTED || !p.construction_status
    ).length;
    
    const started = validProjects.filter(p => 
      p.construction_status === CONSTRUCTION_STATUSES.STARTED
    ).length;
    
    const pendingMeter = validProjects.filter(p => 
      p.construction_status === CONSTRUCTION_STATUSES.PENDING_METER
    ).length;
    
    const completed = validProjects.filter(p => 
      p.construction_status === CONSTRUCTION_STATUSES.COMPLETED
    ).length;

    return { notStarted, started, pendingMeter, completed };
  }, [projects]);

  // 待處理案場（已開工但進度較低）
  const pendingProjects = useMemo(() => {
    return projects
      .filter(p => {
        if (['暫停', '取消'].includes(p.status)) return false;
        if (['運維中', '設備登記'].includes(p.status)) return false;
        // 已開工但工程進度低於 50%
        if (p.construction_status === CONSTRUCTION_STATUSES.STARTED) {
          return (Number(p.engineering_progress) || 0) < 50;
        }
        // 或待掛錶
        return p.construction_status === CONSTRUCTION_STATUSES.PENDING_METER;
      })
      .sort((a, b) => (Number(a.engineering_progress) || 0) - (Number(b.engineering_progress) || 0))
      .slice(0, maxDisplayCount);
  }, [projects, maxDisplayCount]);

  return (
    <div className="space-y-4">
      {/* 工程 KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?construction=尚未開工')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">尚未開工</p>
                <p className="text-2xl font-bold">{kpis.notStarted}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <PauseCircle className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?construction=已開工')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">已開工</p>
                <p className="text-2xl font-bold">{kpis.started}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                <PlayCircle className="w-4 h-4 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?construction=待掛錶')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">待掛錶</p>
                <p className="text-2xl font-bold">{kpis.pendingMeter}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/projects?construction=已掛錶')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">已掛錶</p>
                <p className="text-2xl font-bold">{kpis.completed}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 待處理案場清單 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wrench className="w-4 h-4 text-info" />
            施工中待關注案場
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingProjects.length > 0 ? (
            <div className="space-y-2">
              {pendingProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
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
                      <span>{project.construction_status || '尚未開工'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-20">
                      <Progress value={Number(project.engineering_progress) || 0} className="h-2" />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {(Number(project.engineering_progress) || 0).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-success mb-2" />
              <p className="text-sm">目前沒有需要特別關注的施工案場</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
