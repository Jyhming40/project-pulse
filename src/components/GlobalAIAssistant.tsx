import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bot,
  Send,
  X,
  Loader2,
  MessageSquare,
  Lightbulb,
  HelpCircle,
  FileText,
  Sparkles,
  Minimize2,
  Maximize2,
  Zap,
  CheckCircle,
  AlertCircle,
  XCircle,
  Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useAISettings } from "@/hooks/useAISettings";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  provider?: string;
}

// Route context mapping for AI awareness
const ROUTE_CONTEXT: Record<string, { name: string; description: string }> = {
  "/": { name: "儀表板", description: "專案進度總覽與待辦事項" },
  "/projects": { name: "專案列表", description: "所有太陽能專案的管理頁面" },
  "/documents": { name: "文件管理", description: "專案相關文件的上傳與管理" },
  "/quotes": { name: "報價管理", description: "報價單的建立與管理" },
  "/investors": { name: "投資人管理", description: "投資人資料與聯絡資訊" },
  "/partners": { name: "合作廠商", description: "施工與合作廠商管理" },
  "/settings": { name: "系統設定", description: "系統參數與設定" },
  "/engineering": { name: "工程管理", description: "系統維護與工程設定" },
};

// Quick action suggestions based on current page
const QUICK_ACTIONS: Record<string, string[]> = {
  "/": [
    "幫我摘要今日待辦事項",
    "分析目前專案進度風險",
    "有哪些專案需要特別注意？",
  ],
  "/projects": [
    "如何新增專案？",
    "專案狀態有哪些選項？",
    "如何批次更新專案？",
  ],
  "/quotes": [
    "如何建立報價單？",
    "報價單的成本如何計算？",
    "什麼是每kW單價？",
  ],
  "/documents": [
    "如何上傳文件？",
    "文件類型有哪些？",
    "文件狀態代表什麼意思？",
  ],
  "/investors": [
    "如何新增投資人？",
    "投資人編碼規則是什麼？",
  ],
  "/partners": [
    "如何管理合作廠商？",
    "廠商類型有哪些？",
  ],
  default: [
    "這個頁面可以做什麼？",
    "幫我說明操作方式",
    "有什麼功能可以用？",
  ],
};

// Mode types
type AssistantMode = "chat" | "summary" | "help";
type ProviderType = "gemini" | "openai" | "lovable";

const PROVIDER_LABELS: Record<ProviderType, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI ChatGPT",
  lovable: "Lovable Cloud AI",
};

const PROVIDER_SHORT_LABELS: Record<ProviderType, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  lovable: "Lovable",
};

export default function GlobalAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("chat");
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("lovable");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const { defaultProvider, geminiKey, openaiKey, isLoading: isLoadingSettings } = useAISettings();

  // Set initial provider from settings
  useEffect(() => {
    if (defaultProvider?.setting_value) {
      setSelectedProvider(defaultProvider.setting_value as ProviderType);
    }
  }, [defaultProvider]);

  // Get current route context
  const currentContext = ROUTE_CONTEXT[location.pathname] || 
    Object.entries(ROUTE_CONTEXT).find(([path]) => 
      location.pathname.startsWith(path) && path !== "/"
    )?.[1] || 
    { name: "頁面", description: "當前頁面" };

  const quickActions = QUICK_ACTIONS[location.pathname] || QUICK_ACTIONS.default;

  // Check if provider is available
  const isProviderAvailable = (provider: ProviderType): boolean => {
    if (provider === "lovable") return true;
    if (provider === "gemini") return geminiKey?.is_enabled && !!geminiKey?.setting_value;
    if (provider === "openai") return openaiKey?.is_enabled && !!openaiKey?.setting_value;
    return false;
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateId = () => Math.random().toString(36).substring(7);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build context-aware system prompt
      const systemContext = `你是 MQT Solar 系統的 AI 助理。使用者目前在「${currentContext.name}」頁面（${currentContext.description}）。
請根據使用者所在頁面提供相關的協助。回答要簡潔實用，使用繁體中文。
如果是操作問題，給出具體步驟。如果是資料分析，提供可執行的建議。`;

      const response = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: [
            { role: "system", content: systemContext },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
          currentPage: location.pathname,
          mode,
          selectedProvider,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: response.data?.content || "抱歉，我無法處理您的請求。請稍後再試。",
        timestamp: new Date(),
        provider: response.data?.provider,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Assistant error:", error);
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "抱歉，發生錯誤。請稍後再試或聯繫系統管理員。",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, currentContext, location.pathname, mode, selectedProvider]);

  const handleQuickAction = (action: string) => {
    handleSend(action);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const getModeIcon = (m: AssistantMode) => {
    switch (m) {
      case "summary":
        return <FileText className="h-4 w-4" />;
      case "help":
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getModeLabel = (m: AssistantMode) => {
    switch (m) {
      case "summary":
        return "摘要";
      case "help":
        return "指引";
      default:
        return "對話";
    }
  };

  const getProviderStatusIcon = (provider: ProviderType) => {
    if (provider === "lovable") {
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
    const available = isProviderAvailable(provider);
    if (available) {
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
    return <XCircle className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/80"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Bot className="h-6 w-6" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className={`p-0 border-0 shadow-2xl transition-all duration-300 ${
              isExpanded ? "w-[500px] h-[600px]" : "w-[380px] h-[500px]"
            }`}
          >
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI 助理
                    <Badge variant="secondary" className="text-xs">
                      {currentContext.name}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => setIsExpanded(!isExpanded)}
                    >
                      {isExpanded ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                {/* Settings Panel (collapsible) */}
                {showSettings && (
                  <div className="p-3 border-b bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">AI 模型</span>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Zap className="h-3 w-3" />
                        {PROVIDER_SHORT_LABELS[selectedProvider]}
                      </Badge>
                    </div>
                    <Select
                      value={selectedProvider}
                      onValueChange={(v) => setSelectedProvider(v as ProviderType)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="選擇 AI 模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["gemini", "openai", "lovable"] as ProviderType[]).map((provider) => {
                          const available = isProviderAvailable(provider);
                          return (
                            <SelectItem 
                              key={provider} 
                              value={provider}
                              disabled={!available && provider !== "lovable"}
                            >
                              <div className="flex items-center gap-2">
                                {getProviderStatusIcon(provider)}
                                <span>{PROVIDER_LABELS[provider]}</span>
                                {!available && provider !== "lovable" && (
                                  <span className="text-xs text-muted-foreground">(未設定)</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      可在「系統設定 &gt; 外部整合」設定 API 金鑰
                    </p>
                  </div>
                )}

                {/* Mode Selector */}
                <div className="flex gap-1 p-2 border-b bg-muted/30">
                  {(["chat", "summary", "help"] as AssistantMode[]).map((m) => (
                    <Button
                      key={m}
                      variant={mode === m ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => setMode(m)}
                    >
                      {getModeIcon(m)}
                      {getModeLabel(m)}
                    </Button>
                  ))}
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-3">
                  {messages.length === 0 ? (
                    <div className="space-y-4">
                      <div className="text-center text-muted-foreground text-sm py-4">
                        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>您好！我是 AI 助理</p>
                        <p className="text-xs mt-1">在「{currentContext.name}」頁面為您服務</p>
                        <p className="text-[10px] mt-2 flex items-center justify-center gap-1">
                          <Zap className="h-3 w-3" />
                          使用 {PROVIDER_LABELS[selectedProvider]}
                        </p>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">快速問題：</p>
                        <div className="flex flex-wrap gap-2">
                          {quickActions.map((action, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="text-xs h-auto py-1.5 px-2"
                              onClick={() => handleQuickAction(action)}
                            >
                              {action}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {message.role === "assistant" ? (
                              <div className="space-y-1">
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                </div>
                                {message.provider && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/50 mt-2">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    {message.provider === "gemini" && "Gemini"}
                                    {message.provider === "openai" && "OpenAI"}
                                    {message.provider === "lovable" && "Lovable AI"}
                                  </div>
                                )}
                              </div>
                            ) : (
                              message.content
                            )}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg px-3 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input Area */}
                <div className="p-3 border-t bg-background">
                  {messages.length > 0 && (
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={clearChat}
                      >
                        清除對話
                      </Button>
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="輸入問題或指令..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!input.trim() || isLoading}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
