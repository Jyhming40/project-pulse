import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Trash2, Settings2, Clock } from 'lucide-react';
import { tableDisplayNames, softDeleteTables } from '@/hooks/useDeletionPolicy';

export function DeletionPolicyPanel() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">刪除政策與回收區</h3>
          <p className="text-sm text-muted-foreground">
            管理各資料類型的刪除行為與保留期限
          </p>
        </div>
        <Button onClick={() => navigate('/deletion-policies')}>
          <Settings2 className="w-4 h-4 mr-2" />
          管理刪除政策
        </Button>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate('/recycle-bin')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="w-4 h-4" />
              回收區
            </CardTitle>
            <CardDescription>
              檢視並管理已刪除的項目，可還原或永久刪除
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              前往回收區
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate('/deletion-policies')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="w-4 h-4" />
              刪除政策設定
            </CardTitle>
            <CardDescription>
              設定各資料類型的刪除模式與保留期限
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              管理政策
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Supported Tables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">支援軟刪除的資料類型</CardTitle>
          <CardDescription>
            以下資料類型支援軟刪除（刪除後可從回收區還原）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {softDeleteTables.map((table) => (
              <div
                key={table}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm">{tableDisplayNames[table] || table}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Alert>
        <Clock className="w-4 h-4" />
        <AlertTitle>自動清除</AlertTitle>
        <AlertDescription>
          已刪除的項目將根據各資料類型的保留期限設定自動清除。預設保留期限為 30 天。
          您可以在刪除政策設定中調整每種資料類型的保留期限。
        </AlertDescription>
      </Alert>
    </div>
  );
}
