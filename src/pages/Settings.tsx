import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Wrench,
  Palette,
  TrendingUp,
  Settings2,
  FileText,
  Building2,
  GitBranch,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BrandingSettings from '@/components/BrandingSettings';
import UserManagement from '@/components/UserManagement';
import PermissionManagement from '@/components/PermissionManagement';
import { ProgressSettingsPanel } from '@/components/settings/ProgressSettingsPanel';
import { SystemOptionsPanel } from '@/components/settings/SystemOptionsPanel';
import { DocumentTypePanel } from '@/components/settings/DocumentTypePanel';
import { DepartmentsPanel } from '@/components/settings/DepartmentsPanel';
import { ProcessStagesPanel } from '@/components/settings/ProcessStagesPanel';
import { StageResponsibilitiesPanel } from '@/components/settings/StageResponsibilitiesPanel';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('branding');

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">僅限管理員存取</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">系統設定</h1>
        <p className="text-muted-foreground mt-1">管理系統配置與資料選項</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 max-w-4xl">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">公司</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">進度</span>
          </TabsTrigger>
          <TabsTrigger value="codebook" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Codebook</span>
          </TabsTrigger>
          <TabsTrigger value="doctype" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">文件</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">部門</span>
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span className="hidden sm:inline">流程</span>
          </TabsTrigger>
          <TabsTrigger value="raci" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">責任</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">權限</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                品牌與公司資訊
              </CardTitle>
              <CardDescription>
                設定系統名稱、Logo 與公司基本資訊
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <ProgressSettingsPanel />
        </TabsContent>

        <TabsContent value="codebook" className="mt-6">
          <SystemOptionsPanel />
        </TabsContent>

        <TabsContent value="doctype" className="mt-6">
          <DocumentTypePanel />
        </TabsContent>

        <TabsContent value="departments" className="mt-6">
          <DepartmentsPanel />
        </TabsContent>

        <TabsContent value="stages" className="mt-6">
          <ProcessStagesPanel />
        </TabsContent>

        <TabsContent value="raci" className="mt-6">
          <StageResponsibilitiesPanel />
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-6">
          <UserManagement />
          <PermissionManagement />
          
          {/* Engineering Interface - Redirect to dedicated page */}
          <Card className="border-amber-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                系統治理中心
              </CardTitle>
              <CardDescription>
                進階系統維護功能，包含 Google Drive 連線設定、資料庫備份與重置等
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <RouterLink to="/engineering">
                  <Wrench className="w-4 h-4 mr-2" />
                  進入系統治理中心
                </RouterLink>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
