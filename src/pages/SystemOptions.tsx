import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemOptions, OptionCategory, SystemOption } from '@/hooks/useSystemOptions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

// Sortable row component
interface SortableRowProps {
  option: SystemOption;
  onEdit: (option: SystemOption) => void;
  onDelete: (option: SystemOption) => void;
  onToggleActive: (option: SystemOption) => void;
}

function SortableRow({ option, onEdit, onDelete, onToggleActive }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={`${!option.is_active ? 'opacity-50' : ''} ${isDragging ? 'bg-muted' : ''}`}
    >
      <TableCell>
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 -m-2 touch-none"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">{option.value}</TableCell>
      <TableCell>{option.label}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={option.is_active}
            onCheckedChange={() => onToggleActive(option)}
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
            onClick={() => onEdit(option)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(option)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function SystemOptions() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<OptionCategory>('project_status');
  const { options, isLoading, createOption, updateOption, deleteOption, reorderOptions } = useSystemOptions();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<SystemOption | null>(null);
  const [deleteConfirmOption, setDeleteConfirmOption] = useState<SystemOption | null>(null);
  
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');

  const filteredOptions = options.filter(opt => opt.category === activeTab);

  // Setup dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredOptions.findIndex((opt) => opt.id === active.id);
      const newIndex = filteredOptions.findIndex((opt) => opt.id === over.id);

      const newOrder = arrayMove(filteredOptions, oldIndex, newIndex);
      const orderedIds = newOrder.map((opt) => opt.id);
      
      await reorderOptions.mutateAsync(orderedIds);
    }
  };

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
          管理下拉選單的選項，包括專案狀態、文件類型和文件狀態。拖曳列可調整順序。
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
          const categoryOptions = options.filter(opt => opt.category === cat);
          
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
                  ) : categoryOptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      尚無選項，請點擊「新增選項」開始建立
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
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
                          <SortableContext
                            items={categoryOptions.map((opt) => opt.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {categoryOptions.map((option) => (
                              <SortableRow
                                key={option.id}
                                option={option}
                                onEdit={handleOpenEdit}
                                onDelete={setDeleteConfirmOption}
                                onToggleActive={handleToggleActive}
                              />
                            ))}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </DndContext>
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
