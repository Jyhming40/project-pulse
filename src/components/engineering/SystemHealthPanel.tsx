import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Users, FileText, Building2, HardHat, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tableDisplayNames } from '@/hooks/useDeletionPolicy';

interface TableStats {
  count: number;
  deletedCount?: number;
}

export function SystemHealthPanel() {
  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['system-health-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-operations', {
        body: { action: 'get-table-stats' },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.stats as Record<string, TableStats>;
    },
    staleTime: 60000,
  });

  const tableIcons: Record<string, typeof Database> = {
    projects: Building2,
    documents: FileText,
    investors: Users,
    partners: HardHat,
  };

  const categoryTables = {
    '業務資料': ['projects', 'documents', 'document_files', 'investors', 'investor_contacts', 'investor_payment_methods', 'partners', 'partner_contacts', 'project_construction_assignments'],
    '歷程記錄': ['project_status_history', 'construction_status_history', 'audit_logs'],
    '系統設定': ['system_options', 'deletion_policies'],
    '使用者': ['profiles', 'user_roles'],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">系統狀態總覽</h3>
          <p className="text-sm text-muted-foreground">資料庫各表格記錄統計</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          重新整理
        </Button>
      </div>

      {Object.entries(categoryTables).map(([category, tables]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tables.map((table) => {
                const tableStats = stats?.[table];
                const Icon = tableIcons[table] || Database;
                const displayName = tableDisplayNames[table] || table;

                return (
                  <div
                    key={table}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {tableStats?.count ?? '-'}
                        </Badge>
                        {tableStats?.deletedCount !== undefined && tableStats.deletedCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            已刪除: {tableStats.deletedCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
