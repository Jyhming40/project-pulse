import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Wrench, 
  Activity, 
  Database, 
  ShieldCheck, 
  ClipboardList, 
  Trash2, 
  AlertTriangle 
} from 'lucide-react';

import {
  SystemHealthPanel,
  IntegrityCheckPanel,
  DangerZonePanel,
  AuditLogsPanel,
  DeletionPolicyPanel,
} from '@/components/engineering';

export default function Engineering() {
  const { isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('health');

  // Redirect non-admin users
  if (!loading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-500" />
              系統治理與工程管理中心
            </h1>
            <p className="text-muted-foreground mt-1">
              系統除錯、資料安全、資料完整性檢查與高風險操作管控
            </p>
          </div>
        </div>

        {/* Admin Only Warning */}
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <AlertTitle>僅限管理員</AlertTitle>
          <AlertDescription>
            此模組僅供系統管理員使用。所有操作都會記錄到稽核日誌中。
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
              className="flex items-center gap-2 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">危險操作區</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <TabsContent value="health" className="mt-6">
            <SystemHealthPanel />
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
            <DangerZonePanel />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
