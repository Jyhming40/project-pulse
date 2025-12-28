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
import SystemOptions from "./pages/SystemOptions";
import Partners from "./pages/Partners";
import RecycleBin from "./pages/RecycleBin";
import DeletionPolicies from "./pages/DeletionPolicies";
import AuditLogs from "./pages/AuditLogs";
import Engineering from "./pages/Engineering";

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
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectDetail /></Layout></ProtectedRoute>} />
            <Route path="/investors" element={<ProtectedRoute><Layout><Investors /></Layout></ProtectedRoute>} />
            <Route path="/investor-codes" element={<ProtectedRoute><Layout><InvestorCodeReference /></Layout></ProtectedRoute>} />
            <Route path="/investor-data" element={<ProtectedRoute><Layout><InvestorDataManagement /></Layout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
            <Route path="/partners" element={<ProtectedRoute><Layout><Partners /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute adminOnly><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/system-options" element={<ProtectedRoute adminOnly><Layout><SystemOptions /></Layout></ProtectedRoute>} />
            <Route path="/recycle-bin" element={<ProtectedRoute><RecycleBin /></ProtectedRoute>} />
            <Route path="/deletion-policies" element={<ProtectedRoute adminOnly><DeletionPolicies /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/engineering" element={<ProtectedRoute adminOnly><Engineering /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
