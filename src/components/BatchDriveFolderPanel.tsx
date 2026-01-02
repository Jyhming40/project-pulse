import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FolderPlus, CheckCircle, XCircle, SkipForward, Loader2 } from 'lucide-react';
import { useBatchDriveFolders } from '@/hooks/useBatchDriveFolders';
import { useDriveSettings, DEFAULT_SUBFOLDERS } from '@/hooks/useDriveSettings';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BatchDriveFolderPanelProps {
  selectedProjectIds: string[];
  onComplete?: () => void;
}

export function BatchDriveFolderPanel({ selectedProjectIds, onComplete }: BatchDriveFolderPanelProps) {
  const { isRunning, progress, createFoldersForProjects, resetProgress } = useBatchDriveFolders();
  const { settings } = useDriveSettings();
  const [showPreview, setShowPreview] = useState(true);

  const handleStart = async () => {
    setShowPreview(false);
    await createFoldersForProjects(selectedProjectIds);
    onComplete?.();
  };

  const handleReset = () => {
    resetProgress();
    setShowPreview(true);
  };

  const progressPercent = progress ? (progress.completed / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderPlus className="h-5 w-5" />
          批次建立 Google Drive 資料夾
        </CardTitle>
        <CardDescription>
          為選取的案場建立 Google Drive 資料夾與子資料夾結構
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Section */}
        {showPreview && !isRunning && !progress && (
          <>
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
              <ScrollArea className="h-48 border rounded-md p-2">
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
              onClick={handleStart} 
              disabled={selectedProjectIds.length === 0}
              className="w-full"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              開始建立 ({selectedProjectIds.length} 個案場)
            </Button>
          </>
        )}

        {/* Progress Section */}
        {(isRunning || progress) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>進度</span>
                <span>{progress?.completed || 0} / {progress?.total || 0}</span>
              </div>
              <Progress value={progressPercent} />
              {isRunning && progress?.current && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  處理中：{progress.current}
                </p>
              )}
            </div>

            {/* Results */}
            {progress?.results && progress.results.length > 0 && (
              <ScrollArea className="h-48 border rounded-md p-2">
                <ul className="space-y-2">
                  {progress.results.map((result, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {result.success ? (
                        result.skipped ? (
                          <SkipForward className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-mono text-xs">{result.projectCode}</span>
                      <span className="truncate flex-1">{result.projectName}</span>
                      {result.skipped && (
                        <Badge variant="secondary" className="text-xs">已存在</Badge>
                      )}
                      {result.error && (
                        <Badge variant="destructive" className="text-xs">失敗</Badge>
                      )}
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
