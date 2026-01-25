import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
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
import { useProcessStages, ProcessStage, PHASE_OPTIONS } from '@/hooks/useProcessStages';
import { Skeleton } from '@/components/ui/skeleton';

interface StageFormData {
  code: string;
  name: string;
  description: string;
  phase: string;
  milestone_step: number | null;
  default_sla_days: number | null;
  sort_order: number;
  is_active: boolean;
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
};

const phaseColors: Record<string, string> = {
  pre_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  construction: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  operation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

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
                <TableHead className="text-center">SLA (天)</TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
