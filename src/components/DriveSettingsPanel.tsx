import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  FolderCog, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical,
  Info,
  Loader2
} from 'lucide-react';
import { useDriveSettings, DEFAULT_SUBFOLDERS, type SubfolderConfig } from '@/hooks/useDriveSettings';
import { toast } from 'sonner';

export function DriveSettingsPanel() {
  const { settings, isLoading, updateSettings } = useDriveSettings();
  
  const [namingPattern, setNamingPattern] = useState(settings.namingPattern);
  const [subfolders, setSubfolders] = useState<SubfolderConfig[]>(
    settings.subfolders || DEFAULT_SUBFOLDERS
  );
  const [newFolder, setNewFolder] = useState({ code: '', folder: '' });

  // Sync local state when settings load
  useState(() => {
    if (!isLoading) {
      setNamingPattern(settings.namingPattern);
      setSubfolders(settings.subfolders || DEFAULT_SUBFOLDERS);
    }
  });

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        namingPattern,
        subfolders,
      });
      toast.success('Drive 設定已儲存');
    } catch (err) {
      toast.error('儲存失敗');
    }
  };

  const handleAddSubfolder = () => {
    if (!newFolder.code.trim() || !newFolder.folder.trim()) {
      toast.error('請填寫代碼與資料夾名稱');
      return;
    }
    if (subfolders.some(sf => sf.code === newFolder.code)) {
      toast.error('代碼已存在');
      return;
    }
    setSubfolders([...subfolders, { code: newFolder.code.toUpperCase(), folder: newFolder.folder }]);
    setNewFolder({ code: '', folder: '' });
  };

  const handleRemoveSubfolder = (code: string) => {
    setSubfolders(subfolders.filter(sf => sf.code !== code));
  };

  const handleUpdateSubfolder = (index: number, field: 'code' | 'folder', value: string) => {
    const updated = [...subfolders];
    updated[index] = { ...updated[index], [field]: field === 'code' ? value.toUpperCase() : value };
    setSubfolders(updated);
  };

  const handleReset = () => {
    setSubfolders(DEFAULT_SUBFOLDERS);
    setNamingPattern('{project_code}_{project_name}');
    toast.info('已重設為預設值，請點擊儲存套用');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FolderCog className="w-5 h-5" />
          Drive 資料夾設定
        </CardTitle>
        <CardDescription>
          設定案場 Google Drive 資料夾的命名規則與子資料夾結構
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Naming Pattern */}
        <div className="space-y-3">
          <Label htmlFor="naming-pattern">資料夾命名格式</Label>
          <Input
            id="naming-pattern"
            value={namingPattern}
            onChange={(e) => setNamingPattern(e.target.value)}
            placeholder="{project_code}_{project_name}"
          />
          <p className="text-xs text-muted-foreground">
            可用變數：<code className="bg-muted px-1 rounded">{'{project_code}'}</code>、
            <code className="bg-muted px-1 rounded">{'{project_name}'}</code>、
            <code className="bg-muted px-1 rounded">{'{investor_name}'}</code>、
            <code className="bg-muted px-1 rounded">{'{city}'}</code>
          </p>
        </div>

        <Separator />

        {/* Subfolders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>子資料夾結構</Label>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              重設為預設
            </Button>
          </div>
          
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-3 space-y-2">
              {subfolders.map((sf, index) => (
                <div key={sf.code} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                  <Input
                    value={sf.code}
                    onChange={(e) => handleUpdateSubfolder(index, 'code', e.target.value)}
                    className="w-32 h-8 font-mono text-xs"
                    placeholder="代碼"
                  />
                  <Input
                    value={sf.folder}
                    onChange={(e) => handleUpdateSubfolder(index, 'folder', e.target.value)}
                    className="flex-1 h-8 text-sm"
                    placeholder="資料夾名稱"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveSubfolder(sf.code)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Add New */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed">
            <Input
              value={newFolder.code}
              onChange={(e) => setNewFolder({ ...newFolder, code: e.target.value })}
              className="w-32 h-8 font-mono text-xs"
              placeholder="代碼 (英文大寫)"
            />
            <Input
              value={newFolder.folder}
              onChange={(e) => setNewFolder({ ...newFolder, folder: e.target.value })}
              className="flex-1 h-8 text-sm"
              placeholder="資料夾名稱"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSubfolder}
              disabled={!newFolder.code.trim() || !newFolder.folder.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              新增
            </Button>
          </div>
        </div>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-xs">
            子資料夾結構設定後，新建立的案場資料夾會自動套用。已存在的資料夾不會受影響。
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            儲存設定
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
