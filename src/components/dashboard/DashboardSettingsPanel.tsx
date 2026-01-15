import { useState } from 'react';
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw, Save, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDashboardSettings,
  DashboardSection,
  DashboardFilters,
  DEFAULT_SETTINGS,
} from '@/hooks/useDashboardSettings';
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

interface SortableSectionItemProps {
  section: DashboardSection;
  onToggle: (id: string) => void;
}

function SortableSectionItem({ section, onToggle }: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border bg-card ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1">
        <span className={section.visible ? 'text-foreground' : 'text-muted-foreground'}>
          {section.label}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggle(section.id)}
        className="h-8 w-8 p-0"
      >
        {section.visible ? (
          <Eye className="w-4 h-4 text-primary" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

interface DashboardSettingsPanelProps {
  investors: Array<{ id: string; investor_code: string; company_name: string }>;
  statuses: string[];
  constructionStatuses: string[];
}

export function DashboardSettingsPanel({
  investors,
  statuses,
  constructionStatuses,
}: DashboardSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const {
    settings,
    isLoading,
    isSaving,
    saveAllSettings,
    resetToDefaults,
  } = useDashboardSettings();

  const [localSections, setLocalSections] = useState<DashboardSection[]>(settings.sections);
  const [localFilters, setLocalFilters] = useState<DashboardFilters>(settings.defaultFilters);
  const [hasChanges, setHasChanges] = useState(false);

  // 當 sheet 開啟時同步設定
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalSections(settings.sections);
      setLocalFilters(settings.defaultFilters);
      setHasChanges(false);
    }
    setOpen(isOpen);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
          ...item,
          order: idx,
        }));
        setHasChanges(true);
        return newItems;
      });
    }
  };

  const handleToggleVisibility = (sectionId: string) => {
    setLocalSections((items) =>
      items.map((item) =>
        item.id === sectionId ? { ...item, visible: !item.visible } : item
      )
    );
    setHasChanges(true);
  };

  const handleFilterChange = (key: keyof DashboardFilters, value: string) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveAllSettings(localSections, localFilters);
    setHasChanges(false);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalSections(DEFAULT_SETTINGS.sections);
    setLocalFilters(DEFAULT_SETTINGS.defaultFilters);
    setHasChanges(true);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">自訂儀表板</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>儀表板設定</SheetTitle>
          <SheetDescription>
            自訂儀表板區塊顯示與排序，設定會同步到雲端
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* 區塊排序與顯示 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">區塊顯示與排序</Label>
            <p className="text-xs text-muted-foreground">
              拖曳調整順序，點擊眼睛圖示切換顯示/隱藏
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localSections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {localSections.map((section) => (
                    <SortableSectionItem
                      key={section.id}
                      section={section}
                      onToggle={handleToggleVisibility}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <Separator />

          {/* 預設篩選條件 */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">預設篩選條件</Label>
            <p className="text-xs text-muted-foreground">
              設定進入儀表板時的預設篩選器
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">投資方</Label>
                <Select
                  value={localFilters.investor}
                  onValueChange={(v) => handleFilterChange('investor', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部投資方</SelectItem>
                    {investors.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        [{inv.investor_code}] {inv.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">案場狀態</Label>
                <Select
                  value={localFilters.status}
                  onValueChange={(v) => handleFilterChange('status', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">施工狀態</Label>
                <Select
                  value={localFilters.constructionStatus}
                  onValueChange={(v) => handleFilterChange('constructionStatus', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    {constructionStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重設
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              儲存
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
