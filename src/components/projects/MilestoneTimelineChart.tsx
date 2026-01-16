import { useMemo } from "react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MilestoneData {
  code: string;
  label: string;
  completedAt: string | null;
}

interface ProjectTimelineData {
  projectId: string;
  projectName: string;
  projectCode: string;
  isBaseline: boolean;
  milestones: MilestoneData[];
}

interface MilestoneTimelineChartProps {
  projects: ProjectTimelineData[];
  milestoneDefinitions: { code: string; label: string; color: string }[];
}

// Color palette for milestones
const MILESTONE_COLORS = [
  { bg: "bg-yellow-500", border: "border-yellow-600", text: "text-yellow-900" },
  { bg: "bg-green-500", border: "border-green-600", text: "text-green-900" },
  { bg: "bg-blue-500", border: "border-blue-600", text: "text-blue-900" },
  { bg: "bg-purple-500", border: "border-purple-600", text: "text-purple-900" },
  { bg: "bg-orange-500", border: "border-orange-600", text: "text-orange-900" },
  { bg: "bg-pink-500", border: "border-pink-600", text: "text-pink-900" },
  { bg: "bg-cyan-500", border: "border-cyan-600", text: "text-cyan-900" },
  { bg: "bg-red-500", border: "border-red-600", text: "text-red-900" },
];

export function MilestoneTimelineChart({
  projects,
  milestoneDefinitions,
}: MilestoneTimelineChartProps) {
  // Calculate time range
  const { minDate, maxDate, years } = useMemo(() => {
    const allDates: Date[] = [];
    
    projects.forEach(p => {
      p.milestones.forEach(m => {
        if (m.completedAt) {
          allDates.push(new Date(m.completedAt));
        }
      });
    });

    if (allDates.length === 0) {
      const now = new Date();
      return {
        minDate: new Date(now.getFullYear(), 0, 1),
        maxDate: new Date(now.getFullYear(), 11, 31),
        years: [now.getFullYear()],
      };
    }

    const minTime = Math.min(...allDates.map(d => d.getTime()));
    const maxTime = Math.max(...allDates.map(d => d.getTime()));
    
    // Add padding
    const padding = (maxTime - minTime) * 0.05;
    const min = new Date(minTime - padding);
    const max = new Date(maxTime + padding);
    
    // Get unique years
    const yearSet = new Set<number>();
    for (let year = min.getFullYear(); year <= max.getFullYear(); year++) {
      yearSet.add(year);
    }
    
    return {
      minDate: min,
      maxDate: max,
      years: Array.from(yearSet).sort(),
    };
  }, [projects]);

  const totalDuration = maxDate.getTime() - minDate.getTime();

  const getPositionPercent = (date: Date) => {
    return ((date.getTime() - minDate.getTime()) / totalDuration) * 100;
  };

  const getMilestoneColor = (index: number) => {
    return MILESTONE_COLORS[index % MILESTONE_COLORS.length];
  };

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        請選擇案件以顯示時間軸
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {milestoneDefinitions.map((def, index) => (
            <Badge
              key={def.code}
              variant="outline"
              className={`${getMilestoneColor(index).bg} text-white border-none text-xs`}
            >
              {def.label}
            </Badge>
          ))}
        </div>

        {/* Timeline header with years */}
        <div className="relative h-8 border-b border-border">
          <div className="absolute inset-0 flex">
            {years.map((year, index) => {
              const yearStart = new Date(year, 0, 1);
              const yearEnd = new Date(year, 11, 31);
              const startPercent = Math.max(0, getPositionPercent(yearStart));
              const endPercent = Math.min(100, getPositionPercent(yearEnd));
              const width = endPercent - startPercent;
              
              if (width <= 0) return null;
              
              return (
                <div
                  key={year}
                  className="absolute h-full flex items-center justify-center border-l border-border first:border-l-0"
                  style={{
                    left: `${startPercent}%`,
                    width: `${width}%`,
                  }}
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {year}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Project timelines */}
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.projectId}
              className={`relative flex items-center gap-4 p-3 rounded-lg ${
                project.isBaseline
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-muted/30 border border-border"
              }`}
            >
              {/* Project label */}
              <div className="w-32 flex-shrink-0">
                <div className="font-medium text-sm truncate" title={project.projectName}>
                  {project.projectName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {project.projectCode}
                </div>
                {project.isBaseline && (
                  <Badge variant="default" className="text-xs mt-1">
                    基準
                  </Badge>
                )}
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-10">
                {/* Background track */}
                <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                  <div className="w-full h-2 bg-muted rounded-full" />
                </div>

                {/* Progress line connecting milestones */}
                {(() => {
                  const completedMilestones = project.milestones
                    .filter(m => m.completedAt)
                    .sort((a, b) => 
                      new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime()
                    );
                  
                  if (completedMilestones.length < 2) return null;
                  
                  const firstPos = getPositionPercent(new Date(completedMilestones[0].completedAt!));
                  const lastPos = getPositionPercent(new Date(completedMilestones[completedMilestones.length - 1].completedAt!));
                  
                  return (
                    <div
                      className={`absolute h-1 top-1/2 -translate-y-1/2 rounded-full ${
                        project.isBaseline ? "bg-primary" : "bg-muted-foreground/50"
                      }`}
                      style={{
                        left: `${firstPos}%`,
                        width: `${lastPos - firstPos}%`,
                      }}
                    />
                  );
                })()}

                {/* Milestone points */}
                {project.milestones.map((milestone, mIndex) => {
                  if (!milestone.completedAt) return null;
                  
                  const position = getPositionPercent(new Date(milestone.completedAt));
                  const color = getMilestoneColor(
                    milestoneDefinitions.findIndex(d => d.code === milestone.code)
                  );
                  
                  return (
                    <Tooltip key={milestone.code}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full cursor-pointer
                            ${color.bg} border-2 border-background shadow-sm
                            hover:scale-125 transition-transform z-10`}
                          style={{ left: `${position}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <div className="font-medium">{milestone.label}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(milestone.completedAt), "yyyy/MM/dd", { locale: zhTW })}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
