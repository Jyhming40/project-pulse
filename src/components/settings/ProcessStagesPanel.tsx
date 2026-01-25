import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProcessStages, ProcessStage, PHASE_OPTIONS } from '@/hooks/useProcessStages';
import { Skeleton } from '@/components/ui/skeleton';
import { TIMELINE_DOC_MAPPING } from '@/hooks/useProjectComparison';

interface StageFormData {
  code: string;
  name: string;
  description: string;
  phase: string;
  milestone_step: number | null;
  default_sla_days: number | null;
  sort_order: number;
  is_active: boolean;
  // 比較分析擴展欄位
  from_milestone_step: number | null;
  to_milestone_step: number | null;
  is_comparison_stage: boolean;
  comparison_sort_order: number | null;
}

const initialFormData: StageFormData = {
  code: '',
  name: '',
  description: '',
  phase: 'pre_review',
  milestone_step: null,
  default_sla_days: 14,
  sort_order: 0,
  is_active: true,
  from_milestone_step: null,
  to_milestone_step: null,
  is_comparison_stage: false,
  comparison_sort_order: null,
};

const phaseColors: Record<string, string> = {
  pre_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  construction: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  operation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

// 里程碑選項 (0-11)
const milestoneOptions = TIMELINE_DOC_MAPPING.map(m => ({
  step: m.step,
  label: m.label,
  short: m.short,
  color: m.color,
}));

export function ProcessStagesPanel() {
  const { stages, isLoading, createStage, updateStage, deleteStage } = useProcessStages();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProcessStage | null>(null);
  const [formData, setFormData] = useState<StageFormData>(initialFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingStage(null);
    setFormData({
      ...initialFormData,
      sort_order: stages.length + 1,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (stage: ProcessStage) => {
    setEditingStage(stage);
    setFormData({
      code: stage.code,
      name: stage.name,
      description: stage.description || '',
      phase: stage.phase,
      milestone_step: stage.milestone_step,
      default_sla_days: stage.default_sla_days,
      sort_order: stage.sort_order,
      is_active: stage.is_active,
      from_milestone_step: stage.from_milestone_step,
      to_milestone_step: stage.to_milestone_step,
      is_comparison_stage: stage.is_comparison_stage,
      comparison_sort_order: stage.comparison_sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingStage) {
      await updateStage.mutateAsync({
        id: editingStage.id,
        ...formData,
      });
    } else {
      await createStage.mutateAsync(formData);
    }
    setIsDialogOpen(false);
    setFormData(initialFormData);
  };

  const handleDelete = async (id: string) => {
    await deleteStage.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleToggleActive = async (stage: ProcessStage) => {
    await updateStage.mutateAsync({
      id: stage.id,
      is_active: !stage.is_active,
    });
  };

  const getPhaseLabel = (phase: string) => {
    return PHASE_OPTIONS.find(p => p.value === phase)?.label || phase;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>流程階段設定</CardTitle>
            <CardDescription>定義案件生命週期的流程階段，對應里程碑節點</CardDescription>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            新增階段
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>代碼</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>階段分類</TableHead>
                <TableHead className="text-center">里程碑</TableHead>
                <TableHead className="text-center">SLA</TableHead>
                <TableHead className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">
                          <BarChart3 className="w-3 h-3" />
                          比較
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>是否用於案件比較分析</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-20">狀態</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((stage, index) => (
                <TableRow key={stage.id} className={!stage.is_active ? 'opacity-50' : ''}>
                  <TableCell className="text-muted-foreground">
                    <GripVertical className="w-4 h-4 inline mr-1" />
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{stage.code}</code>
                  </TableCell>
                  <TableCell className="font-medium">{stage.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={phaseColors[stage.phase] || ''}>
                      {getPhaseLabel(stage.phase)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {stage.milestone_step !== null ? (
                      <Badge variant="secondary">Step {stage.milestone_step}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {stage.default_sla_days ?? '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {stage.is_comparison_stage ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="default" className="text-xs">
                              {stage.from_milestone_step}→{stage.to_milestone_step}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {milestoneOptions.find(m => m.step === stage.from_milestone_step)?.short || stage.from_milestone_step}
                              {' → '}
                              {milestoneOptions.find(m => m.step === stage.to_milestone_step)?.short || stage.to_milestone_step}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={stage.is_active}
                      onCheckedChange={() => handleToggleActive(stage)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(stage)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(stage.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {stages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    尚無流程階段資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStage ? '編輯流程階段' : '新增流程階段'}</DialogTitle>
            <DialogDescription>
              {editingStage ? '修改流程階段設定' : '建立新的流程階段'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">代碼 *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="taipower_review"
                  disabled={!!editingStage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">名稱 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="台電審查"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phase">階段分類</Label>
                <Select
                  value={formData.phase}
                  onValueChange={(value) => setFormData({ ...formData, phase: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestone_step">對應里程碑 (Step)</Label>
                <Input
                  id="milestone_step"
                  type="number"
                  value={formData.milestone_step ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    milestone_step: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="0-11"
                  min={0}
                  max={11}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_sla_days">預設 SLA (天)</Label>
                <Input
                  id="default_sla_days"
                  type="number"
                  value={formData.default_sla_days ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    default_sla_days: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="14"
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">排序</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="階段說明..."
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">啟用</Label>
            </div>

            <Separator />

            {/* 比較分析設定區塊 */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-sm font-medium">比較分析設定</span>
                  </div>
                  {formData.is_comparison_stage && (
                    <Badge variant="secondary" className="text-xs">
                      已設定
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_comparison_stage"
                    checked={formData.is_comparison_stage}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      is_comparison_stage: checked,
                      // 若開啟則設定預設值
                      from_milestone_step: checked && formData.from_milestone_step === null ? 0 : formData.from_milestone_step,
                      to_milestone_step: checked && formData.to_milestone_step === null ? 1 : formData.to_milestone_step,
                    })}
                  />
                  <Label htmlFor="is_comparison_stage">用於案件比較分析</Label>
                </div>

                {formData.is_comparison_stage && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>起始節點 *</Label>
                        <Select
                          value={formData.from_milestone_step?.toString() ?? '0'}
                          onValueChange={(v) => setFormData({ 
                            ...formData, 
                            from_milestone_step: parseInt(v) 
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {milestoneOptions.map((m) => (
                              <SelectItem key={m.step} value={m.step.toString()}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: m.color }}
                                  />
                                  <span className="truncate">{m.step}. {m.short}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>結束節點 *</Label>
                        <Select
                          value={formData.to_milestone_step?.toString() ?? '1'}
                          onValueChange={(v) => setFormData({ 
                            ...formData, 
                            to_milestone_step: parseInt(v) 
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {milestoneOptions.map((m) => (
                              <SelectItem key={m.step} value={m.step.toString()}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: m.color }}
                                  />
                                  <span className="truncate">{m.step}. {m.short}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {formData.from_milestone_step === formData.to_milestone_step && (
                      <p className="text-sm text-destructive">起始與結束節點不可相同</p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="comparison_sort_order">比較排序</Label>
                      <Input
                        id="comparison_sort_order"
                        type="number"
                        value={formData.comparison_sort_order ?? ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          comparison_sort_order: e.target.value ? parseInt(e.target.value) : null 
                        })}
                        placeholder="顯示順序"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      設定後，此階段將出現在「案件比較分析」頁面的區間選項中
                    </p>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.code || !formData.name || createStage.isPending || updateStage.isPending}
            >
              {createStage.isPending || updateStage.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除此流程階段嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteStage.isPending}
            >
              {deleteStage.isPending ? '刪除中...' : '刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
