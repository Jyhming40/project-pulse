import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, RefreshCw, CalendarDays } from "lucide-react";
import { DEFAULT_SCHEDULE_ITEMS, ScheduleItem, calculateScheduleDates } from "@/lib/quoteCalculations";
import { format, addDays, differenceInDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Plot } from "@/lib/plotly";

interface QuoteScheduleTabProps {
  quoteId: string | null;
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  pre_work: { label: "前置作業", color: "hsl(210, 70%, 50%)" },
  construction: { label: "工程進行", color: "hsl(173, 58%, 45%)" },
  completion: { label: "工程結尾", color: "hsl(38, 92%, 50%)" },
  closing: { label: "結案階段", color: "hsl(280, 60%, 50%)" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending: { label: "待執行", variant: "secondary" },
  in_progress: { label: "進行中", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
};

export default function QuoteScheduleTab({ quoteId }: QuoteScheduleTabProps) {
  const [projectStartDate, setProjectStartDate] = useState<Date>(new Date());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(
    DEFAULT_SCHEDULE_ITEMS.map((item, idx) => ({
      ...item,
      id: `schedule-${idx}`,
    }))
  );

  // Calculate dates based on start date
  const calculatedSchedule = useMemo(() => {
    return calculateScheduleDates(scheduleItems, projectStartDate);
  }, [scheduleItems, projectStartDate]);

  // Group by phase
  const groupedSchedule = useMemo(() => {
    const groups: Record<string, ScheduleItem[]> = {};
    calculatedSchedule.forEach((item) => {
      if (!groups[item.phase]) {
        groups[item.phase] = [];
      }
      groups[item.phase].push(item);
    });
    return groups;
  }, [calculatedSchedule]);

  // Prepare Gantt chart data
  const ganttData = useMemo(() => {
    return calculatedSchedule.map((item) => ({
      Task: `${item.itemCode ? `${item.itemCode}. ` : ""}${item.itemName}`,
      Start: item.startDate,
      End: item.endDate,
      Phase: item.phase,
      Duration: item.durationDays,
      PaymentMilestone: item.paymentMilestone,
    }));
  }, [calculatedSchedule]);

  // Calculate total project duration
  const projectEndDate = calculatedSchedule.length > 0
    ? calculatedSchedule[calculatedSchedule.length - 1].endDate
    : projectStartDate;
  const totalDays = projectEndDate ? differenceInDays(projectEndDate, projectStartDate) : 0;

  // Update item
  const updateItem = (id: string, field: keyof ScheduleItem, value: any) => {
    setScheduleItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setScheduleItems(
      DEFAULT_SCHEDULE_ITEMS.map((item, idx) => ({
        ...item,
        id: `schedule-${idx}`,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">專案開始日期:</span>
          </div>
          <Input
            type="date"
            className="w-40"
            value={format(projectStartDate, "yyyy-MM-dd")}
            onChange={(e) => setProjectStartDate(new Date(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-muted-foreground">
            預計工期: {totalDays} 天
          </Badge>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重設
          </Button>
        </div>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            甘特圖
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Plot
            data={Object.entries(PHASE_LABELS).map(([phase, { label, color }]) => ({
              type: "bar",
              orientation: "h",
              name: label,
              y: ganttData.filter((d) => d.Phase === phase).map((d) => d.Task),
              x: ganttData.filter((d) => d.Phase === phase).map((d) => d.Duration),
              base: ganttData
                .filter((d) => d.Phase === phase)
                .map((d) => differenceInDays(d.Start!, projectStartDate)),
              marker: { color },
              hovertemplate: "%{y}<br>工期: %{x} 天<extra></extra>",
            }))}
            layout={{
              autosize: true,
              height: Math.max(400, calculatedSchedule.length * 25),
              margin: { l: 250, r: 50, t: 30, b: 50 },
              showlegend: true,
              legend: { orientation: "h", y: -0.1 },
              xaxis: {
                title: "天數",
                tickformat: "d",
              },
              yaxis: {
                autorange: "reversed",
                tickfont: { size: 11 },
              },
              barmode: "stack",
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </CardContent>
      </Card>

      {/* Schedule Table by Phase */}
      {Object.entries(PHASE_LABELS).map(([phase, { label, color }]) => {
        const items = groupedSchedule[phase] || [];
        if (items.length === 0) return null;

        return (
          <Card key={phase}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">項次</TableHead>
                    <TableHead>工項名稱</TableHead>
                    <TableHead className="w-24">工期 (天)</TableHead>
                    <TableHead className="w-32">開始日期</TableHead>
                    <TableHead className="w-32">結束日期</TableHead>
                    <TableHead className="w-36">請款期程</TableHead>
                    <TableHead className="w-24">狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.itemCode || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.itemName}</p>
                          {item.itemDescription && (
                            <p className="text-xs text-muted-foreground">{item.itemDescription}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20 h-8"
                          value={item.durationDays || 1}
                          onChange={(e) =>
                            updateItem(item.id!, "durationDays", parseInt(e.target.value) || 1)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.startDate
                          ? format(item.startDate, "yyyy/MM/dd", { locale: zhTW })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.endDate
                          ? format(item.endDate, "yyyy/MM/dd", { locale: zhTW })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {item.paymentMilestone ? (
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {item.paymentMilestone}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(v) => updateItem(item.id!, "status", v)}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
