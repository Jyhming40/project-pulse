import { useState } from 'react';
import { useDocumentTags, useDocumentTagAssignments } from '@/hooks/useDocumentTags';
import { DocumentTagBadge, TagColorDot } from './DocumentTagBadge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Tag, Loader2, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DocumentTagSelectorProps {
  documentId: string;
  canEdit?: boolean;
}

const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'];

export function DocumentTagSelector({ documentId, canEdit = true }: DocumentTagSelectorProps) {
  const { tags, createTag, isCreating } = useDocumentTags();
  const { assignments, assignTag, removeTag, isAssigning, isRemoving } = useDocumentTagAssignments(documentId);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');

  const assignedTagIds = new Set(assignments.map(a => a.tag_id));

  const handleAssignTag = async (tagId: string) => {
    if (assignedTagIds.has(tagId)) {
      await removeTag({ documentId, tagId });
    } else {
      await assignTag({ documentId, tagId });
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await createTag({ name: newTagName.trim(), color: newTagColor });
      if (newTag) {
        await assignTag({ documentId, tagId: newTag.id });
      }
      setNewTagName('');
      setIsCreatingNew(false);
    } catch {
      // Error handled in hook
    }
  };

  const isLoading = isAssigning || isRemoving;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {assignments.map(a => (
        <DocumentTagBadge
          key={a.id}
          name={a.tag?.name || ''}
          color={a.tag?.color || 'gray'}
          size="sm"
          onRemove={canEdit ? () => removeTag({ documentId, tagId: a.tag_id }) : undefined}
        />
      ))}
      
      {canEdit && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 rounded-full">
              <Plus className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  標籤
                </span>
                {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>
              
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {tags.map(tag => {
                    const isAssigned = assignedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleAssignTag(tag.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          isAssigned && 'bg-muted'
                        )}
                        disabled={isLoading}
                      >
                        <TagColorDot color={tag.color} />
                        <span className="flex-1 text-left">{tag.name}</span>
                        {isAssigned && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {isCreatingNew ? (
                <div className="space-y-2 pt-2 border-t">
                  <Input
                    placeholder="標籤名稱"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">顏色</Label>
                    <Select value={newTagColor} onValueChange={setNewTagColor}>
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TAG_COLORS.map(c => (
                          <SelectItem key={c} value={c}>
                            <div className="flex items-center gap-2">
                              <TagColorDot color={c} />
                              {c}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1 h-7"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || isCreating}
                    >
                      {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : '建立'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => setIsCreatingNew(false)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground h-8"
                  onClick={() => setIsCreatingNew(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  建立新標籤
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
