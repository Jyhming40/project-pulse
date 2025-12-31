import { Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDuplicateScannerSettings, DuplicateScannerSettings } from '@/hooks/useDuplicateScannerSettings';

interface SettingSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

function SettingSlider({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  suffix = '%',
}: SettingSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
          {value}{suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

interface DuplicateScannerSettingsProps {
  onSettingsChange?: () => void;
}

export function DuplicateScannerSettingsPanel({ onSettingsChange }: DuplicateScannerSettingsProps) {
  const { settings, updateSetting, resetToDefaults, defaultSettings } = useDuplicateScannerSettings();

  const handleUpdate = <K extends keyof DuplicateScannerSettings>(
    key: K,
    value: DuplicateScannerSettings[K]
  ) => {
    updateSetting(key, value);
    onSettingsChange?.();
  };

  const handleReset = () => {
    resetToDefaults();
    onSettingsChange?.();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          掃描設定
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>重複偵測設定</SheetTitle>
          <SheetDescription>
            調整相似度門檻值以自訂重複偵測規則
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <Accordion type="single" collapsible defaultValue="exclusion" className="w-full">
            <AccordionItem value="exclusion">
              <AccordionTrigger className="text-sm font-medium">
                排除條件（Hard Exclude）
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pt-4">
                <SettingSlider
                  label="最低地址相似度"
                  description={`地址相似度低於此值，且名稱相似度也低於門檻時，直接排除（預設：${defaultSettings.minAddressSimilarity}%）`}
                  value={settings.minAddressSimilarity}
                  onChange={(v) => handleUpdate('minAddressSimilarity', v)}
                />
                <SettingSlider
                  label="最低名稱相似度"
                  description={`名稱相似度低於此值，且地址相似度也低於門檻時，直接排除（預設：${defaultSettings.minNameSimilarity}%）`}
                  value={settings.minNameSimilarity}
                  onChange={(v) => handleUpdate('minNameSimilarity', v)}
                />
                <SettingSlider
                  label="最大容量差距"
                  description={`容量差距超過此百分比時，直接排除（預設：${defaultSettings.maxCapacityDifference}%）`}
                  value={settings.maxCapacityDifference}
                  onChange={(v) => handleUpdate('maxCapacityDifference', v)}
                />
                <SettingSlider
                  label="最低地址 Token 重疊"
                  description={`地址關鍵詞（路名、段、地號）重疊率低於此值時排除（預設：${defaultSettings.minAddressTokenOverlap}%）`}
                  value={settings.minAddressTokenOverlap}
                  onChange={(v) => handleUpdate('minAddressTokenOverlap', v)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="medium">
              <AccordionTrigger className="text-sm font-medium">
                中可信度門檻
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pt-4">
                <SettingSlider
                  label="地址相似度門檻"
                  description={`地址相似度達到此值即可判定為中可信度（預設：${defaultSettings.mediumAddressThreshold}%）`}
                  value={settings.mediumAddressThreshold}
                  onChange={(v) => handleUpdate('mediumAddressThreshold', v)}
                />
                <SettingSlider
                  label="名稱相似度門檻"
                  description={`名稱相似度達到此值即可判定為中可信度（預設：${defaultSettings.mediumNameThreshold}%）`}
                  value={settings.mediumNameThreshold}
                  onChange={(v) => handleUpdate('mediumNameThreshold', v)}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-2">
            <p className="font-medium">說明</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• <strong>高可信度</strong>：案場編號完全相同，或投資方+年份+序號完全相同（皆非空）</li>
              <li>• <strong>中可信度</strong>：地址或名稱相似度達到門檻值</li>
              <li>• <strong>低可信度</strong>：同投資方且同鄉鎮市區且容量接近</li>
            </ul>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            重設為預設值
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
