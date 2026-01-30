import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Download, FileText, Shield } from 'lucide-react';
import { useQuoteEngineeringPresets, PresetCategory, EngineeringPreset, CreatePresetInput } from '@/hooks/useQuoteEngineeringPresets';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_LABELS: Record<PresetCategory, string> = {
  module_bracket: '模組支架',
  protection_engineering: '防護工程',
};

export function QuotePresetsPanel() {
  const { presets, isLoading, createPreset, updatePreset, deletePreset, initializeFromDefaults } = useQuoteEngineeringPresets();
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('module_bracket');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<EngineeringPreset | null>(null);

  // 篩選當前類別的預設值
  const filteredPresets = presets.filter(p => p.category === activeCategory);

  // 新增表單狀態
  const [newPreset, setNewPreset] = useState<CreatePresetInput>({
    category: 'module_bracket',
    preset_key: '',
    item_name: '',
    spec_description: '',
    parent_label: '',
    is_sub_option: false,
  });

  const resetForm = () => {
    setNewPreset({
      category: activeCategory,
      preset_key: '',
      item_name: '',
      spec_description: '',
      parent_label: '',
      is_sub_option: false,
    });
  };

  const handleAdd = () => {
    createPreset.mutate(
      { ...newPreset, category: activeCategory },
      {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingPreset) return;
    updatePreset.mutate(
      {
        id: editingPreset.id,
        item_name: editingPreset.item_name,
        spec_description: editingPreset.spec_description || undefined,
        parent_label: editingPreset.parent_label || undefined,
        is_sub_option: editingPreset.is_sub_option,
        is_active: editingPreset.is_active,
      },
      {
        onSuccess: () => setEditingPreset(null),
      }
    );
  };

  const handleDelete = (id: string) => {
    deletePreset.mutate(id);
  };

  const handleToggleActive = (preset: EngineeringPreset) => {
    updatePreset.mutate({
      id: preset.id,
      is_active: !preset.is_active,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              報價項目預設值管理
            </CardTitle>
            <CardDescription className="mt-1">
              管理成本報價中的項目名稱與規格描述預設值
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => initializeFromDefaults.mutate()}
            disabled={initializeFromDefaults.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            載入系統預設
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as PresetCategory)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="module_bracket" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                模組支架
              </TabsTrigger>
              <TabsTrigger value="protection_engineering" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                防護工程
              </TabsTrigger>
            </TabsList>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增項目
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>新增項目預設值</DialogTitle>
                  <DialogDescription>
                    新增 {CATEGORY_LABELS[activeCategory]} 的項目名稱與規格描述
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="preset_key">項目代碼 *</Label>
                    <Input
                      id="preset_key"
                      value={newPreset.preset_key}
                      onChange={(e) => setNewPreset({ ...newPreset, preset_key: e.target.value })}
                      placeholder="如: galvanized_steel_bracket"
                    />
                    <p className="text-xs text-muted-foreground">用於系統辨識，僅限英文、數字、底線</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item_name">項目名稱 *</Label>
                    <Input
                      id="item_name"
                      value={newPreset.item_name}
                      onChange={(e) => setNewPreset({ ...newPreset, item_name: e.target.value })}
                      placeholder="如: 熱浸鍍鋅鋼構"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent_label">父項目標籤（選填）</Label>
                    <Input
                      id="parent_label"
                      value={newPreset.parent_label || ''}
                      onChange={(e) => setNewPreset({ ...newPreset, parent_label: e.target.value })}
                      placeholder="如: 熱浸鍍鋅鋼構"
                    />
                    <p className="text-xs text-muted-foreground">若此項目屬於子選項，填寫父項目名稱</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_sub_option"
                      checked={newPreset.is_sub_option}
                      onCheckedChange={(checked) => setNewPreset({ ...newPreset, is_sub_option: checked })}
                    />
                    <Label htmlFor="is_sub_option">是否為子選項</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spec_description">規格描述</Label>
                    <Textarea
                      id="spec_description"
                      value={newPreset.spec_description || ''}
                      onChange={(e) => setNewPreset({ ...newPreset, spec_description: e.target.value })}
                      placeholder="輸入詳細規格描述，支援多行..."
                      rows={6}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={!newPreset.preset_key || !newPreset.item_name || createPreset.isPending}
                  >
                    新增
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="module_bracket" className="mt-0">
            <PresetTable
              presets={filteredPresets}
              onEdit={setEditingPreset}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          </TabsContent>
          <TabsContent value="protection_engineering" className="mt-0">
            <PresetTable
              presets={filteredPresets}
              onEdit={setEditingPreset}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          </TabsContent>
        </Tabs>

        {/* 編輯對話框 */}
        <Dialog open={!!editingPreset} onOpenChange={(open) => !open && setEditingPreset(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>編輯項目預設值</DialogTitle>
            </DialogHeader>
            {editingPreset && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>項目代碼</Label>
                  <Input value={editingPreset.preset_key} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_item_name">項目名稱 *</Label>
                  <Input
                    id="edit_item_name"
                    value={editingPreset.item_name}
                    onChange={(e) => setEditingPreset({ ...editingPreset, item_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_parent_label">父項目標籤</Label>
                  <Input
                    id="edit_parent_label"
                    value={editingPreset.parent_label || ''}
                    onChange={(e) => setEditingPreset({ ...editingPreset, parent_label: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit_is_sub_option"
                    checked={editingPreset.is_sub_option}
                    onCheckedChange={(checked) => setEditingPreset({ ...editingPreset, is_sub_option: checked })}
                  />
                  <Label htmlFor="edit_is_sub_option">是否為子選項</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit_is_active"
                    checked={editingPreset.is_active}
                    onCheckedChange={(checked) => setEditingPreset({ ...editingPreset, is_active: checked })}
                  />
                  <Label htmlFor="edit_is_active">啟用</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_spec_description">規格描述</Label>
                  <Textarea
                    id="edit_spec_description"
                    value={editingPreset.spec_description || ''}
                    onChange={(e) => setEditingPreset({ ...editingPreset, spec_description: e.target.value })}
                    rows={6}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPreset(null)}>
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={updatePreset.isPending}>
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

interface PresetTableProps {
  presets: EngineeringPreset[];
  onEdit: (preset: EngineeringPreset) => void;
  onDelete: (id: string) => void;
  onToggleActive: (preset: EngineeringPreset) => void;
}

function PresetTable({ presets, onEdit, onDelete, onToggleActive }: PresetTableProps) {
  if (presets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚無項目，請點擊「新增項目」或「載入系統預設」
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">排序</TableHead>
            <TableHead className="min-w-[120px]">項目名稱</TableHead>
            <TableHead className="min-w-[200px]">規格描述</TableHead>
            <TableHead className="w-20">狀態</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {presets.map((preset) => (
            <TableRow key={preset.id}>
              <TableCell className="text-muted-foreground text-sm">
                {preset.sort_order}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  {preset.parent_label && (
                    <span className="text-xs text-muted-foreground">{preset.parent_label}</span>
                  )}
                  <span className={preset.is_sub_option ? 'pl-3' : ''}>{preset.item_name}</span>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2">
                  {preset.spec_description || '-'}
                </p>
              </TableCell>
              <TableCell>
                <Switch
                  checked={preset.is_active}
                  onCheckedChange={() => onToggleActive(preset)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(preset)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
                        <AlertDialogDescription>
                          此操作將永久刪除「{preset.item_name}」預設值，無法復原。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(preset.id)}
                        >
                          刪除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default QuotePresetsPanel;
