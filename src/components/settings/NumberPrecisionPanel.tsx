import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useNumberPrecision, 
  DEFAULT_PRECISION, 
  PRECISION_FIELD_LABELS,
  NumberPrecisionConfig 
} from '@/hooks/useNumberPrecision';
import { 
  Hash, 
  RotateCcw, 
  Save, 
  DollarSign, 
  Percent, 
  Zap, 
  Calculator,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  '金額': <DollarSign className="h-4 w-4" />,
  '費率': <Percent className="h-4 w-4" />,
  '發電': <Zap className="h-4 w-4" />,
  '係數': <Calculator className="h-4 w-4" />,
  '其他': <Hash className="h-4 w-4" />,
};

export function NumberPrecisionPanel() {
  const { precisionConfig, isLoading, updatePrecision, isUpdating, resetToDefaults } = useNumberPrecision();
  const [localConfig, setLocalConfig] = useState<NumberPrecisionConfig>(DEFAULT_PRECISION);
  const [hasChanges, setHasChanges] = useState(false);

  // 同步遠端設定
  useEffect(() => {
    if (precisionConfig) {
      setLocalConfig(precisionConfig);
    }
  }, [precisionConfig]);

  // 檢查是否有變更
  useEffect(() => {
    const changed = Object.keys(localConfig).some(
      (key) => localConfig[key as keyof NumberPrecisionConfig] !== precisionConfig[key as keyof NumberPrecisionConfig]
    );
    setHasChanges(changed);
  }, [localConfig, precisionConfig]);

  const handleChange = (key: keyof NumberPrecisionConfig, value: string) => {
    const numValue = parseInt(value) || 0;
    // 限制範圍 0-6
    const clampedValue = Math.max(0, Math.min(6, numValue));
    setLocalConfig((prev) => ({ ...prev, [key]: clampedValue }));
  };

  const handleSave = () => {
    updatePrecision(localConfig);
  };

  const handleReset = () => {
    resetToDefaults();
    setLocalConfig(DEFAULT_PRECISION);
  };

  // 按類別分組
  const groupedFields = Object.entries(PRECISION_FIELD_LABELS).reduce((acc, [key, value]) => {
    if (!acc[value.category]) {
      acc[value.category] = [];
    }
    acc[value.category].push({ key: key as keyof NumberPrecisionConfig, ...value });
    return acc;
  }, {} as Record<string, Array<{ key: keyof NumberPrecisionConfig; label: string; description: string; category: string }>>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              數值顯示精度
            </CardTitle>
            <CardDescription className="mt-1">
              設定各類數值的小數位數顯示（0-6 位）
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                未儲存變更
              </Badge>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={isUpdating}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    還原預設
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">將所有精度設定還原為系統預設值</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isUpdating}
            >
              <Save className="h-4 w-4 mr-1" />
              儲存設定
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedFields).map(([category, fields], idx) => (
          <div key={category}>
            {idx > 0 && <Separator className="mb-4" />}
            <div className="flex items-center gap-2 mb-3">
              {CATEGORY_ICONS[category]}
              <h3 className="font-semibold text-sm">{category}類數值</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {fields.map(({ key, label, description }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={key} className="text-xs font-medium">
                      {label}
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-48">{description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={key}
                      type="number"
                      min={0}
                      max={6}
                      value={localConfig[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="h-8 w-16 text-center font-mono"
                    />
                    <span className="text-xs text-muted-foreground">位</span>
                    {localConfig[key] !== DEFAULT_PRECISION[key] && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        預設 {DEFAULT_PRECISION[key]}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 預覽區 */}
        <Separator />
        <div className="p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            格式預覽
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">新台幣金額：</span>
              <span className="font-mono ml-1">
                {new Intl.NumberFormat('zh-TW', {
                  style: 'currency',
                  currency: 'TWD',
                  minimumFractionDigits: localConfig.currency_twd,
                  maximumFractionDigits: localConfig.currency_twd,
                }).format(1234567.8901)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">電力費率：</span>
              <span className="font-mono ml-1">${(4.1234).toFixed(localConfig.rate_tariff)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">百分比：</span>
              <span className="font-mono ml-1">{(12.3456).toFixed(localConfig.rate_percent)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">發電度數：</span>
              <span className="font-mono ml-1">
                {(123456.7891).toLocaleString(undefined, {
                  minimumFractionDigits: localConfig.generation_kwh,
                  maximumFractionDigits: localConfig.generation_kwh,
                })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default NumberPrecisionPanel;
