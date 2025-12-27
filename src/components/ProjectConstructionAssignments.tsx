import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConstructionAssignments, type ConstructionAssignment, type CreateAssignmentInput } from '@/hooks/useConstructionAssignments';
import { usePartners, type Partner } from '@/hooks/usePartners';
import { CodebookSelect, CodebookValue } from '@/components/CodebookSelect';
import { AssignmentTimeline } from '@/components/AssignmentTimeline';
import { format } from 'date-fns';
import {
  Plus,
  Edit,
  Trash2,
  HardHat,
  Calendar,
  Star,
  Sparkles,
  LayoutList,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    '預計': 'bg-muted text-muted-foreground',
    '已確認': 'bg-info/15 text-info',
    '已進場': 'bg-primary/15 text-primary',
    '已完成': 'bg-success/15 text-success',
    '暫緩': 'bg-warning/15 text-warning',
    '取消': 'bg-destructive/15 text-destructive',
  };
  return colorMap[status] || 'bg-muted text-muted-foreground';
};

// Partner selector with smart recommendations
interface PartnerSelectorProps {
  selectedWorkType: string;
  partners: Partner[];
  value: string;
  onValueChange: (value: string) => void;
}

function PartnerSelector({ selectedWorkType, partners, value, onValueChange }: PartnerSelectorProps) {
  // Separate partners into recommended (matching work type) and others
  const { recommended, others } = useMemo(() => {
    if (!selectedWorkType) {
      return { recommended: [], others: partners };
    }
    
    const rec: Partner[] = [];
    const oth: Partner[] = [];
    
    partners.forEach((p) => {
      if (p.work_capabilities && p.work_capabilities.includes(selectedWorkType)) {
        rec.push(p);
      } else {
        oth.push(p);
      }
    });
    
    return { recommended: rec, others: oth };
  }, [selectedWorkType, partners]);

  const hasRecommendations = recommended.length > 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label>外包夥伴</Label>
        {hasRecommendations && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="w-3 h-3" />
            {recommended.length} 個推薦
          </Badge>
        )}
      </div>
      <Select
        value={value || '__none__'}
        onValueChange={(v) => onValueChange(v === '__none__' ? '' : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="選擇夥伴" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">不指派</SelectItem>
          {hasRecommendations && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1 text-success">
                <Star className="w-3 h-3" />
                推薦夥伴（具備相關工程能力）
              </SelectLabel>
              {recommended.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <Star className="w-3 h-3 text-success" />
                    {p.name}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {others.length > 0 && (
            <SelectGroup>
              {hasRecommendations && (
                <SelectLabel className="text-muted-foreground">其他夥伴</SelectLabel>
              )}
              {others.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {hasRecommendations && !value && (
        <p className="text-xs text-muted-foreground">
          已根據「{selectedWorkType}」自動篩選具備相關工程能力的夥伴
        </p>
      )}
    </div>
  );
}

interface Props {
  projectId: string;
  readOnly?: boolean;
}

export default function ProjectConstructionAssignments({ projectId, readOnly = false }: Props) {
  const { canEdit, isAdmin } = useAuth();
  const {
    assignments,
    isLoading,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    isCreating,
    isUpdating,
  } = useConstructionAssignments(projectId);
  const { activePartners } = usePartners();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingAssignment, setEditingAssignment] = useState<ConstructionAssignment | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<ConstructionAssignment | null>(null);
  const [formData, setFormData] = useState<CreateAssignmentInput>({
    project_id: projectId,
    construction_work_type: '',
    partner_id: '',
    assignment_status: '預計',
    planned_start_date: '',
    planned_end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    note: '',
  });

  const handleOpenForm = (assignment?: ConstructionAssignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setFormData({
        project_id: projectId,
        construction_work_type: assignment.construction_work_type,
        partner_id: assignment.partner_id || '',
        assignment_status: assignment.assignment_status,
        planned_start_date: assignment.planned_start_date || '',
        planned_end_date: assignment.planned_end_date || '',
        actual_start_date: assignment.actual_start_date || '',
        actual_end_date: assignment.actual_end_date || '',
        note: assignment.note || '',
      });
    } else {
      setEditingAssignment(null);
      setFormData({
        project_id: projectId,
        construction_work_type: '',
        partner_id: '',
        assignment_status: '預計',
        planned_start_date: '',
        planned_end_date: '',
        actual_start_date: '',
        actual_end_date: '',
        note: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.construction_work_type) {
      toast.error('請選擇工程項目');
      return;
    }

    try {
      const submitData = {
        ...formData,
        partner_id: formData.partner_id || null,
        planned_start_date: formData.planned_start_date || null,
        planned_end_date: formData.planned_end_date || null,
        actual_start_date: formData.actual_start_date || null,
        actual_end_date: formData.actual_end_date || null,
      };

      if (editingAssignment) {
        await updateAssignment({ id: editingAssignment.id, ...submitData });
      } else {
        await createAssignment(submitData as any);
      }
      setIsFormOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!deletingAssignment) return;
    try {
      await deleteAssignment(deletingAssignment.id);
      setIsDeleteOpen(false);
      setDeletingAssignment(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const canModify = canEdit && !readOnly;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary" />
              施工工班 / 外包夥伴
            </CardTitle>
            <CardDescription>
              案場工程項目與外包夥伴指派
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('table')}
              >
                <LayoutList className="w-4 h-4 mr-1" />
                表格
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('timeline')}
              >
                <CalendarDays className="w-4 h-4 mr-1" />
                時間軸
              </Button>
            </div>
            {canModify && (
              <Button onClick={() => handleOpenForm()} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新增指派
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">載入中...</div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            尚未安排工班
          </div>
        ) : viewMode === 'timeline' ? (
          <AssignmentTimeline
            assignments={assignments}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onAssignmentClick={canModify ? handleOpenForm : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工程項目</TableHead>
                <TableHead>外包夥伴</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>預計日期</TableHead>
                <TableHead>實際日期</TableHead>
                <TableHead>備註</TableHead>
                {canModify && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <CodebookValue 
                      category="construction_work_type" 
                      value={assignment.construction_work_type} 
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {assignment.partners?.name || (
                      <span className="text-muted-foreground">未指派</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(assignment.assignment_status)} variant="secondary">
                      {assignment.assignment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {assignment.planned_start_date || assignment.planned_end_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {assignment.planned_start_date || '?'} ~ {assignment.planned_end_date || '?'}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {assignment.actual_start_date || assignment.actual_end_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-success" />
                        {assignment.actual_start_date || '?'} ~ {assignment.actual_end_date || '?'}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={assignment.note || ''}>
                    {assignment.note || '-'}
                  </TableCell>
                  {canModify && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenForm(assignment)}
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingAssignment(assignment);
                              setIsDeleteOpen(true);
                            }}
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? '編輯工班指派' : '新增工班指派'}</DialogTitle>
            <DialogDescription>
              指派外包夥伴負責特定工程項目
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>工程項目 *</Label>
              <CodebookSelect
                category="construction_work_type"
                value={formData.construction_work_type}
                onValueChange={(v) => setFormData({ ...formData, construction_work_type: v, partner_id: '' })}
                placeholder="選擇工程項目"
              />
            </div>
            <PartnerSelector
              selectedWorkType={formData.construction_work_type}
              partners={activePartners}
              value={formData.partner_id || ''}
              onValueChange={(v) => setFormData({ ...formData, partner_id: v })}
            />
            <div className="grid gap-2">
              <Label>狀態</Label>
              <CodebookSelect
                category="construction_assignment_status"
                value={formData.assignment_status || '預計'}
                onValueChange={(v) => setFormData({ ...formData, assignment_status: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>預計開始日期</Label>
                <Input
                  type="date"
                  value={formData.planned_start_date || ''}
                  onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>預計結束日期</Label>
                <Input
                  type="date"
                  value={formData.planned_end_date || ''}
                  onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>實際開始日期</Label>
                <Input
                  type="date"
                  value={formData.actual_start_date || ''}
                  onChange={(e) => setFormData({ ...formData, actual_start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>實際結束日期</Label>
                <Input
                  type="date"
                  value={formData.actual_end_date || ''}
                  onChange={(e) => setFormData({ ...formData, actual_end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>備註</Label>
              <Textarea
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

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此工班指派嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
