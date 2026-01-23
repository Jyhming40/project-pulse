import { Eye, EyeOff, LineChart, BarChart3, Calendar, Info, Settings2, AlertOctagon, Calculator, Grid3X3, PanelRightClose, PanelRight, Scale, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SectionVisibility {
  chart: boolean;
  bottleneck: boolean;
  stats: boolean;
  analysis: boolean;
  dates: boolean;
  pairInfo: boolean;
}

export type ChartMode = "progress" | "duration-bar" | "heatmap";

interface ComparisonControlPanelProps {
  visibility: SectionVisibility;
  onVisibilityChange: (visibility: SectionVisibility) => void;
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
  // Dispute settings slot
  disputeSettingsSlot?: React.ReactNode;
  // Dispute display strategy slot
  disputeStrategySlot?: React.ReactNode;
  // Milestone settings slot
  milestoneSettingsSlot?: React.ReactNode;
}

const sections = [
  { id: "chart" as const, label: "圖表區", icon: LineChart },
  { id: "bottleneck" as const, label: "瓶頸階段識別", icon: AlertOctagon },
  { id: "stats" as const, label: "統計分析", icon: Calculator },
  { id: "analysis" as const, label: "階段耗時差異分析", icon: BarChart3 },
  { id: "dates" as const, label: "原始日期列表", icon: Calendar },
  { id: "pairInfo" as const, label: "比較區間說明", icon: Info },
];

const chartModes = [
  { id: "progress" as const, label: "進度曲線", icon: LineChart },
  { id: "duration-bar" as const, label: "耗時長條圖", icon: BarChart3 },
  { id: "heatmap" as const, label: "熱力圖", icon: Grid3X3 },
];

export function ComparisonControlPanel({
  visibility,
  onVisibilityChange,
  isCollapsed,
  onCollapseChange,
  chartMode,
  onChartModeChange,
  disputeSettingsSlot,
  disputeStrategySlot,
  milestoneSettingsSlot,
}: ComparisonControlPanelProps) {
  const toggleSection = (sectionId: keyof SectionVisibility) => {
    onVisibilityChange({
      ...visibility,
      [sectionId]: !visibility[sectionId],
    });
  };

  const allVisible = Object.values(visibility).every(Boolean);

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
        "bg-card border-l border-border flex flex-col transition-all duration-300 ease-in-out shrink-0",
        isCollapsed ? "w-12" : "w-80"
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onCollapseChange(!isCollapsed)}
          title={isCollapsed ? "展開控制面板" : "收合控制面板"}
        >
          {isCollapsed ? (
            <PanelRight className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">控制面板</span>
          </div>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-5">
            {/* Chart Mode Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                圖表模式
              </Label>
              <Tabs value={chartMode} onValueChange={(v) => onChartModeChange(v as ChartMode)}>
                <TabsList className="grid w-full grid-cols-3 h-auto">
                  {chartModes.map((mode) => (
                    <TabsTrigger
                      key={mode.id}
                      value={mode.id}
                      className="flex flex-col gap-1 py-2 text-xs"
                    >
                      <mode.icon className="h-4 w-4" />
                      <span>{mode.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <Separator />

            {/* Section Toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  顯示區塊
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={toggleAll}
                >
                  {allVisible ? "全部隱藏" : "全部顯示"}
                </Button>
              </div>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between py-1"
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
            </div>

            <Separator />

            {/* Dispute Settings Slot */}
            {disputeSettingsSlot && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5" />
                    爭議設定
                  </Label>
                  {disputeSettingsSlot}
                </div>
                <Separator />
              </>
            )}

            {/* Dispute Display Strategy Slot */}
            {disputeStrategySlot && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    爭議顯示策略
                  </Label>
                  {disputeStrategySlot}
                </div>
                <Separator />
              </>
            )}

            {/* Milestone Settings Slot */}
            {milestoneSettingsSlot && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="h-3.5 w-3.5" />
                    比較項目設定
                  </Label>
                  {milestoneSettingsSlot}
                </div>
                <Separator />
              </>
            )}

            {/* Tips */}
            <div className="text-xs text-muted-foreground space-y-1 pt-2">
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
          {chartModes.map((mode) => (
            <Button
              key={mode.id}
              variant={chartMode === mode.id ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onChartModeChange(mode.id)}
              title={mode.label}
            >
              <mode.icon className="h-4 w-4" />
            </Button>
          ))}
          <Separator className="my-1 w-6" />
          {sections.map((section) => (
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
