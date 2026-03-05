import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Users, FileText, Building2, HardHat, RefreshCw, Receipt, Wrench, StickyNote, ShieldCheck, BarChart3, Settings } from 'lucide-react';
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

  const categoryTables: Record<string, string[]> = {
    '業務資料': [
      'projects', 'documents', 'document_files', 'document_tags', 'document_tag_assignments',
      'investors', 'investor_contacts', 'investor_payment_methods',
      'partners', 'partner_contacts', 'project_construction_assignments',
    ],
    '報價系統': [
      'project_quotes', 'quote_modules', 'quote_inverters', 'quote_engineering_items',
      'quote_line_items', 'quote_financial_projections', 'quote_schedules',
      'quote_engineering_presets', 'quote_engineering_templates',
    ],
    '付款與里程碑': [
      'project_payments', 'payment_milestones', 'project_milestones',
      'progress_milestones', 'progress_settings',
      'milestone_notification_settings', 'milestone_notification_logs',
    ],
    '維運 (O&M)': [
      'om_ac_tests', 'om_dc_tests', 'om_cleaning_reports', 'om_incident_reports',
      'om_inspections', 'om_personnel_rosters', 'om_site_access_requests', 'om_toolbox_meetings',
    ],
    '備忘錄': ['memos', 'memo_tags'],
    '治理與流程': [
      'departments', 'process_stages', 'stage_responsibilities',
      'project_stages', 'project_issues', 'action_item_resolutions',
      'project_epc_financial_metrics',
    ],
    '專案擴充': [
      'project_custom_fields', 'project_custom_field_values', 'project_field_config',
      'duplicate_ignore_pairs', 'duplicate_reviews',
    ],
    '歷程記錄': [
      'project_status_history', 'construction_status_history', 'audit_logs', 'user_events',
    ],
    '系統設定': [
      'system_options', 'system_tariff_rates', 'deletion_policies', 'app_settings',
      'ai_settings', 'company_bank_accounts',
      'document_type_config', 'document_linkage_rules', 'document_expiry_rules',
    ],
    '使用者': [
      'profiles', 'user_roles', 'user_security', 'user_preferences',
      'user_drive_tokens', 'user_milestone_order', 'module_permissions',
    ],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate total table count
  const totalTables = Object.values(categoryTables).reduce((sum, tables) => sum + tables.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">系統狀態總覽</h3>
          <p className="text-sm text-muted-foreground">
            資料庫各表格記錄統計（共 {totalTables} 張表）
          </p>
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
