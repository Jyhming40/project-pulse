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
import NotFound from "./pages/NotFound";
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
            
            {/* 日常工作 */}
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
            <Route path="/projects/compare" element={<ProtectedRoute><Layout><ProjectComparison /></Layout></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectDetail /></Layout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
            <Route path="/import-batch" element={<ProtectedRoute><Layout><ImportBatch /></Layout></ProtectedRoute>} />
            <Route path="/investors" element={<ProtectedRoute><Layout><Investors /></Layout></ProtectedRoute>} />
            <Route path="/partners" element={<ProtectedRoute><Layout><Partners /></Layout></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><Layout><Quotes /></Layout></ProtectedRoute>} />
            
            {/* 管理與設定 (Admin) */}
            <Route path="/users" element={<ProtectedRoute adminOnly><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute adminOnly><Layout><Permissions /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute adminOnly><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute adminOnly><Layout><Integrations /></Layout></ProtectedRoute>} />
            
            {/* 系統治理中心 (Admin) */}
            <Route path="/engineering" element={<ProtectedRoute adminOnly><Layout><Engineering /></Layout></ProtectedRoute>} />
            <Route path="/recycle-bin" element={<ProtectedRoute adminOnly><Layout><RecycleBin /></Layout></ProtectedRoute>} />
            <Route path="/duplicate-scanner" element={<ProtectedRoute adminOnly><Layout><DuplicateScanner /></Layout></ProtectedRoute>} />
            
            {/* Dev Tools (開發環境) */}
            <Route path="/dev/dashboard-audit" element={<ProtectedRoute><Layout><DashboardAudit /></Layout></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
