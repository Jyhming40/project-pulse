import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Building2,
  ClipboardCheck,
  HardHat,
  FileX,
  ShieldAlert,
} from 'lucide-react';

interface QuickAccessItem {
  title: string;
  icon: React.ElementType;
  path: string;
  iconColor: string;
  adminOnly?: boolean;
}

const quickAccessItems: QuickAccessItem[] = [
  {
    title: '案場總覽',
    icon: Building2,
    path: '/projects',
    iconColor: 'text-primary',
  },
  {
    title: '行政進度',
    icon: ClipboardCheck,
    path: '/projects?filter=admin',
    iconColor: 'text-info',
  },
  {
    title: '工程進度',
    icon: HardHat,
    path: '/projects?filter=engineering',
    iconColor: 'text-warning',
  },
  {
    title: '文件管理',
    icon: FileX,
    path: '/documents',
    iconColor: 'text-destructive',
  },
  {
    title: '系統治理',
    icon: ShieldAlert,
    path: '/engineering',
    iconColor: 'text-amber-500',
    adminOnly: true,
  },
];

export function QuickAccessCompact() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const visibleItems = quickAccessItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <div className="flex flex-wrap gap-2">
      {visibleItems.map((item) => (
        <Button
          key={item.path}
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => navigate(item.path)}
        >
          <item.icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
          {item.title}
        </Button>
      ))}
    </div>
  );
}
