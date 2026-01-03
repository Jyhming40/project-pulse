import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Loader2,
  Search,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useDriveSettings, DEFAULT_SUBFOLDERS, type SubfolderConfig } from '@/hooks/useDriveSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
}

export function DriveSettingsPanel() {
  const { settings, isLoading, updateSettings } = useDriveSettings();
  
  const [namingPattern, setNamingPattern] = useState(settings.namingPattern);
  const [subfolders, setSubfolders] = useState<SubfolderConfig[]>(
    settings.subfolders || DEFAULT_SUBFOLDERS
  );
  const [newFolder, setNewFolder] = useState({ code: '', folder: '' });
  
  // Root folder state
  const [rootFolderId, setRootFolderId] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchResults, setSearchResults] = useState<DriveFolder[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Sync local state when settings load
  useEffect(() => {
    if (!isLoading) {
      setNamingPattern(settings.namingPattern);
      setSubfolders(settings.subfolders || DEFAULT_SUBFOLDERS);
    }
  }, [isLoading, settings]);

  // Load current root folder ID from settings
  useEffect(() => {
    const loadRootFolderId = async () => {
      const { data } = await supabase
        .from('system_options')
        .select('label')
        .eq('category', 'drive_settings')
        .eq('value', 'root_folder_id')
        .eq('is_active', true)
        .single();
      
      if (data?.label) {
        setRootFolderId(data.label);
      }
    };
    loadRootFolderId();
  }, []);

  const handleSearchRootFolder = async () => {
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('請先登入');
        return;
      }

      const response = await supabase.functions.invoke('drive-find-root-folder', {
        body: { action: 'search', folderName: 'MQ-Documents' },
      });

      if (response.error) throw new Error(response.error.message);
      
      const folders = response.data?.folders || [];
      setSearchResults(folders);
      
      if (folders.length === 0) {
        toast.info('未找到 MQ-Documents 資料夾，請建立新資料夾或輸入資料夾 ID');
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('搜尋失敗');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateRootFolder = async () => {
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('請先登入');
        return;
      }

      const response = await supabase.functions.invoke('drive-find-root-folder', {
        body: { action: 'create', folderName: 'MQ-Documents' },
      });

      if (response.error) throw new Error(response.error.message);
      
      const folder = response.data?.folder;
      if (folder) {
        setRootFolderId(folder.id);
        await saveRootFolderId(folder.id);
        toast.success('已建立 MQ-Documents 資料夾');
        setShowSearchResults(false);
      }
    } catch (err) {
      console.error('Create error:', err);
      toast.error('建立失敗');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectFolder = async (folder: DriveFolder) => {
    setRootFolderId(folder.id);
    await saveRootFolderId(folder.id);
    setShowSearchResults(false);
    toast.success(`已選擇 ${folder.name} 作為根資料夾`);
  };

  const saveRootFolderId = async (folderId: string) => {
    // Delete existing
    await supabase
      .from('system_options')
      .delete()
      .eq('category', 'drive_settings')
      .eq('value', 'root_folder_id');

    // Insert new
    const { error } = await supabase
      .from('system_options')
      .insert({
        category: 'drive_settings',
        value: 'root_folder_id',
        label: folderId,
        is_active: true,
        sort_order: -1,
      });

    if (error) throw error;
  };

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
          設定案場 Google Drive 資料夾的根目錄、命名規則與子資料夾結構
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Root Folder Setting */}
        <div className="space-y-3">
          <Label>根資料夾 (MQ-Documents)</Label>
          <div className="flex items-center gap-2">
            <Input
              value={rootFolderId}
              onChange={(e) => setRootFolderId(e.target.value)}
              placeholder="Google Drive 資料夾 ID"
              className="flex-1"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSearchRootFolder}
              disabled={isSearching}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateRootFolder}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )}
            </Button>
            {rootFolderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => saveRootFolderId(rootFolderId)}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {/* Root folder status */}
          {rootFolderId ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>根資料夾已設定</span>
              <a 
                href={`https://drive.google.com/drive/folders/${rootFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                開啟 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span>請設定根資料夾 ID（點擊搜尋按鈕尋找或點擊建立按鈕建立新資料夾）</span>
            </div>
          )}

          {/* Search results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">選擇一個資料夾作為根目錄：</p>
              {searchResults.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleSelectFolder(folder)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-muted flex items-center justify-between text-sm"
                >
                  <span>{folder.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{folder.id.substring(0, 12)}...</span>
                </button>
              ))}
            </div>
          )}
          
          {showSearchResults && searchResults.length === 0 && !isSearching && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                未找到 MQ-Documents 資料夾。請點擊 <FolderPlus className="w-4 h-4 inline" /> 按鈕建立新資料夾。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Naming Pattern */}
        <div className="space-y-3">
          <Label htmlFor="naming-pattern">案場資料夾命名格式</Label>
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
            資料夾結構：MQ-Documents → 投資方名稱 → 案場資料夾 → 子資料夾模板
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
