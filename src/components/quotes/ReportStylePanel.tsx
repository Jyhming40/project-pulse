import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image,
  Type,
  FileText,
  Settings2,
  LayoutList,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ReportStyleSettings,
  ReportTextContent,
  ReportTemplate,
  REPORT_TEMPLATES,
  ReportTemplateType,
} from "@/types/investmentReport";

interface ReportStylePanelProps {
  style: ReportStyleSettings;
  text: ReportTextContent;
  selectedTemplate: ReportTemplateType;
  companyLogo?: string | null;
  onStyleChange: (style: Partial<ReportStyleSettings>) => void;
  onTextChange: (text: Partial<ReportTextContent>) => void;
  onTemplateChange: (templateId: ReportTemplateType) => void;
}

export default function ReportStylePanel({
  style,
  text,
  selectedTemplate,
  companyLogo,
  onStyleChange,
  onTextChange,
  onTemplateChange,
}: ReportStylePanelProps) {
  const handleAddAdvantageItem = () => {
    onTextChange({
      advantageItems: [...text.advantageItems, ''],
    });
  };

  const handleRemoveAdvantageItem = (index: number) => {
    onTextChange({
      advantageItems: text.advantageItems.filter((_, i) => i !== index),
    });
  };

  const handleAdvantageItemChange = (index: number, value: string) => {
    const updated = [...text.advantageItems];
    updated[index] = value;
    onTextChange({ advantageItems: updated });
  };

  const handleAddRiskItem = () => {
    onTextChange({
      riskItems: [...text.riskItems, ''],
    });
  };

  const handleRemoveRiskItem = (index: number) => {
    onTextChange({
      riskItems: text.riskItems.filter((_, i) => i !== index),
    });
  };

  const handleRiskItemChange = (index: number, value: string) => {
    const updated = [...text.riskItems];
    updated[index] = value;
    onTextChange({ riskItems: updated });
  };

  return (
    <div className="space-y-4">
      {/* Template Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <LayoutList className="h-4 w-4" />
          報告範本
        </Label>
        <Select
          value={selectedTemplate}
          onValueChange={(v) => onTemplateChange(v as ReportTemplateType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex flex-col">
                  <span>{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <Tabs defaultValue="style" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="style" className="gap-1 text-xs">
            <Settings2 className="h-3 w-3" />
            樣式
          </TabsTrigger>
          <TabsTrigger value="sections" className="gap-1 text-xs">
            <LayoutList className="h-3 w-3" />
            區塊
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1 text-xs">
            <FileText className="h-3 w-3" />
            文案
          </TabsTrigger>
        </TabsList>

        {/* Style Tab */}
        <TabsContent value="style" className="space-y-4 mt-4">
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-4">
              {/* Logo Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <Label>Logo 設定</Label>
                </div>
                
                {companyLogo && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <img
                      src={companyLogo}
                      alt="Preview"
                      style={{ height: style.logoSize }}
                      className="object-contain"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      目前高度：{style.logoSize}px
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Logo 大小</Label>
                    <span className="text-xs text-muted-foreground">{style.logoSize}px</span>
                  </div>
                  <Slider
                    value={[style.logoSize]}
                    min={30}
                    max={100}
                    step={5}
                    onValueChange={([v]) => onStyleChange({ logoSize: v })}
                  />
                </div>
              </div>

              <Separator />

              {/* Typography Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <Label>字型大小設定</Label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">標題</Label>
                    <Select
                      value={String(style.titleFontSize)}
                      onValueChange={(v) => onStyleChange({ titleFontSize: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[18, 20, 22, 24, 26, 28].map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}px
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">副標題</Label>
                    <Select
                      value={String(style.subtitleFontSize)}
                      onValueChange={(v) => onStyleChange({ subtitleFontSize: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[12, 13, 14, 15, 16].map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}px
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">內文</Label>
                    <Select
                      value={String(style.bodyFontSize)}
                      onValueChange={(v) => onStyleChange({ bodyFontSize: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[11, 12, 13, 14].map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}px
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">表格</Label>
                    <Select
                      value={String(style.tableFontSize)}
                      onValueChange={(v) => onStyleChange({ tableFontSize: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 11, 12, 13].map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}px
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Header Text */}
              <div className="space-y-3">
                <Label>報告標頭</Label>
                <Input
                  placeholder="報告標題"
                  value={style.reportTitle}
                  onChange={(e) => onStyleChange({ reportTitle: e.target.value })}
                />
                <Input
                  placeholder="副標題（選填）"
                  value={style.reportSubtitle}
                  onChange={(e) => onStyleChange({ reportSubtitle: e.target.value })}
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Sections Tab */}
        <TabsContent value="sections" className="space-y-4 mt-4">
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI 智慧內容</Label>
                  <p className="text-xs text-muted-foreground">開場白、建議、風險評估</p>
                </div>
                <Switch
                  checked={style.showAIContent}
                  onCheckedChange={(v) => onStyleChange({ showAIContent: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>圖表視覺化</Label>
                  <p className="text-xs text-muted-foreground">現金流與 IRR 圖表</p>
                </div>
                <Switch
                  checked={style.showCharts}
                  onCheckedChange={(v) => onStyleChange({ showCharts: v })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>併內線靈活性說明</Label>
                  <p className="text-xs text-muted-foreground">T-REC 取得與電價風險</p>
                </div>
                <Switch
                  checked={style.showGridFlexibility}
                  onCheckedChange={(v) => onStyleChange({ showGridFlexibility: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>每度電成本計算</Label>
                  <p className="text-xs text-muted-foreground">LCOE 計算說明</p>
                </div>
                <Switch
                  checked={style.showLcoeCalculation}
                  onCheckedChange={(v) => onStyleChange({ showLcoeCalculation: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>T-REC 憑證估算</Label>
                  <p className="text-xs text-muted-foreground">三情境收益試算</p>
                </div>
                <Switch
                  checked={style.showTrec}
                  onCheckedChange={(v) => onStyleChange({ showTrec: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>電價敏感度分析</Label>
                  <p className="text-xs text-muted-foreground">不同成長率 IRR 變化</p>
                </div>
                <Switch
                  checked={style.showSensitivity}
                  onCheckedChange={(v) => onStyleChange({ showSensitivity: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>方案優勢與風險</Label>
                  <p className="text-xs text-muted-foreground">自訂優勢與注意事項</p>
                </div>
                <Switch
                  checked={style.showAdvantageRisk}
                  onCheckedChange={(v) => onStyleChange({ showAdvantageRisk: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>工程概要規格</Label>
                  <p className="text-xs text-muted-foreground">模組與逆變器規格</p>
                </div>
                <Switch
                  checked={style.showEngineeringSpecs}
                  onCheckedChange={(v) => onStyleChange({ showEngineeringSpecs: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>專案附圖</Label>
                  <p className="text-xs text-muted-foreground">自訂上傳圖片</p>
                </div>
                <Switch
                  checked={style.showCustomImages}
                  onCheckedChange={(v) => onStyleChange({ showCustomImages: v })}
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Text Tab */}
        <TabsContent value="text" className="space-y-4 mt-4">
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-4">
              {/* Grid Flexibility */}
              {style.showGridFlexibility && (
                <div className="space-y-2">
                  <Label>併內線靈活性說明</Label>
                  <Input
                    placeholder="標題"
                    value={text.gridFlexibilityTitle}
                    onChange={(e) => onTextChange({ gridFlexibilityTitle: e.target.value })}
                  />
                  <Textarea
                    placeholder="內容說明..."
                    value={text.gridFlexibilityContent}
                    onChange={(e) => onTextChange({ gridFlexibilityContent: e.target.value })}
                    rows={4}
                  />
                </div>
              )}

              {/* Advantages */}
              {style.showAdvantageRisk && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{text.advantageTitle || '方案優勢'}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddAdvantageItem}
                        className="h-7 gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        新增
                      </Button>
                    </div>
                    <Input
                      placeholder="優勢標題"
                      value={text.advantageTitle}
                      onChange={(e) => onTextChange({ advantageTitle: e.target.value })}
                      className="mb-2"
                    />
                    {text.advantageItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`優勢 ${index + 1}`}
                          value={item}
                          onChange={(e) => handleAdvantageItemChange(index, e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAdvantageItem(index)}
                          className="shrink-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Risks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{text.riskTitle || '須留意事項'}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddRiskItem}
                        className="h-7 gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        新增
                      </Button>
                    </div>
                    <Input
                      placeholder="風險標題"
                      value={text.riskTitle}
                      onChange={(e) => onTextChange({ riskTitle: e.target.value })}
                      className="mb-2"
                    />
                    {text.riskItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`風險 ${index + 1}`}
                          value={item}
                          onChange={(e) => handleRiskItemChange(index, e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRiskItem(index)}
                          className="shrink-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Conclusion */}
              <Separator />
              <div className="space-y-2">
                <Label>結論（選填）</Label>
                <Input
                  placeholder="結論標題"
                  value={text.conclusionTitle}
                  onChange={(e) => onTextChange({ conclusionTitle: e.target.value })}
                />
                <Textarea
                  placeholder="結論內容..."
                  value={text.conclusionContent}
                  onChange={(e) => onTextChange({ conclusionContent: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
