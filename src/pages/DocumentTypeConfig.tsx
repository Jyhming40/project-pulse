import { useState } from 'react';
import { useDocumentTypeConfig, DocumentTypeConfigInput } from '@/hooks/useDocumentTypeConfig';
import { AGENCY_CODE_TO_LABEL, AGENCY_CODES, type AgencyCode } from '@/lib/docTypeMapping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Plus,
  Pencil,
  FileText,
  Building2,
  Lock,
  Loader2,
  Star,
} from 'lucide-react';

export default function DocumentTypeConfig() {
  const {
    documentTypes,
    isLoading,
    groupedByAgency,
    createDocumentType,
    updateDocumentType,
    toggleActive,
    isCreating,
    isUpdating,
  } = useDocumentTypeConfig();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<typeof documentTypes[0] | null>(null);
  const [form, setForm] = useState<DocumentTypeConfigInput>({
    code: '',
    label: '',
    agency_code: 'OTHER',
    description: '',
    sort_order: 0,
  });

  const grouped = groupedByAgency();

  const openCreateDialog = () => {
    setEditingType(null);
    setForm({
      code: '',
      label: '',
      agency_code: 'OTHER',
      description: '',
      sort_order: 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (type: typeof documentTypes[0]) => {
    setEditingType(type);
    setForm({
      code: type.code,
      label: type.label,
      agency_code: type.agency_code,
      description: type.description || '',
      sort_order: type.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code || !form.label || !form.agency_code) return;

    if (editingType) {
      await updateDocumentType({
        id: editingType.id,
        label: form.label,
        agency_code: form.agency_code,
        description: form.description,
        sort_order: form.sort_order,
      });
    } else {
      await createDocumentType(form);
    }
    setDialogOpen(false);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await toggleActive({ id, is_active: !currentActive });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" />
            文件類型管理
          </h1>
          <p className="text-muted-foreground mt-1">
            設定系統中可用的文件類型，按發證機關分組管理
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          新增類型
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{documentTypes.length}</p>
            <p className="text-sm text-muted-foreground">總類型數</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-success">
              {documentTypes.filter(d => d.is_active).length}
            </p>
            <p className="text-sm text-muted-foreground">啟用中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">
              {documentTypes.filter(d => d.is_required && d.is_active).length}
            </p>
            <p className="text-sm text-muted-foreground">必要文件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-muted-foreground">
              {documentTypes.filter(d => !d.is_active).length}
            </p>
            <p className="text-sm text-muted-foreground">已停用</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">
              {documentTypes.filter(d => d.is_system).length}
            </p>
            <p className="text-sm text-muted-foreground">系統內建</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            按機關分組
          </CardTitle>
          <CardDescription>
            展開各機關查看其下所有文件類型
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full" defaultValue={AGENCY_CODES.slice(0, 3)}>
            {AGENCY_CODES.map(agencyCode => {
              const items = grouped[agencyCode] || [];
              const activeCount = items.filter(i => i.is_active).length;

              return (
                <AccordionItem key={agencyCode} value={agencyCode}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {AGENCY_CODE_TO_LABEL[agencyCode]}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {activeCount}/{items.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        尚無文件類型
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">代碼</TableHead>
                            <TableHead>名稱</TableHead>
                            <TableHead className="w-[60px] text-center">必要</TableHead>
                            <TableHead className="w-[80px]">排序</TableHead>
                            <TableHead className="w-[80px]">狀態</TableHead>
                            <TableHead className="w-[80px]">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {item.code}
                                </code>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {item.label}
                                  {item.is_system && (
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.is_required && (
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 mx-auto" />
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.sort_order}
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={item.is_active}
                                  onCheckedChange={() => handleToggleActive(item.id, item.is_active)}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(item)}
                                  disabled={item.is_system}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? '編輯文件類型' : '新增文件類型'}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? '修改文件類型的名稱、機關或說明'
                : '建立新的文件類型，系統會自動產生對應的代碼'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">代碼 *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="例如：TPC_NEW_DOC"
                disabled={!!editingType}
              />
              <p className="text-xs text-muted-foreground">
                建議格式：機關代碼_文件名稱（全大寫）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">名稱 *</Label>
              <Input
                id="label"
                value={form.label}
                onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="例如：新文件類型"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agency">發證機關 *</Label>
              <Select
                value={form.agency_code}
                onValueChange={val => setForm(prev => ({ ...prev, agency_code: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_CODES.map(code => (
                    <SelectItem key={code} value={code}>
                      {AGENCY_CODE_TO_LABEL[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort_order">排序</Label>
              <Input
                id="sort_order"
                type="number"
                value={form.sort_order}
                onChange={e => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">說明</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="選填，用於說明此文件類型的用途"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.code || !form.label || isCreating || isUpdating}
            >
              {(isCreating || isUpdating) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingType ? '儲存' : '建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}