import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pin, Calendar, Tag, Building2 } from 'lucide-react';
import { Memo, MemoFormData, useMemoTags } from '@/hooks/useMemos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MemoEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo?: Memo | null;
  onSave: (data: MemoFormData & { id?: string }) => void;
  isSaving?: boolean;
}

export default function MemoEditorDialog({ open, onOpenChange, memo, onSave, isSaving }: MemoEditorDialogProps) {
  const { tags } = useMemoTags();
  const [form, setForm] = useState<MemoFormData>({
    title: '', content: '', project_id: null, is_personal: true, is_pinned: false, reminder_at: null, tag_id: null,
  });

  // Fetch projects for linking
  const { data: projects = [] } = useQuery({
    queryKey: ['memo-projects-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .eq('is_deleted', false)
        .order('project_code');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (memo) {
      setForm({
        title: memo.title,
        content: memo.content,
        project_id: memo.project_id,
        is_personal: memo.is_personal,
        is_pinned: memo.is_pinned,
        reminder_at: memo.reminder_at ? memo.reminder_at.slice(0, 16) : null,
        tag_id: memo.tag_id,
      });
    } else {
      setForm({ title: '', content: '', project_id: null, is_personal: true, is_pinned: false, reminder_at: null, tag_id: null });
    }
  }, [memo, open]);

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, id: memo?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{memo ? '編輯備忘錄' : '新增備忘錄'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>標題 *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="備忘錄標題" />
          </div>

          <div>
            <Label>內容 (支援 Markdown)</Label>
            <Textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="輸入備忘錄內容，支援 Markdown 格式..."
              className="min-h-[160px] font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><Tag className="w-3.5 h-3.5" />標籤</Label>
              <Select value={form.tag_id || 'none'} onValueChange={v => setForm(f => ({ ...f, tag_id: v === 'none' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="選擇標籤" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">無標籤</SelectItem>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><Building2 className="w-3.5 h-3.5" />關聯案場</Label>
              <Select value={form.project_id || 'none'} onValueChange={v => setForm(f => ({ ...f, project_id: v === 'none' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="選擇案場" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">無關聯</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_code} - {p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-1.5"><Calendar className="w-3.5 h-3.5" />提醒時間</Label>
            <Input
              type="datetime-local"
              value={form.reminder_at || ''}
              onChange={e => setForm(f => ({ ...f, reminder_at: e.target.value || null }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_pinned} onCheckedChange={v => setForm(f => ({ ...f, is_pinned: v }))} />
                <Label className="flex items-center gap-1"><Pin className="w-3.5 h-3.5" />釘選</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!form.is_personal} onCheckedChange={v => setForm(f => ({ ...f, is_personal: !v }))} />
                <Label>團隊共享</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || isSaving}>
            {isSaving ? '儲存中...' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
