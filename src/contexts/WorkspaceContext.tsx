import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkspaceId, WORKSPACE_REGISTRY, getWorkspaceById } from '@/config/moduleRegistry';

// ==========================================
// Context Type
// ==========================================
interface WorkspaceContextType {
  currentWorkspace: WorkspaceId | null;
  setCurrentWorkspace: (workspace: WorkspaceId) => void;
  isInWorkspace: boolean;
  workspaceLabel: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// ==========================================
// Storage Key
// ==========================================
const WORKSPACE_STORAGE_KEY = 'pulse-current-workspace';

// ==========================================
// Provider
// ==========================================
interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Initialize from localStorage or null
  const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceId | null>(() => {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (stored && stored in WORKSPACE_REGISTRY) {
      return stored as WorkspaceId;
    }
    return null;
  });

  // Sync workspace from URL when navigating
  useEffect(() => {
    const pathMatch = location.pathname.match(/^\/w\/([^/]+)/);
    if (pathMatch) {
      const urlWorkspace = pathMatch[1] as WorkspaceId;
      if (urlWorkspace in WORKSPACE_REGISTRY && urlWorkspace !== currentWorkspace) {
        setCurrentWorkspaceState(urlWorkspace);
        localStorage.setItem(WORKSPACE_STORAGE_KEY, urlWorkspace);
      }
    }
  }, [location.pathname]);

  // Set workspace and persist
  const setCurrentWorkspace = (workspace: WorkspaceId) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace);
    
    // Navigate to workspace hub
    const workspaceDef = getWorkspaceById(workspace);
    if (workspaceDef) {
      navigate(workspaceDef.hubRoute);
    }
  };

  // Check if currently in a workspace route
  const isInWorkspace = location.pathname.startsWith('/w/');

  // Get current workspace label
  const workspaceLabel = currentWorkspace 
    ? getWorkspaceById(currentWorkspace).label 
    : '選擇工作模式';

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      setCurrentWorkspace,
      isInWorkspace,
      workspaceLabel,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ==========================================
// Hook
// ==========================================
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
