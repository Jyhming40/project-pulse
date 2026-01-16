import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TIMELINE_MILESTONES, ComparisonResult } from "@/hooks/useProjectComparison";
import { CheckCircle2, Circle } from "lucide-react";

interface MilestoneDatesTableProps {
  results: ComparisonResult[];
}

export function MilestoneDatesTable({ results }: MilestoneDatesTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        請選擇案件以顯示里程碑日期
      </div>
    );
  }

  // Reverse milestones for display (10→1 becomes visible as 1→10 from bottom)
  const reversedMilestones = [...TIMELINE_MILESTONES].reverse();

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[60px] text-center">步驟</TableHead>
            <TableHead className="min-w-[120px]">里程碑 (由下而上)</TableHead>
            {results.map(r => (
              <TableHead key={r.project.id} className="min-w-[120px] text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="truncate max-w-[120px]" title={r.project.project_name}>
                    {r.project.project_name.length > 10 
                      ? r.project.project_name.substring(0, 10) + '...'
                      : r.project.project_name}
                  </span>
                  {r.isBaseline && (
                    <Badge variant="destructive" className="text-xs">卡關案件</Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reversedMilestones.map((milestone, idx) => {
            const stepNumber = TIMELINE_MILESTONES.length - idx;
            
            return (
              <TableRow key={milestone.code} className="hover:bg-muted/30">
                <TableCell className="text-center font-mono font-medium text-muted-foreground">
                  {stepNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: milestone.color }}
                    />
                    <span className="font-medium">{milestone.label}</span>
                  </div>
                </TableCell>
                {results.map(r => {
                  const completedAt = r.milestones[milestone.code];
                  const isCompleted = !!completedAt;
                  
                  return (
                    <TableCell key={r.project.id} className="text-center">
                      {isCompleted ? (
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            {format(new Date(completedAt), "yyyy/MM/dd", { locale: zhTW })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Circle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">-</span>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
