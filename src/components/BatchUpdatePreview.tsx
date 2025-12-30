import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BatchUpdateField } from './BatchUpdateDialog';

interface BatchUpdatePreviewProps<T = unknown> {
  selectedItems: T[];
  values: Record<string, string>;
  fields: BatchUpdateField[];
  getDisplayValue?: (key: string, value: unknown) => string;
  getItemLabel?: (item: T) => string;
}

export function BatchUpdatePreview<T = unknown>({
  selectedItems,
  values,
  fields,
  getDisplayValue,
  getItemLabel,
}: BatchUpdatePreviewProps<T>) {
  const changedFields = useMemo(() => {
    return fields.filter((field) => values[field.key] && values[field.key] !== '__none__');
  }, [fields, values]);

  const getFieldLabel = (key: string) => {
    return fields.find((f) => f.key === key)?.label || key;
  };

  const getOptionLabel = (key: string, value: string) => {
    const field = fields.find((f) => f.key === key);
    return field?.options.find((o) => o.value === value)?.label || value;
  };

  const formatValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">未設定</span>;
    }
    if (getDisplayValue) {
      return getDisplayValue(key, value);
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return String(value);
  };

  const getLabel = (item: T) => {
    if (getItemLabel) {
      return getItemLabel(item);
    }
    const anyItem = item as Record<string, unknown>;
    return String(anyItem.name || anyItem.project_name || anyItem.company_name || anyItem.id || '');
  };

  if (changedFields.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        請選擇要變更的欄位
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 pb-2 border-b">
        <span className="text-sm text-muted-foreground">變更欄位：</span>
        {changedFields.map((field) => (
          <Badge key={field.key} variant="secondary">
            {field.label}: {getOptionLabel(field.key, values[field.key])}
          </Badge>
        ))}
      </div>

      <ScrollArea className="h-[200px] pr-4">
        <div className="space-y-2">
          {selectedItems.map((item, index) => {
            const itemId = (item as Record<string, unknown>).id;
            return (
              <div
                key={itemId ? String(itemId) : index}
                className="p-3 rounded-lg border bg-muted/30"
              >
              <div className="font-medium text-sm mb-2 truncate">
                {getLabel(item)}
              </div>
              <div className="space-y-1">
                {changedFields.map((field) => {
                  const anyItem = item as Record<string, unknown>;
                  const oldValue = anyItem[field.key];
                  const newValue = values[field.key];
                  const oldDisplay = formatValue(field.key, oldValue);
                  const newDisplay = getOptionLabel(field.key, newValue);

                  return (
                    <div key={field.key} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-20 shrink-0">
                        {getFieldLabel(field.key)}:
                      </span>
                      <span className="text-destructive line-through">
                        {oldDisplay}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-primary font-medium">
                        {newDisplay}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
