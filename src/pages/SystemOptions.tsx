import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCodebook, CodebookOption } from '@/hooks/useCodebook';
import { CodebookCategory, codebookCategoryConfig, allCategories, defaultEnumValues } from '@/config/codebookConfig';
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
  AlertCircle,
  Database,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Sortable row component with usage count
interface SortableRowProps {
  option: CodebookOption;
  usageCount: number;
  onEdit: (option: CodebookOption) => void;
  onDelete: (option: CodebookOption, usageCount: number) => void;
  onToggleActive: (option: CodebookOption) => void;
}

function SortableRow({ option, usageCount, onEdit, onDelete, onToggleActive }: SortableRowProps) {
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

  const canDelete = usageCount === 0;

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={`${!option.is_active ? 'opacity-50 bg-muted/30' : ''} ${isDragging ? 'bg-muted' : ''}`}
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={usageCount > 0 ? 'secondary' : 'outline'} className="cursor-help">
                <Database className="w-3 h-3 mr-1" />
                {usageCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {usageCount > 0 
                ? `已被 ${usageCount} 筆資料使用` 
                : '尚無資料使用此選項'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(option, usageCount)}
                    className={canDelete ? "text-destructive hover:text-destructive" : "text-muted-foreground"}
                    disabled={!canDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canDelete && (
                <TooltipContent>
                  <p>已被 {usageCount} 筆資料使用，無法刪除</p>
                  <p className="text-xs text-muted-foreground">請改為停用此選項</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function SystemOptions() {
  const { isAdmin } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CodebookCategory>('project_status');
  const { 
    options, 
    isLoading, 
    isLoadingUsage,
    usageCounts,
    getUsageCount,
    createOption, 
    updateOption, 
    deleteOption, 
    reorderOptions 
  } = useCodebook(activeCategory);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<CodebookOption | null>(null);
  const [deleteConfirmOption, setDeleteConfirmOption] = useState<{ option: CodebookOption; usageCount: number } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');

  const filteredOptions = options.filter(opt => opt.category === activeCategory);
  const categoryConfig = codebookCategoryConfig[activeCategory];

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

  const handleOpenEdit = (option: CodebookOption) => {
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
          category: activeCategory,
          value: formValue.trim(),
          label: formLabel.trim(),
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (option: CodebookOption) => {
    await updateOption.mutateAsync({
      id: option.id,
      is_active: !option.is_active,
    });
  };

  const handleDeleteClick = (option: CodebookOption, usageCount: number) => {
    if (usageCount > 0) {
      toast.error(`此選項已被 ${usageCount} 筆資料使用，無法刪除。請改為停用此選項。`);
      return;
    }
    setDeleteConfirmOption({ option, usageCount });
  };

  const handleDelete = async () => {
    if (!deleteConfirmOption) return;
    try {
      await deleteOption.mutateAsync({
        id: deleteConfirmOption.option.id,
        category: activeCategory,
        value: deleteConfirmOption.option.value,
      });
      setDeleteConfirmOption(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Initialize category with default values if empty
  const handleInitializeCategory = async () => {
    const defaults = defaultEnumValues[activeCategory];
    if (!defaults || defaults.length === 0) return;

    setIsInitializing(true);
    try {
      for (let i = 0; i < defaults.length; i++) {
        const { value, label } = defaults[i];
        // Check if already exists
        const existing = filteredOptions.find(opt => opt.value === value);
        if (!existing) {
          await supabase
            .from('system_options')
            .insert({
              category: activeCategory,
              value,
              label,
              sort_order: i + 1,
            });
        }
      }
      toast.success(`已初始化「${categoryConfig.label}」的預設選項`);
      // Refresh data
      window.location.reload();
    } catch (error) {
      toast.error('初始化失敗');
    } finally {
      setIsInitializing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">僅限管理員存取</p>
      </div>
    );
  }

  const Icon = categoryConfig.icon;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          代碼對照表 (Codebook)
        </h1>
        <p className="text-muted-foreground mt-1">
          統一管理系統所有下拉選單選項，包括新增、修改、排序、啟用/停用。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">選項類別</CardTitle>
            <CardDescription>選擇要管理的類別</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-3">
                {allCategories.map((cat) => {
                  const config = codebookCategoryConfig[cat];
                  const CatIcon = config.icon;
                  const isActive = cat === activeCategory;
                  const categoryOptions = options.filter(opt => opt.category === cat);
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <CatIcon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{config.label}</div>
                        <div className={`text-xs ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {categoryOptions.length} 個選項
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Options Panel */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{categoryConfig.label}</CardTitle>
                <CardDescription>{categoryConfig.description}</CardDescription>
                <div className="flex flex-wrap gap-1 mt-2">
                  {categoryConfig.usageMapping.map((mapping, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {mapping.table}.{mapping.column}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {filteredOptions.length === 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleInitializeCategory}
                  disabled={isInitializing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
                  載入預設值
                </Button>
              )}
              <Button onClick={handleOpenCreate}>
                <Plus className="w-4 h-4 mr-2" />
                新增選項
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : filteredOptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>尚無選項</p>
                <p className="text-sm mt-1">點擊「載入預設值」匯入系統預設選項，或「新增選項」手動建立</p>
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
                      <TableHead className="w-24">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                              引用數
                              {isLoadingUsage && <RefreshCw className="w-3 h-3 animate-spin" />}
                            </TooltipTrigger>
                            <TooltipContent>
                              被資料庫中的資料引用的次數
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="w-28">狀態</TableHead>
                      <TableHead className="w-24 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={filteredOptions.map((opt) => opt.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredOptions.map((option) => (
                        <SortableRow
                          key={option.id}
                          option={option}
                          usageCount={getUsageCount(option.id)}
                          onEdit={handleOpenEdit}
                          onDelete={handleDeleteClick}
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOption ? '編輯選項' : '新增選項'}
            </DialogTitle>
            <DialogDescription>
              {editingOption ? '修改現有選項的設定' : `為「${categoryConfig.label}」新增一個選項`}
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
                儲存到資料庫的實際值，必須與現有資料的值相符
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
              確定要刪除選項「{deleteConfirmOption?.option.label}」嗎？
              <br />
              此操作無法復原。
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
