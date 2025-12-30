import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DataEnrichmentPanelProps {
  selectedIds: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}

// Admin progress options
const ADMIN_PROGRESS_OPTIONS = [
  { value: 'not_started', label: '未開始', stage: null },
  { value: 'in_progress', label: '進行中', stage: '行政作業中' },
  { value: 'completed', label: '已完成', stage: '行政結案' },
];

// Engineering stage options
const ENGINEERING_STAGE_OPTIONS = [
  { value: 'design', label: '設計', stage: '設計階段' },
  { value: 'procurement', label: '採購', stage: '材料採購' },
  { value: 'construction', label: '施工', stage: '現場施工' },
  { value: 'completed', label: '完工', stage: '工程完工' },
];

export function DataEnrichmentPanel({
  selectedIds,
  onClose,
  onSuccess,
}: DataEnrichmentPanelProps) {
  const queryClient = useQueryClient();
  const selectedCount = selectedIds.size;

  // Form state - only checked fields will be applied
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    admin_progress: false,
    engineering_stage: false,
    milestones: false,
    overall_progress: false,
  });

  const [adminProgress, setAdminProgress] = useState<string>('');
  const [engineeringStage, setEngineeringStage] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<string>('');
  const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set());
  
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch available milestones
  const { data: milestones = [] } = useQuery({
    queryKey: ['progress-milestones-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_milestones')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  // Group milestones by type
  const adminMilestones = useMemo(() => 
    milestones.filter(m => m.milestone_type === 'admin'), [milestones]);
  const engineeringMilestones = useMemo(() => 
    milestones.filter(m => m.milestone_type === 'engineering'), [milestones]);

  // Toggle field enable
  const toggleField = (field: string) => {
    setEnabledFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Toggle milestone selection
  const toggleMilestone = (code: string) => {
    setSelectedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Get fields that will be updated
  const getActiveFields = () => {
    const fields: string[] = [];
    if (enabledFields.admin_progress && adminProgress) fields.push('行政進度');
    if (enabledFields.engineering_stage && engineeringStage) fields.push('工程階段');
    if (enabledFields.milestones && selectedMilestones.size > 0) fields.push('里程碑完成度');
    if (enabledFields.overall_progress && overallProgress) fields.push('整體進度百分比');
    return fields;
  };

  // Batch update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const projectIds = Array.from(selectedIds);
      const updates: Record<string, any> = {};
      
      // Build updates based on enabled fields
      if (enabledFields.admin_progress && adminProgress) {
        const option = ADMIN_PROGRESS_OPTIONS.find(o => o.value === adminProgress);
        if (option) {
          updates.admin_stage = option.stage;
          // Set admin_progress percentage based on selection
          if (adminProgress === 'not_started') updates.admin_progress = 0;
          else if (adminProgress === 'in_progress') updates.admin_progress = 50;
          else if (adminProgress === 'completed') updates.admin_progress = 100;
        }
      }
      
      if (enabledFields.engineering_stage && engineeringStage) {
        const option = ENGINEERING_STAGE_OPTIONS.find(o => o.value === engineeringStage);
        if (option) {
          updates.engineering_stage = option.stage;
          // Set engineering_progress percentage based on selection
          if (engineeringStage === 'design') updates.engineering_progress = 25;
          else if (engineeringStage === 'procurement') updates.engineering_progress = 50;
          else if (engineeringStage === 'construction') updates.engineering_progress = 75;
          else if (engineeringStage === 'completed') updates.engineering_progress = 100;
        }
      }
      
      if (enabledFields.overall_progress && overallProgress) {
        const progress = Math.min(100, Math.max(0, parseInt(overallProgress) || 0));
        updates.overall_progress = progress;
      }

      // Update projects if there are field changes
      if (Object.keys(updates).length > 0) {
        const { data: oldData } = await supabase
          .from('projects')
          .select('id, admin_stage, engineering_stage, admin_progress, engineering_progress, overall_progress')
          .in('id', projectIds);

        const { error } = await supabase
          .from('projects')
          .update(updates)
          .in('id', projectIds);
        if (error) throw error;

        // Log audit for each project
        for (const id of projectIds) {
          const oldRecord = oldData?.find(r => r.id === id);
          await supabase.rpc('log_audit_action', {
            p_table_name: 'projects',
            p_record_id: id,
            p_action: 'UPDATE',
            p_old_data: oldRecord || null,
            p_new_data: { ...oldRecord, ...updates },
            p_reason: `資料補齊模式批次更新 ${projectIds.length} 筆`,
          });
        }
      }

      // Update milestones if enabled
      if (enabledFields.milestones && selectedMilestones.size > 0) {
        for (const projectId of projectIds) {
          for (const milestoneCode of selectedMilestones) {
            // Upsert milestone completion
            const { error } = await supabase
              .from('project_milestones')
              .upsert({
                project_id: projectId,
                milestone_code: milestoneCode,
                is_completed: true,
                completed_at: new Date().toISOString(),
              }, {
                onConflict: 'project_id,milestone_code',
              });
            if (error) {
              // If upsert fails due to no unique constraint, try insert
              await supabase
                .from('project_milestones')
                .insert({
                  project_id: projectId,
                  milestone_code: milestoneCode,
                  is_completed: true,
                  completed_at: new Date().toISOString(),
                });
            }
          }
        }
      }

      return { count: projectIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
      toast.success('批次更新成功', {
        description: `已更新 ${data.count} 筆案場資料`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  const handleApply = () => {
    const activeFields = getActiveFields();
    if (activeFields.length === 0) {
      toast.error('請至少勾選一個欄位並填入值');
      return;
    }
    setShowConfirm(true);
  };

  const confirmApply = () => {
    setShowConfirm(false);
    updateMutation.mutate();
  };

  const activeFields = getActiveFields();

  return (
    <>
      <div className="h-full flex flex-col bg-warning/5 border-l border-warning/20">
        {/* Header */}
        <div className="p-4 border-b border-warning/20 bg-warning/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">資料補齊面板</h3>
              <p className="text-sm text-muted-foreground mt-1">
                已選取 <span className="font-medium text-warning">{selectedCount}</span> 筆案場
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Admin Progress */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-admin"
                  checked={enabledFields.admin_progress}
                  onCheckedChange={() => toggleField('admin_progress')}
                />
                <Label htmlFor="enable-admin" className="font-medium cursor-pointer">
                  行政進度
                </Label>
              </div>
              {enabledFields.admin_progress && (
                <Select value={adminProgress} onValueChange={setAdminProgress}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇行政進度" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_PROGRESS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Engineering Stage */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-engineering"
                  checked={enabledFields.engineering_stage}
                  onCheckedChange={() => toggleField('engineering_stage')}
                />
                <Label htmlFor="enable-engineering" className="font-medium cursor-pointer">
                  工程階段
                </Label>
              </div>
              {enabledFields.engineering_stage && (
                <Select value={engineeringStage} onValueChange={setEngineeringStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇工程階段" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINEERING_STAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Milestones */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-milestones"
                  checked={enabledFields.milestones}
                  onCheckedChange={() => toggleField('milestones')}
                />
                <Label htmlFor="enable-milestones" className="font-medium cursor-pointer">
                  里程碑完成度
                </Label>
              </div>
              {enabledFields.milestones && (
                <div className="space-y-4 pl-6">
                  {/* Admin Milestones */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">行政里程碑</p>
                    <div className="space-y-2">
                      {adminMilestones.map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`milestone-${m.milestone_code}`}
                            checked={selectedMilestones.has(m.milestone_code)}
                            onCheckedChange={() => toggleMilestone(m.milestone_code)}
                          />
                          <Label 
                            htmlFor={`milestone-${m.milestone_code}`}
                            className="text-sm cursor-pointer"
                          >
                            {m.milestone_name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Engineering Milestones */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">工程里程碑</p>
                    <div className="space-y-2">
                      {engineeringMilestones.map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`milestone-${m.milestone_code}`}
                            checked={selectedMilestones.has(m.milestone_code)}
                            onCheckedChange={() => toggleMilestone(m.milestone_code)}
                          />
                          <Label 
                            htmlFor={`milestone-${m.milestone_code}`}
                            className="text-sm cursor-pointer"
                          >
                            {m.milestone_name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Overall Progress */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-progress"
                  checked={enabledFields.overall_progress}
                  onCheckedChange={() => toggleField('overall_progress')}
                />
                <Label htmlFor="enable-progress" className="font-medium cursor-pointer">
                  整體進度百分比
                </Label>
              </div>
              {enabledFields.overall_progress && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={overallProgress}
                    onChange={(e) => setOverallProgress(e.target.value)}
                    placeholder="0-100"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-warning/20 bg-card">
          <Button
            onClick={handleApply}
            disabled={selectedCount === 0 || updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                更新中...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                套用到選取案場
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認批次更新</AlertDialogTitle>
            <AlertDialogDescription>
              你即將更新 <span className="font-medium text-foreground">{selectedCount}</span> 筆案場的：
              <ul className="mt-2 list-disc list-inside">
                {activeFields.map(field => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              <p className="mt-3">此操作無法復原，是否確認執行？</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>確認更新</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
