import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  FolderOpen,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCustomStages, getMilestoneOptions } from "@/hooks/useCustomStages";
import { StageDefinition } from "@/types/compareConfig";

interface StageEditorProps {
  stage?: StageDefinition;
  onSave: (stage: Omit<StageDefinition, 'id' | 'isSystem' | 'sortOrder'>) => void;
  onCancel: () => void;
}

function StageEditor({ stage, onSave, onCancel }: StageEditorProps) {
  const milestoneOptions = getMilestoneOptions();
  const [label, setLabel] = useState(stage?.label || "");
  const [fromStep, setFromStep] = useState<number>(stage?.fromStep || 1);
  const [toStep, setToStep] = useState<number>(stage?.toStep || 2);
  const [description, setDescription] = useState(stage?.description || "");

  const isValid = label.trim() && fromStep !== toStep;

  const handleSave = () => {
    if (isValid) {
      onSave({
        label: label.trim(),
        fromStep,
        toStep,
        description: description.trim() || undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>階段名稱 *</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例如：前期行政"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>起始節點 *</Label>
          <Select
            value={fromStep.toString()}
            onValueChange={(v) => setFromStep(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {milestoneOptions.map((m) => (
                <SelectItem key={m.step} value={m.step.toString()}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    <span>{m.step}. {m.shortLabel}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>結束節點 *</Label>
          <Select
            value={toStep.toString()}
            onValueChange={(v) => setToStep(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {milestoneOptions.map((m) => (
                <SelectItem key={m.step} value={m.step.toString()}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    <span>{m.step}. {m.shortLabel}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fromStep === toStep && (
        <p className="text-sm text-destructive">起始與結束節點不可相同</p>
      )}

      <div className="space-y-2">
        <Label>描述（選填）</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：從客戶簽約到能源署同意備案"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={!isValid}>
          {stage ? "更新" : "新增"}
        </Button>
      </div>
    </div>
  );
}

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description?: string) => void;
}

function SaveTemplateDialog({ open, onOpenChange, onSave }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>儲存為範本</DialogTitle>
          <DialogDescription>
            將目前的自定義階段配置儲存為可重複使用的範本
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>範本名稱 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：工程進度分析"
            />
          </div>
          <div className="space-y-2">
            <Label>描述（選填）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述這個範本的用途..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!name.trim()}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomStagesPanel() {
  const {
    allStages,
    userStages,
    systemStages,
    templates,
    activeTemplateId,
    addStage,
    updateStage,
    deleteStage,
    saveAsTemplate,
    loadTemplate,
    deleteTemplate,
    resetToDefault,
  } = useCustomStages();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<StageDefinition | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);

  const handleAddStage = (stage: Omit<StageDefinition, 'id' | 'isSystem' | 'sortOrder'>) => {
    addStage(stage);
    setShowAddDialog(false);
  };

  const handleUpdateStage = (stage: Omit<StageDefinition, 'id' | 'isSystem' | 'sortOrder'>) => {
    if (editingStage) {
      updateStage(editingStage.id, stage);
      setEditingStage(null);
    }
  };

  const activeTemplate = templates.find(t => t.id === activeTemplateId);

  return (
    <div className="space-y-3">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-auto py-2 px-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-sm font-medium">自定義比較階段</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {userStages.length} 自訂
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-2">
          {/* Active Template Info */}
          {activeTemplate && (
            <div className="px-2 py-1.5 bg-primary/10 rounded-md">
              <p className="text-xs text-primary">
                目前範本：{activeTemplate.name}
              </p>
            </div>
          )}

          {/* User Stages List */}
          {userStages.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2">自訂階段</p>
              {userStages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                    <span className="text-sm truncate">{stage.label}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {stage.fromStep}→{stage.toStep}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditingStage(stage)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>刪除自訂階段</AlertDialogTitle>
                          <AlertDialogDescription>
                            確定要刪除「{stage.label}」嗎？此操作無法復原。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteStage(stage.id)}>
                            刪除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* System Stages Info */}
          <div className="px-2">
            <p className="text-xs text-muted-foreground">
              系統預設：{systemStages.length} 個階段
            </p>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 px-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  新增階段
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增自定義階段</DialogTitle>
                  <DialogDescription>
                    定義兩個里程碑之間的時間區間
                  </DialogDescription>
                </DialogHeader>
                <StageEditor
                  onSave={handleAddStage}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowSaveTemplate(true)}
              disabled={userStages.length === 0}
            >
              <Save className="h-3 w-3 mr-1" />
              儲存範本
            </Button>

            <Dialog open={showLoadTemplate} onOpenChange={setShowLoadTemplate}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={templates.length === 0}
                >
                  <FolderOpen className="h-3 w-3 mr-1" />
                  載入範本
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>載入範本</DialogTitle>
                  <DialogDescription>
                    選擇要載入的分析範本
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                          activeTemplateId === template.id && "border-primary bg-primary/5"
                        )}
                        onClick={() => {
                          loadTemplate(template.id);
                          setShowLoadTemplate(false);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{template.name}</span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>刪除範本</AlertDialogTitle>
                                <AlertDialogDescription>
                                  確定要刪除「{template.name}」嗎？
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTemplate(template.id)}>
                                  刪除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.config.stages.length} 個自訂階段
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={userStages.length === 0}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重設
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>重設為系統預設</AlertDialogTitle>
                  <AlertDialogDescription>
                    這將清除所有自定義階段，只保留系統預設的 {systemStages.length} 個階段。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={resetToDefault}>
                    確定重設
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Edit Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && setEditingStage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯自定義階段</DialogTitle>
            <DialogDescription>
              修改階段設定
            </DialogDescription>
          </DialogHeader>
          {editingStage && (
            <StageEditor
              stage={editingStage}
              onSave={handleUpdateStage}
              onCancel={() => setEditingStage(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
        onSave={saveAsTemplate}
      />
    </div>
  );
}
