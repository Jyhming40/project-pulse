import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { X, CheckCircle2, Loader2, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface ProgressMilestone {
  id: string;
  milestone_type: 'admin' | 'engineering';
  milestone_code: string;
  milestone_name: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

interface ProjectMilestone {
  id: string;
  project_id: string;
  milestone_code: string;
  is_completed: boolean;
}

// Result item for showing progress update results
interface ProgressUpdateResult {
  projectId: string;
  projectCode: string;
  projectName: string;
  oldProgress: {
    admin: number;
    engineering: number;
    overall: number;
  };
  newProgress: {
    admin: number;
    engineering: number;
    overall: number;
  };
}

// Helper function to recalculate and update project progress
async function recalculateProjectProgress(projectId: string, token: string) {
  // Fetch all progress milestones
  const milestonesResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_milestones?is_active=eq.true`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const allMilestones = await milestonesResponse.json() as ProgressMilestone[];

  // Fetch project's completed milestones
  const projectMilestonesResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_milestones?project_id=eq.${projectId}&is_completed=eq.true`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const completedMilestones = await projectMilestonesResponse.json() as ProjectMilestone[];
  const completedCodes = new Set(completedMilestones.map(m => m.milestone_code));

  // Fetch weight settings
  const settingsResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_settings?setting_key=eq.weights`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const settingsData = await settingsResponse.json();
  const weightSettings = settingsData?.[0]?.setting_value || { admin_weight: 50, engineering_weight: 50 };
  const adminWeight = weightSettings.admin_weight ?? 50;
  const engineeringWeight = weightSettings.engineering_weight ?? 50;

  // Calculate admin progress
  const adminMilestones = allMilestones.filter(m => m.milestone_type === 'admin');
  const adminTotalWeight = adminMilestones.reduce((sum, m) => sum + m.weight, 0);
  const adminCompletedWeight = adminMilestones
    .filter(m => completedCodes.has(m.milestone_code))
    .reduce((sum, m) => sum + m.weight, 0);
  const adminProgress = adminTotalWeight > 0 ? (adminCompletedWeight / adminTotalWeight) * 100 : 0;

  // Calculate engineering progress
  const engMilestones = allMilestones.filter(m => m.milestone_type === 'engineering');
  const engTotalWeight = engMilestones.reduce((sum, m) => sum + m.weight, 0);
  const engCompletedWeight = engMilestones
    .filter(m => completedCodes.has(m.milestone_code))
    .reduce((sum, m) => sum + m.weight, 0);
  const engineeringProgress = engTotalWeight > 0 ? (engCompletedWeight / engTotalWeight) * 100 : 0;

  // Calculate overall progress using configured weights
  const overallProgress = 
    (adminProgress * adminWeight / 100) + 
    (engineeringProgress * engineeringWeight / 100);

  // Find current stage for admin and engineering
  const sortedAdminMilestones = adminMilestones.sort((a, b) => a.sort_order - b.sort_order);
  const sortedEngMilestones = engMilestones.sort((a, b) => a.sort_order - b.sort_order);
  
  const adminStage = sortedAdminMilestones.find(m => !completedCodes.has(m.milestone_code))?.milestone_name || 
    (sortedAdminMilestones.length > 0 ? '已完成' : null);
  const engineeringStage = sortedEngMilestones.find(m => !completedCodes.has(m.milestone_code))?.milestone_name || 
    (sortedEngMilestones.length > 0 ? '已完成' : null);

  // Update project with new progress values
  await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        admin_progress: Math.round(adminProgress * 100) / 100,
        engineering_progress: Math.round(engineeringProgress * 100) / 100,
        overall_progress: Math.round(overallProgress * 100) / 100,
        admin_stage: adminStage,
        engineering_stage: engineeringStage,
      }),
    }
  );
}

interface DataEnrichmentPanelProps {
  selectedIds: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}

// We'll fetch dynamic options from system_options table instead of using static Constants

export function DataEnrichmentPanel({
  selectedIds,
  onClose,
  onSuccess,
}: DataEnrichmentPanelProps) {
  const queryClient = useQueryClient();
  const selectedCount = selectedIds.size;

  // Form state - only checked fields will be applied
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    project_status: false,
    construction_status: false,
    installation_type: false,
    grid_connection_type: false,
    city: false,
    milestones: false,
  });

  const [projectStatus, setProjectStatus] = useState<string>('');
  const [constructionStatus, setConstructionStatus] = useState<string>('');
  const [installationType, setInstallationType] = useState<string>('');
  const [gridConnectionType, setGridConnectionType] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set());
  const [milestoneAction, setMilestoneAction] = useState<'complete' | 'uncomplete'>('complete');
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [updateResults, setUpdateResults] = useState<ProgressUpdateResult[]>([]);

  // Fetch dynamic options from system_options table
  const { data: systemOptions = [] } = useQuery({
    queryKey: ['system-options-for-enrichment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_options')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  // Filter options by category
  const projectStatusOptions = useMemo(() => 
    systemOptions.filter(opt => opt.category === 'project_status').map(opt => opt.value), 
    [systemOptions]
  );
  const constructionStatusOptions = useMemo(() => 
    systemOptions.filter(opt => opt.category === 'construction_status').map(opt => opt.value), 
    [systemOptions]
  );
  const installationTypeOptions = useMemo(() => 
    systemOptions.filter(opt => opt.category === 'installation_type').map(opt => opt.value), 
    [systemOptions]
  );
  const gridConnectionTypeOptions = useMemo(() => 
    systemOptions.filter(opt => opt.category === 'grid_connection_type').map(opt => opt.value), 
    [systemOptions]
  );
  const cityOptions = useMemo(() => 
    systemOptions.filter(opt => opt.category === 'city').map(opt => opt.value), 
    [systemOptions]
  );

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

  // FIT-only milestones that should not be applied to REC projects
  const FIT_ONLY_MILESTONES = ['ADMIN_07_PPA_SIGNED', 'ADMIN_09B_FIT_OFFICIAL', 'ADMIN_10_CLOSED'];
  // REC-only milestones (REC prefix)
  const isRecMilestone = (code: string) => code.startsWith('REC_');
  
  // Group milestones by type
  const adminMilestones = useMemo(() => 
    milestones.filter(m => m.milestone_type === 'admin' && !isRecMilestone(m.milestone_code)), 
    [milestones]
  );
  const recMilestones = useMemo(() => 
    milestones.filter(m => isRecMilestone(m.milestone_code)), 
    [milestones]
  );
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
    if (enabledFields.project_status && projectStatus) fields.push('案場狀態');
    if (enabledFields.construction_status && constructionStatus) fields.push('施工狀態');
    if (enabledFields.installation_type && installationType) fields.push('裝置類型');
    if (enabledFields.grid_connection_type && gridConnectionType) fields.push('併網類型');
    if (enabledFields.city && city) fields.push('縣市');
    if (enabledFields.milestones && selectedMilestones.size > 0) fields.push('里程碑完成度');
    return fields;
  };

  // Batch update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const projectIds = Array.from(selectedIds);
      const updates: Record<string, any> = {};
      
      // Build updates based on enabled fields
      if (enabledFields.project_status && projectStatus) {
        updates.status = projectStatus;
      }
      
      if (enabledFields.construction_status && constructionStatus) {
        updates.construction_status = constructionStatus;
      }
      
      if (enabledFields.installation_type && installationType) {
        updates.installation_type = installationType;
      }
      
      if (enabledFields.grid_connection_type && gridConnectionType) {
        updates.grid_connection_type = gridConnectionType;
      }

      if (enabledFields.city && city) {
        updates.city = city;
      }

      // Fetch old progress data BEFORE any updates
      const { data: oldProjectsData } = await supabase
        .from('projects')
        .select('id, project_code, project_name, admin_progress, engineering_progress, overall_progress')
        .in('id', projectIds);

      // Update projects if there are field changes
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('projects')
          .update(updates)
          .in('id', projectIds);
        if (error) throw error;

        // Log audit for each project
        for (const id of projectIds) {
          const oldRecord = oldProjectsData?.find(r => r.id === id);
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
        const isCompleting = milestoneAction === 'complete';
        
        for (const projectId of projectIds) {
          for (const milestoneCode of selectedMilestones) {
            if (isCompleting) {
              // Mark as complete - upsert
              const { error } = await supabase
                .from('project_milestones')
                .upsert({
                  project_id: projectId,
                  milestone_code: milestoneCode,
                  is_completed: true,
                  completed_at: new Date().toISOString(),
                  note: '批量標記完成',
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
                    note: '批量標記完成',
                  });
              }
            } else {
              // Mark as uncomplete - update existing or upsert with is_completed = false
              const { error } = await supabase
                .from('project_milestones')
                .upsert({
                  project_id: projectId,
                  milestone_code: milestoneCode,
                  is_completed: false,
                  completed_at: null,
                  note: '批量取消完成',
                }, {
                  onConflict: 'project_id,milestone_code',
                });
              if (error) {
                // If upsert fails, try update
                await supabase
                  .from('project_milestones')
                  .update({
                    is_completed: false,
                    completed_at: null,
                    note: '批量取消完成',
                  })
                  .eq('project_id', projectId)
                  .eq('milestone_code', milestoneCode);
              }
            }
          }
        }

        // Recalculate progress for all affected projects
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        for (const projectId of projectIds) {
          await recalculateProjectProgress(projectId, token);
        }
      }

      // Fetch new progress data AFTER all updates
      const { data: newProjectsData } = await supabase
        .from('projects')
        .select('id, project_code, project_name, admin_progress, engineering_progress, overall_progress')
        .in('id', projectIds);

      // Build results array
      const results: ProgressUpdateResult[] = projectIds.map(id => {
        const oldProject = oldProjectsData?.find(p => p.id === id);
        const newProject = newProjectsData?.find(p => p.id === id);
        return {
          projectId: id,
          projectCode: newProject?.project_code || oldProject?.project_code || '',
          projectName: newProject?.project_name || oldProject?.project_name || '',
          oldProgress: {
            admin: oldProject?.admin_progress ?? 0,
            engineering: oldProject?.engineering_progress ?? 0,
            overall: oldProject?.overall_progress ?? 0,
          },
          newProgress: {
            admin: newProject?.admin_progress ?? 0,
            engineering: newProject?.engineering_progress ?? 0,
            overall: newProject?.overall_progress ?? 0,
          },
        };
      });

      return { count: projectIds.length, results };
    },
    onSuccess: (data) => {
      // Invalidate all related queries to ensure progress bars update
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['project-drawer'] });
      queryClient.invalidateQueries({ queryKey: ['project-analytics'] });
      
      // Show results dialog
      setUpdateResults(data.results);
      setShowResults(true);
      
      toast.success('批次更新成功', {
        description: `已更新 ${data.count} 筆案場資料`,
      });
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
          <div className="flex items-center justify-between mb-3">
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
          {/* Apply button moved to header for better accessibility */}
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

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Project Status (案場狀態) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-status"
                  checked={enabledFields.project_status}
                  onCheckedChange={() => toggleField('project_status')}
                />
                <Label htmlFor="enable-status" className="font-medium cursor-pointer">
                  案場狀態
                </Label>
              </div>
              {enabledFields.project_status && (
                <Select value={projectStatus} onValueChange={setProjectStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇案場狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectStatusOptions.map(status => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Construction Status (施工狀態) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-construction"
                  checked={enabledFields.construction_status}
                  onCheckedChange={() => toggleField('construction_status')}
                />
                <Label htmlFor="enable-construction" className="font-medium cursor-pointer">
                  施工狀態
                </Label>
              </div>
              {enabledFields.construction_status && (
                <Select value={constructionStatus} onValueChange={setConstructionStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇施工狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    {constructionStatusOptions.map(status => (
                      <SelectItem key={status} value={status}>
                        {status}
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
                  {/* Action selector: complete or uncomplete */}
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Label className="text-sm">操作模式：</Label>
                    <Select
                      value={milestoneAction}
                      onValueChange={(v: 'complete' | 'uncomplete') => setMilestoneAction(v)}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complete">標記為完成</SelectItem>
                        <SelectItem value="uncomplete">取消完成</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Global Select All / Deselect All */}
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Checkbox
                      id="milestone-select-all"
                      checked={milestones.length > 0 && selectedMilestones.size === milestones.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedMilestones(new Set(milestones.map(m => m.milestone_code)));
                        } else {
                          setSelectedMilestones(new Set());
                        }
                      }}
                    />
                    <Label 
                      htmlFor="milestone-select-all" 
                      className="text-sm cursor-pointer font-medium"
                    >
                      {selectedMilestones.size === milestones.length ? '全部取消' : '全部選取'}
                      {selectedMilestones.size > 0 && selectedMilestones.size < milestones.length && 
                        ` (已選 ${selectedMilestones.size}/${milestones.length})`
                      }
                    </Label>
                  </div>
                  {/* Admin Milestones */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">行政里程碑</p>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          const adminCodes = adminMilestones.map(m => m.milestone_code);
                          const allAdminSelected = adminCodes.every(code => selectedMilestones.has(code));
                          if (allAdminSelected) {
                            // Deselect all admin
                            setSelectedMilestones(prev => {
                              const next = new Set(prev);
                              adminCodes.forEach(code => next.delete(code));
                              return next;
                            });
                          } else {
                            // Select all admin
                            setSelectedMilestones(prev => {
                              const next = new Set(prev);
                              adminCodes.forEach(code => next.add(code));
                              return next;
                            });
                          }
                        }}
                      >
                        {adminMilestones.length > 0 && adminMilestones.every(m => selectedMilestones.has(m.milestone_code)) 
                          ? '取消全選' 
                          : '全選'
                        }
                      </button>
                    </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">工程里程碑</p>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          const engCodes = engineeringMilestones.map(m => m.milestone_code);
                          const allEngSelected = engCodes.every(code => selectedMilestones.has(code));
                          if (allEngSelected) {
                            // Deselect all engineering
                            setSelectedMilestones(prev => {
                              const next = new Set(prev);
                              engCodes.forEach(code => next.delete(code));
                              return next;
                            });
                          } else {
                            // Select all engineering
                            setSelectedMilestones(prev => {
                              const next = new Set(prev);
                              engCodes.forEach(code => next.add(code));
                              return next;
                            });
                          }
                        }}
                      >
                        {engineeringMilestones.length > 0 && engineeringMilestones.every(m => selectedMilestones.has(m.milestone_code)) 
                          ? '取消全選' 
                          : '全選'
                        }
                      </button>
                    </div>
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
                  {/* REC Milestones (only show if there are any) */}
                  {recMilestones.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">REC 里程碑</p>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            const recCodes = recMilestones.map(m => m.milestone_code);
                            const allRecSelected = recCodes.every(code => selectedMilestones.has(code));
                            if (allRecSelected) {
                              // Deselect all REC
                              setSelectedMilestones(prev => {
                                const next = new Set(prev);
                                recCodes.forEach(code => next.delete(code));
                                return next;
                              });
                            } else {
                              // Select all REC
                              setSelectedMilestones(prev => {
                                const next = new Set(prev);
                                recCodes.forEach(code => next.add(code));
                                return next;
                              });
                            }
                          }}
                        >
                          {recMilestones.every(m => selectedMilestones.has(m.milestone_code)) 
                            ? '取消全選' 
                            : '全選'
                          }
                        </button>
                      </div>
                      <div className="space-y-2">
                        {recMilestones.map(m => (
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
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Installation Type (裝置類型) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-installation-type"
                  checked={enabledFields.installation_type}
                  onCheckedChange={() => toggleField('installation_type')}
                />
                <Label htmlFor="enable-installation-type" className="font-medium cursor-pointer">
                  裝置類型
                </Label>
              </div>
              {enabledFields.installation_type && (
                <Select value={installationType} onValueChange={setInstallationType}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇裝置類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {installationTypeOptions.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Grid Connection Type (併網類型) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-grid-connection"
                  checked={enabledFields.grid_connection_type}
                  onCheckedChange={() => toggleField('grid_connection_type')}
                />
                <Label htmlFor="enable-grid-connection" className="font-medium cursor-pointer">
                  併網類型
                </Label>
              </div>
              {enabledFields.grid_connection_type && (
                <Select value={gridConnectionType} onValueChange={setGridConnectionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇併網類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {gridConnectionTypeOptions.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* City (縣市) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-city"
                  checked={enabledFields.city}
                  onCheckedChange={() => toggleField('city')}
                />
                <Label htmlFor="enable-city" className="font-medium cursor-pointer">
                  縣市
                </Label>
              </div>
              {enabledFields.city && (
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇縣市" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map(c => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="pt-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              <p className="font-medium mb-1">📊 關於進度百分比</p>
              <p>整體進度、行政進度、工程進度百分比由系統根據里程碑完成狀態自動計算，無法手動設定。</p>
            </div>
          </div>
        </ScrollArea>
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

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={(open) => {
        setShowResults(open);
        if (!open) {
          onSuccess();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              批次更新完成
            </DialogTitle>
            <DialogDescription>
              已成功更新 {updateResults.length} 筆案場資料，以下是進度變化：
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-4">
              {updateResults.map((result) => {
                const overallChange = result.newProgress.overall - result.oldProgress.overall;
                const adminChange = result.newProgress.admin - result.oldProgress.admin;
                const engChange = result.newProgress.engineering - result.oldProgress.engineering;
                const hasChange = overallChange !== 0 || adminChange !== 0 || engChange !== 0;
                
                return (
                  <div 
                    key={result.projectId} 
                    className="p-3 border rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{result.projectCode}</p>
                        <p className="text-xs text-muted-foreground">{result.projectName}</p>
                      </div>
                      {hasChange && (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                          +{overallChange.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    
                    {/* Overall Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">整體進度</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{result.oldProgress.overall.toFixed(1)}%</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{result.newProgress.overall.toFixed(1)}%</span>
                        </div>
                      </div>
                      <Progress value={result.newProgress.overall} className="h-2" />
                    </div>

                    {/* Admin Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">行政進度</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{result.oldProgress.admin.toFixed(1)}%</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{result.newProgress.admin.toFixed(1)}%</span>
                        </div>
                      </div>
                      <Progress value={result.newProgress.admin} className="h-1.5 bg-muted" />
                    </div>

                    {/* Engineering Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">工程進度</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{result.oldProgress.engineering.toFixed(1)}%</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{result.newProgress.engineering.toFixed(1)}%</span>
                        </div>
                      </div>
                      <Progress value={result.newProgress.engineering} className="h-1.5 bg-muted" />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-2">
            <Button onClick={() => {
              setShowResults(false);
              onSuccess();
            }}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
