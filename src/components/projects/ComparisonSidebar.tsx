import { Eye, EyeOff, LineChart, BarChart3, Calendar, Info, Settings2, AlertOctagon, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface SectionVisibility {
  chart: boolean;
  bottleneck: boolean;
  stats: boolean;
  analysis: boolean;
  dates: boolean;
  pairInfo: boolean;
}

interface ComparisonSidebarProps {
  visibility: SectionVisibility;
  onVisibilityChange: (visibility: SectionVisibility) => void;
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
}

const sections = [
  { id: "chart" as const, label: "爬升歷程圖", icon: LineChart },
  { id: "bottleneck" as const, label: "瓶頸階段識別", icon: AlertOctagon },
  { id: "stats" as const, label: "統計分析", icon: Calculator },
  { id: "analysis" as const, label: "階段耗時差異分析", icon: BarChart3 },
  { id: "dates" as const, label: "原始日期列表", icon: Calendar },
  { id: "pairInfo" as const, label: "比較區間說明", icon: Info },
];

export function ComparisonSidebar({
  visibility,
  onVisibilityChange,
  isCollapsed,
  onCollapseChange,
}: ComparisonSidebarProps) {
  const toggleSection = (sectionId: keyof SectionVisibility) => {
    onVisibilityChange({
      ...visibility,
      [sectionId]: !visibility[sectionId],
    });
  };

  const allVisible = Object.values(visibility).every(Boolean);
  const allHidden = Object.values(visibility).every(v => !v);

  const toggleAll = () => {
    const newValue = !allVisible;
    onVisibilityChange({
      chart: newValue,
      bottleneck: newValue,
      stats: newValue,
      analysis: newValue,
      dates: newValue,
      pairInfo: newValue,
    });
  };

  return (
    <div
      className={cn(
        "bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out shrink-0",
        isCollapsed ? "w-14" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">顯示控制</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onCollapseChange(!isCollapsed)}
        >
          {isCollapsed ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={toggleAll}
              >
                {allVisible ? "全部隱藏" : "全部顯示"}
              </Button>
            </div>

            <Separator />

            {/* Section toggles */}
            <div className="space-y-3">
              {sections.map(section => (
                <div
                  key={section.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <section.icon className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor={`toggle-${section.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {section.label}
                    </Label>
                  </div>
                  <Switch
                    id={`toggle-${section.id}`}
                    checked={visibility[section.id]}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Tips */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>💡 可摺疊不需要的區塊</p>
              <p>📊 圖表支援縮放與平移</p>
              <p>🖨️ 列印時自動展開</p>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Collapsed state - show icons */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-2 p-2 mt-2">
          {sections.map(section => (
            <Button
              key={section.id}
              variant={visibility[section.id] ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleSection(section.id)}
              title={section.label}
            >
              <section.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
