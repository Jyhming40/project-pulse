import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { TelemetryProvider } from "@/components/TelemetryProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionGuard from "@/components/PermissionGuard";
import Layout from "@/components/Layout";
import { MODULES } from "@/hooks/usePermissions";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Hub from "./pages/Hub";
import Projects from "./pages/Projects";
import ProjectCustomExport from "./pages/ProjectCustomExport";
import ProjectDetail from "./pages/ProjectDetail";
import Investors from "./pages/Investors";
import Documents from "./pages/Documents";
import ImportBatch from "./pages/ImportBatch";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Permissions from "./pages/Permissions";
import Partners from "./pages/Partners";
import RecycleBin from "./pages/RecycleBin";
import Engineering from "./pages/Engineering";
import ChangePassword from "./pages/ChangePassword";
import Integrations from "./pages/Integrations";
import PendingApproval from "./pages/PendingApproval";
import DuplicateScanner from "./pages/DuplicateScanner";
import DashboardAudit from "./pages/DashboardAudit";
import ProjectComparison from "./pages/ProjectComparison";
import Quotes from "./pages/Quotes";
import QuoteWizard from "./pages/QuoteWizard";
import Memos from "./pages/Memos";
import NotFound from "./pages/NotFound";

// Workspace Module pages
import { 
  SalesModule, 
  ExecutionModule, 
  GovernanceModule, 
  FinanceModule, 
  RiskModule 
} from "./pages/modules";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WorkspaceProvider>
            <TelemetryProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              
              {/* Layer 1: 營運指揮中心 (Hub) */}
              <Route path="/hub" element={<ProtectedRoute><Layout><Hub /></Layout></ProtectedRoute>} />
              
              {/* KPI 儀表板 */}
              <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
              
              {/* Layer 2: Workspace 模組首頁 (/w/*) */}
              <Route path="/w/sales" element={
                <ProtectedRoute>
                  <PermissionGuard requiredPermission={MODULES.PROJECTS}>
                    <Layout><SalesModule /></Layout>
                  </PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/w/execution" element={
                <ProtectedRoute>
                  <PermissionGuard requiredPermission={MODULES.PROJECTS}>
                    <Layout><ExecutionModule /></Layout>
                  </PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/w/governance" element={
                <ProtectedRoute>
                  <PermissionGuard requiredPermission={MODULES.DOCUMENTS}>
                    <Layout><GovernanceModule /></Layout>
                  </PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/w/finance" element={
                <ProtectedRoute>
                  <PermissionGuard requiredPermission={MODULES.INVESTORS}>
                    <Layout><FinanceModule /></Layout>
                  </PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/w/risk" element={
                <ProtectedRoute>
                  <PermissionGuard requiredPermission={MODULES.PROJECTS}>
                    <Layout><RiskModule /></Layout>
                  </PermissionGuard>
                </ProtectedRoute>
              } />
              
              {/* Legacy /modules/* routes - redirect to /w/* */}
              <Route path="/modules/sales" element={<Navigate to="/w/sales" replace />} />
              <Route path="/modules/execution" element={<Navigate to="/w/execution" replace />} />
              <Route path="/modules/governance" element={<Navigate to="/w/governance" replace />} />
              <Route path="/modules/finance" element={<Navigate to="/w/finance" replace />} />
              <Route path="/modules/risk" element={<Navigate to="/w/risk" replace />} />
              
              {/* Layer 3: 專案戰情室 */}
              <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
              <Route path="/projects/export" element={<ProtectedRoute><Layout><ProjectCustomExport /></Layout></ProtectedRoute>} />
              <Route path="/projects/compare" element={<ProtectedRoute><Layout><ProjectComparison /></Layout></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectDetail /></Layout></ProtectedRoute>} />
              
              {/* 功能頁面 */}
              <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
              <Route path="/import-batch" element={<ProtectedRoute><Layout><ImportBatch /></Layout></ProtectedRoute>} />
              <Route path="/investors" element={<ProtectedRoute><Layout><Investors /></Layout></ProtectedRoute>} />
              <Route path="/partners" element={<ProtectedRoute><Layout><Partners /></Layout></ProtectedRoute>} />
              <Route path="/quotes" element={<ProtectedRoute><Layout><Quotes /></Layout></ProtectedRoute>} />
              <Route path="/quotes/new" element={<ProtectedRoute><Layout><QuoteWizard /></Layout></ProtectedRoute>} />
              <Route path="/quotes/:id" element={<ProtectedRoute><Layout><QuoteWizard /></Layout></ProtectedRoute>} />
              <Route path="/memos" element={<ProtectedRoute><Layout><Memos /></Layout></ProtectedRoute>} />
              
              {/* 管理與設定 (Admin) */}
              <Route path="/users" element={
                <ProtectedRoute adminOnly>
                  <Layout><Users /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/permissions" element={
                <ProtectedRoute adminOnly>
                  <Layout><Permissions /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute adminOnly>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations" element={
                <ProtectedRoute adminOnly>
                  <Layout><Integrations /></Layout>
                </ProtectedRoute>
              } />
              
              {/* 系統治理中心 (Admin) */}
              <Route path="/engineering" element={
                <ProtectedRoute adminOnly>
                  <Layout><Engineering /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/recycle-bin" element={
                <ProtectedRoute adminOnly>
                  <Layout><RecycleBin /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/duplicate-scanner" element={
                <ProtectedRoute adminOnly>
                  <Layout><DuplicateScanner /></Layout>
                </ProtectedRoute>
              } />
              
              {/* Dev Tools */}
              <Route path="/dev/dashboard-audit" element={
                <ProtectedRoute>
                  <Layout><DashboardAudit /></Layout>
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            </TelemetryProvider>
          </WorkspaceProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
