import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type { ProjectAnalytics } from '@/hooks/useProjectAnalytics';

interface RiskProjectsListProps {
  projects: ProjectAnalytics[];
  isLoading?: boolean;
  limit?: number;
}

export function RiskProjectsList({ 
  projects, 
  isLoading = false,
  limit = 5,
}: RiskProjectsListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const displayProjects = projects.slice(0, limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          風險案場列表
          {projects.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {projects.length}
            </Badge>
          )}
        </CardTitle>
        {projects.length > limit && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/projects?filter=risk')}
            className="text-xs"
          >
            查看全部 <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>目前沒有風險案場</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayProjects.map((project) => (
              <div 
                key={project.project_id}
                className="flex items-start gap-4 p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.project_id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {project.project_code}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {project.current_project_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {project.project_name}
                  </p>
                  
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={project.overall_progress_percent} 
                      className="h-1.5 flex-1" 
                    />
                    <span className="text-xs font-medium w-10 text-right">
                      {project.overall_progress_percent}%
                    </span>
                  </div>

                  {/* Risk reasons */}
                  {project.risk_reasons && project.risk_reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {project.risk_reasons.slice(0, 2).map((reason, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-xs bg-destructive/10 text-destructive"
                        >
                          {reason}
                        </Badge>
                      ))}
                      {project.risk_reasons.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{project.risk_reasons.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
