import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, FolderOpen, FilePlus2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OmSaveLoadBarProps {
  recordId: string | null;
  isSaving: boolean;
  isLoading: boolean;
  savedRecords: { id: string; label: string; date: string }[];
  onSave: () => void;
  onLoad: (id: string) => void;
  onNew: () => void;
}

export function OmSaveLoadBar({ recordId, isSaving, isLoading, savedRecords, onSave, onLoad, onNew }: OmSaveLoadBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={onSave} disabled={isSaving || isLoading} size="sm" variant="default">
        {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        {recordId ? '更新' : '儲存'}
      </Button>
      <Button onClick={onNew} variant="outline" size="sm" disabled={!recordId}>
        <FilePlus2 className="w-4 h-4 mr-1" />新建
      </Button>
      {savedRecords.length > 0 && (
        <Select onValueChange={onLoad} disabled={isLoading}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <FolderOpen className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="載入歷史紀錄..." />
          </SelectTrigger>
          <SelectContent>
            {savedRecords.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {r.label} — {r.date}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {recordId && (
        <Badge variant="outline" className="text-[10px]">
          編輯中
        </Badge>
      )}
    </div>
  );
}
