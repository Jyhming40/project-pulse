import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Hub from "./pages/Hub";
import Projects from "./pages/Projects";
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
import NotFound from "./pages/NotFound";

// Module pages
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
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            
            {/* Layer 1: 營運指揮中心 (Hub) */}
            <Route path="/hub" element={<ProtectedRoute><Layout><Hub /></Layout></ProtectedRoute>} />
            
            {/* KPI 儀表板 (保留原有) */}
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            
            {/* Layer 2: 模組首頁 */}
            <Route path="/modules/sales" element={<ProtectedRoute><Layout><SalesModule /></Layout></ProtectedRoute>} />
            <Route path="/modules/execution" element={<ProtectedRoute><Layout><ExecutionModule /></Layout></ProtectedRoute>} />
            <Route path="/modules/governance" element={<ProtectedRoute><Layout><GovernanceModule /></Layout></ProtectedRoute>} />
            <Route path="/modules/finance" element={<ProtectedRoute><Layout><FinanceModule /></Layout></ProtectedRoute>} />
            <Route path="/modules/risk" element={<ProtectedRoute><Layout><RiskModule /></Layout></ProtectedRoute>} />
            
            {/* Layer 3: 專案戰情室 */}
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
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
            
            {/* 管理與設定 (Admin) */}
            <Route path="/users" element={<ProtectedRoute adminOnly><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute adminOnly><Layout><Permissions /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute adminOnly><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute adminOnly><Layout><Integrations /></Layout></ProtectedRoute>} />
            
            {/* 系統治理中心 (Admin) */}
            <Route path="/engineering" element={<ProtectedRoute adminOnly><Layout><Engineering /></Layout></ProtectedRoute>} />
            <Route path="/recycle-bin" element={<ProtectedRoute adminOnly><Layout><RecycleBin /></Layout></ProtectedRoute>} />
            <Route path="/duplicate-scanner" element={<ProtectedRoute adminOnly><Layout><DuplicateScanner /></Layout></ProtectedRoute>} />
            
            {/* Dev Tools */}
            <Route path="/dev/dashboard-audit" element={<ProtectedRoute><Layout><DashboardAudit /></Layout></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
