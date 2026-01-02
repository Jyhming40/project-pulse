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
import InvestorCodeReference from "./pages/InvestorCodeReference";
import InvestorDataManagement from "./pages/InvestorDataManagement";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Permissions from "./pages/Permissions";
import SystemOptions from "./pages/SystemOptions";
import Partners from "./pages/Partners";
import RecycleBin from "./pages/RecycleBin";
import DeletionPolicies from "./pages/DeletionPolicies";
import AuditLogs from "./pages/AuditLogs";
import Engineering from "./pages/Engineering";
import ProgressSettings from "./pages/ProgressSettings";
import ChangePassword from "./pages/ChangePassword";
import Branding from "./pages/Branding";
import Integrations from "./pages/Integrations";
import PendingApproval from "./pages/PendingApproval";
import DuplicateScanner from "./pages/DuplicateScanner";
import ProjectFieldSettings from "./pages/ProjectFieldSettings";
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
            <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectDetail /></Layout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
            <Route path="/investors" element={<ProtectedRoute><Layout><Investors /></Layout></ProtectedRoute>} />
            <Route path="/investor-data" element={<ProtectedRoute><Layout><InvestorDataManagement /></Layout></ProtectedRoute>} />
            <Route path="/partners" element={<ProtectedRoute><Layout><Partners /></Layout></ProtectedRoute>} />
            
            {/* 管理與設定 (Admin) - 人員管理 */}
            <Route path="/users" element={<ProtectedRoute adminOnly><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute adminOnly><Layout><Permissions /></Layout></ProtectedRoute>} />
            {/* 管理與設定 (Admin) - 系統設定 */}
            <Route path="/progress-settings" element={<ProtectedRoute adminOnly><Layout><ProgressSettings /></Layout></ProtectedRoute>} />
            <Route path="/system-options" element={<ProtectedRoute adminOnly><Layout><SystemOptions /></Layout></ProtectedRoute>} />
            <Route path="/project-field-settings" element={<ProtectedRoute adminOnly><Layout><ProjectFieldSettings /></Layout></ProtectedRoute>} />
            <Route path="/investor-codes" element={<ProtectedRoute adminOnly><Layout><InvestorCodeReference /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute adminOnly><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/branding" element={<ProtectedRoute adminOnly><Layout><Branding /></Layout></ProtectedRoute>} />
            {/* 管理與設定 (Admin) - 外部整合 */}
            <Route path="/integrations" element={<ProtectedRoute adminOnly><Layout><Integrations /></Layout></ProtectedRoute>} />
            
            {/* 系統治理中心 (Admin) */}
            <Route path="/engineering" element={<ProtectedRoute adminOnly><Layout><Engineering /></Layout></ProtectedRoute>} />
            <Route path="/deletion-policies" element={<ProtectedRoute adminOnly><Layout><DeletionPolicies /></Layout></ProtectedRoute>} />
            <Route path="/recycle-bin" element={<ProtectedRoute adminOnly><Layout><RecycleBin /></Layout></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute adminOnly><Layout><AuditLogs /></Layout></ProtectedRoute>} />
            <Route path="/duplicate-scanner" element={<ProtectedRoute adminOnly><Layout><DuplicateScanner /></Layout></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
