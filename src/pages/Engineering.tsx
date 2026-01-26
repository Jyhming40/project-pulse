import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { 
  Activity, 
  ShieldCheck, 
  ClipboardList, 
  Trash2, 
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

import {
  SystemHealthPanel,
  IntegrityCheckPanel,
  DangerZonePanel,
  AuditLogsPanel,
  DeletionPolicyPanel,
  SchemaExportPanel,
  ProjectCustomExportPanel,
} from '@/components/engineering';

export default function Engineering() {
  const { isAdmin, loading, role } = useAuth();
  const [activeTab, setActiveTab] = useState('health');

  // Show loading while checking auth
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  // Redirect non-admin users only after loading is complete and role is determined
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
              系統治理中心
            </h1>
            <p className="text-muted-foreground mt-1">
              系統除錯、資料安全、資料完整性檢查與高風險操作管控
            </p>
          </div>
        </div>

        {/* Critical Warning Banner */}
        <Alert className="border-2 border-amber-500 bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400 font-bold">
            ⚠️ 本區為系統治理與高風險操作區域
          </AlertTitle>
          <AlertDescription className="text-amber-700/90 dark:text-amber-400/90">
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>僅限具備完整權限且理解後果者使用</li>
              <li>所有操作都會記錄到稽核日誌中，可供追溯</li>
              <li>部分操作為不可逆，執行前請確保已完成備份</li>
              <li>如有疑問，請先諮詢系統管理員</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="health" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">系統狀態</span>
            </TabsTrigger>
            <TabsTrigger 
              value="integrity"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">完整性檢查</span>
            </TabsTrigger>
            <TabsTrigger 
              value="audit"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">操作紀錄</span>
            </TabsTrigger>
            <TabsTrigger 
              value="deletion"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">刪除政策</span>
            </TabsTrigger>
            <TabsTrigger 
              value="danger"
              className="flex items-center gap-2 border-2 border-destructive/30 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">危險操作區</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <TabsContent value="health" className="mt-6 space-y-6">
            <SystemHealthPanel />
            <ProjectCustomExportPanel />
            <SchemaExportPanel />
          </TabsContent>


          <TabsContent value="integrity" className="mt-6">
            <IntegrityCheckPanel />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditLogsPanel />
          </TabsContent>

          <TabsContent value="deletion" className="mt-6">
            <DeletionPolicyPanel />
          </TabsContent>

          <TabsContent value="danger" className="mt-6">
            {/* Additional Danger Zone warning before panel */}
            <Alert variant="destructive" className="mb-6 border-2">
              <AlertTriangle className="w-5 h-5" />
              <AlertTitle className="text-lg font-bold">⚠️ 危險操作區</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="font-medium mb-2">此區域的操作可能造成：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>不可復原的資料損失</strong> — 刪除後無法透過系統還原</li>
                  <li><strong>業務中斷</strong> — 重置期間系統暫時無法使用</li>
                  <li><strong>完整追溯紀錄</strong> — 所有操作將寫入 audit_logs</li>
                </ul>
                <p className="mt-3 text-sm">
                  執行任何操作前，請務必：<strong>完成資料庫備份</strong>、<strong>確認操作範圍</strong>、<strong>取得必要授權</strong>
                </p>
              </AlertDescription>
            </Alert>
            <DangerZonePanel />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
