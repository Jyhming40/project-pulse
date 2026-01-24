import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Scale, Filter, Eye, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { 
  ProjectDispute, 
  DisputeDisplayStrategy,
  useProjectDisputes 
} from "@/hooks/useProjectDisputes";
import { ProjectForComparison } from "@/hooks/useProjectComparison";

interface DisputeSettingsPanelProps {
  selectedProjects: ProjectForComparison[];
}

type DisputeFormData = Omit<ProjectDispute, "id">;

const SEVERITY_OPTIONS = [
  { value: "low", label: "低", color: "bg-green-500" },
  { value: "medium", label: "中", color: "bg-yellow-500" },
  { value: "high", label: "高", color: "bg-red-500" },
];

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ? format(parseISO(value), "yyyy/MM/dd") : "");

  // Sync inputValue when value prop changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    
    // Try to parse the input as a date
    // Support formats: yyyy/MM/dd, yyyy-MM-dd, yyyyMMdd
    const cleaned = raw.replace(/[\/\-]/g, "");
    if (cleaned.length === 8) {
      const year = cleaned.slice(0, 4);
      const month = cleaned.slice(4, 6);
      const day = cleaned.slice(6, 8);
      const dateStr = `${year}-${month}-${day}`;
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        onChange(dateStr);
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, "yyyy-MM-dd");
      onChange(formatted);
      setInputValue(format(date, "yyyy/MM/dd"));
      setOpen(false);
    }
  };

  // Update input when value changes externally
  const displayValue = value ? format(parseISO(value), "yyyy/MM/dd") : "";
  if (displayValue && inputValue !== displayValue && !inputValue.includes(displayValue.replace(/\//g, ""))) {
    // Only sync if the parsed value is different
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Input
          value={inputValue || (value ? format(parseISO(value), "yyyy/MM/dd") : "")}
          onChange={handleInputChange}
          placeholder="yyyy/MM/dd"
          className="h-9 flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
            <Calendar
              mode="single"
              selected={value ? parseISO(value) : undefined}
              onSelect={handleCalendarSelect}
              locale={zhTW}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function DisputeSettingsPanel({ selectedProjects }: DisputeSettingsPanelProps) {
  const {
    disputes,
    strategy,
    addDispute,
    updateDispute,
    deleteDispute,
    getDisputesByProject,
    updateStrategy,
    isSaving,
  } = useProjectDisputes();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDispute, setEditingDispute] = useState<ProjectDispute | null>(null);
  const [formData, setFormData] = useState<DisputeFormData>({
    project_id: "",
    title: "",
    start_date: "",
    end_date: "",
    severity: "medium",
    note: "",
  });

  const resetForm = () => {
    setFormData({
      project_id: selectedProjects[0]?.id || "",
      title: "",
      start_date: "",
      end_date: "",
      severity: "medium",
      note: "",
    });
    setEditingDispute(null);
  };

  const handleOpenDialog = (dispute?: ProjectDispute) => {
    if (dispute) {
      setEditingDispute(dispute);
      setFormData({
        project_id: dispute.project_id,
        title: dispute.title,
        start_date: dispute.start_date,
        end_date: dispute.end_date,
        severity: dispute.severity,
        note: dispute.note || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.project_id || !formData.title || !formData.start_date || !formData.end_date) {
      return;
    }

    try {
      if (editingDispute) {
        await updateDispute(editingDispute.id, formData);
      } else {
        await addDispute(formData);
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error toast is handled in the mutation
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDispute(id);
    } catch (error) {
      // Error toast is handled in the mutation
    }
  };

  // Get disputes for selected projects
  const relevantDisputes = disputes.filter((d) =>
    selectedProjects.some((p) => p.id === d.project_id)
  );

  const getProjectName = (projectId: string) => {
    return selectedProjects.find((p) => p.id === projectId)?.project_name || "未知案場";
  };

  return (
    <div className="space-y-3">
      {/* Add Dispute Button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => handleOpenDialog()}
            disabled={selectedProjects.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            新增爭議期間
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDispute ? "編輯爭議" : "新增爭議期間"}</DialogTitle>
            <DialogDescription>
              設定爭議期間以分析延宕與爭議的關聯性
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Project Select */}
            <div className="space-y-1">
              <Label className="text-xs">案場</Label>
              <Select
                value={formData.project_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, project_id: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="選擇案場" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {selectedProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs">爭議標題</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例：鄰居抗議施工"
                className="h-9"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField
                label="起始日期"
                value={formData.start_date}
                onChange={(date) => setFormData((prev) => ({ ...prev, start_date: date }))}
              />
              <DatePickerField
                label="結束日期"
                value={formData.end_date}
                onChange={(date) => setFormData((prev) => ({ ...prev, end_date: date }))}
              />
            </div>

            {/* Severity */}
            <div className="space-y-1">
              <Label className="text-xs">嚴重度</Label>
              <Select
                value={formData.severity}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, severity: v as "low" | "medium" | "high" }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", opt.color)} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="space-y-1">
              <Label className="text-xs">備註（選填）</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="詳細說明..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!formData.title || !formData.start_date || !formData.end_date}>
              {editingDispute ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute List */}
      {relevantDisputes.length > 0 ? (
        <ScrollArea className="h-40">
          <div className="space-y-2 pr-2">
            {relevantDisputes.map((dispute) => (
              <div
                key={dispute.id}
                className="flex items-start justify-between p-2 rounded-md border bg-muted/30 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        dispute.severity === "high"
                          ? "bg-red-500"
                          : dispute.severity === "medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      )}
                    />
                    <span className="font-medium truncate">{dispute.title}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {getProjectName(dispute.project_id)}
                  </div>
                  <div className="text-muted-foreground">
                    {format(parseISO(dispute.start_date), "yyyy/MM/dd")} ~{" "}
                    {format(parseISO(dispute.end_date), "yyyy/MM/dd")}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleOpenDialog(dispute)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(dispute.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-4">
          <Scale className="h-6 w-6 mx-auto mb-2 opacity-50" />
          尚無爭議資料
          <br />
          點擊上方按鈕新增
        </div>
      )}

      {/* Summary */}
      {relevantDisputes.length > 0 && (
        <div className="text-xs text-muted-foreground">
          共 {relevantDisputes.length} 筆爭議
        </div>
      )}
    </div>
  );
}

// Dispute Display Strategy Controls
export function DisputeDisplayStrategyPanel() {
  const { strategy, updateStrategy } = useProjectDisputes();

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1.5">
          <Filter className="h-3 w-3" />
          顯示範圍
        </Label>
        <Select
          value={strategy.filter}
          onValueChange={(v) => updateStrategy({ filter: v as DisputeDisplayStrategy["filter"] })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="all">顯示全部</SelectItem>
            <SelectItem value="high">只顯示 高嚴重度</SelectItem>
            <SelectItem value="intersecting">只顯示與區間交集</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
            <Eye className="h-3 w-3" />
            顯示重疊天數
          </Label>
          <Switch
            checked={strategy.showOverlapDays}
            onCheckedChange={(v) => updateStrategy({ showOverlapDays: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
            <Tag className="h-3 w-3" />
            顯示爭議標籤
          </Label>
          <Switch
            checked={strategy.showDisputeLabels}
            onCheckedChange={(v) => updateStrategy({ showDisputeLabels: v })}
          />
        </div>
      </div>
    </div>
  );
}
