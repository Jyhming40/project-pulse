import { useState } from 'react';
import { 
  Brain, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAISettings } from '@/hooks/useAISettings';

export function AISettingsPanel() {
  const { 
    geminiKey, 
    openaiKey, 
    defaultProvider, 
    isLoading, 
    updateSetting, 
    isUpdating 
  } = useAISettings();

  const [geminiValue, setGeminiValue] = useState('');
  const [openaiValue, setOpenaiValue] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [editingGemini, setEditingGemini] = useState(false);
  const [editingOpenai, setEditingOpenai] = useState(false);

  const handleSaveGemini = () => {
    if (!geminiValue.trim()) return;
    updateSetting({ 
      settingKey: 'gemini_api_key', 
      value: geminiValue.trim(),
      isEnabled: true 
    });
    setEditingGemini(false);
    setGeminiValue('');
  };

  const handleSaveOpenai = () => {
    if (!openaiValue.trim()) return;
    updateSetting({ 
      settingKey: 'openai_api_key', 
      value: openaiValue.trim(),
      isEnabled: true 
    });
    setEditingOpenai(false);
    setOpenaiValue('');
  };

  const handleToggleGemini = (enabled: boolean) => {
    updateSetting({ settingKey: 'gemini_api_key', isEnabled: enabled });
  };

  const handleToggleOpenai = (enabled: boolean) => {
    updateSetting({ settingKey: 'openai_api_key', isEnabled: enabled });
  };

  const handleChangeProvider = (provider: string) => {
    updateSetting({ settingKey: 'default_ai_provider', value: provider });
  };

  const handleClearKey = (key: 'gemini_api_key' | 'openai_api_key') => {
    updateSetting({ settingKey: key, value: null, isEnabled: false });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasGeminiKey = !!geminiKey?.setting_value;
  const hasOpenaiKey = !!openaiKey?.setting_value;
  const currentProvider = defaultProvider?.setting_value || 'gemini';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI 服務設定
          </CardTitle>
          <CardDescription>
            設定 AI 洞察報告所使用的 API 金鑰，支援 Google Gemini 與 OpenAI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Provider Selection */}
          <div className="space-y-2">
            <Label>預設 AI 服務</Label>
            <Select value={currentProvider} onValueChange={handleChangeProvider}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Google Gemini
                  </span>
                </SelectItem>
                <SelectItem value="openai">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-green-500" />
                    OpenAI ChatGPT
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              選擇用於生成 AI 洞察報告的預設服務
            </p>
          </div>

          {/* Gemini API Key */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Google Gemini</span>
                {hasGeminiKey ? (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30">
                    <CheckCircle2 className="w-3 h-3" />
                    已設定
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <XCircle className="w-3 h-3" />
                    未設定
                  </Badge>
                )}
              </div>
              {hasGeminiKey && (
                <Switch
                  checked={geminiKey?.is_enabled ?? false}
                  onCheckedChange={handleToggleGemini}
                  disabled={isUpdating}
                />
              )}
            </div>

            {editingGemini ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showGemini ? 'text' : 'password'}
                      placeholder="輸入 Gemini API Key"
                      value={geminiValue}
                      onChange={(e) => setGeminiValue(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowGemini(!showGemini)}
                    >
                      {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveGemini} disabled={isUpdating || !geminiValue.trim()}>
                    <Save className="w-4 h-4 mr-1" />
                    儲存
                  </Button>
                  <Button variant="outline" onClick={() => setEditingGemini(false)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingGemini(true)}
                >
                  {hasGeminiKey ? '更新金鑰' : '設定金鑰'}
                </Button>
                {hasGeminiKey && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleClearKey('gemini_api_key')}
                  >
                    清除
                  </Button>
                )}
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                  取得 API Key
                </a>
              </div>
            )}
          </div>

          {/* OpenAI API Key */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-500" />
                <span className="font-medium">OpenAI ChatGPT</span>
                {hasOpenaiKey ? (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30">
                    <CheckCircle2 className="w-3 h-3" />
                    已設定
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <XCircle className="w-3 h-3" />
                    未設定
                  </Badge>
                )}
              </div>
              {hasOpenaiKey && (
                <Switch
                  checked={openaiKey?.is_enabled ?? false}
                  onCheckedChange={handleToggleOpenai}
                  disabled={isUpdating}
                />
              )}
            </div>

            {editingOpenai ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showOpenai ? 'text' : 'password'}
                      placeholder="輸入 OpenAI API Key"
                      value={openaiValue}
                      onChange={(e) => setOpenaiValue(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowOpenai(!showOpenai)}
                    >
                      {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveOpenai} disabled={isUpdating || !openaiValue.trim()}>
                    <Save className="w-4 h-4 mr-1" />
                    儲存
                  </Button>
                  <Button variant="outline" onClick={() => setEditingOpenai(false)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingOpenai(true)}
                >
                  {hasOpenaiKey ? '更新金鑰' : '設定金鑰'}
                </Button>
                {hasOpenaiKey && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleClearKey('openai_api_key')}
                  >
                    清除
                  </Button>
                )}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                  取得 API Key
                </a>
              </div>
            )}
          </div>

          <Alert>
            <Brain className="w-4 h-4" />
            <AlertDescription className="text-xs">
              API 金鑰將安全儲存於資料庫中。設定完成後，AI 洞察報告將使用您選擇的服務進行分析。
              若兩個服務都已設定，系統會使用「預設 AI 服務」的設定。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
