import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderPlus, CheckCircle, XCircle, SkipForward, Loader2, FolderSearch, RotateCcw, FolderX } from 'lucide-react';
import { useBatchDriveFolders } from '@/hooks/useBatchDriveFolders';
import { useDriveSettings, DEFAULT_SUBFOLDERS } from '@/hooks/useDriveSettings';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BatchDriveFolderPanelProps {
  selectedProjectIds: string[];
  onComplete?: () => void;
}

type ActionType = 'create' | 'verify' | 'reset';

export function BatchDriveFolderPanel({ selectedProjectIds, onComplete }: BatchDriveFolderPanelProps) {
  const { 
    isRunning, 
    progress, 
    createFoldersForProjects, 
    verifyFoldersForProjects,
    resetFoldersForProjects,
    resetProgress 
  } = useBatchDriveFolders();
  const { settings } = useDriveSettings();
  const [showPreview, setShowPreview] = useState(true);
  const [activeAction, setActiveAction] = useState<ActionType>('create');

  const handleStart = async (action: ActionType) => {
    setShowPreview(false);
    setActiveAction(action);
    
    switch (action) {
      case 'create':
        await createFoldersForProjects(selectedProjectIds);
        break;
      case 'verify':
        await verifyFoldersForProjects(selectedProjectIds);
        break;
      case 'reset':
        await resetFoldersForProjects(selectedProjectIds);
        break;
    }
    onComplete?.();
  };

  const handleReset = () => {
    resetProgress();
    setShowPreview(true);
  };

  const progressPercent = progress ? (progress.completed / progress.total) * 100 : 0;

  const getResultIcon = (result: NonNullable<typeof progress>['results'][number]) => {
    if (!result.success) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (result.skipped) {
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    }
    if (result.wasReset) {
      return <RotateCcw className="h-4 w-4 text-orange-500" />;
    }
    if (result.folderExists === false) {
      return <FolderX className="h-4 w-4 text-orange-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getResultBadge = (result: NonNullable<typeof progress>['results'][number]) => {
    if (result.error) {
      return <Badge variant="destructive" className="text-xs">失敗</Badge>;
    }
    if (result.skipped) {
      return <Badge variant="secondary" className="text-xs">無連結</Badge>;
    }
    if (result.wasReset) {
      return <Badge variant="outline" className="text-xs text-orange-600">已重置</Badge>;
    }
    if (result.folderExists === true) {
      return <Badge variant="outline" className="text-xs text-green-600">存在</Badge>;
    }
    if (result.folderExists === false) {
      return <Badge variant="outline" className="text-xs text-orange-600">已清除</Badge>;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderPlus className="h-5 w-5" />
          批次 Google Drive 資料夾管理
        </CardTitle>
        <CardDescription>
          為選取的案場建立、驗證或重置 Google Drive 資料夾
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Section */}
        {showPreview && !isRunning && !progress && (
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">建立資料夾</TabsTrigger>
              <TabsTrigger value="verify">驗證資料夾</TabsTrigger>
              <TabsTrigger value="reset">重置連結</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4 mt-4">
              <Alert>
                <AlertDescription>
                  將為 <strong>{selectedProjectIds.length}</strong> 個案場建立資料夾
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm font-medium">命名格式：</p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {settings.namingPattern}
                </code>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">子資料夾結構：</p>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <ul className="space-y-1">
                    {(settings.subfolders || DEFAULT_SUBFOLDERS).map((sf, i) => (
                      <li key={i} className="text-sm flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {sf.code}
                        </Badge>
                        <span>{sf.folder}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>

              <Button 
                onClick={() => handleStart('create')} 
                disabled={selectedProjectIds.length === 0}
                className="w-full"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                開始建立 ({selectedProjectIds.length} 個案場)
              </Button>
            </TabsContent>

            <TabsContent value="verify" className="space-y-4 mt-4">
              <Alert>
                <AlertDescription>
                  將驗證 <strong>{selectedProjectIds.length}</strong> 個案場的 Drive 資料夾是否存在。
                  若資料夾已被刪除，系統會自動清除資料庫記錄。
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => handleStart('verify')} 
                disabled={selectedProjectIds.length === 0}
                className="w-full"
                variant="secondary"
              >
                <FolderSearch className="h-4 w-4 mr-2" />
                開始驗證 ({selectedProjectIds.length} 個案場)
              </Button>
            </TabsContent>

            <TabsContent value="reset" className="space-y-4 mt-4">
              <Alert variant="destructive">
                <AlertDescription>
                  將強制清除 <strong>{selectedProjectIds.length}</strong> 個案場的 Drive 資料夾連結記錄。
                  此操作不會刪除 Drive 上的實際資料夾，僅清除資料庫記錄。
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => handleStart('reset')} 
                disabled={selectedProjectIds.length === 0}
                className="w-full"
                variant="destructive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                開始重置 ({selectedProjectIds.length} 個案場)
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* Progress Section */}
        {(isRunning || progress) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {activeAction === 'create' && '建立資料夾'}
                {activeAction === 'verify' && '驗證資料夾'}
                {activeAction === 'reset' && '重置連結'}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>進度</span>
                <span>{progress?.completed || 0} / {progress?.total || 0}</span>
              </div>
              <Progress value={progressPercent} />
              {isRunning && progress?.current && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress.current}
                </p>
              )}
            </div>

            {/* Results */}
            {progress?.results && progress.results.length > 0 && (
              <ScrollArea className="h-48 border rounded-md p-2">
                <ul className="space-y-2">
                  {progress.results.map((result, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {getResultIcon(result)}
                      <span className="font-mono text-xs">{result.projectCode}</span>
                      <span className="truncate flex-1">{result.projectName}</span>
                      {getResultBadge(result)}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}

            {!isRunning && progress && (
              <Button onClick={handleReset} variant="outline" className="w-full">
                完成
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
