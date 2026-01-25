import { Building2, Users, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjectStage, useProjectStageProgress } from '@/hooks/useProjectStage';
import { cn } from '@/lib/utils';

interface ProjectStageIndicatorProps {
  projectStatus: string;
  variant?: 'full' | 'compact' | 'badge';
  className?: string;
}

const phaseColors: Record<string, string> = {
  pre_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  construction: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  operation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
};

const phaseLabels: Record<string, string> = {
  pre_review: '前置作業',
  review: '審查階段',
  construction: '施工階段',
  operation: '營運階段',
};

export function ProjectStageIndicator({ projectStatus, variant = 'compact', className }: ProjectStageIndicatorProps) {
  const { currentStage } = useProjectStage(projectStatus);
  const { stages, currentIndex, progress } = useProjectStageProgress(projectStatus);

  if (!currentStage) {
    return null;
  }

  // Badge variant - 最簡潔，只顯示主責部門
  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn('gap-1 cursor-help', phaseColors[currentStage.stage_phase], className)}
            >
              <Building2 className="w-3 h-3" />
              {currentStage.responsible_department_name || '未指定'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p><strong>流程階段：</strong>{currentStage.stage_name}</p>
              <p><strong>階段類型：</strong>{phaseLabels[currentStage.stage_phase]}</p>
              <p><strong>主責部門：</strong>{currentStage.responsible_department_name || '未指定'}</p>
              {currentStage.consulted_departments && currentStage.consulted_departments.length > 0 && (
                <p><strong>協辦部門：</strong>{currentStage.consulted_departments.map(d => d.name).join('、')}</p>
              )}
              {currentStage.sla_days && (
                <p><strong>預設 SLA：</strong>{currentStage.sla_days} 天</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact variant - 一行顯示
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <Badge variant="outline" className={cn('gap-1', phaseColors[currentStage.stage_phase])}>
          {phaseLabels[currentStage.stage_phase]}
        </Badge>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">主責：</span>
        <span className="font-medium flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-primary" />
          {currentStage.responsible_department_name || '未指定'}
        </span>
        {currentStage.consulted_departments && currentStage.consulted_departments.length > 0 && (
          <>
            <span className="text-muted-foreground ml-2">協辦：</span>
            <span className="text-muted-foreground">
              {currentStage.consulted_departments.map(d => d.name).join('、')}
            </span>
          </>
        )}
      </div>
    );
  }

  // Full variant - 完整卡片
  return (
    <Card className={className}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            流程進度追蹤
          </span>
          <Badge variant="secondary" className="text-xs">
            {currentIndex + 1} / {stages.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 進度條 */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>開始</span>
            <span>{progress}%</span>
            <span>完成</span>
          </div>
        </div>

        {/* 目前階段資訊 */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">目前階段</span>
            <Badge className={phaseColors[currentStage.stage_phase]}>
              {phaseLabels[currentStage.stage_phase]}
            </Badge>
          </div>
          <p className="font-medium">{currentStage.stage_name}</p>
        </div>

        {/* 責任部門 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              主責部門
            </p>
            <p className="font-medium text-sm">
              {currentStage.responsible_department_name || '未指定'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              協辦部門
            </p>
            <p className="text-sm text-muted-foreground">
              {currentStage.consulted_departments && currentStage.consulted_departments.length > 0
                ? currentStage.consulted_departments.map(d => d.name).join('、')
                : '-'}
            </p>
          </div>
        </div>

        {/* SLA 資訊 */}
        {currentStage.sla_days && (
          <div className="flex items-center justify-between text-xs border-t pt-2">
            <span className="text-muted-foreground">預設處理時間</span>
            <span className="font-medium">{currentStage.sla_days} 天</span>
          </div>
        )}

        {/* 階段時間軸縮略 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.slice(0, 6).map((stage, idx) => (
            <TooltipProvider key={stage.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-6 h-2 rounded-full flex-shrink-0 transition-colors',
                      idx < currentIndex
                        ? 'bg-success'
                        : idx === currentIndex
                        ? 'bg-primary'
                        : 'bg-muted'
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{stage.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {stages.length > 6 && (
            <span className="text-xs text-muted-foreground ml-1">+{stages.length - 6}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
