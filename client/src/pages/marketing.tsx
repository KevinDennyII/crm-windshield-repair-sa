import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Megaphone,
  Send,
  Loader2,
  Copy,
  Check,
  Bot,
  User,
  MapPin,
  Pencil,
  Star,
  Briefcase,
  MessageSquare,
  Search,
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Trash2,
  RotateCcw,
  Hash,
  Mail,
  Phone,
  MousePointerClick,
  Eye,
  Zap,
  AlertCircle,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface CMOMessage {
  role: "user" | "assistant";
  content: string;
}

interface LeadSourceStat {
  source: string;
  count: number;
  label: string;
}

interface CampaignMetrics {
  id: string;
  name: string;
  status: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  conversionRate: number;
}

interface KeywordMetrics {
  keyword: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  qualityScore: number | null;
}

interface AccountOverview {
  totalClicks: number;
  totalImpressions: number;
  totalCost: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  costPerConversion: number;
}

const QUICK_ACTIONS = [
  {
    id: "google-ad",
    label: "Write Google Ad",
    icon: Search,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    prompt: "Write a high-converting Google Ads campaign for Windshield Repair SA. Include 3 responsive search ad variations with headlines (30 chars max each) and descriptions (90 chars max each). Target high-intent keywords like 'windshield repair San Antonio' and 'mobile auto glass replacement'. Emphasize our same-day service, mobile convenience, and lifetime warranty.",
  },
  {
    id: "sms-promo",
    label: "Draft Promo SMS",
    icon: MessageSquare,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    prompt: "Draft 3 promotional SMS messages (under 160 characters each) for Windshield Repair SA to send to past customers. Include: 1) A seasonal promotion, 2) A referral incentive, 3) A chip repair reminder. Each message should have a clear call-to-action and feel urgent but professional.",
  },
  {
    id: "email-campaign",
    label: "Email Campaign",
    icon: Mail,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    prompt: "Create an email marketing campaign for Windshield Repair SA targeting San Antonio vehicle owners. Include subject line, preview text, and full email body. Focus on the dangers of driving with a cracked windshield, our mobile service convenience, and a limited-time offer. Make it professional and compliance-ready.",
  },
  {
    id: "keywords",
    label: "Keyword Strategy",
    icon: Target,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    prompt: "Provide a comprehensive Google Ads keyword strategy for Windshield Repair SA in San Antonio. Include: 1) 15 high-intent keywords with estimated search volume, 2) 10 negative keywords to exclude, 3) 5 long-tail keywords for each San Antonio neighborhood (Stone Oak, Alamo Heights, Helotes, Shavano Park, Leon Valley). Organize by match type (exact, phrase, broad).",
  },
  {
    id: "social-post",
    label: "Social Media Post",
    icon: Hash,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    prompt: "Create platform-specific social media content for Windshield Repair SA: 1) TikTok: A script for a 15-second 'satisfying' chip repair video, 2) Facebook: A community safety post about cracked windshields for San Antonio parents, 3) Instagram: A carousel post idea showcasing before/after repairs, 4) X/Twitter: 3 real-time update posts about our mobile unit availability. Include relevant hashtags for each platform.",
  },
  {
    id: "review-response",
    label: "Review Response",
    icon: Star,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    prompt: "Draft professional Google review responses for Windshield Repair SA: 1) A response to a 5-star review thanking the customer and asking for referrals, 2) A response to a 3-star review acknowledging feedback and offering to make it right, 3) A response to a 1-star review that's empathetic and professional. Also draft a follow-up SMS template to send customers after job completion asking for a Google review with a direct link.",
  },
  {
    id: "fleet-proposal",
    label: "Fleet Proposal",
    icon: Briefcase,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    prompt: "Draft a B2B fleet partnership proposal for Windshield Repair SA targeting local San Antonio businesses (HVAC, plumbing, delivery companies). Include: 1) A cold email introduction, 2) Key value propositions (on-site service, fleet discounts, priority scheduling, lifetime warranty), 3) A pricing tier structure for 5+, 10+, and 20+ vehicle fleets, 4) A follow-up sequence of 3 emails. Make it professional and emphasize ROI for the fleet manager.",
  },
  {
    id: "local-seo",
    label: "Local SEO Tips",
    icon: MapPin,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    prompt: "Provide a detailed Local SEO optimization checklist for Windshield Repair SA's Google Business Profile. Include: 1) Profile completeness checklist, 2) Recommended categories and attributes, 3) Photo types to upload (exterior, team, work photos), 4) Post ideas for weekly GBP updates, 5) San Antonio-specific zip codes to add as service areas, 6) Tips for getting more reviews organically. Also suggest 5 local directory listings we should be on.",
  },
  {
    id: "competitor-analysis",
    label: "Competitor Analysis",
    icon: BarChart3,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    prompt: "Analyze the competitive landscape for auto glass services in San Antonio, TX. Provide: 1) Common pricing strategies competitors use, 2) Their likely Google Ads strategies and keywords, 3) Gaps in the market that Windshield Repair SA can exploit, 4) Differentiation strategies based on our mobile service and lifetime warranty, 5) Estimated Customer Acquisition Cost (CAC) benchmarks for the auto glass industry. Focus on how we can maintain a CAC below $85.",
  },
];

export default function Marketing() {
  const { toast } = useToast();
  const [chatMessages, setChatMessages] = useState<CMOMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [adsDateRange, setAdsDateRange] = useState("LAST_30_DAYS");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: leadStats = [] } = useQuery<LeadSourceStat[]>({
    queryKey: ["/api/marketing/lead-stats"],
  });

  const { data: marketingStats } = useQuery<{
    totalJobs: number;
    totalRevenue: number;
    avgJobValue: number;
    conversionRate: number;
  }>({
    queryKey: ["/api/marketing/stats"],
  });

  const { data: adsStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/marketing/google-ads/status"],
  });

  const { data: adsOverview, isLoading: loadingAdsOverview } = useQuery<AccountOverview>({
    queryKey: ["/api/marketing/google-ads/overview", adsDateRange],
    enabled: !!adsStatus?.configured,
  });

  const { data: adsCampaigns = [], isLoading: loadingCampaigns } = useQuery<CampaignMetrics[]>({
    queryKey: ["/api/marketing/google-ads/campaigns", adsDateRange],
    enabled: !!adsStatus?.configured,
  });

  const { data: adsKeywords = [], isLoading: loadingKeywords } = useQuery<KeywordMetrics[]>({
    queryKey: ["/api/marketing/google-ads/keywords", adsDateRange],
    enabled: !!adsStatus?.configured,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, streamingContent]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMessage: CMOMessage = { role: "user", content: content.trim() };
    setChatMessages((prev) => [...prev, userMessage]);
    setMessageInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/marketing/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: content.trim(),
          history: chatMessages,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullResponse += data.content;
                  setStreamingContent(fullResponse);
                }
                if (data.done) {
                  setChatMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: fullResponse },
                  ]);
                  setStreamingContent("");
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(messageInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(messageInput);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    setChatMessages([]);
    setStreamingContent("");
  };

  const LEAD_SOURCE_LABELS: Record<string, string> = {
    google_ads: "Google Ads",
    referral: "Referral",
    dealer: "Dealer",
    repeat: "Repeat Customer",
    subcontractor: "Subcontractor",
    facebook: "Facebook",
    website: "Website",
    phone: "Phone Call",
    walk_in: "Walk-in",
    insurance: "Insurance",
    fleet: "Fleet",
  };

  const LEAD_SOURCE_COLORS: Record<string, string> = {
    google_ads: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    referral: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    dealer: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    repeat: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    subcontractor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    facebook: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    website: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    phone: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    walk_in: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
    insurance: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    fleet: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-marketing-title">AI Marketing CMO</h1>
            <p className="text-sm text-muted-foreground">Your AI-powered Chief Marketing Officer for Windshield Repair SA</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="cmo" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList data-testid="tabs-marketing">
            <TabsTrigger value="cmo" data-testid="tab-cmo">
              <Bot className="h-4 w-4 mr-1" />
              AI CMO
            </TabsTrigger>
            <TabsTrigger value="google-ads" data-testid="tab-google-ads">
              <Search className="h-4 w-4 mr-1" />
              Google Ads
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads">
              <TrendingUp className="h-4 w-4 mr-1" />
              Lead Sources
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cmo" className="flex-1 flex flex-col overflow-hidden mt-0 px-4 pb-4">
          <div className="flex-1 flex gap-4 overflow-hidden pt-3">
            <div className="w-64 flex-shrink-0 hidden lg:flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1.5 pr-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={isStreaming}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors border ${action.bg} hover:opacity-80 disabled:opacity-50`}
                      data-testid={`button-quick-action-${action.id}`}
                    >
                      <action.icon className={`h-4 w-4 flex-shrink-0 ${action.color}`} />
                      <span className="font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">AI CMO Chat</span>
                  {chatMessages.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {chatMessages.filter((m) => m.role === "assistant").length} responses
                    </Badge>
                  )}
                </div>
                {chatMessages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChat}
                    className="h-7 text-xs text-muted-foreground"
                    data-testid="button-clear-chat"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {chatMessages.length === 0 && !streamingContent && (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                      <Megaphone className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">AI CMO Ready</h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-6">
                      I'm your AI Chief Marketing Officer for Windshield Repair SA. Ask me to write ad copy, 
                      plan campaigns, draft social posts, or strategize about growing your San Antonio market share.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center lg:hidden max-w-lg">
                      {QUICK_ACTIONS.slice(0, 6).map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          size="sm"
                          onClick={() => sendMessage(action.prompt)}
                          disabled={isStreaming}
                          className="text-xs"
                          data-testid={`button-mobile-quick-${action.id}`}
                        >
                          <action.icon className={`h-3.5 w-3.5 mr-1 ${action.color}`} />
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-lg px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 border"
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap" data-testid={`text-message-${i}`}>
                          {msg.content}
                        </div>
                        {msg.role === "assistant" && (
                          <div className="flex justify-end mt-2 pt-2 border-t border-border/40">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => copyToClipboard(msg.content, i)}
                              data-testid={`button-copy-${i}`}
                            >
                              {copiedIndex === i ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary flex-shrink-0 mt-1">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {streamingContent && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted/60 border">
                        <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating...
                        </div>
                      </div>
                    </div>
                  )}

                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="rounded-lg px-4 py-3 bg-muted/60 border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          AI CMO is thinking...
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <form onSubmit={handleSubmit} className="p-3 border-t bg-background/50">
                <div className="flex gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask your AI CMO anything... (e.g., 'Write a Google Ad for chip repair' or 'Draft a fleet proposal')"
                    className="min-h-[44px] max-h-[120px] resize-none text-sm"
                    disabled={isStreaming}
                    data-testid="input-cmo-message"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!messageInput.trim() || isStreaming}
                    className="h-[44px] w-[44px] flex-shrink-0"
                    data-testid="button-send-message"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="google-ads" className="flex-1 overflow-auto mt-0 px-4 pb-4">
          <div className="pt-3 space-y-4">
            {!adsStatus?.configured ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mx-auto mb-4">
                    <Settings className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Connect Google Ads</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                    To see real campaign data, connect your Google Ads account. You'll need your Developer Token, OAuth credentials, and Customer ID.
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 text-left max-w-md mx-auto space-y-2">
                    <p className="text-sm font-medium mb-2">Required credentials (add as Secrets):</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p data-testid="text-ads-setup-1">GOOGLE_ADS_CLIENT_ID - OAuth Client ID from Google Cloud Console</p>
                      <p data-testid="text-ads-setup-2">GOOGLE_ADS_CLIENT_SECRET - OAuth Client Secret</p>
                      <p data-testid="text-ads-setup-3">GOOGLE_ADS_DEVELOPER_TOKEN - From Google Ads API Center</p>
                      <p data-testid="text-ads-setup-4">GOOGLE_ADS_REFRESH_TOKEN - OAuth Refresh Token</p>
                      <p data-testid="text-ads-setup-5">GOOGLE_ADS_CUSTOMER_ID - Your 10-digit account number</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Google Ads Performance</h2>
                  <Select value={adsDateRange} onValueChange={setAdsDateRange}>
                    <SelectTrigger className="w-[180px]" data-testid="select-ads-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                      <SelectItem value="LAST_14_DAYS">Last 14 Days</SelectItem>
                      <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                      <SelectItem value="THIS_MONTH">This Month</SelectItem>
                      <SelectItem value="LAST_MONTH">Last Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loadingAdsOverview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : adsOverview ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <MousePointerClick className="h-4 w-4" />
                          <span className="text-xs font-medium">Clicks</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-clicks">
                          {adsOverview.totalClicks.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Eye className="h-4 w-4" />
                          <span className="text-xs font-medium">Impressions</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-impressions">
                          {adsOverview.totalImpressions.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">Total Spend</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-cost">
                          ${adsOverview.totalCost.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Zap className="h-4 w-4" />
                          <span className="text-xs font-medium">Conversions</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-conversions">
                          {adsOverview.totalConversions.toFixed(1)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">Avg CTR</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-ctr">
                          {adsOverview.avgCtr.toFixed(2)}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">Avg CPC</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-cpc">
                          ${adsOverview.avgCpc.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Target className="h-4 w-4" />
                          <span className="text-xs font-medium">Cost/Conversion</span>
                        </div>
                        <p className="text-2xl font-bold" data-testid="text-ads-cost-per-conv">
                          ${adsOverview.costPerConversion.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Megaphone className="h-5 w-5" />
                      Campaign Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingCampaigns ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : adsCampaigns.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No campaign data for this period.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">Campaign</th>
                              <th className="pb-2 pr-4 font-medium text-right">Status</th>
                              <th className="pb-2 pr-4 font-medium text-right">Clicks</th>
                              <th className="pb-2 pr-4 font-medium text-right">Impr.</th>
                              <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                              <th className="pb-2 pr-4 font-medium text-right">Conv.</th>
                              <th className="pb-2 pr-4 font-medium text-right">CTR</th>
                              <th className="pb-2 font-medium text-right">Avg CPC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adsCampaigns.map((campaign) => (
                              <tr key={campaign.id} className="border-b last:border-0" data-testid={`row-campaign-${campaign.id}`}>
                                <td className="py-2.5 pr-4 font-medium">{campaign.name}</td>
                                <td className="py-2.5 pr-4 text-right">
                                  <Badge
                                    variant={campaign.status === "ENABLED" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {campaign.status}
                                  </Badge>
                                </td>
                                <td className="py-2.5 pr-4 text-right">{campaign.clicks.toLocaleString()}</td>
                                <td className="py-2.5 pr-4 text-right">{campaign.impressions.toLocaleString()}</td>
                                <td className="py-2.5 pr-4 text-right">${campaign.cost.toFixed(2)}</td>
                                <td className="py-2.5 pr-4 text-right">{campaign.conversions.toFixed(1)}</td>
                                <td className="py-2.5 pr-4 text-right">{(campaign.ctr * 100).toFixed(2)}%</td>
                                <td className="py-2.5 text-right">${campaign.avgCpc.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-5 w-5" />
                      Top Keywords
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingKeywords ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : adsKeywords.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No keyword data for this period.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">Keyword</th>
                              <th className="pb-2 pr-4 font-medium">Match</th>
                              <th className="pb-2 pr-4 font-medium">Campaign</th>
                              <th className="pb-2 pr-4 font-medium text-right">Clicks</th>
                              <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                              <th className="pb-2 pr-4 font-medium text-right">Conv.</th>
                              <th className="pb-2 pr-4 font-medium text-right">CTR</th>
                              <th className="pb-2 font-medium text-right">QS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adsKeywords.map((kw, i) => (
                              <tr key={i} className="border-b last:border-0" data-testid={`row-keyword-${i}`}>
                                <td className="py-2.5 pr-4 font-medium">"{kw.keyword}"</td>
                                <td className="py-2.5 pr-4">
                                  <Badge variant="outline" className="text-xs">{kw.matchType}</Badge>
                                </td>
                                <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[150px]">{kw.campaignName}</td>
                                <td className="py-2.5 pr-4 text-right">{kw.clicks.toLocaleString()}</td>
                                <td className="py-2.5 pr-4 text-right">${kw.cost.toFixed(2)}</td>
                                <td className="py-2.5 pr-4 text-right">{kw.conversions.toFixed(1)}</td>
                                <td className="py-2.5 pr-4 text-right">{(kw.ctr * 100).toFixed(2)}%</td>
                                <td className="py-2.5 text-right">
                                  {kw.qualityScore !== null ? (
                                    <span className={kw.qualityScore >= 7 ? "text-green-600 dark:text-green-400 font-semibold" : kw.qualityScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
                                      {kw.qualityScore}/10
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">--</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leads" className="flex-1 overflow-auto mt-0 px-4 pb-4">
          <div className="pt-3 space-y-4">
            {marketingStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium">Total Jobs</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-jobs">{marketingStats.totalJobs}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Total Revenue</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-revenue">
                      ${(marketingStats.totalRevenue || 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs font-medium">Avg Job Value</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-avg-value">
                      ${(marketingStats.avgJobValue || 0).toFixed(0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-xs font-medium">Conversion Rate</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-conversion-rate">
                      {(marketingStats.conversionRate || 0).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Lead Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leadStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No lead source data yet. Tag your jobs with a lead source to see analytics here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leadStats.map((stat) => {
                      const maxCount = Math.max(...leadStats.map((s) => s.count));
                      const percentage = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
                      return (
                        <div key={stat.source} className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className={`min-w-[120px] justify-center text-xs ${
                              LEAD_SOURCE_COLORS[stat.source] || "bg-gray-100 text-gray-800"
                            }`}
                            data-testid={`badge-source-${stat.source}`}
                          >
                            {stat.label}
                          </Badge>
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold min-w-[40px] text-right" data-testid={`text-source-count-${stat.source}`}>
                            {stat.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
