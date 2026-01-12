import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Wrench, Loader2 } from 'lucide-react';
import { useProgressMilestones, useProjectMilestones, useToggleProjectMilestone } from '@/hooks/useProgressManagement';

interface ProjectMilestonesProps {
  projectId: string;
  installationType?: string | null; // 案場類型，用於過濾里程碑
  adminProgress?: number;
  engineeringProgress?: number;
  overallProgress?: number;
  adminStage?: string;
  engineeringStage?: string;
  readOnly?: boolean;
}

export function ProjectMilestones({
  projectId,
  installationType,
  adminProgress = 0,
  engineeringProgress = 0,
  overallProgress = 0,
  adminStage,
  engineeringStage,
  readOnly = false,
}: ProjectMilestonesProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'engineering'>('admin');
  
  const { data: milestones, isLoading: milestonesLoading } = useProgressMilestones();
  const { data: projectMilestones, isLoading: projectMilestonesLoading } = useProjectMilestones(projectId);
  const toggleMilestone = useToggleProjectMilestone();

  const isLoading = milestonesLoading || projectMilestonesLoading;

  // 過濾里程碑：根據案場類型過濾出適用的里程碑
  const filterByInstallationType = (milestone: { applicable_installation_types?: string[] | null }) => {
    // 如果沒有設定適用類型（null 或空陣列），表示適用所有案場
    if (!milestone.applicable_installation_types || milestone.applicable_installation_types.length === 0) {
      return true;
    }
    // 如果案場類型未知，顯示所有里程碑
    if (!installationType) {
      return true;
    }
    // 檢查案場類型是否在適用列表中
    return milestone.applicable_installation_types.includes(installationType);
  };

  const adminMilestones = milestones
    ?.filter(m => m.milestone_type === 'admin' && m.is_active)
    ?.filter(filterByInstallationType) || [];
  const engMilestones = milestones
    ?.filter(m => m.milestone_type === 'engineering' && m.is_active)
    ?.filter(filterByInstallationType) || [];

  const isMilestoneCompleted = (code: string) => {
    return projectMilestones?.some(pm => pm.milestone_code === code && pm.is_completed) || false;
  };

  const getCompletedInfo = (code: string) => {
    return projectMilestones?.find(pm => pm.milestone_code === code && pm.is_completed);
  };

  const handleToggle = (milestoneCode: string, currentState: boolean) => {
    if (readOnly) return;
    toggleMilestone.mutate({
      projectId,
      milestoneCode,
      isCompleted: !currentState,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          專案進度
        </CardTitle>
        
        {/* Overall Progress */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">總體進度</span>
            <span className="font-medium">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">行政進度</span>
                <span className="font-medium">{Math.round(adminProgress)}%</span>
              </div>
              <Progress value={adminProgress} className="h-1.5" />
              {adminStage && (
                <Badge variant="outline" className="text-xs mt-1">{adminStage}</Badge>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">工程進度</span>
                <span className="font-medium">{Math.round(engineeringProgress)}%</span>
              </div>
              <Progress value={engineeringProgress} className="h-1.5" />
              {engineeringStage && (
                <Badge variant="outline" className="text-xs mt-1">{engineeringStage}</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'admin' | 'engineering')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="admin" className="text-xs">
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              行政里程碑
            </TabsTrigger>
            <TabsTrigger value="engineering" className="text-xs">
              <Wrench className="h-3.5 w-3.5 mr-1" />
              工程里程碑
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="space-y-2">
            {adminMilestones.map((milestone) => {
              const completed = isMilestoneCompleted(milestone.milestone_code);
              const info = getCompletedInfo(milestone.milestone_code);
              return (
                <div
                  key={milestone.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    completed ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                  }`}
                >
                  <Checkbox
                    checked={completed}
                    onCheckedChange={() => handleToggle(milestone.milestone_code, completed)}
                    disabled={readOnly || toggleMilestone.isPending}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${completed ? 'line-through text-muted-foreground' : ''}`}>
                        {milestone.milestone_name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {milestone.weight}%
                      </Badge>
                    </div>
                    {milestone.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
                    )}
                    {info?.completed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        完成於 {new Date(info.completed_at).toLocaleDateString('zh-TW')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="engineering" className="space-y-2">
            {engMilestones.map((milestone) => {
              const completed = isMilestoneCompleted(milestone.milestone_code);
              const info = getCompletedInfo(milestone.milestone_code);
              return (
                <div
                  key={milestone.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    completed ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                  }`}
                >
                  <Checkbox
                    checked={completed}
                    onCheckedChange={() => handleToggle(milestone.milestone_code, completed)}
                    disabled={readOnly || toggleMilestone.isPending}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${completed ? 'line-through text-muted-foreground' : ''}`}>
                        {milestone.milestone_name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {milestone.weight}%
                      </Badge>
                    </div>
                    {milestone.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
                    )}
                    {info?.completed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        完成於 {new Date(info.completed_at).toLocaleDateString('zh-TW')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
