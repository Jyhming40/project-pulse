import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { BatchUpdatePreview } from './BatchUpdatePreview';

export interface BatchUpdateField {
  key: string;
  label: string;
  type: 'select';
  options: { value: string; label: string }[];
  placeholder?: string;
}

interface BatchUpdateDialogProps<T = unknown> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  selectedCount: number;
  selectedItems?: T[];
  fields: BatchUpdateField[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
  isLoading?: boolean;
  getDisplayValue?: (key: string, value: unknown) => string;
  getItemLabel?: (item: T) => string;
}

export function BatchUpdateDialog<T = unknown>({
  open,
  onOpenChange,
  title,
  description,
  selectedCount,
  selectedItems = [],
  fields,
  onSubmit,
  isLoading = false,
  getDisplayValue,
  getItemLabel,
}: BatchUpdateDialogProps<T>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = async () => {
    // Filter out empty values
    const filteredValues = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v && v !== '__none__')
    );
    
    if (Object.keys(filteredValues).length === 0) {
      return;
    }
    
    await onSubmit(filteredValues);
    setValues({});
    onOpenChange(false);
  };

  const handleClose = () => {
    setValues({});
    setShowPreview(false);
    onOpenChange(false);
  };

  const hasChanges = Object.values(values).some((v) => v && v !== '__none__');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || `將批次更新 ${selectedCount} 筆資料`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {fields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label>{field.label}</Label>
              <Select
                value={values[field.key] || '__none__'}
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, [field.key]: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder || '不變更'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不變更</SelectItem>
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {selectedItems.length > 0 && hasChanges && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  隱藏預覽
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  顯示變更預覽
                </>
              )}
            </Button>
            {showPreview && (
              <BatchUpdatePreview
                selectedItems={selectedItems}
                values={values}
                fields={fields}
                getDisplayValue={getDisplayValue}
                getItemLabel={getItemLabel}
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !hasChanges}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            確認更新 ({selectedCount} 筆)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
