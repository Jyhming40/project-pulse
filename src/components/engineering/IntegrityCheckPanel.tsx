import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { tableDisplayNames } from '@/hooks/useDeletionPolicy';

interface IntegrityIssue {
  table: string;
  issue: string;
  count: number;
  severity: 'info' | 'warning' | 'error';
}

export function IntegrityCheckPanel() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const { data: issues, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['integrity-check'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-operations', {
        body: { action: 'check-integrity' },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setLastChecked(new Date());
      return data.issues as IntegrityIssue[];
    },
    enabled: false, // Only run on demand
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive">錯誤</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500">警告</Badge>;
      default:
        return <Badge variant="secondary">資訊</Badge>;
    }
  };

  const errorCount = issues?.filter(i => i.severity === 'error').length || 0;
  const warningCount = issues?.filter(i => i.severity === 'warning').length || 0;
  const infoCount = issues?.filter(i => i.severity === 'info').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">資料完整性檢查</h3>
          <p className="text-sm text-muted-foreground">
            檢查資料庫中的孤立資料、重複項目及其他潛在問題
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4 mr-2" />
          )}
          執行檢查
        </Button>
      </div>

      {lastChecked && (
        <p className="text-xs text-muted-foreground">
          上次檢查時間: {lastChecked.toLocaleString('zh-TW')}
        </p>
      )}

      {isLoading || isFetching ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">正在檢查資料完整性...</span>
        </div>
      ) : issues ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className={errorCount > 0 ? 'border-destructive' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">錯誤</span>
                  <XCircle className={`w-4 h-4 ${errorCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <p className={`text-2xl font-bold ${errorCount > 0 ? 'text-destructive' : ''}`}>
                  {errorCount}
                </p>
              </CardContent>
            </Card>
            <Card className={warningCount > 0 ? 'border-amber-500' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">警告</span>
                  <AlertTriangle className={`w-4 h-4 ${warningCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                </div>
                <p className={`text-2xl font-bold ${warningCount > 0 ? 'text-amber-500' : ''}`}>
                  {warningCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">資訊</span>
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-blue-500">{infoCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Issues List */}
          {issues.length === 0 ? (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertTitle>檢查通過</AlertTitle>
              <AlertDescription>未發現任何資料完整性問題</AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">檢查結果</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {issues.map((issue, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {tableDisplayNames[issue.table] || issue.table}
                          </span>
                          {getSeverityBadge(issue.severity)}
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.issue}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          影響筆數: {issue.count}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Alert>
          <ShieldCheck className="w-4 h-4" />
          <AlertTitle>尚未執行檢查</AlertTitle>
          <AlertDescription>點擊「執行檢查」按鈕開始資料完整性檢查</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
