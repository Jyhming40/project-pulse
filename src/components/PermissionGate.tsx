import { ReactNode } from 'react';
import { usePermissions, ModuleName } from '@/hooks/usePermissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock } from 'lucide-react';

interface PermissionGateProps {
  module: ModuleName;
  action: 'view' | 'create' | 'edit' | 'delete';
  children: ReactNode;
  fallback?: ReactNode;
  showTooltip?: boolean;
  tooltipMessage?: string;
}

/**
 * Conditionally renders children based on user permissions.
 * If user lacks permission, shows fallback or nothing.
 */
export function PermissionGate({
  module,
  action,
  children,
  fallback = null,
  showTooltip = false,
  tooltipMessage,
}: PermissionGateProps) {
  const { getPermissions, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const permissions = getPermissions(module);
  let hasPermission = false;

  switch (action) {
    case 'view':
      hasPermission = permissions.can_view;
      break;
    case 'create':
      hasPermission = permissions.can_create;
      break;
    case 'edit':
      hasPermission = permissions.can_edit;
      break;
    case 'delete':
      hasPermission = permissions.can_delete;
      break;
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  if (showTooltip && fallback) {
    const message = tooltipMessage || getDefaultTooltipMessage(action);
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{fallback}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {message}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{fallback}</>;
}

function getDefaultTooltipMessage(action: string): string {
  switch (action) {
    case 'view':
      return '您沒有查看權限';
    case 'create':
      return '您沒有新增權限';
    case 'edit':
      return '您沒有編輯權限';
    case 'delete':
      return '您沒有刪除權限';
    default:
      return '您沒有執行此操作的權限';
  }
}

interface PermissionButtonProps {
  module: ModuleName;
  action: 'view' | 'create' | 'edit' | 'delete';
  children: ReactNode;
  disabledClassName?: string;
}

/**
 * Wraps a button and disables it if user lacks permission.
 * Shows a tooltip explaining why when hovered.
 */
export function PermissionButton({
  module,
  action,
  children,
  disabledClassName = 'opacity-50 cursor-not-allowed',
}: PermissionButtonProps) {
  const { getPermissions, isLoading } = usePermissions();

  if (isLoading) {
    return <>{children}</>;
  }

  const permissions = getPermissions(module);
  let hasPermission = false;

  switch (action) {
    case 'view':
      hasPermission = permissions.can_view;
      break;
    case 'create':
      hasPermission = permissions.can_create;
      break;
    case 'edit':
      hasPermission = permissions.can_edit;
      break;
    case 'delete':
      hasPermission = permissions.can_delete;
      break;
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  const message = getDefaultTooltipMessage(action);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex ${disabledClassName}`}>
            <span className="pointer-events-none">{children}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {message}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
