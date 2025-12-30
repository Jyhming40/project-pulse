import { useState, useRef, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartners, type Partner, type CreatePartnerInput } from '@/hooks/usePartners';
import { usePartnersImport } from '@/hooks/usePartnersImport';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { useCodebookOptions } from '@/hooks/useCodebook';
import { useTableSort } from '@/hooks/useTableSort';
import { usePagination } from '@/hooks/usePagination';
import { CodebookSelect, CodebookValue } from '@/components/CodebookSelect';
import { PartnerContacts } from '@/components/PartnerContacts';
import { TablePagination } from '@/components/ui/table-pagination';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Power,
  PowerOff,
  Users,
  Phone,
  Mail,
  Upload,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Hammer,
  X,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function Partners() {
  const { canEdit, isAdmin } = useAuth();
  const {
    partners,
    isLoading,
    createPartner,
    updatePartner,
    toggleActive,
    isCreating,
    isUpdating,
  } = usePartners();

  // Soft delete hook
  const { softDelete, isDeleting } = useSoftDelete({
    tableName: 'partners',
    queryKey: 'partners',
  });

  const {
    isProcessing: isImporting,
    preview: importPreview,
    previewImport,
    executeImport,
    clearPreview,
    downloadTemplate,
  } = usePartnersImport();

  const { options: workTypeOptions } = useCodebookOptions('construction_work_type');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWorkType, setFilterWorkType] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'insert' | 'upsert'>('upsert');
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: '',
    partner_type: '',
    tax_id: '',
    contact_person: '',
    contact_phone: '',
    email: '',
    address: '',
    note: '',
    work_capabilities: [],
  });

  // Filter partners by search and work type
  const filteredPartners = partners.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      p.contact_person?.toLowerCase().includes(query) ||
      p.contact_phone?.includes(query) ||
      p.tax_id?.includes(query);
    
    const matchesWorkType = !filterWorkType || 
      (p.work_capabilities && p.work_capabilities.includes(filterWorkType));
    
    return matchesSearch && matchesWorkType;
  });

  // Sorting (multi-column support)
  const { sortedData: sortedPartners, sortConfig, handleSort, getSortInfo } = useTableSort(filteredPartners, {
    key: 'name',
    direction: 'asc',
  });

  // Pagination
  const pagination = usePagination(sortedPartners, { pageSize: 20 });

  const handleOpenForm = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name,
        partner_type: partner.partner_type || '',
        tax_id: partner.tax_id || '',
        contact_person: partner.contact_person || '',
        contact_phone: partner.contact_phone || '',
        email: partner.email || '',
        address: partner.address || '',
        note: partner.note || '',
        work_capabilities: partner.work_capabilities || [],
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: '',
        partner_type: '',
        tax_id: '',
        contact_person: '',
        contact_phone: '',
        email: '',
        address: '',
        note: '',
        work_capabilities: [],
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('請輸入夥伴名稱');
      return;
    }

    try {
      if (editingPartner) {
        await updatePartner({ id: editingPartner.id, ...formData });
      } else {
        await createPartner(formData);
      }
      setIsFormOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (reason?: string) => {
    if (!deletingPartner) return;
    try {
      await softDelete({ id: deletingPartner.id, reason });
      setIsDeleteOpen(false);
      setDeletingPartner(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (partner: Partner) => {
    await toggleActive({ id: partner.id, is_active: !partner.is_active });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      await previewImport(file);
      setIsImportOpen(true);
    } catch (error) {
      toast.error('檔案解析失敗');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const result = await executeImport(importPreview, importMode);
    if (result.errors === 0) {
      setIsImportOpen(false);
      clearPreview();
    }
  };

  const handleCloseImport = () => {
    setIsImportOpen(false);
    clearPreview();
  };

  const previewStats = {
    insert: importPreview.filter((i) => i.status === 'insert').length,
    update: importPreview.filter((i) => i.status === 'update').length,
    error: importPreview.filter((i) => i.status === 'error').length,
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">您沒有權限存取此頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            外包夥伴管理
          </h1>
          <p className="text-muted-foreground">
            管理施工工班、廠商與個人外包夥伴
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            下載範本
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            匯入 Excel
          </Button>
          <Button onClick={() => handleOpenForm()}>
            <Plus className="w-4 h-4 mr-2" />
            新增夥伴
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋名稱、統編、聯絡人、電話..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select
            value={filterWorkType || '__all__'}
            onValueChange={(val) => setFilterWorkType(val === '__all__' ? '' : val)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="依工程能力篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              {workTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterWorkType && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFilterWorkType('')}
              title="清除篩選"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            外包夥伴清單
          </CardTitle>
          <CardDescription>
            共 {filteredPartners.length} 筆資料
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? '找不到符合的夥伴' : '尚無資料，請新增外包夥伴'}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <SortableTableHead sortKey="name" currentSortKey={sortConfig.key} currentDirection={getSortInfo('name').direction} sortIndex={getSortInfo('name').index} onSort={handleSort}>名稱</SortableTableHead>
                    <SortableTableHead sortKey="partner_type" currentSortKey={sortConfig.key} currentDirection={getSortInfo('partner_type').direction} sortIndex={getSortInfo('partner_type').index} onSort={handleSort}>類型</SortableTableHead>
                    <SortableTableHead sortKey="tax_id" currentSortKey={sortConfig.key} currentDirection={getSortInfo('tax_id').direction} sortIndex={getSortInfo('tax_id').index} onSort={handleSort}>統編</SortableTableHead>
                    <TableHead>工程能力</TableHead>
                    <SortableTableHead sortKey="contact_person" currentSortKey={sortConfig.key} currentDirection={getSortInfo('contact_person').direction} sortIndex={getSortInfo('contact_person').index} onSort={handleSort}>聯絡人</SortableTableHead>
                    <SortableTableHead sortKey="is_active" currentSortKey={sortConfig.key} currentDirection={getSortInfo('is_active').direction} sortIndex={getSortInfo('is_active').index} onSort={handleSort}>狀態</SortableTableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((partner) => (
                    <Fragment key={partner.id}>
                      <TableRow className={!partner.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setExpandedPartner(
                              expandedPartner === partner.id ? null : partner.id
                            )}
                          >
                            {expandedPartner === partner.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        <TableCell>
                          <CodebookValue category="partner_type" value={partner.partner_type} />
                        </TableCell>
                        <TableCell>{partner.tax_id || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {partner.work_capabilities && partner.work_capabilities.length > 0 ? (
                              partner.work_capabilities.slice(0, 2).map((cap) => (
                                <Badge key={cap} variant="outline" className="text-xs">
                                  {cap.length > 10 ? cap.substring(0, 10) + '...' : cap}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {partner.work_capabilities && partner.work_capabilities.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{partner.work_capabilities.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{partner.contact_person || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                            {partner.is_active ? '啟用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenForm(partner)}
                              title="編輯"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(partner)}
                              title={partner.is_active ? '停用' : '啟用'}
                            >
                              {partner.is_active ? (
                                <PowerOff className="w-4 h-4 text-warning" />
                              ) : (
                                <Power className="w-4 h-4 text-success" />
                              )}
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeletingPartner(partner);
                                  setIsDeleteOpen(true);
                                }}
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded contacts row */}
                      {expandedPartner === partner.id && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-4">
                            <PartnerContacts partnerId={partner.id} partnerName={partner.name} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                pageSizeOptions={pagination.pageSizeOptions}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                hasNextPage={pagination.hasNextPage}
                hasPreviousPage={pagination.hasPreviousPage}
                onPageChange={pagination.goToPage}
                onPageSizeChange={pagination.changePageSize}
                getPageNumbers={pagination.getPageNumbers}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPartner ? '編輯外包夥伴' : '新增外包夥伴'}</DialogTitle>
            <DialogDescription>
              {editingPartner ? '修改夥伴資料' : '建立新的外包夥伴'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name">名稱 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入夥伴名稱"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>類型</Label>
                <CodebookSelect
                  category="partner_type"
                  value={formData.partner_type || ''}
                  onValueChange={(v) => setFormData({ ...formData, partner_type: v })}
                  placeholder="選擇類型"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tax_id">統編</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id || ''}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="統一編號"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Hammer className="w-4 h-4" />
                工程能力（可多選）
              </Label>
              <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2">
                {workTypeOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`work-${opt.value}`}
                      checked={formData.work_capabilities?.includes(opt.value) || false}
                      onCheckedChange={(checked) => {
                        const current = formData.work_capabilities || [];
                        if (checked) {
                          setFormData({ ...formData, work_capabilities: [...current, opt.value] });
                        } else {
                          setFormData({ ...formData, work_capabilities: current.filter(v => v !== opt.value) });
                        }
                      }}
                    />
                    <label
                      htmlFor={`work-${opt.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
              {formData.work_capabilities && formData.work_capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {formData.work_capabilities.map((cap) => (
                    <Badge key={cap} variant="secondary" className="text-xs">
                      {cap}
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          work_capabilities: formData.work_capabilities?.filter(v => v !== cap)
                        })}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact_person">聯絡人（舊欄位）</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_phone">電話</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone || ''}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">備註</Label>
              <Textarea
                id="note"
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => !open && handleCloseImport()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              匯入外包夥伴
            </DialogTitle>
            <DialogDescription>
              預覽匯入資料，確認後執行匯入
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success" />
                新增: {previewStats.insert}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-warning" />
                更新: {previewStats.update}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-destructive" />
                錯誤: {previewStats.error}
              </div>
            </div>

            {/* Import Mode */}
            <div className="flex items-center gap-4">
              <Label>匯入模式:</Label>
              <Select value={importMode} onValueChange={(v) => setImportMode(v as 'insert' | 'upsert')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsert">Insert / Upsert（更新重複）</SelectItem>
                  <SelectItem value="insert">僅新增（略過重複）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview Table */}
            <div className="max-h-[40vh] overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">列</TableHead>
                    <TableHead className="w-20">狀態</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>統編</TableHead>
                    <TableHead>錯誤</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreview.map((item) => (
                    <TableRow key={item.rowIndex} className={item.status === 'error' ? 'bg-destructive/10' : ''}>
                      <TableCell>{item.rowIndex}</TableCell>
                      <TableCell>
                        <Badge variant={
                          item.status === 'insert' ? 'default' :
                          item.status === 'update' ? 'secondary' :
                          'destructive'
                        }>
                          {item.status === 'insert' ? '新增' :
                           item.status === 'update' ? '更新' :
                           '錯誤'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.data.name}</TableCell>
                      <TableCell>{item.data.partner_type || '-'}</TableCell>
                      <TableCell>{item.data.tax_id || '-'}</TableCell>
                      <TableCell className="text-destructive text-sm">
                        {item.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseImport}>
              取消
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || previewStats.insert + previewStats.update === 0}
            >
              {isImporting ? '匯入中...' : '確認匯入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        tableName="partners"
        itemName={deletingPartner?.name}
        isPending={isDeleting}
      />
    </div>
  );
}
