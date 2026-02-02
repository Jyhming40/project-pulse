import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, Plus, Trash2, Edit2, Lock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentLinkageRules, CreateLinkageRuleInput, DocumentLinkageRule } from '@/hooks/useDocumentLinkageRules';
import { useCodebookOptions } from '@/hooks/useCodebook';
import { getDocTypeLabelByCode } from '@/lib/docTypeMapping';
import { GroupedDocTypeSelect } from '@/components/GroupedDocTypeSelect';

const TARGET_TYPE_OPTIONS = [
  { value: 'project_status', label: '案場狀態' },
  { value: 'construction_status', label: '工程狀態' },
  { value: 'milestone', label: '里程碑' },
  { value: 'project_field', label: '案場欄位' },
];

const TRIGGER_FIELD_OPTIONS = [
  { value: 'issued_at', label: '核發日期 (issued_at)' },
  { value: 'submitted_at', label: '送件日期 (submitted_at)' },
];

const TRIGGER_CONDITION_OPTIONS = [
  { value: 'set_new', label: '首次設定（從空值變為有值）' },
  { value: 'any_change', label: '任何變更' },
];

const PROJECT_FIELD_OPTIONS = [
  { value: 'approval_date', label: '核准日期' },
  { value: 'construction_start_date', label: '施工開始日期' },
  { value: 'actual_meter_date', label: '實際掛表日期' },
];

// Hook to fetch milestone codes from progress_milestones
function useMilestoneCodes() {
  return useQuery({
    queryKey: ['milestone-codes-for-linkage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_milestones')
        .select('milestone_code, milestone_name')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      // Deduplicate by milestone_code
      const uniqueMap = new Map<string, { value: string; label: string }>();
      data?.forEach(item => {
        if (!uniqueMap.has(item.milestone_code)) {
          uniqueMap.set(item.milestone_code, {
            value: item.milestone_code,
            label: `${item.milestone_name} (${item.milestone_code})`,
          });
        }
      });
      
      return Array.from(uniqueMap.values());
    },
  });
}

export function DocumentLinkagePanel() {
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleRule } = useDocumentLinkageRules();
  const { options: projectStatusOptions } = useCodebookOptions('project_status');
  const { options: constructionStatusOptions } = useCodebookOptions('construction_status');
  const { data: milestoneOptions = [] } = useMilestoneCodes();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DocumentLinkageRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<DocumentLinkageRule | null>(null);

  const [formData, setFormData] = useState<CreateLinkageRuleInput>({
    rule_name: '',
    description: '',
    trigger_doc_type_code: '',
    trigger_field: 'issued_at',
    trigger_condition: 'set_new',
    target_type: 'milestone',
    target_value: '',
    target_field: '',
    use_trigger_value: false,
    is_active: true,
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({
      rule_name: '',
      description: '',
      trigger_doc_type_code: '',
      trigger_field: 'issued_at',
      trigger_condition: 'set_new',
      target_type: 'milestone',
      target_value: '',
      target_field: '',
      use_trigger_value: false,
      is_active: true,
      sort_order: rules.length + 1,
    });
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DocumentLinkageRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description: rule.description || '',
      trigger_doc_type_code: rule.trigger_doc_type_code,
      trigger_field: rule.trigger_field,
      trigger_condition: rule.trigger_condition,
      target_type: rule.target_type,
      target_value: rule.target_value || '',
      target_field: rule.target_field || '',
      use_trigger_value: rule.use_trigger_value,
      is_active: rule.is_active,
      sort_order: rule.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.rule_name || !formData.trigger_doc_type_code || !formData.target_type) {
      return;
    }

    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...formData });
    } else {
      await createRule.mutateAsync(formData);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (ruleToDelete) {
      await deleteRule.mutateAsync(ruleToDelete.id);
      setDeleteConfirmOpen(false);
      setRuleToDelete(null);
    }
  };

  const getTargetLabel = (rule: DocumentLinkageRule) => {
    const typeLabel = TARGET_TYPE_OPTIONS.find(t => t.value === rule.target_type)?.label || rule.target_type;
    if (rule.target_type === 'project_field') {
      const fieldLabel = PROJECT_FIELD_OPTIONS.find(f => f.value === rule.target_field)?.label || rule.target_field;
      return `${typeLabel}: ${fieldLabel}${rule.use_trigger_value ? ' (使用觸發值)' : ''}`;
    }
    return `${typeLabel}: ${rule.target_value || '-'}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            文件連動規則
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                文件連動規則
              </CardTitle>
              <CardDescription className="mt-1">
                設定文件狀態變更時自動觸發的連動行為
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              新增規則
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">狀態</TableHead>
                  <TableHead>規則名稱</TableHead>
                  <TableHead>觸發文件</TableHead>
                  <TableHead>觸發條件</TableHead>
                  <TableHead>連動目標</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      尚無連動規則
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map(rule => (
                    <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Switch
                                  checked={rule.is_active}
                                  onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                                  disabled={toggleRule.isPending}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {rule.is_active ? '點擊停用' : '點擊啟用'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rule.rule_name}</span>
                          {rule.is_system && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>系統預設規則</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDocTypeLabelByCode(rule.trigger_doc_type_code)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {TRIGGER_FIELD_OPTIONS.find(f => f.value === rule.trigger_field)?.label.split(' ')[0]}
                          {' · '}
                          {TRIGGER_CONDITION_OPTIONS.find(c => c.value === rule.trigger_condition)?.label.split('（')[0]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getTargetLabel(rule)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {!rule.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setRuleToDelete(rule);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? '編輯連動規則' : '新增連動規則'}</DialogTitle>
            <DialogDescription>
              設定文件狀態變更時自動觸發的連動行為
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule_name">規則名稱 *</Label>
              <Input
                id="rule_name"
                value={formData.rule_name}
                onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                placeholder="例如：同意備案 → 案場狀態"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="描述此規則的用途..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>觸發文件類型 *</Label>
                <GroupedDocTypeSelect
                  value={formData.trigger_doc_type_code}
                  onValueChange={(code) => setFormData(prev => ({ ...prev, trigger_doc_type_code: code }))}
                  placeholder="選擇文件類型"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>觸發欄位</Label>
                <Select
                  value={formData.trigger_field}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, trigger_field: v as 'issued_at' | 'submitted_at' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_FIELD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>觸發條件</Label>
              <Select
                value={formData.trigger_condition}
                onValueChange={(v) => setFormData(prev => ({ ...prev, trigger_condition: v as 'set_new' | 'any_change' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_CONDITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>連動目標類型 *</Label>
                <Select
                  value={formData.target_type}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    target_type: v as CreateLinkageRuleInput['target_type'],
                    target_value: '',
                    target_field: '',
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.target_type === 'project_field' ? (
                <div className="space-y-2">
                  <Label>目標欄位</Label>
                  <Select
                    value={formData.target_field}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, target_field: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇欄位" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_FIELD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>目標值</Label>
                  {formData.target_type === 'milestone' ? (
                    <Select
                      value={formData.target_value || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, target_value: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇里程碑" />
                      </SelectTrigger>
                      <SelectContent>
                        {milestoneOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : formData.target_type === 'project_status' ? (
                    <Select
                      value={formData.target_value || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, target_value: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇案場狀態" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectStatusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : formData.target_type === 'construction_status' ? (
                    <Select
                      value={formData.target_value || ''}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, target_value: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇工程狀態" />
                      </SelectTrigger>
                      <SelectContent>
                        {constructionStatusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={formData.target_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                      placeholder="輸入目標值"
                    />
                  )}
                </div>
              )}
            </div>

            {formData.target_type === 'project_field' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use_trigger_value"
                  checked={formData.use_trigger_value}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, use_trigger_value: !!checked }))}
                />
                <Label htmlFor="use_trigger_value" className="font-normal">
                  使用觸發值作為目標值（例如：核准日期 = 核發日期）
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.rule_name || !formData.trigger_doc_type_code || createRule.isPending || updateRule.isPending}
            >
              {editingRule ? '儲存變更' : '新增規則'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              確認刪除
            </DialogTitle>
            <DialogDescription>
              確定要刪除規則「{ruleToDelete?.rule_name}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRule.isPending}>
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
