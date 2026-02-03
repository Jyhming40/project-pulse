import { useState } from 'react';
import { Clock, Plus, Trash2, Edit2, Lock, AlertCircle, ArrowRight } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentExpiryRules, CreateExpiryRuleInput, DocumentExpiryRule } from '@/hooks/useDocumentExpiryRules';
import { getDocTypeLabelByCode } from '@/lib/docTypeMapping';
import { GroupedDocTypeSelect } from '@/components/GroupedDocTypeSelect';

const BASE_FIELD_OPTIONS = [
  { value: 'issued_at', label: '核發日期 (issued_at)' },
  { value: 'submitted_at', label: '送件日期 (submitted_at)' },
];

const SUPERSEDE_ACTION_OPTIONS = [
  { value: 'clear', label: '清除到期日（不再有效期限制）' },
  { value: 'inherit_field', label: '繼承後續文件的日期欄位' },
  { value: 'extend_days', label: '從後續文件日期延長固定天數' },
];

const SUPERSEDE_FIELD_OPTIONS = [
  { value: 'issued_at', label: '核發日期' },
  { value: 'submitted_at', label: '送件日期' },
  { value: 'due_at', label: '到期日' },
];

export function DocumentExpiryRulesPanel() {
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleRule } = useDocumentExpiryRules();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DocumentExpiryRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<DocumentExpiryRule | null>(null);

  const [formData, setFormData] = useState<CreateExpiryRuleInput>({
    rule_name: '',
    description: '',
    source_doc_type_code: '',
    base_field: 'issued_at',
    default_validity_days: 365,
    supersede_doc_type_code: '',
    supersede_action: 'inherit_field',
    supersede_field: 'due_at',
    supersede_days: undefined,
    is_active: true,
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({
      rule_name: '',
      description: '',
      source_doc_type_code: '',
      base_field: 'issued_at',
      default_validity_days: 365,
      supersede_doc_type_code: '',
      supersede_action: 'inherit_field',
      supersede_field: 'due_at',
      supersede_days: undefined,
      is_active: true,
      sort_order: rules.length + 1,
    });
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DocumentExpiryRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description: rule.description || '',
      source_doc_type_code: rule.source_doc_type_code,
      base_field: rule.base_field,
      default_validity_days: rule.default_validity_days,
      supersede_doc_type_code: rule.supersede_doc_type_code || '',
      supersede_action: rule.supersede_action || 'inherit_field',
      supersede_field: rule.supersede_field || 'due_at',
      supersede_days: rule.supersede_days || undefined,
      is_active: rule.is_active,
      sort_order: rule.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.rule_name || !formData.source_doc_type_code) {
      return;
    }

    // Clean up supersede fields if no supersede doc selected
    const submitData = { ...formData };
    if (!submitData.supersede_doc_type_code) {
      submitData.supersede_action = undefined;
      submitData.supersede_field = undefined;
      submitData.supersede_days = undefined;
    }

    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...submitData });
    } else {
      await createRule.mutateAsync(submitData);
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

  const getExpiryDescription = (rule: DocumentExpiryRule) => {
    const parts: string[] = [];
    
    if (rule.default_validity_days) {
      const baseLabel = BASE_FIELD_OPTIONS.find(f => f.value === rule.base_field)?.label.split(' ')[0] || rule.base_field;
      parts.push(`${baseLabel} + ${rule.default_validity_days} 天`);
    }
    
    if (rule.supersede_doc_type_code) {
      const supersedeLabel = getDocTypeLabelByCode(rule.supersede_doc_type_code);
      if (rule.supersede_action === 'clear') {
        parts.push(`取得 ${supersedeLabel} → 清除到期日`);
      } else if (rule.supersede_action === 'inherit_field') {
        const fieldLabel = SUPERSEDE_FIELD_OPTIONS.find(f => f.value === rule.supersede_field)?.label || rule.supersede_field;
        parts.push(`取得 ${supersedeLabel} → 使用其${fieldLabel}`);
      } else if (rule.supersede_action === 'extend_days') {
        parts.push(`取得 ${supersedeLabel} → 延長 ${rule.supersede_days} 天`);
      }
    }
    
    return parts.join(' / ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            文件效期規則
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
                <Clock className="w-5 h-5" />
                文件效期規則
              </CardTitle>
              <CardDescription className="mt-1">
                設定文件的有效期限及後續文件取代邏輯
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
                  <TableHead>來源文件</TableHead>
                  <TableHead>效期邏輯</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      尚無效期規則
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
                          {getDocTypeLabelByCode(rule.source_doc_type_code)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span>{getExpiryDescription(rule)}</span>
                        </div>
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
            <DialogTitle>{editingRule ? '編輯效期規則' : '新增效期規則'}</DialogTitle>
            <DialogDescription>
              設定文件的有效期限及後續文件取代邏輯
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule_name">規則名稱 *</Label>
              <Input
                id="rule_name"
                value={formData.rule_name}
                onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                placeholder="例如：台電審查意見書效期"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="描述此效期規則..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>來源文件類型 *</Label>
              <GroupedDocTypeSelect
                value={formData.source_doc_type_code}
                onValueChange={(code) => setFormData(prev => ({ ...prev, source_doc_type_code: code }))}
                placeholder="選擇需要設定效期的文件類型"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>計算基準欄位</Label>
                <Select
                  value={formData.base_field}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, base_field: v as 'issued_at' | 'submitted_at' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_FIELD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>預設效期天數</Label>
                <Input
                  type="number"
                  value={formData.default_validity_days || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    default_validity_days: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  placeholder="例如：365"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="w-4 h-4" />
                <span>後續文件取代設定（選填）</span>
              </div>

              <div className="space-y-2">
                <Label>取代文件類型</Label>
                <GroupedDocTypeSelect
                  value={formData.supersede_doc_type_code || ''}
                  onValueChange={(code) => setFormData(prev => ({ ...prev, supersede_doc_type_code: code }))}
                  placeholder="選擇取代的文件類型"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  當此文件被取得後，將改變來源文件的到期日計算方式
                </p>
              </div>

              {formData.supersede_doc_type_code && (
                <>
                  <div className="space-y-2">
                    <Label>取代行為</Label>
                    <Select
                      value={formData.supersede_action}
                      onValueChange={(v) => setFormData(prev => ({ 
                        ...prev, 
                        supersede_action: v as 'clear' | 'inherit_field' | 'extend_days' 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPERSEDE_ACTION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.supersede_action === 'inherit_field' && (
                    <div className="space-y-2">
                      <Label>繼承欄位</Label>
                      <Select
                        value={formData.supersede_field || 'due_at'}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, supersede_field: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPERSEDE_FIELD_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.supersede_action === 'extend_days' && (
                    <div className="space-y-2">
                      <Label>延長天數</Label>
                      <Input
                        type="number"
                        value={formData.supersede_days || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          supersede_days: e.target.value ? parseInt(e.target.value) : undefined 
                        }))}
                        placeholder="例如：90"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.rule_name || !formData.source_doc_type_code || createRule.isPending || updateRule.isPending}
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
