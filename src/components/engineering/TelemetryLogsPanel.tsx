/**
 * Telemetry Logs Panel for Engineering page
 * 
 * Allows admins to view and filter user events for debugging and UX analysis.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { 
  Activity, 
  MousePointerClick, 
  AlertTriangle, 
  Eye,
  Filter,
  RefreshCw,
  User,
  Clock,
  MapPin,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ==========================================
// Types
// ==========================================
interface UserEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  session_id: string;
  event_type: 'page_view' | 'action' | 'error';
  event_name: string;
  path: string | null;
  workspace: string | null;
  metadata: Record<string, unknown> | null;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ==========================================
// Component
// ==========================================
export function TelemetryLogsPanel() {
  // Filters
  const [eventType, setEventType] = useState<string>('all');
  const [workspace, setWorkspace] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');
  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  
  // Calculate date range
  const dateFilter = useMemo(() => {
    const days = parseInt(dateRange);
    return {
      start: startOfDay(subDays(new Date(), days)).toISOString(),
      end: endOfDay(new Date()).toISOString(),
    };
  }, [dateRange]);
  
  // Fetch events
  const { data: events, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['telemetry-events', eventType, workspace, dateFilter, userId, sessionId],
    queryFn: async () => {
      // Use type assertion since user_events table may not be in generated types yet
      let query = (supabase as any)
        .from('user_events')
        .select('*')
        .gte('created_at', dateFilter.start)
        .lte('created_at', dateFilter.end)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (eventType !== 'all') {
        query = query.eq('event_type', eventType);
      }
      if (workspace !== 'all') {
        query = query.eq('workspace', workspace);
      }
      if (userId.trim()) {
        query = query.eq('user_id', userId.trim());
      }
      if (sessionId.trim()) {
        query = query.eq('session_id', sessionId.trim());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UserEvent[];
    },
  });
  
  // Fetch user profiles for display
  const userIds = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.user_id).filter(Boolean))] as string[];
  }, [events]);
  
  const { data: profiles } = useQuery({
    queryKey: ['telemetry-profiles', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const map: Record<string, UserProfile> = {};
      (data || []).forEach((p: UserProfile) => {
        map[p.id] = p;
      });
      return map;
    },
    enabled: userIds.length > 0,
  });
  
  // Group events by session
  const sessionGroups = useMemo(() => {
    if (!events) return [];
    
    const groups: Record<string, UserEvent[]> = {};
    events.forEach(event => {
      if (!groups[event.session_id]) {
        groups[event.session_id] = [];
      }
      groups[event.session_id].push(event);
    });
    
    return Object.entries(groups)
      .map(([sessionId, sessionEvents]) => ({
        sessionId,
        events: sessionEvents.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
        firstEvent: sessionEvents[sessionEvents.length - 1],
        lastEvent: sessionEvents[0],
        userId: sessionEvents.find(e => e.user_id)?.user_id || null,
        eventCounts: {
          page_view: sessionEvents.filter(e => e.event_type === 'page_view').length,
          action: sessionEvents.filter(e => e.event_type === 'action').length,
          error: sessionEvents.filter(e => e.event_type === 'error').length,
        },
      }))
      .sort((a, b) => 
        new Date(b.lastEvent.created_at).getTime() - new Date(a.lastEvent.created_at).getTime()
      );
  }, [events]);
  
  // Stats
  const stats = useMemo(() => {
    if (!events) return { total: 0, pageViews: 0, actions: 0, errors: 0 };
    return {
      total: events.length,
      pageViews: events.filter(e => e.event_type === 'page_view').length,
      actions: events.filter(e => e.event_type === 'action').length,
      errors: events.filter(e => e.event_type === 'error').length,
    };
  }, [events]);
  
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'page_view': return <Eye className="w-3.5 h-3.5" />;
      case 'action': return <MousePointerClick className="w-3.5 h-3.5" />;
      case 'error': return <AlertTriangle className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };
  
  const getEventColor = (type: string) => {
    switch (type) {
      case 'page_view': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'action': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'error': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  
  const formatUserName = (userId: string | null) => {
    if (!userId) return '匿名';
    const profile = profiles?.[userId];
    return profile?.full_name || profile?.email || userId.substring(0, 8);
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              使用者行為記錄
            </CardTitle>
            <CardDescription>
              追蹤使用者操作以利除錯與 UX 改善
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", isFetching && "animate-spin")} />
            重新整理
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">總事件</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.pageViews}</div>
            <div className="text-xs text-blue-600/80">頁面瀏覽</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.actions}</div>
            <div className="text-xs text-green-600/80">操作動作</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
            <div className="text-xs text-red-600/80">錯誤</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            篩選：
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">事件類型</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="page_view">頁面瀏覽</SelectItem>
                <SelectItem value="action">操作動作</SelectItem>
                <SelectItem value="error">錯誤</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">工作模式</Label>
            <Select value={workspace} onValueChange={setWorkspace}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="sales">接案</SelectItem>
                <SelectItem value="execution">工程</SelectItem>
                <SelectItem value="governance">治理</SelectItem>
                <SelectItem value="finance">財務</SelectItem>
                <SelectItem value="risk">風險</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">時間範圍</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">今天</SelectItem>
                <SelectItem value="3">3 天</SelectItem>
                <SelectItem value="7">7 天</SelectItem>
                <SelectItem value="14">14 天</SelectItem>
                <SelectItem value="30">30 天</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Session ID</Label>
            <Input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="搜尋 Session..."
              className="w-[160px] h-8"
            />
          </div>
        </div>
        
        {/* Session Groups */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sessionGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>沒有符合條件的事件記錄</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessionGroups.map(group => (
                <Collapsible
                  key={group.sessionId}
                  open={expandedSession === group.sessionId}
                  onOpenChange={(open) => setExpandedSession(open ? group.sessionId : null)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 bg-card border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                      {expandedSession === group.sessionId ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">
                            {formatUserName(group.userId)}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {group.sessionId.substring(0, 16)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(group.firstEvent.created_at), 'MM/dd HH:mm', { locale: zhTW })}
                          {' → '}
                          {format(new Date(group.lastEvent.created_at), 'HH:mm', { locale: zhTW })}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {group.eventCounts.page_view > 0 && (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <Eye className="w-3 h-3 mr-1" />
                            {group.eventCounts.page_view}
                          </Badge>
                        )}
                        {group.eventCounts.action > 0 && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <MousePointerClick className="w-3 h-3 mr-1" />
                            {group.eventCounts.action}
                          </Badge>
                        )}
                        {group.eventCounts.error > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {group.eventCounts.error}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="ml-8 mt-1 space-y-1 border-l-2 border-muted pl-4 py-2">
                      {group.events.map((event, idx) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-2 text-sm py-1.5"
                        >
                          <div className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                            getEventColor(event.event_type)
                          )}>
                            {getEventIcon(event.event_type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.event_name}</span>
                              {event.workspace && (
                                <Badge variant="outline" className="text-xs">
                                  <Layers className="w-3 h-3 mr-1" />
                                  {event.workspace}
                                </Badge>
                              )}
                            </div>
                            {event.path && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {event.path}
                              </div>
                            )}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <pre className="text-xs bg-muted/50 rounded p-2 mt-1 overflow-x-auto">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                          
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(event.created_at), 'HH:mm:ss')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default TelemetryLogsPanel;
