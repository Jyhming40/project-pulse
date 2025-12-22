import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemOptions, OptionCategory, SystemOption } from '@/hooks/useSystemOptions';
import { 
  Settings2, 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical,
  Save,
  X,
  FileText,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const categoryConfig: Record<OptionCategory, { label: string; icon: typeof Activity; description: string }> = {
  project_status: {
    label: '專案狀態',
    icon: Activity,
    description: '管理專案進度的狀態選項',
  },
  doc_type: {
    label: '文件類型',
    icon: FileText,
    description: '管理文件分類的類型選項',
  },
  doc_status: {
    label: '文件狀態',
    icon: CheckCircle2,
    description: '管理文件處理的狀態選項',
  },
};

export default function SystemOptions() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<OptionCategory>('project_status');
  const { options, isLoading, createOption, updateOption, deleteOption } = useSystemOptions();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<SystemOption | null>(null);
  const [deleteConfirmOption, setDeleteConfirmOption] = useState<SystemOption | null>(null);
  
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');

  const filteredOptions = options.filter(opt => opt.category === activeTab);

  const handleOpenCreate = () => {
    setEditingOption(null);
    setFormValue('');
    setFormLabel('');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (option: SystemOption) => {
    setEditingOption(option);
    setFormValue(option.value);
    setFormLabel(option.label);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formValue.trim() || !formLabel.trim()) {
      toast.error('請填寫所有欄位');
      return;
    }

    try {
      if (editingOption) {
        await updateOption.mutateAsync({
          id: editingOption.id,
          value: formValue.trim(),
          label: formLabel.trim(),
        });
      } else {
        await createOption.mutateAsync({
          category: activeTab,
          value: formValue.trim(),
          label: formLabel.trim(),
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (option: SystemOption) => {
    await updateOption.mutateAsync({
      id: option.id,
      is_active: !option.is_active,
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirmOption) return;
    try {
      await deleteOption.mutateAsync(deleteConfirmOption.id);
      setDeleteConfirmOption(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleMoveUp = async (option: SystemOption, index: number) => {
    if (index === 0) return;
    const prevOption = filteredOptions[index - 1];
    await Promise.all([
      updateOption.mutateAsync({ id: option.id, sort_order: prevOption.sort_order }),
      updateOption.mutateAsync({ id: prevOption.id, sort_order: option.sort_order }),
    ]);
  };

  const handleMoveDown = async (option: SystemOption, index: number) => {
    if (index === filteredOptions.length - 1) return;
    const nextOption = filteredOptions[index + 1];
    await Promise.all([
      updateOption.mutateAsync({ id: option.id, sort_order: nextOption.sort_order }),
      updateOption.mutateAsync({ id: nextOption.id, sort_order: option.sort_order }),
    ]);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">僅限管理員存取</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          系統選項設定
        </h1>
        <p className="text-muted-foreground mt-1">
          管理下拉選單的選項，包括專案狀態、文件類型和文件狀態
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OptionCategory)}>
        <TabsList className="grid w-full grid-cols-3">
          {(Object.keys(categoryConfig) as OptionCategory[]).map((cat) => {
            const config = categoryConfig[cat];
            const Icon = config.icon;
            return (
              <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {config.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(categoryConfig) as OptionCategory[]).map((cat) => {
          const config = categoryConfig[cat];
          return (
            <TabsContent key={cat} value={cat}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{config.label}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                  <Button onClick={handleOpenCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    新增選項
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">載入中...</div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      尚無選項，請點擊「新增選項」開始建立
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">順序</TableHead>
                          <TableHead>值</TableHead>
                          <TableHead>顯示名稱</TableHead>
                          <TableHead className="w-24">狀態</TableHead>
                          <TableHead className="w-32 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOptions.map((option, index) => (
                          <TableRow key={option.id} className={!option.is_active ? 'opacity-50' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => handleMoveUp(option, index)}
                                    disabled={index === 0}
                                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => handleMoveDown(option, index)}
                                    disabled={index === filteredOptions.length - 1}
                                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{option.value}</TableCell>
                            <TableCell>{option.label}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={option.is_active}
                                  onCheckedChange={() => handleToggleActive(option)}
                                />
                                <Badge variant={option.is_active ? 'default' : 'secondary'}>
                                  {option.is_active ? '啟用' : '停用'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(option)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmOption(option)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOption ? '編輯選項' : '新增選項'}
            </DialogTitle>
            <DialogDescription>
              {editingOption ? '修改現有選項的設定' : `為「${categoryConfig[activeTab].label}」新增一個選項`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="value">選項值 *</Label>
              <Input
                id="value"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="例如：進行中"
              />
              <p className="text-xs text-muted-foreground">
                儲存到資料庫的實際值，建議與顯示名稱相同
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">顯示名稱 *</Label>
              <Input
                id="label"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="例如：進行中"
              />
              <p className="text-xs text-muted-foreground">
                在下拉選單中顯示給使用者的文字
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createOption.isPending || updateOption.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {editingOption ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmOption} onOpenChange={() => setDeleteConfirmOption(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除選項「{deleteConfirmOption?.label}」嗎？
              <br />
              <span className="text-destructive font-medium">
                注意：如果已有資料使用此選項，刪除後可能導致資料顯示異常。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
