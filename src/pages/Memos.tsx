import { useState, useMemo } from 'react';
import { Plus, Search, Pin, Filter, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemos, useMemoTags, MemoFormData, Memo } from '@/hooks/useMemos';
import MemoCard from '@/components/memos/MemoCard';
import MemoEditorDialog from '@/components/memos/MemoEditorDialog';
import MemoViewDialog from '@/components/memos/MemoViewDialog';

export default function Memos() {
  const { memos, isLoading, createMemo, updateMemo, togglePin, deleteMemo } = useMemos();
  const { tags } = useMemoTags();

  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [filterScope, setFilterScope] = useState<'all' | 'personal' | 'shared'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [viewMemo, setViewMemo] = useState<Memo | null>(null);

  const filtered = useMemo(() => {
    return memos.filter(m => {
      if (search && !m.title.includes(search) && !m.content.includes(search)) return false;
      if (filterTag !== 'all' && m.tag_id !== filterTag) return false;
      if (filterScope === 'personal' && !m.is_personal) return false;
      if (filterScope === 'shared' && m.is_personal) return false;
      return true;
    });
  }, [memos, search, filterTag, filterScope]);

  const pinnedMemos = filtered.filter(m => m.is_pinned);
  const unpinnedMemos = filtered.filter(m => !m.is_pinned);

  const handleSave = (data: MemoFormData & { id?: string }) => {
    if (data.id) {
      updateMemo.mutate(data as MemoFormData & { id: string }, { onSuccess: () => setEditorOpen(false) });
    } else {
      createMemo.mutate(data, { onSuccess: () => setEditorOpen(false) });
    }
  };

  const handleEdit = (memo: Memo) => {
    setEditingMemo(memo);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditingMemo(null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <StickyNote className="w-6 h-6" />
            備忘錄
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">記錄重要事項，支援個人筆記與團隊共享</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          新增備忘錄
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋備忘錄..." className="pl-9" />
        </div>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="標籤" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部標籤</SelectItem>
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
        <Select value={filterScope} onValueChange={v => setFilterScope(v as any)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="personal">個人</SelectItem>
            <SelectItem value="shared">共享</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pinned Section */}
      {pinnedMemos.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
            <Pin className="w-3.5 h-3.5 fill-current" />
            釘選 ({pinnedMemos.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pinnedMemos.map(m => (
              <MemoCard key={m.id} memo={m} onEdit={handleEdit} onDelete={id => deleteMemo.mutate(id)} onTogglePin={(id, p) => togglePin.mutate({ id, is_pinned: p })} onView={setViewMemo} />
            ))}
          </div>
        </div>
      )}

      {/* All Memos */}
      <div>
        {pinnedMemos.length > 0 && unpinnedMemos.length > 0 && (
          <h2 className="text-sm font-medium text-muted-foreground mb-3">全部 ({unpinnedMemos.length})</h2>
        )}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">載入中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>尚無備忘錄</p>
            <Button variant="link" onClick={handleNew}>建立第一筆備忘錄</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {unpinnedMemos.map(m => (
              <MemoCard key={m.id} memo={m} onEdit={handleEdit} onDelete={id => deleteMemo.mutate(id)} onTogglePin={(id, p) => togglePin.mutate({ id, is_pinned: p })} onView={setViewMemo} />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <MemoEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        memo={editingMemo}
        onSave={handleSave}
        isSaving={createMemo.isPending || updateMemo.isPending}
      />
      <MemoViewDialog open={!!viewMemo} onOpenChange={() => setViewMemo(null)} memo={viewMemo} />
    </div>
  );
}
