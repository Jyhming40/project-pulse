import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  ExternalLink,
  Filter
} from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  status: string;
  construction_status: string | null;
  overall_progress: number | null;
  admin_progress: number | null;
  engineering_progress: number | null;
  updated_at: string;
  created_at: string;
  investors?: { investor_code: string; company_name: string } | null;
}

interface RiskSectionProps {
  projects: Project[];
  thresholds?: {
    noUpdateDays: number;
    adminStuckDays: number;
    engineeringStuckDays: number;
  };
  maxDisplayCount?: number;
}

type RiskLevel = 'high' | 'medium' | 'low';

interface RiskProject {
  project: Project;
  riskLevel: RiskLevel;
  riskScore: number;
  riskReasons: string[];
}

export function RiskSection({ 
  projects, 
  thresholds = {
    noUpdateDays: 30,
    adminStuckDays: 21,
    engineeringStuckDays: 14,
  },
  maxDisplayCount = 8
}: RiskSectionProps) {
  const navigate = useNavigate();

  // 計算風險分數與分類
  const riskProjects = useMemo(() => {
    const now = new Date();
    const results: RiskProject[] = [];

    projects.forEach(project => {
      // 排除已完成、暫停、取消的案場
      if (['暫停', '取消', '運維中'].includes(project.status)) return;

      let riskScore = 0;
      const riskReasons: string[] = [];
      const updatedAt = new Date(project.updated_at);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      // 風險來源 1: 長時間未更新
      if (daysSinceUpdate >= thresholds.noUpdateDays) {
        riskScore += 40;
        riskReasons.push(`${daysSinceUpdate} 天未更新`);
      } else if (daysSinceUpdate >= thresholds.noUpdateDays * 0.7) {
        riskScore += 20;
        riskReasons.push(`${daysSinceUpdate} 天未更新`);
      }

      // 風險來源 2: 行政進度卡關
      const adminProgress = Number(project.admin_progress) || 0;
      if (adminProgress > 0 && adminProgress < 80 && daysSinceUpdate >= thresholds.adminStuckDays) {
        riskScore += 30;
        riskReasons.push('行政進度停滯');
      }

      // 風險來源 3: 工程進度卡關
      const engineeringProgress = Number(project.engineering_progress) || 0;
      if (project.construction_status === '已開工' && engineeringProgress < 50 && daysSinceUpdate >= thresholds.engineeringStuckDays) {
        riskScore += 30;
        riskReasons.push('施工進度落後');
      }

      // 額外風險：整體進度很低但專案已建檔很久
      const createdAt = new Date(project.created_at);
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const overallProgress = Number(project.overall_progress) || 0;
      if (daysSinceCreated > 180 && overallProgress < 30) {
        riskScore += 20;
        riskReasons.push('建檔超過 6 個月進度仍低');
      }

      if (riskScore > 0) {
        let riskLevel: RiskLevel = 'low';
        if (riskScore >= 60) riskLevel = 'high';
        else if (riskScore >= 30) riskLevel = 'medium';

        results.push({
          project,
          riskLevel,
          riskScore,
          riskReasons,
        });
      }
    });

    return results.sort((a, b) => b.riskScore - a.riskScore);
  }, [projects, thresholds]);

  // 統計各風險等級數量
  const riskStats = useMemo(() => {
    return {
      high: riskProjects.filter(r => r.riskLevel === 'high').length,
      medium: riskProjects.filter(r => r.riskLevel === 'medium').length,
      low: riskProjects.filter(r => r.riskLevel === 'low').length,
    };
  }, [riskProjects]);

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'high':
        return <Badge variant="destructive">高風險</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-warning-foreground">中風險</Badge>;
      case 'low':
        return <Badge variant="secondary">低風險</Badge>;
    }
  };

  const getRiskIcon = (level: RiskLevel) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'low':
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const displayProjects = riskProjects.slice(0, maxDisplayCount);

  return (
    <div className="space-y-4">
      {/* 風險統計 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={`${riskStats.high > 0 ? 'border-destructive/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">高風險</p>
                <p className="text-2xl font-bold text-destructive">{riskStats.high}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`${riskStats.medium > 0 ? 'border-warning/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">中風險</p>
                <p className="text-2xl font-bold text-warning">{riskStats.medium}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">低風險</p>
                <p className="text-2xl font-bold">{riskStats.low}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 風險排行榜 */}
      <Card className="border-destructive/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              風險排行榜
            </CardTitle>
            {riskProjects.length > maxDisplayCount && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/projects?risk=high')}>
                <Filter className="w-4 h-4 mr-1" />
                查看全部
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {displayProjects.length > 0 ? (
            <div className="space-y-2">
              {displayProjects.map(({ project, riskLevel, riskReasons }) => (
                <div
                  key={project.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer
                    ${riskLevel === 'high' ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10' : 
                      riskLevel === 'medium' ? 'bg-warning/5 border-warning/30 hover:bg-warning/10' : 
                      'bg-muted/50 hover:bg-muted'}`}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getRiskIcon(riskLevel)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{project.project_name}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {riskReasons.map((reason, idx) => (
                          <span key={idx} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {getRiskBadge(riskLevel)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 text-success mb-2" />
              <p className="text-sm">目前沒有高風險案場</p>
              <p className="text-xs mt-1">所有案場進度正常</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
