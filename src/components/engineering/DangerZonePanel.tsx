import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  AlertCircle, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  Shield,
  Clock,
  Database,
  FileWarning
} from 'lucide-react';
import { toast } from 'sonner';
import { DatabaseExportPanel } from './DatabaseExportPanel';
import { tableDisplayNames } from '@/hooks/useDeletionPolicy';

// Reset scope configurations — synced with edge function
const RESET_SCOPES = {
  demo: {
    label: '示範資料',
    description: '清除專案、文件、報價、付款、O&M、備忘錄等業務資料',
    tables: [
      'quote_financial_projections', 'quote_engineering_items', 'quote_line_items',
      'quote_schedules', 'quote_modules', 'quote_inverters',
      'project_payments',
      'document_tag_assignments', 'document_files', 'documents',
      'project_construction_assignments', 'project_milestones', 'project_stages',
      'project_issues', 'project_custom_field_values', 'project_epc_financial_metrics',
      'action_item_resolutions', 'construction_status_history', 'project_status_history',
      'milestone_notification_logs',
      'memos',
      'om_ac_tests', 'om_dc_tests', 'om_cleaning_reports', 'om_incident_reports',
      'om_inspections', 'om_personnel_rosters', 'om_site_access_requests', 'om_toolbox_meetings',
      'project_quotes', 'projects',
    ],
  },
  business: {
    label: '業務資料',
    description: '清除所有業務資料（含專案、投資人、廠商、報價、O&M 等）',
    tables: [
      'quote_financial_projections', 'quote_engineering_items', 'quote_line_items',
      'quote_schedules', 'quote_modules', 'quote_inverters',
      'project_payments',
      'document_tag_assignments', 'document_files', 'documents',
      'project_construction_assignments', 'project_milestones', 'project_stages',
      'project_issues', 'project_custom_field_values', 'project_epc_financial_metrics',
      'action_item_resolutions', 'construction_status_history', 'project_status_history',
      'milestone_notification_logs',
      'memos',
      'om_ac_tests', 'om_dc_tests', 'om_cleaning_reports', 'om_incident_reports',
      'om_inspections', 'om_personnel_rosters', 'om_site_access_requests', 'om_toolbox_meetings',
      'duplicate_ignore_pairs', 'duplicate_reviews',
      'project_quotes', 'projects',
      'investor_contacts', 'investor_payment_methods', 'investors', 'investor_year_counters',
      'partner_contacts', 'partners',
    ],
  },
  factory: {
    label: '完整重置',
    description: '清除所有業務資料、稽核日誌及使用者事件（保留系統設定與權限）',
    tables: [
      'quote_financial_projections', 'quote_engineering_items', 'quote_line_items',
      'quote_schedules', 'quote_modules', 'quote_inverters',
      'project_payments',
      'document_tag_assignments', 'document_files', 'documents',
      'project_construction_assignments', 'project_milestones', 'project_stages',
      'project_issues', 'project_custom_field_values', 'project_epc_financial_metrics',
      'action_item_resolutions', 'construction_status_history', 'project_status_history',
      'milestone_notification_logs',
      'memos', 'memo_tags',
      'om_ac_tests', 'om_dc_tests', 'om_cleaning_reports', 'om_incident_reports',
      'om_inspections', 'om_personnel_rosters', 'om_site_access_requests', 'om_toolbox_meetings',
      'duplicate_ignore_pairs', 'duplicate_reviews',
      'project_quotes', 'projects',
      'investor_contacts', 'investor_payment_methods', 'investors', 'investor_year_counters',
      'partner_contacts', 'partners',
      'audit_logs', 'module_permissions', 'progress_milestones', 'progress_settings',
      'user_events', 'user_milestone_order',
    ],
  },
};

// Preserved tables that should be displayed in all reset scopes
const PRESERVED_TABLES = [
  'system_options', 'system_tariff_rates', 'deletion_policies', 'app_settings',
  'ai_settings', 'company_bank_accounts',
  'departments', 'process_stages', 'stage_responsibilities',
  'document_type_config', 'document_linkage_rules', 'document_expiry_rules',
  'payment_milestones', 'milestone_notification_settings',
  'quote_engineering_presets', 'quote_engineering_templates',
  'profiles', 'user_roles', 'user_security', 'user_preferences',
];

const ENVIRONMENT_ID = 'MQTSOLAR-DEV';

export function DangerZonePanel() {
  const queryClient = useQueryClient();
  const [resetScope, setResetScope] = useState<keyof typeof RESET_SCOPES>('business');
  const [resetReason, setResetReason] = useState('');
  const [confirmReset, setConfirmReset] = useState('');
  const [confirmEnvId, setConfirmEnvId] = useState('');
  const [deleteCloudFiles, setDeleteCloudFiles] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [backupFileId, setBackupFileId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const { data: cooldownStatus, refetch: refetchCooldown } = useQuery({
    queryKey: ['reset-cooldown'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-operations', {
        body: { action: 'check-cooldown', environment_id: ENVIRONMENT_ID },
      });
      if (error) throw error;
      return data as { canReset: boolean; cooldownMinutes?: number };
    },
    refetchInterval: 60000,
  });

  const handleExportComplete = (fileId: string) => {
    setBackupFileId(fileId);
    toast.success('備份完成，現在可以執行重置操作');
  };

  const handleReset = async () => {
    if (!backupFileId) { toast.error('請先完成資料庫備份'); return; }
    if (confirmReset !== 'RESET') { toast.error('請正確輸入 RESET'); return; }
    if (confirmEnvId !== ENVIRONMENT_ID) { toast.error(`請正確輸入環境識別碼: ${ENVIRONMENT_ID}`); return; }
    if (resetReason.length < 10) { toast.error('請提供有效的重置原因（至少 10 個字元）'); return; }

    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-operations', {
        body: {
          action: 'db-reset',
          scope: resetScope,
          reason: resetReason,
          environment_id: ENVIRONMENT_ID,
          backup_file_id: backupFileId,
          delete_cloud_files: deleteCloudFiles,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || '重置失敗');

      toast.success('資料庫重置完成');
      setBackupFileId(null);
      setConfirmReset('');
      setConfirmEnvId('');
      setResetReason('');
      setDeleteCloudFiles(false);
      setShowResetDialog(false);
      queryClient.invalidateQueries();
      refetchCooldown();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('重置失敗：' + (err as Error).message);
    } finally {
      setIsResetting(false);
    }
  };

  const selectedScope = RESET_SCOPES[resetScope];
  const canReset = backupFileId && confirmReset === 'RESET' && confirmEnvId === ENVIRONMENT_ID && resetReason.length >= 10;

  return (
    <div className="space-y-6">
      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="w-5 h-5" />
        <AlertTitle className="text-lg">危險操作區</AlertTitle>
        <AlertDescription>
          此區域包含可能造成不可逆資料損失的操作。所有操作都會記錄到稽核日誌，並受到權限控制。
        </AlertDescription>
      </Alert>

      {cooldownStatus && !cooldownStatus.canReset && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <Clock className="w-4 h-4 text-amber-500" />
          <AlertTitle>冷卻時間中</AlertTitle>
          <AlertDescription>
            距離上次重置尚未超過 10 分鐘，請等待 {cooldownStatus.cooldownMinutes} 分鐘後再試。
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
            強制備份
          </CardTitle>
          <CardDescription>執行任何危險操作前，必須先完成資料庫完整備份</CardDescription>
        </CardHeader>
        <CardContent>
          <DatabaseExportPanel onExportComplete={handleExportComplete} />
          {backupFileId && (
            <Alert className="mt-4 border-green-500 bg-green-500/10">
              <Shield className="w-4 h-4 text-green-500" />
              <AlertTitle>備份已完成</AlertTitle>
              <AlertDescription className="font-mono text-xs">備份 ID: {backupFileId}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Reset */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-sm font-bold">2</span>
            資料庫重置
          </CardTitle>
          <CardDescription>選擇重置範圍並確認操作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>重置範圍</Label>
            <Select value={resetScope} onValueChange={(v) => setResetScope(v as keyof typeof RESET_SCOPES)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RESET_SCOPES).map(([key, scope]) => (
                  <SelectItem key={key} value={key}>{scope.label} - {scope.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>將會刪除的資料表（{selectedScope.tables.length} 張）</Label>
            <div className="p-3 rounded-lg border bg-destructive/5 border-destructive/20 max-h-48 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {selectedScope.tables.map((table) => (
                  <Badge key={table} variant="destructive" className="text-xs">
                    {tableDisplayNames[table] || table}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>將會保留的資料表（{PRESERVED_TABLES.length} 張）</Label>
            <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20 max-h-48 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {PRESERVED_TABLES.map((table) => (
                  <Badge key={table} variant="secondary" className="text-xs">
                    {tableDisplayNames[table] || table}
                  </Badge>
                ))}
                {resetScope !== 'factory' && (
                  <>
                    <Badge variant="secondary" className="text-xs">{tableDisplayNames['audit_logs']}</Badge>
                    <Badge variant="secondary" className="text-xs">{tableDisplayNames['module_permissions']}</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
              <Checkbox id="deleteCloudFiles" checked={deleteCloudFiles} onCheckedChange={(checked) => setDeleteCloudFiles(checked === true)} />
              <div className="space-y-1">
                <Label htmlFor="deleteCloudFiles" className="font-medium cursor-pointer">同時刪除雲端儲存檔案</Label>
                <p className="text-xs text-muted-foreground">預設只刪除資料庫記錄，勾選此選項將同時刪除 Storage 中的實際檔案（不可復原）</p>
              </div>
            </div>
            {deleteCloudFiles && (
              <Alert variant="destructive">
                <FileWarning className="w-4 h-4" />
                <AlertTitle>警告：雲端檔案將被永久刪除</AlertTitle>
                <AlertDescription>此操作將刪除所有上傳的文件檔案，即使有備份也無法透過系統還原這些檔案。</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="resetReason">重置原因（必填，至少 10 字）</Label>
            <Textarea id="resetReason" value={resetReason} onChange={(e) => setResetReason(e.target.value)} placeholder="請說明執行此重置操作的原因..." className="min-h-[80px]" />
            <p className="text-xs text-muted-foreground">已輸入 {resetReason.length} 字 / 最少 10 字</p>
          </div>

          <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!backupFileId || (cooldownStatus && !cooldownStatus.canReset)} className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />開始重置
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />最終確認
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>此操作將永久刪除選定範圍內的所有資料，無法復原！</AlertDescription>
                  </Alert>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>輸入「RESET」確認操作</Label>
                      <Input value={confirmReset} onChange={(e) => setConfirmReset(e.target.value.toUpperCase())} placeholder="RESET" className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label>輸入環境識別碼確認</Label>
                      <Input value={confirmEnvId} onChange={(e) => setConfirmEnvId(e.target.value.toUpperCase())} placeholder={ENVIRONMENT_ID} className="font-mono" />
                      <p className="text-xs text-muted-foreground">請輸入: {ENVIRONMENT_ID}</p>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setConfirmReset(''); setConfirmEnvId(''); }}>取消</AlertDialogCancel>
                <Button variant="destructive" disabled={!canReset || isResetting} onClick={handleReset}>
                  {isResetting ? (<><RefreshCw className="w-4 h-4 mr-2 animate-spin" />重置中...</>) : (<><Trash2 className="w-4 h-4 mr-2" />確認重置</>)}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
