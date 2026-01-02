import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useProjectFieldConfig, 
  useProjectCustomFields,
  FieldConfig,
  CustomField 
} from '@/hooks/useProjectFieldConfig';
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
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  Save,
  RefreshCw,
  Layout,
  Layers,
  Type,
  Hash,
  Calendar,
  List,
  FileText,
  CheckSquare,
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
import { toast } from 'sonner';

// Field type icons and labels
const FIELD_TYPES = [
  { value: 'text', label: '文字', icon: Type },
  { value: 'number', label: '數字', icon: Hash },
  { value: 'date', label: '日期', icon: Calendar },
  { value: 'select', label: '下拉選單', icon: List },
  { value: 'textarea', label: '多行文字', icon: FileText },
  { value: 'checkbox', label: '核取方塊', icon: CheckSquare },
] as const;

// Sortable row for system fields
function SortableFieldRow({ 
  field, 
  onToggleVisible,
  onEditLabel,
}: { 
  field: FieldConfig;
  onToggleVisible: (field: FieldConfig) => void;
  onEditLabel: (field: FieldConfig) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style}
      className={`${!field.is_visible ? 'opacity-50 bg-muted/30' : ''} ${isDragging ? 'bg-muted' : ''}`}
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
      <TableCell className="font-mono text-sm text-muted-foreground">{field.field_key}</TableCell>
      <TableCell className="font-medium">{field.field_label}</TableCell>
      <TableCell>
        <Badge variant={field.is_system ? 'secondary' : 'outline'}>
          {field.is_system ? '系統欄位' : '自訂'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={field.is_visible}
            onCheckedChange={() => onToggleVisible(field)}
          />
          {field.is_visible ? (
            <Eye className="w-4 h-4 text-primary" />
          ) : (
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => onEditLabel(field)}>
          <Pencil className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Sortable row for custom fields
function SortableCustomFieldRow({ 
  field, 
  onEdit,
  onDelete,
  onToggleActive,
}: { 
  field: CustomField;
  onEdit: (field: CustomField) => void;
  onDelete: (field: CustomField) => void;
  onToggleActive: (field: CustomField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const TypeIcon = FIELD_TYPES.find(t => t.value === field.field_type)?.icon || Type;

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style}
      className={`${!field.is_active ? 'opacity-50 bg-muted/30' : ''} ${isDragging ? 'bg-muted' : ''}`}
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
      <TableCell className="font-medium">{field.field_label}</TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1">
          <TypeIcon className="w-3 h-3" />
          {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
        </Badge>
      </TableCell>
      <TableCell>
        {field.is_required && <Badge variant="destructive">必填</Badge>}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={field.is_active}
            onCheckedChange={() => onToggleActive(field)}
          />
          <Badge variant={field.is_active ? 'default' : 'secondary'}>
            {field.is_active ? '啟用' : '停用'}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(field)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(field)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ProjectFieldSettings() {
  const { isAdmin } = useAuth();
  const {
    fieldConfigs,
    isLoading: isLoadingConfig,
    initializeDefaults,
    updateFieldConfig,
    reorderFields,
  } = useProjectFieldConfig();

  const {
    customFields,
    isLoading: isLoadingCustom,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    reorderCustomFields,
  } = useProjectCustomFields();

  // Edit label dialog
  const [editingField, setEditingField] = useState<FieldConfig | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Custom field dialog
  const [isCustomFieldDialogOpen, setIsCustomFieldDialogOpen] = useState(false);
  const [editingCustomField, setEditingCustomField] = useState<CustomField | null>(null);
  const [customFieldForm, setCustomFieldForm] = useState({
    field_label: '',
    field_type: 'text' as CustomField['field_type'],
    is_required: false,
    field_options: [] as string[],
  });
  const [optionInput, setOptionInput] = useState('');

  // Delete confirmation
  const [deletingField, setDeletingField] = useState<CustomField | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle drag end for system fields
  const handleFieldDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fieldConfigs.findIndex(f => f.id === active.id);
    const newIndex = fieldConfigs.findIndex(f => f.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(fieldConfigs, oldIndex, newIndex);
    await reorderFields.mutateAsync(newOrder.map(f => f.id));
  };

  // Handle drag end for custom fields
  const handleCustomFieldDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = customFields.findIndex(f => f.id === active.id);
    const newIndex = customFields.findIndex(f => f.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(customFields, oldIndex, newIndex);
    await reorderCustomFields.mutateAsync(newOrder.map(f => f.id));
  };

  // Toggle field visibility
  const handleToggleVisible = async (field: FieldConfig) => {
    await updateFieldConfig.mutateAsync({
      id: field.id,
      is_visible: !field.is_visible,
    });
  };

  // Save label edit
  const handleSaveLabel = async () => {
    if (!editingField || !editLabel.trim()) return;
    
    await updateFieldConfig.mutateAsync({
      id: editingField.id,
      field_label: editLabel.trim(),
    });
    
    setEditingField(null);
    setEditLabel('');
    toast.success('標籤已更新');
  };

  // Open custom field dialog
  const handleOpenCustomFieldDialog = (field?: CustomField) => {
    if (field) {
      setEditingCustomField(field);
      setCustomFieldForm({
        field_label: field.field_label,
        field_type: field.field_type,
        is_required: field.is_required,
        field_options: field.field_options || [],
      });
    } else {
      setEditingCustomField(null);
      setCustomFieldForm({
        field_label: '',
        field_type: 'text',
        is_required: false,
        field_options: [],
      });
    }
    setIsCustomFieldDialogOpen(true);
  };

  // Save custom field
  const handleSaveCustomField = async () => {
    if (!customFieldForm.field_label.trim()) {
      toast.error('請輸入欄位名稱');
      return;
    }

    const fieldData = {
      field_label: customFieldForm.field_label.trim(),
      field_type: customFieldForm.field_type,
      is_required: customFieldForm.is_required,
      field_options: customFieldForm.field_options,
      is_active: true,
      sort_order: customFields.length + 1,
      field_key: '',
    };

    if (editingCustomField) {
      await updateCustomField.mutateAsync({
        id: editingCustomField.id,
        ...fieldData,
      });
    } else {
      await createCustomField.mutateAsync(fieldData);
    }

    setIsCustomFieldDialogOpen(false);
  };

  // Toggle custom field active
  const handleToggleCustomFieldActive = async (field: CustomField) => {
    await updateCustomField.mutateAsync({
      id: field.id,
      is_active: !field.is_active,
    });
  };

  // Delete custom field
  const handleDeleteCustomField = async () => {
    if (!deletingField) return;
    await deleteCustomField.mutateAsync(deletingField.id);
    setDeletingField(null);
  };

  // Add option to select field
  const handleAddOption = () => {
    if (!optionInput.trim()) return;
    setCustomFieldForm({
      ...customFieldForm,
      field_options: [...customFieldForm.field_options, optionInput.trim()],
    });
    setOptionInput('');
  };

  // Remove option
  const handleRemoveOption = (index: number) => {
    setCustomFieldForm({
      ...customFieldForm,
      field_options: customFieldForm.field_options.filter((_, i) => i !== index),
    });
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Layout className="w-6 h-6" />
            案場欄位設定
          </h1>
          <p className="text-muted-foreground mt-1">
            管理案場列表的欄位顯示、順序、標籤，以及新增自訂欄位
          </p>
        </div>
      </div>

      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system" className="gap-2">
            <Settings2 className="w-4 h-4" />
            系統欄位
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2">
            <Layers className="w-4 h-4" />
            自訂欄位
          </TabsTrigger>
        </TabsList>

        {/* System Fields Tab */}
        <TabsContent value="system">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>系統欄位設定</CardTitle>
                <CardDescription>
                  調整系統內建欄位的顯示狀態、順序和標籤名稱
                </CardDescription>
              </div>
              {fieldConfigs.length === 0 && (
                <Button 
                  onClick={() => initializeDefaults.mutate()}
                  disabled={initializeDefaults.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${initializeDefaults.isPending ? 'animate-spin' : ''}`} />
                  載入預設值
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingConfig ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : fieldConfigs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>尚無欄位設定</p>
                  <p className="text-sm mt-1">點擊「載入預設值」初始化系統欄位</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleFieldDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">順序</TableHead>
                        <TableHead className="w-40">欄位鍵</TableHead>
                        <TableHead>顯示標籤</TableHead>
                        <TableHead className="w-24">類型</TableHead>
                        <TableHead className="w-28">顯示</TableHead>
                        <TableHead className="w-24 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={fieldConfigs.map(f => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {fieldConfigs.map(field => (
                          <SortableFieldRow
                            key={field.id}
                            field={field}
                            onToggleVisible={handleToggleVisible}
                            onEditLabel={(f) => {
                              setEditingField(f);
                              setEditLabel(f.field_label);
                            }}
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

        {/* Custom Fields Tab */}
        <TabsContent value="custom">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>自訂欄位</CardTitle>
                <CardDescription>
                  新增額外欄位來記錄案場的自訂資訊
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenCustomFieldDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                新增自訂欄位
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingCustom ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : customFields.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>尚無自訂欄位</p>
                  <p className="text-sm mt-1">點擊「新增自訂欄位」建立新欄位</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleCustomFieldDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">順序</TableHead>
                        <TableHead>欄位名稱</TableHead>
                        <TableHead className="w-32">類型</TableHead>
                        <TableHead className="w-20">必填</TableHead>
                        <TableHead className="w-28">狀態</TableHead>
                        <TableHead className="w-24 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={customFields.map(f => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {customFields.map(field => (
                          <SortableCustomFieldRow
                            key={field.id}
                            field={field}
                            onEdit={handleOpenCustomFieldDialog}
                            onDelete={setDeletingField}
                            onToggleActive={handleToggleCustomFieldActive}
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
      </Tabs>

      {/* Edit Label Dialog */}
      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯欄位標籤</DialogTitle>
            <DialogDescription>
              修改欄位的顯示名稱
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>欄位鍵</Label>
              <Input value={editingField?.field_key || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>顯示標籤</Label>
              <Input 
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="輸入顯示名稱"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>取消</Button>
            <Button onClick={handleSaveLabel} disabled={updateFieldConfig.isPending}>
              <Save className="w-4 h-4 mr-2" />
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Field Dialog */}
      <Dialog open={isCustomFieldDialogOpen} onOpenChange={setIsCustomFieldDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomField ? '編輯自訂欄位' : '新增自訂欄位'}
            </DialogTitle>
            <DialogDescription>
              設定欄位的類型和屬性
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>欄位名稱 *</Label>
              <Input 
                value={customFieldForm.field_label}
                onChange={(e) => setCustomFieldForm({ ...customFieldForm, field_label: e.target.value })}
                placeholder="例：合約編號"
              />
            </div>
            <div className="space-y-2">
              <Label>欄位類型</Label>
              <Select 
                value={customFieldForm.field_type}
                onValueChange={(v) => setCustomFieldForm({ ...customFieldForm, field_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Options for select type */}
            {customFieldForm.field_type === 'select' && (
              <div className="space-y-2">
                <Label>選項</Label>
                <div className="flex gap-2">
                  <Input 
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    placeholder="輸入選項"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                  />
                  <Button type="button" variant="outline" onClick={handleAddOption}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {customFieldForm.field_options.map((opt, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      {opt}
                      <button onClick={() => handleRemoveOption(idx)} className="ml-1 hover:text-destructive">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch 
                checked={customFieldForm.is_required}
                onCheckedChange={(v) => setCustomFieldForm({ ...customFieldForm, is_required: v })}
              />
              <Label>必填欄位</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomFieldDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleSaveCustomField} 
              disabled={createCustomField.isPending || updateCustomField.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingField} onOpenChange={() => setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除自訂欄位？</AlertDialogTitle>
            <AlertDialogDescription>
              刪除後，所有案場中此欄位的資料將會遺失，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCustomField}
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
