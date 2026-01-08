import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useProgressMilestones, 
  useProgressSettings,
  useUpdateMilestone,
  useUpdateProgressSettings,
  useCreateMilestone,
  type ProgressMilestone 
} from '@/hooks/useProgressManagement';
import { 
  Settings2, 
  ListChecks, 
  Plus, 
  GripVertical,
  Edit,
  Save,
  X,
  AlertCircle,
  Percent,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ProgressSettings() {
  const { isAdmin } = useAuth();
  const { data: milestones = [], isLoading: milestonesLoading } = useProgressMilestones();
  const { data: settings = [], isLoading: settingsLoading } = useProgressSettings();
  const updateMilestone = useUpdateMilestone();
  const updateSettings = useUpdateProgressSettings();
  const createMilestone = useCreateMilestone();

  const [activeTab, setActiveTab] = useState<'admin' | 'engineering'>('admin');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProgressMilestone>>({});
  const [newMilestone, setNewMilestone] = useState<Partial<ProgressMilestone>>({
    milestone_type: 'admin',
    weight: 10,
    sort_order: 0,
    is_required: true,
    is_active: true,
  });

  // Get progress weights from settings
  const weightSetting = settings.find(s => s.setting_key === 'weights');
  const adminWeight = (weightSetting?.setting_value?.admin_weight ?? 50) as number;
  const engineeringWeight = (weightSetting?.setting_value?.engineering_weight ?? 50) as number;

  // Get alert threshold settings
  const alertSetting = settings.find(s => s.setting_key === 'alert_thresholds');
  const alertThresholds = {
    months_threshold: (alertSetting?.setting_value?.months_threshold ?? 6) as number,
    min_progress_old_project: (alertSetting?.setting_value?.min_progress_old_project ?? 25) as number,
    min_progress_late_stage: (alertSetting?.setting_value?.min_progress_late_stage ?? 50) as number,
    late_stages: (alertSetting?.setting_value?.late_stages ?? ['台電審查', '能源署送件', '同意備案', '工程施工', '報竣掛表']) as string[],
    max_display_count: (alertSetting?.setting_value?.max_display_count ?? 5) as number,
  };

  const handleAlertThresholdChange = (key: string, value: number | string[]) => {
    updateSettings.mutate({
      key: 'alert_thresholds',
      value: {
        ...alertThresholds,
        [key]: value,
      },
    });
  };

  // Filter milestones by type
  const adminMilestones = milestones.filter(m => m.milestone_type === 'admin').sort((a, b) => a.sort_order - b.sort_order);
  const engineeringMilestones = milestones.filter(m => m.milestone_type === 'engineering').sort((a, b) => a.sort_order - b.sort_order);
  const currentMilestones = activeTab === 'admin' ? adminMilestones : engineeringMilestones;

  // Calculate total weight
  const totalWeight = currentMilestones.filter(m => m.is_active).reduce((sum, m) => sum + Number(m.weight), 0);

  const handleWeightChange = (value: number[]) => {
    const newAdminWeight = value[0];
    updateSettings.mutate({
      key: 'weights',
      value: {
        admin_weight: newAdminWeight,
        engineering_weight: 100 - newAdminWeight,
      },
    });
  };

  const handleEditMilestone = (milestone: ProgressMilestone) => {
    setEditingId(milestone.id);
    setEditForm({
      milestone_name: milestone.milestone_name,
      weight: milestone.weight,
      is_required: milestone.is_required,
      is_active: milestone.is_active,
      description: milestone.description,
      stage_label: milestone.stage_label,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateMilestone.mutate({ id: editingId, ...editForm });
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleToggleActive = (milestone: ProgressMilestone) => {
    updateMilestone.mutate({ id: milestone.id, is_active: !milestone.is_active });
  };

  const handleAddMilestone = () => {
    if (!newMilestone.milestone_code || !newMilestone.milestone_name) {
      toast.error('請填寫必要欄位');
      return;
    }
    const maxSortOrder = Math.max(...currentMilestones.map(m => m.sort_order), 0);
    createMilestone.mutate({
      ...newMilestone,
      milestone_type: activeTab,
      sort_order: maxSortOrder + 1,
    } as any);
    setIsAddOpen(false);
    setNewMilestone({
      milestone_type: activeTab,
      weight: 10,
      sort_order: 0,
      is_required: true,
      is_active: true,
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>無權限</AlertTitle>
          <AlertDescription>僅系統管理員可存取此頁面</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (milestonesLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">進度管理設定</h1>
        <p className="text-muted-foreground mt-1">設定里程碑與進度權重</p>
      </div>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            全域設定
          </CardTitle>
          <CardDescription>設定行政與工程進度的權重比例</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>行政/工程進度權重</Label>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium w-24">行政 {adminWeight}%</span>
              <Slider
                value={[adminWeight]}
                min={0}
                max={100}
                step={5}
                onValueChange={handleWeightChange}
                className="flex-1"
              />
              <span className="text-sm font-medium w-24 text-right">工程 {engineeringWeight}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              總進度 = 行政進度 × {adminWeight}% + 工程進度 × {engineeringWeight}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Alert Threshold Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            進度落後警示設定
          </CardTitle>
          <CardDescription>設定進度落後警示的判斷標準</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>案場建立時間門檻（月）</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[alertThresholds.months_threshold]}
                    min={1}
                    max={24}
                    step={1}
                    onValueChange={(v) => handleAlertThresholdChange('months_threshold', v[0])}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-16 text-right">{alertThresholds.months_threshold} 個月</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  案場建立超過此時間將列入警示檢查
                </p>
              </div>

              <div className="space-y-2">
                <Label>舊案場最低進度（%）</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[alertThresholds.min_progress_old_project]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) => handleAlertThresholdChange('min_progress_old_project', v[0])}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">{alertThresholds.min_progress_old_project}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  超過建立時間門檻的案場，若進度低於此值則發出警示
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>後期階段最低進度（%）</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[alertThresholds.min_progress_late_stage]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) => handleAlertThresholdChange('min_progress_late_stage', v[0])}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">{alertThresholds.min_progress_late_stage}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  處於後期階段的案場，若進度低於此值則發出警示
                </p>
              </div>

              <div className="space-y-2">
                <Label>最多顯示筆數</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[alertThresholds.max_display_count]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={(v) => handleAlertThresholdChange('max_display_count', v[0])}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">{alertThresholds.max_display_count} 筆</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  儀表板上最多顯示的落後案場數量
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>後期階段定義</Label>
            <div className="flex flex-wrap gap-2">
              {['台電審查', '能源署送件', '同意備案', '工程施工', '報竣掛表', '設備登記'].map((stage) => {
                const isSelected = alertThresholds.late_stages.includes(stage);
                return (
                  <Button
                    key={stage}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const newStages = isSelected
                        ? alertThresholds.late_stages.filter(s => s !== stage)
                        : [...alertThresholds.late_stages, stage];
                      handleAlertThresholdChange('late_stages', newStages);
                    }}
                  >
                    {stage}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              選取的階段將被視為「後期階段」，套用後期最低進度門檻
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Milestones Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                里程碑設定
              </CardTitle>
              <CardDescription>管理行政與工程里程碑</CardDescription>
            </div>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新增里程碑
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'admin' | 'engineering')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="admin">行政進度</TabsTrigger>
              <TabsTrigger value="engineering">工程進度</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  共 {currentMilestones.length} 個里程碑，啟用中 {currentMilestones.filter(m => m.is_active).length} 個
                </p>
                <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                  總權重: {totalWeight}%
                </Badge>
              </div>

              {totalWeight !== 100 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>權重不平衡</AlertTitle>
                  <AlertDescription>
                    啟用中的里程碑總權重為 {totalWeight}%，應為 100%。進度計算可能不準確。
                  </AlertDescription>
                </Alert>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">排序</TableHead>
                    <TableHead>代碼</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>階段標籤</TableHead>
                    <TableHead className="w-[80px]">權重</TableHead>
                    <TableHead className="w-[80px]">必經</TableHead>
                    <TableHead className="w-[80px]">啟用</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMilestones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        尚無里程碑
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentMilestones.map((milestone, index) => (
                      <TableRow key={milestone.id} className={!milestone.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <GripVertical className="w-4 h-4" />
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{milestone.milestone_code}</TableCell>
                        <TableCell>
                          {editingId === milestone.id ? (
                            <Input
                              value={editForm.milestone_name || ''}
                              onChange={(e) => setEditForm({ ...editForm, milestone_name: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            milestone.milestone_name
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === milestone.id ? (
                            <Input
                              value={editForm.stage_label || ''}
                              onChange={(e) => setEditForm({ ...editForm, stage_label: e.target.value })}
                              className="h-8"
                              placeholder="階段標籤"
                            />
                          ) : (
                            <Badge variant="outline">{milestone.stage_label || '-'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === milestone.id ? (
                            <Input
                              type="number"
                              value={editForm.weight || 0}
                              onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                              className="h-8 w-16"
                            />
                          ) : (
                            <span className="font-medium">{milestone.weight}%</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === milestone.id ? (
                            <Switch
                              checked={editForm.is_required ?? false}
                              onCheckedChange={(checked) => setEditForm({ ...editForm, is_required: checked })}
                            />
                          ) : (
                            milestone.is_required ? '是' : '否'
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={milestone.is_active}
                            onCheckedChange={() => handleToggleActive(milestone)}
                          />
                        </TableCell>
                        <TableCell>
                          {editingId === milestone.id ? (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => handleEditMilestone(milestone)} className="h-8 w-8">
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Milestone Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增里程碑</DialogTitle>
            <DialogDescription>
              新增{activeTab === 'admin' ? '行政' : '工程'}里程碑
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">里程碑代碼 *</Label>
                <Input
                  id="code"
                  placeholder={activeTab === 'admin' ? 'ADM_XX' : 'ENG_XX'}
                  value={newMilestone.milestone_code || ''}
                  onChange={(e) => setNewMilestone({ ...newMilestone, milestone_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">里程碑名稱 *</Label>
                <Input
                  id="name"
                  placeholder="輸入名稱"
                  value={newMilestone.milestone_name || ''}
                  onChange={(e) => setNewMilestone({ ...newMilestone, milestone_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">權重 (%)</Label>
                <Input
                  id="weight"
                  type="number"
                  min={0}
                  max={100}
                  value={newMilestone.weight || 10}
                  onChange={(e) => setNewMilestone({ ...newMilestone, weight: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stageLabel">階段標籤</Label>
                <Input
                  id="stageLabel"
                  placeholder="顯示用標籤"
                  value={newMilestone.stage_label || ''}
                  onChange={(e) => setNewMilestone({ ...newMilestone, stage_label: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Textarea
                id="description"
                placeholder="里程碑說明..."
                value={newMilestone.description || ''}
                onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="required"
                  checked={newMilestone.is_required ?? true}
                  onCheckedChange={(checked) => setNewMilestone({ ...newMilestone, is_required: checked })}
                />
                <Label htmlFor="required">必經里程碑</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={newMilestone.is_active ?? true}
                  onCheckedChange={(checked) => setNewMilestone({ ...newMilestone, is_active: checked })}
                />
                <Label htmlFor="active">啟用</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>取消</Button>
            <Button onClick={handleAddMilestone} disabled={createMilestone.isPending}>
              {createMilestone.isPending ? '新增中...' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
