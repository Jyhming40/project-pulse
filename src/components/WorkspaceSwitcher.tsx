import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  WORKSPACE_REGISTRY, 
  getAllWorkspaces,
  WorkspaceId,
} from '@/config/moduleRegistry';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export default function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const { currentWorkspace, setCurrentWorkspace, workspaceLabel } = useWorkspace();
  const { canView } = usePermissions();
  
  const workspaces = getAllWorkspaces();
  const currentDef = currentWorkspace ? WORKSPACE_REGISTRY[currentWorkspace] : null;

  // Filter workspaces by permission
  const accessibleWorkspaces = workspaces.filter(ws => canView(ws.requiredPermission));

  if (collapsed) {
    // Collapsed mode: show icon only
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="w-10 h-10 rounded-lg"
          >
            {currentDef ? (
              <currentDef.icon className={cn("w-5 h-5", currentDef.color)} />
            ) : (
              <div className="w-5 h-5 rounded bg-muted" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {accessibleWorkspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => setCurrentWorkspace(ws.id)}
              className="flex items-center gap-3 py-2"
            >
              <ws.icon className={cn("w-5 h-5", ws.color)} />
              <div className="flex-1">
                <p className="font-medium">{ws.label}</p>
                <p className="text-xs text-muted-foreground">{ws.description}</p>
              </div>
              {currentWorkspace === ws.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Expanded mode: show full switcher
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between h-auto py-2 px-3"
        >
          <div className="flex items-center gap-2">
            {currentDef ? (
              <>
                <currentDef.icon className={cn("w-5 h-5", currentDef.color)} />
                <span className="font-medium">{currentDef.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">選擇工作模式</span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[calc(var(--radix-dropdown-menu-trigger-width))]">
        {accessibleWorkspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => setCurrentWorkspace(ws.id)}
            className="flex items-center gap-3 py-2.5"
          >
            <ws.icon className={cn("w-5 h-5 flex-shrink-0", ws.color)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{ws.label}</p>
              <p className="text-xs text-muted-foreground truncate">{ws.description}</p>
            </div>
            {currentWorkspace === ws.id && (
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        {accessibleWorkspaces.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            沒有可存取的工作模式
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
