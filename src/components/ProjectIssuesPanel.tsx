import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  FileEdit,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useProjectIssues,
  ProjectIssue,
  CreateIssueInput,
  IssueType,
  IssueSeverity,
  ISSUE_TYPE_LABELS,
  ISSUE_TYPE_COLORS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
} from "@/hooks/useProjectIssues";
import { useProcessStages } from "@/hooks/useProcessStages";

interface ProjectIssuesPanelProps {
  projectId: string;
  canEdit?: boolean;
}

const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string; icon: React.ReactNode }[] = [
  { value: "dispute", label: "爭議", icon: <AlertTriangle className="h-4 w-4" /> },
  { value: "delay", label: "延遲", icon: <Clock className="h-4 w-4" /> },
  { value: "design_change", label: "設計變更", icon: <FileEdit className="h-4 w-4" /> },
];

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string; color: string }[] = [
  { value: "low", label: "低", color: "bg-success" },
  { value: "medium", label: "中", color: "bg-warning" },
  { value: "high", label: "高", color: "bg-destructive" },
];

interface FormData {
  issue_type: IssueType;
  title: string;
  description: string;
  severity: IssueSeverity;
  start_date: string;
  end_date: string;
  stage_id: string;
}

const INITIAL_FORM: FormData = {
  issue_type: "dispute",
  title: "",
  description: "",
  severity: "medium",
  start_date: "",
  end_date: "",
  stage_id: "",
};

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
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
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0">
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

export function ProjectIssuesPanel({ projectId, canEdit = false }: ProjectIssuesPanelProps) {
  const { issues, stats, isLoading, createIssue, updateIssue, deleteIssue, toggleResolved, isSaving } =
    useProjectIssues(projectId);
  const { stages } = useProcessStages();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<ProjectIssue | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingIssue(null);
  };

  const handleOpenDialog = (issue?: ProjectIssue) => {
    if (issue) {
      setEditingIssue(issue);
      setFormData({
        issue_type: issue.issue_type,
        title: issue.title,
        description: issue.description || "",
        severity: issue.severity,
        start_date: issue.start_date,
        end_date: issue.end_date,
        stage_id: issue.stage_id || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.start_date || !formData.end_date) {
      return;
    }

    try {
      if (editingIssue) {
        await updateIssue(editingIssue.id, {
          issue_type: formData.issue_type,
          title: formData.title,
          description: formData.description || undefined,
          severity: formData.severity,
          start_date: formData.start_date,
          end_date: formData.end_date,
          stage_id: formData.stage_id || undefined,
        });
      } else {
        await createIssue({
          project_id: projectId,
          issue_type: formData.issue_type,
          title: formData.title,
          description: formData.description || undefined,
          severity: formData.severity,
          start_date: formData.start_date,
          end_date: formData.end_date,
          stage_id: formData.stage_id || undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteIssue(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleToggleResolved = async (issue: ProjectIssue) => {
    await toggleResolved(issue.id, !issue.is_resolved);
  };

  const getDurationDays = (startDate: string, endDate: string) => {
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  };

  const unresolvedIssues = issues.filter((i) => !i.is_resolved);
  const resolvedIssues = issues.filter((i) => i.is_resolved);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          載入中...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            問題與爭議追蹤
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              新增問題
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Summary */}
          {issues.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                總計 {stats.total} 件
              </Badge>
              {stats.unresolved > 0 && (
                <Badge variant="destructive">
                  未解決 {stats.unresolved} 件
                </Badge>
              )}
              {stats.resolved > 0 && (
                <Badge variant="secondary" className="bg-success/15 text-success">
                  已解決 {stats.resolved} 件
                </Badge>
              )}
            </div>
          )}

          {/* Unresolved Issues */}
          {unresolvedIssues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                未解決 ({unresolvedIssues.length})
              </h4>
              <div className="space-y-2">
                {unresolvedIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    canEdit={canEdit}
                    onEdit={() => handleOpenDialog(issue)}
                    onDelete={() => setDeleteConfirmId(issue.id)}
                    onToggleResolved={() => handleToggleResolved(issue)}
                    getDurationDays={getDurationDays}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolved Issues */}
          {resolvedIssues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                已解決 ({resolvedIssues.length})
              </h4>
              <ScrollArea className={resolvedIssues.length > 3 ? "h-48" : ""}>
                <div className="space-y-2 pr-2">
                  {resolvedIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      canEdit={canEdit}
                      onEdit={() => handleOpenDialog(issue)}
                      onDelete={() => setDeleteConfirmId(issue.id)}
                      onToggleResolved={() => handleToggleResolved(issue)}
                      getDurationDays={getDurationDays}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {issues.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>尚無問題或爭議記錄</p>
              {canEdit && (
                <p className="text-sm mt-1">點擊「新增問題」開始記錄</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIssue ? "編輯問題" : "新增問題"}</DialogTitle>
            <DialogDescription>
              記錄案件相關的爭議、延遲或設計變更
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Issue Type */}
            <div className="space-y-1">
              <Label className="text-xs">問題類型</Label>
              <Select
                value={formData.issue_type}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, issue_type: v as IssueType }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {ISSUE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.icon}
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs">標題</Label>
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
              <Label className="text-xs">嚴重程度</Label>
              <Select
                value={formData.severity}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, severity: v as IssueSeverity }))}
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

            {/* Related Stage */}
            <div className="space-y-1">
              <Label className="text-xs">關聯階段（選填）</Label>
              <Select
                value={formData.stage_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, stage_id: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="選擇階段" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="">不關聯</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs">說明（選填）</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="詳細說明問題..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.title || !formData.start_date || !formData.end_date || isSaving}
            >
              {editingIssue ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此問題記錄嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Individual Issue Card Component
function IssueCard({
  issue,
  canEdit,
  onEdit,
  onDelete,
  onToggleResolved,
  getDurationDays,
}: {
  issue: ProjectIssue;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleResolved: () => void;
  getDurationDays: (start: string, end: string) => number;
}) {
  const durationDays = getDurationDays(issue.start_date, issue.end_date);

  return (
    <div
      className={cn(
        "flex items-start justify-between p-3 rounded-lg border transition-colors",
        issue.is_resolved ? "bg-muted/30 opacity-70" : "bg-card"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={ISSUE_TYPE_COLORS[issue.issue_type]} variant="secondary">
            {ISSUE_TYPE_LABELS[issue.issue_type]}
          </Badge>
          <Badge className={SEVERITY_COLORS[issue.severity]} variant="secondary">
            {SEVERITY_LABELS[issue.severity]}
          </Badge>
          {issue.is_resolved && (
            <Badge variant="secondary" className="bg-success/15 text-success">
              已解決
            </Badge>
          )}
        </div>

        {/* Title */}
        <p className={cn("font-medium", issue.is_resolved && "line-through text-muted-foreground")}>
          {issue.title}
        </p>

        {/* Date Range */}
        <p className="text-sm text-muted-foreground">
          {format(parseISO(issue.start_date), "yyyy/MM/dd")} ~ {format(parseISO(issue.end_date), "yyyy/MM/dd")}
          <span className="ml-2">({durationDays} 天)</span>
        </p>

        {/* Stage */}
        {issue.stage_name && (
          <p className="text-sm text-muted-foreground">
            階段：{issue.stage_name}
          </p>
        )}

        {/* Description */}
        {issue.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {issue.description}
          </p>
        )}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-col gap-1 ml-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleResolved}
            title={issue.is_resolved ? "標記為未解決" : "標記為已解決"}
          >
            {issue.is_resolved ? (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
