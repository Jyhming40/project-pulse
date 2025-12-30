import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  ClipboardCheck,
  HardHat,
  FileX,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface QuickAccessItem {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  iconColor: string;
  bgColor: string;
  adminOnly?: boolean;
}

const quickAccessItems: QuickAccessItem[] = [
  {
    title: '案場總覽',
    description: '查看所有案場列表與狀態',
    icon: Building2,
    path: '/projects',
    iconColor: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: '行政進度',
    description: '追蹤行政審查與文件進度',
    icon: ClipboardCheck,
    path: '/projects?filter=admin',
    iconColor: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    title: '工程進度',
    description: '監控施工狀態與派工情況',
    icon: HardHat,
    path: '/projects?filter=engineering',
    iconColor: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    title: '文件管理',
    description: '查看缺件清單與文件狀態',
    icon: FileX,
    path: '/documents',
    iconColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  {
    title: '系統治理中心',
    description: '系統狀態與高風險操作',
    icon: ShieldAlert,
    path: '/engineering',
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    adminOnly: true,
  },
];

export function QuickAccessSection() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const visibleItems = quickAccessItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">快捷入口</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {visibleItems.map((item) => (
            <Button
              key={item.path}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent transition-colors group"
              onClick={() => navigate(item.path)}
            >
              <div className="flex items-center gap-3 w-full">
                <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
