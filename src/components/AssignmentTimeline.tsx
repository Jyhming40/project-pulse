import { useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, isSameMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ConstructionAssignment } from '@/hooks/useConstructionAssignments';

const statusColors: Record<string, { bg: string; border: string }> = {
  '預計': { bg: 'bg-muted', border: 'border-muted-foreground/30' },
  '已確認': { bg: 'bg-info/20', border: 'border-info' },
  '已進場': { bg: 'bg-primary/20', border: 'border-primary' },
  '已完成': { bg: 'bg-success/20', border: 'border-success' },
  '暫緩': { bg: 'bg-warning/20', border: 'border-warning' },
  '取消': { bg: 'bg-destructive/20', border: 'border-destructive' },
};

interface Props {
  assignments: ConstructionAssignment[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onAssignmentClick?: (assignment: ConstructionAssignment) => void;
}

export function AssignmentTimeline({ 
  assignments, 
  currentMonth, 
  onMonthChange,
  onAssignmentClick 
}: Props) {
  // Get all days in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  // Filter assignments that have dates and overlap with current month
  const visibleAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const start = a.planned_start_date || a.actual_start_date;
      const end = a.planned_end_date || a.actual_end_date;
      if (!start) return false;
      
      const startDate = parseISO(start);
      const endDate = end ? parseISO(end) : startDate;
      
      // Check if assignment overlaps with current month
      return (
        isWithinInterval(startDate, { start: monthStart, end: monthEnd }) ||
        isWithinInterval(endDate, { start: monthStart, end: monthEnd }) ||
        (startDate <= monthStart && endDate >= monthEnd)
      );
    });
  }, [assignments, monthStart, monthEnd]);

  const handlePrevMonth = () => {
    onMonthChange(addDays(monthStart, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(addDays(monthEnd, 1));
  };

  const getBarPosition = (assignment: ConstructionAssignment) => {
    const start = assignment.planned_start_date || assignment.actual_start_date;
    const end = assignment.planned_end_date || assignment.actual_end_date;
    
    if (!start) return null;
    
    const startDate = parseISO(start);
    const endDate = end ? parseISO(end) : startDate;
    
    // Clamp to month boundaries
    const clampedStart = startDate < monthStart ? monthStart : startDate;
    const clampedEnd = endDate > monthEnd ? monthEnd : endDate;
    
    const totalDays = days.length;
    const startDay = differenceInDays(clampedStart, monthStart);
    const duration = differenceInDays(clampedEnd, clampedStart) + 1;
    
    const left = (startDay / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    
    return { left: `${left}%`, width: `${Math.max(width, 3)}%` };
  };

  return (
    <div className="space-y-4">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">
            {format(currentMonth, 'yyyy年 MMMM', { locale: zhTW })}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onMonthChange(new Date())}
          >
            本月
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Days header */}
        <div className="flex border-b bg-muted/50">
          <div className="w-48 flex-shrink-0 p-2 border-r font-medium text-sm">
            工程項目
          </div>
          <div className="flex-1 flex">
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 text-center text-xs py-1 border-r last:border-r-0",
                    isWeekend && "bg-muted/80",
                    isToday && "bg-primary/10 font-bold"
                  )}
                >
                  <div className={cn(isToday && "text-primary")}>
                    {format(day, 'd')}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {format(day, 'EEE', { locale: zhTW })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignment rows */}
        {visibleAssignments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>本月無排程工程項目</p>
            <p className="text-sm">請先在表格中新增工班指派並設定日期</p>
          </div>
        ) : (
          visibleAssignments.map((assignment) => {
            const position = getBarPosition(assignment);
            const colors = statusColors[assignment.assignment_status] || statusColors['預計'];
            
            return (
              <div key={assignment.id} className="flex border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                <div className="w-48 flex-shrink-0 p-2 border-r">
                  <div className="font-medium text-sm truncate" title={assignment.construction_work_type}>
                    {assignment.construction_work_type}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {assignment.partners?.name || '未指派'}
                  </div>
                </div>
                <div className="flex-1 relative h-14">
                  {/* Day grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((day, i) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "flex-1 border-r last:border-r-0",
                            isWeekend && "bg-muted/30"
                          )} 
                        />
                      );
                    })}
                  </div>
                  
                  {/* Assignment bar */}
                  {position && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "absolute top-2 h-10 rounded-md border-2 cursor-pointer transition-all hover:scale-y-110",
                              colors.bg,
                              colors.border,
                              onAssignmentClick && "hover:brightness-95"
                            )}
                            style={{ left: position.left, width: position.width }}
                            onClick={() => onAssignmentClick?.(assignment)}
                          >
                            <span className="px-2 text-xs font-medium truncate block">
                              {assignment.partners?.name || assignment.construction_work_type}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{assignment.construction_work_type}</p>
                            <p className="text-sm">夥伴: {assignment.partners?.name || '未指派'}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {assignment.assignment_status}
                              </Badge>
                            </div>
                            {assignment.planned_start_date && (
                              <p className="text-xs text-muted-foreground">
                                預計: {assignment.planned_start_date} ~ {assignment.planned_end_date || '?'}
                              </p>
                            )}
                            {assignment.actual_start_date && (
                              <p className="text-xs text-success">
                                實際: {assignment.actual_start_date} ~ {assignment.actual_end_date || '進行中'}
                              </p>
                            )}
                            {assignment.note && (
                              <p className="text-xs text-muted-foreground">{assignment.note}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(statusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={cn("w-4 h-3 rounded border-2", colors.bg, colors.border)} />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
