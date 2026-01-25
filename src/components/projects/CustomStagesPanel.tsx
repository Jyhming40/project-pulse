import { Settings2, ExternalLink, Layers, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useComparisonStages } from "@/hooks/useComparisonStages";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * CustomStagesPanel - 比較階段設定面板
 * 
 * 現在整合到「設定 → 流程」統一管理
 * 此面板改為顯示目前設定的摘要並導引用戶到設定頁面
 */
export function CustomStagesPanel() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { 
    customStages, 
    systemStages, 
    hasCustomStages,
    isLoading 
  } = useComparisonStages();

  const handleGoToSettings = () => {
    navigate('/settings', { state: { defaultTab: 'process' } });
  };

  return (
    <div className="space-y-3">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-auto py-2 px-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-sm font-medium">比較階段設定</span>
            </div>
            <div className="flex items-center gap-2">
              {hasCustomStages && (
                <Badge variant="secondary" className="text-xs">
                  <Database className="h-3 w-3 mr-1" />
                  {customStages.length} 自訂
                </Badge>
              )}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-2">
          {isLoading ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              載入中...
            </div>
          ) : (
            <>
              {/* DB Stages Summary */}
              {hasCustomStages && (
                <div className="space-y-1 px-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    已設定的比較區間：
                  </p>
                  {customStages.slice(0, 5).map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between py-1 text-sm"
                    >
                      <span className="truncate">{stage.label}</span>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        {stage.fromStep}→{stage.toStep}
                      </Badge>
                    </div>
                  ))}
                  {customStages.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      ...還有 {customStages.length - 5} 個
                    </p>
                  )}
                </div>
              )}

              {/* System Stages Info */}
              <div className="px-2">
                <p className="text-xs text-muted-foreground">
                  系統預設：{systemStages.length} 個階段
                </p>
              </div>

              {/* Integration Notice */}
              <Alert className="mx-2">
                <Layers className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  比較階段設定已整合至「設定 → 流程」頁面，
                  可在流程階段中設定「用於比較分析」的區間。
                </AlertDescription>
              </Alert>

              {/* Go to Settings Button */}
              <div className="px-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleGoToSettings}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  前往流程設定
                </Button>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
