import { useState, useMemo } from 'react';
import { Save, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useProcessStages, PHASE_OPTIONS } from '@/hooks/useProcessStages';
import { useDepartments } from '@/hooks/useDepartments';
import { useStageResponsibilities } from '@/hooks/useStageResponsibilities';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const phaseColors: Record<string, string> = {
  pre_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  construction: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  operation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

interface LocalResponsibility {
  stageId: string;
  responsibleDeptId: string;
  consultedDeptIds: string[];
  existingId?: string;
}

export function StageResponsibilitiesPanel() {
  const { stages, isLoading: stagesLoading } = useProcessStages();
  const { activeDepartments, isLoading: deptsLoading } = useDepartments();
  const { responsibilities, isLoading: respLoading, upsertResponsibility } = useStageResponsibilities();
  
  const [localChanges, setLocalChanges] = useState<Record<string, LocalResponsibility>>({});
  const [saving, setSaving] = useState(false);

  const activeStages = useMemo(() => stages.filter(s => s.is_active), [stages]);

  // Initialize local state from fetched data
  const getLocalResp = (stageId: string): LocalResponsibility => {
    if (localChanges[stageId]) {
      return localChanges[stageId];
    }
    const existing = responsibilities.find(r => r.stage_id === stageId);
    if (existing) {
      return {
        stageId,
        responsibleDeptId: existing.responsible_department_id,
        consultedDeptIds: existing.consulted_department_ids || [],
        existingId: existing.id,
      };
    }
    return {
      stageId,
      responsibleDeptId: '',
      consultedDeptIds: [],
    };
  };

  const handleResponsibleChange = (stageId: string, deptId: string) => {
    const current = getLocalResp(stageId);
    setLocalChanges({
      ...localChanges,
      [stageId]: {
        ...current,
        responsibleDeptId: deptId,
        // Remove from consulted if selected as responsible
        consultedDeptIds: current.consultedDeptIds.filter(id => id !== deptId),
      },
    });
  };

  const handleConsultedToggle = (stageId: string, deptId: string) => {
    const current = getLocalResp(stageId);
    const isChecked = current.consultedDeptIds.includes(deptId);
    setLocalChanges({
      ...localChanges,
      [stageId]: {
        ...current,
        consultedDeptIds: isChecked
          ? current.consultedDeptIds.filter(id => id !== deptId)
          : [...current.consultedDeptIds, deptId],
      },
    });
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const [stageId, resp] of Object.entries(localChanges)) {
        if (resp.responsibleDeptId) {
          await upsertResponsibility.mutateAsync({
            id: resp.existingId,
            stage_id: stageId,
            responsible_department_id: resp.responsibleDeptId,
            consulted_department_ids: resp.consultedDeptIds,
            notes: null,
          });
        }
      }
      setLocalChanges({});
    } finally {
      setSaving(false);
    }
  };

  const getPhaseLabel = (phase: string) => {
    return PHASE_OPTIONS.find(p => p.value === phase)?.label || phase;
  };

  const getDeptName = (id: string) => {
    return activeDepartments.find(d => d.id === id)?.name || id;
  };

  const isLoading = stagesLoading || deptsLoading || respLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            責任矩陣設定
          </CardTitle>
          <CardDescription>
            設定每個流程階段的主責部門 (R) 與會同部門 (C)
          </CardDescription>
        </div>
        {hasChanges && (
          <Button onClick={handleSaveAll} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '儲存中...' : '儲存變更'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-32">流程階段</TableHead>
                <TableHead className="min-w-24">分類</TableHead>
                <TableHead className="min-w-40">主責部門 (R)</TableHead>
                <TableHead>會同部門 (C)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeStages.map((stage) => {
                const resp = getLocalResp(stage.id);
                const isModified = !!localChanges[stage.id];
                
                return (
                  <TableRow key={stage.id} className={cn(isModified && 'bg-primary/5')}>
                    <TableCell className="font-medium">
                      {stage.name}
                      {isModified && (
                        <Badge variant="outline" className="ml-2 text-xs">已修改</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={phaseColors[stage.phase] || ''}>
                        {getPhaseLabel(stage.phase)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={resp.responsibleDeptId || 'none'}
                        onValueChange={(v) => handleResponsibleChange(stage.id, v === 'none' ? '' : v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="選擇主責部門" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">未指定</span>
                          </SelectItem>
                          {activeDepartments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {activeDepartments
                          .filter(d => d.id !== resp.responsibleDeptId)
                          .map((dept) => {
                            const isChecked = resp.consultedDeptIds.includes(dept.id);
                            return (
                              <label
                                key={dept.id}
                                className={cn(
                                  'flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-colors',
                                  isChecked 
                                    ? 'bg-primary/10 border-primary/30' 
                                    : 'hover:bg-muted'
                                )}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleConsultedToggle(stage.id, dept.id)}
                                />
                                <span className="text-sm">{dept.name}</span>
                              </label>
                            );
                          })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {activeStages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    請先設定流程階段
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium mb-2">責任矩陣說明</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>R (Responsible)</strong>：主責部門，負責執行該階段工作</li>
            <li><strong>C (Consulted)</strong>：會同部門，需諮詢或協調配合</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
