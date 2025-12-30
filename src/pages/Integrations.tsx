import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Loader2, Link2, FolderOpen } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DriveConnectionPanel } from '@/components/engineering';

export default function Integrations() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            外部整合
          </h1>
          <p className="text-muted-foreground mt-1">
            管理與第三方服務的連結設定，包含雲端儲存、OAuth 認證等
          </p>
        </div>

        <Alert>
          <FolderOpen className="w-4 h-4" />
          <AlertDescription>
            此頁面用於管理系統與外部服務的整合。目前支援 Google Drive 雲端資料夾連結。
          </AlertDescription>
        </Alert>

        {/* Google Drive Connection */}
        <DriveConnectionPanel />
      </div>
    </Layout>
  );
}
