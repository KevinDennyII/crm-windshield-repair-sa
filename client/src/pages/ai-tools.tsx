import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Send, 
  MessageSquare, 
  Mail, 
  FileText, 
  ClipboardList, 
  Lightbulb,
  Shield,
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check,
  User,
  Sparkles,
  Camera,
  Wrench,
  BarChart3,
  Calendar,
  TrendingUp,
  Users,
  Star,
  Phone,
  Languages,
  Brain,
  ThumbsUp,
  AlertTriangle,
  Clock,
  Package,
  DollarSign,
  Target,
  Award,
  Image,
  Upload
} from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

function ChatAssistant() {
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [includeCRMContext, setIncludeCRMContext] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/ai/conversations"],
  });

  const { data: currentConversation, isLoading: loadingMessages } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/ai/conversations", selectedConversation],
    enabled: !!selectedConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
      setSelectedConversation(data.id);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
      setSelectedConversation(null);
    },
  });

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isStreaming) return;

    const content = messageInput;
    setMessageInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/ai/conversations/${selectedConversation}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, includeCRMContext }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullContent += data.content;
              setStreamingContent(fullContent);
            }
            if (data.done) {
              queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", selectedConversation] });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentConversation?.messages, streamingContent]);

  const messages = currentConversation?.messages || [];

  return (
    <div className="flex h-full gap-4">
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="p-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Chats</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
              data-testid="button-new-chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {loadingConversations ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">No chats yet</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer hover-elevate ${
                      selectedConversation === conv.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedConversation(conv.id)}
                    data-testid={`chat-item-${conv.id}`}
                  >
                    <span className="text-sm truncate flex-1">{conv.title}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationMutation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-chat-${conv.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="p-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">AI Assistant</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Include CRM data</Label>
              <Button
                size="sm"
                variant={includeCRMContext ? "default" : "outline"}
                onClick={() => setIncludeCRMContext(!includeCRMContext)}
                data-testid="toggle-crm-context"
              >
                {includeCRMContext ? "On" : "Off"}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {!selectedConversation ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <Bot className="h-12 w-12" />
              <p>Select or create a chat to get started</p>
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="max-w-[80%] p-3 rounded-lg bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {selectedConversation && (
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Ask about jobs, customers, or get help writing messages..."
                className="resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                data-testid="input-chat-message"
              />
              <Button
                onClick={sendMessage}
                disabled={isStreaming || !messageInput.trim()}
                data-testid="button-send-message"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function MessageComposer() {
  const { toast } = useToast();
  const [messageType, setMessageType] = useState<"email" | "sms">("email");
  const [customerName, setCustomerName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState("professional and friendly");
  const [jobContext, setJobContext] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/generate-message", {
        messageType,
        customerName,
        purpose,
        tone,
        jobContext,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedMessage(data.message);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate message", variant: "destructive" });
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Message Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Message Type</Label>
            <Select value={messageType} onValueChange={(v) => setMessageType(v as "email" | "sms")}>
              <SelectTrigger data-testid="select-message-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Smith"
              data-testid="input-customer-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Purpose</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Confirm appointment for tomorrow, Follow up on quote..."
              rows={2}
              data-testid="input-purpose"
            />
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger data-testid="select-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional and friendly">Professional & Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Job Context (optional)</Label>
            <Textarea
              value={jobContext}
              onChange={(e) => setJobContext(e.target.value)}
              placeholder="e.g., Windshield replacement scheduled for Monday at 10am..."
              rows={2}
              data-testid="input-job-context"
            />
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !purpose}
            className="w-full"
            data-testid="button-generate-message"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Message
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Generated Message</CardTitle>
            {generatedMessage && (
              <Button size="sm" variant="outline" onClick={copyToClipboard} data-testid="button-copy-message">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {generatedMessage ? (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{generatedMessage}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">Fill in the details and generate a message</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuoteGenerator() {
  const { toast } = useToast();
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [glassType, setGlassType] = useState("Windshield");
  const [serviceType, setServiceType] = useState("Replacement");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [generatedQuote, setGeneratedQuote] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/generate-quote", {
        vehicleInfo,
        glassType,
        serviceType,
        additionalNotes,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedQuote(data.description);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate quote", variant: "destructive" });
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedQuote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quote Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Information</Label>
            <Input
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
              placeholder="e.g., 2022 Toyota Camry SE"
              data-testid="input-vehicle-info"
            />
          </div>

          <div className="space-y-2">
            <Label>Glass Type</Label>
            <Select value={glassType} onValueChange={setGlassType}>
              <SelectTrigger data-testid="select-glass-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Windshield">Windshield</SelectItem>
                <SelectItem value="Front Door">Front Door Glass</SelectItem>
                <SelectItem value="Rear Door">Rear Door Glass</SelectItem>
                <SelectItem value="Back Glass">Back Glass</SelectItem>
                <SelectItem value="Quarter Glass">Quarter Glass</SelectItem>
                <SelectItem value="Vent Glass">Vent Glass</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Service Type</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger data-testid="select-service-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Replacement">Replacement</SelectItem>
                <SelectItem value="Repair">Chip/Crack Repair</SelectItem>
                <SelectItem value="Calibration">ADAS Calibration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g., Rain sensor, heated, acoustic..."
              rows={2}
              data-testid="input-additional-notes"
            />
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full"
            data-testid="button-generate-quote"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Quote Description
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Generated Description</CardTitle>
            {generatedQuote && (
              <Button size="sm" variant="outline" onClick={copyToClipboard} data-testid="button-copy-quote">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {generatedQuote ? (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{generatedQuote}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">Enter vehicle details to generate a quote description</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FollowUpSuggester() {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState("");

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/suggest-followups", {});
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get suggestions", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Follow-up Suggestions
            </CardTitle>
            <CardDescription>
              AI analyzes your CRM data to identify leads and jobs needing attention
            </CardDescription>
          </div>
          <Button
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            data-testid="button-get-suggestions"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analyze CRM
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions ? (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{suggestions}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mb-2" />
            <p className="text-sm">Click "Analyze CRM" to get follow-up suggestions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsuranceClaimHelper() {
  const { toast } = useToast();
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [glassType, setGlassType] = useState("Windshield");
  const [causeOfLoss, setCauseOfLoss] = useState("");
  const [dateOfLoss, setDateOfLoss] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/generate-claim-description", {
        vehicleInfo,
        glassType,
        causeOfLoss,
        dateOfLoss,
        additionalDetails,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedDescription(data.description);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate description", variant: "destructive" });
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Claim Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Information</Label>
            <Input
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
              placeholder="e.g., 2022 Toyota Camry SE"
              data-testid="input-claim-vehicle"
            />
          </div>

          <div className="space-y-2">
            <Label>Glass Type</Label>
            <Select value={glassType} onValueChange={setGlassType}>
              <SelectTrigger data-testid="select-claim-glass-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Windshield">Windshield</SelectItem>
                <SelectItem value="Front Door">Front Door Glass</SelectItem>
                <SelectItem value="Rear Door">Rear Door Glass</SelectItem>
                <SelectItem value="Back Glass">Back Glass</SelectItem>
                <SelectItem value="Quarter Glass">Quarter Glass</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cause of Loss</Label>
            <Input
              value={causeOfLoss}
              onChange={(e) => setCauseOfLoss(e.target.value)}
              placeholder="e.g., Road debris, vandalism, hail..."
              data-testid="input-cause-of-loss"
            />
          </div>

          <div className="space-y-2">
            <Label>Date of Loss</Label>
            <Input
              type="date"
              value={dateOfLoss}
              onChange={(e) => setDateOfLoss(e.target.value)}
              data-testid="input-date-of-loss"
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Details</Label>
            <Textarea
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Any additional information about the damage..."
              rows={2}
              data-testid="input-claim-details"
            />
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full"
            data-testid="button-generate-claim"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Claim Description
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Claim Description</CardTitle>
            {generatedDescription && (
              <Button size="sm" variant="outline" onClick={copyToClipboard} data-testid="button-copy-claim">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {generatedDescription ? (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{generatedDescription}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Shield className="h-8 w-8 mb-2" />
              <p className="text-sm">Enter claim details to generate a description</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== NEW COMMUNICATION INTELLIGENCE TOOLS ==========

function SmartReply() {
  const { toast } = useToast();
  const [originalMessage, setOriginalMessage] = useState("");
  const [context, setContext] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/smart-reply", { originalMessage, context });
      return res.json();
    },
    onSuccess: (data) => setSuggestions(data.suggestions),
    onError: () => toast({ title: "Error", description: "Failed to generate replies", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Customer Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Original Message</Label>
            <Textarea
              value={originalMessage}
              onChange={(e) => setOriginalMessage(e.target.value)}
              placeholder="Paste the customer's message here..."
              rows={4}
              data-testid="input-original-message"
            />
          </div>
          <div className="space-y-2">
            <Label>Context (optional)</Label>
            <Input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Quote for windshield, $350"
              data-testid="input-reply-context"
            />
          </div>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !originalMessage} className="w-full" data-testid="button-smart-reply">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Reply Options
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Reply Suggestions</CardTitle>
            {suggestions && (
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(suggestions); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {suggestions ? (
            <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{suggestions}</p></div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">Paste a customer message to get reply suggestions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConversationSummary() {
  const { toast } = useToast();
  const [conversationText, setConversationText] = useState("");
  const [summary, setSummary] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/summarize-conversation", { messages: conversationText });
      return res.json();
    },
    onSuccess: (data) => setSummary(data.summary),
    onError: () => toast({ title: "Error", description: "Failed to summarize", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Email/SMS Thread</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={conversationText} onChange={(e) => setConversationText(e.target.value)} placeholder="Paste the full conversation thread here..." rows={10} data-testid="input-conversation-text" />
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !conversationText} className="w-full" data-testid="button-summarize-conversation">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Summarize Thread
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent>
          {summary ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{summary}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><ClipboardList className="h-8 w-8 mb-2" /><p className="text-sm">Paste a conversation to summarize it</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SentimentAnalysis() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze-sentiment", { text });
      return res.json();
    },
    onSuccess: (data) => setAnalysis(data),
    onError: () => toast({ title: "Error", description: "Failed to analyze", variant: "destructive" }),
  });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "bg-green-500";
      case "negative": return "bg-red-500";
      case "frustrated": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />Customer Message</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste customer message to analyze sentiment..." rows={6} data-testid="input-sentiment-text" />
          <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || !text} className="w-full" data-testid="button-analyze-sentiment">
            {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analyze Sentiment
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Analysis Results</CardTitle></CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={getSentimentColor(analysis.sentiment)}>{analysis.sentiment?.toUpperCase()}</Badge>
                <Badge variant="outline">Urgency: {analysis.urgency?.toUpperCase()}</Badge>
              </div>
              {analysis.emotions && <div className="flex flex-wrap gap-2">{analysis.emotions.map((e: string, i: number) => <Badge key={i} variant="secondary">{e}</Badge>)}</div>}
              <div className="p-4 bg-muted rounded-lg"><p className="text-sm">{analysis.summary || analysis.recommendedAction}</p></div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Brain className="h-8 w-8 mb-2" /><p className="text-sm">Paste a message to analyze sentiment</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpanishTranslation() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [translation, setTranslation] = useState("");
  const [copied, setCopied] = useState(false);

  const translateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/translate", { text, targetLanguage });
      return res.json();
    },
    onSuccess: (data) => setTranslation(data.translation),
    onError: () => toast({ title: "Error", description: "Failed to translate", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5" />Original Text</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Spanish">English to Spanish</SelectItem>
              <SelectItem value="English">Spanish to English</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to translate..." rows={6} data-testid="input-translate-text" />
          <Button onClick={() => translateMutation.mutate()} disabled={translateMutation.isPending || !text} className="w-full" data-testid="button-translate">
            {translateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Languages className="h-4 w-4 mr-2" />}
            Translate
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Translation</CardTitle>
            {translation && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(translation); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {translation ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{translation}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Languages className="h-8 w-8 mb-2" /><p className="text-sm">Enter text to translate</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== TECHNICIAN TOOLS ==========

function DamageAssessment() {
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [assessment, setAssessment] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImagePreview(result);
        setImageBase64(result.split(",")[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const assessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/assess-damage", { imageBase64 });
      return res.json();
    },
    onSuccess: (data) => setAssessment(data.assessment),
    onError: () => toast({ title: "Error", description: "Failed to assess damage", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" />Upload Damage Photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="damage-upload" data-testid="input-damage-upload" />
            <label htmlFor="damage-upload" className="cursor-pointer">
              {imagePreview ? (
                <img src={imagePreview} alt="Damage" className="max-h-48 mx-auto rounded" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p>Click to upload damage photo</p>
                </div>
              )}
            </label>
          </div>
          <Button onClick={() => assessMutation.mutate()} disabled={assessMutation.isPending || !imageBase64} className="w-full" data-testid="button-assess-damage">
            {assessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Assess Damage
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Assessment Results</CardTitle></CardHeader>
        <CardContent>
          {assessment ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{assessment}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Camera className="h-8 w-8 mb-2" /><p className="text-sm">Upload a photo to get damage assessment</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InstallationGuide() {
  const { toast } = useToast();
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [glassType, setGlassType] = useState("Windshield");
  const [guide, setGuide] = useState("");

  const getMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/installation-guide", { year, make, model, glassType });
      return res.json();
    },
    onSuccess: (data) => setGuide(data.guide),
    onError: () => toast({ title: "Error", description: "Failed to get guide", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />Vehicle Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" data-testid="input-guide-year" />
            <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" data-testid="input-guide-make" />
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" data-testid="input-guide-model" />
          </div>
          <Select value={glassType} onValueChange={setGlassType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Windshield">Windshield</SelectItem>
              <SelectItem value="Front Door">Front Door Glass</SelectItem>
              <SelectItem value="Rear Door">Rear Door Glass</SelectItem>
              <SelectItem value="Back Glass">Back Glass</SelectItem>
              <SelectItem value="Quarter Glass">Quarter Glass</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => getMutation.mutate()} disabled={getMutation.isPending || !year || !make || !model} className="w-full" data-testid="button-get-guide">
            {getMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wrench className="h-4 w-4 mr-2" />}
            Get Installation Guide
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Installation Guide</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {guide ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{guide}</p></div> : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Wrench className="h-8 w-8 mb-2" /><p className="text-sm">Enter vehicle details for installation guide</p></div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SafetyVerification() {
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [jobType, setJobType] = useState("windshield replacement");
  const [verification, setVerification] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImagePreview(result);
        setImageBase64(result.split(",")[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/verify-completion", { imageBase64, jobType });
      return res.json();
    },
    onSuccess: (data) => setVerification(data.verification),
    onError: () => toast({ title: "Error", description: "Failed to verify", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ThumbsUp className="h-5 w-5" />Completion Photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={jobType} onValueChange={setJobType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="windshield replacement">Windshield Replacement</SelectItem>
              <SelectItem value="door glass replacement">Door Glass Replacement</SelectItem>
              <SelectItem value="back glass replacement">Back Glass Replacement</SelectItem>
              <SelectItem value="chip repair">Chip Repair</SelectItem>
            </SelectContent>
          </Select>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="completion-upload" data-testid="input-completion-upload" />
            <label htmlFor="completion-upload" className="cursor-pointer">
              {imagePreview ? <img src={imagePreview} alt="Completion" className="max-h-48 mx-auto rounded" /> : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload className="h-8 w-8" /><p>Upload completion photo</p></div>
              )}
            </label>
          </div>
          <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending || !imageBase64} className="w-full" data-testid="button-verify-completion">
            {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
            Verify Quality
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Quality Verification</CardTitle></CardHeader>
        <CardContent>
          {verification ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{verification}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><ThumbsUp className="h-8 w-8 mb-2" /><p className="text-sm">Upload completion photo to verify quality</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PhotoAnalysis() {
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImagePreview(result);
        setImageBase64(result.split(",")[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze-photo", { imageBase64 });
      return res.json();
    },
    onSuccess: (data) => setAnalysis(data.analysis),
    onError: () => toast({ title: "Error", description: "Failed to analyze", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" />Damage Photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="photo-analysis-upload" data-testid="input-photo-analysis" />
            <label htmlFor="photo-analysis-upload" className="cursor-pointer">
              {imagePreview ? <img src={imagePreview} alt="Photo" className="max-h-48 mx-auto rounded" /> : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground"><Upload className="h-8 w-8" /><p>Upload photo for analysis</p></div>
              )}
            </label>
          </div>
          <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || !imageBase64} className="w-full" data-testid="button-analyze-photo">
            {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Image className="h-4 w-4 mr-2" />}
            Analyze: Repair vs Replace
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Repair/Replace Analysis</CardTitle></CardHeader>
        <CardContent>
          {analysis ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{analysis}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Image className="h-8 w-8 mb-2" /><p className="text-sm">Upload a damage photo for repair vs replace analysis</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== BUSINESS INTELLIGENCE ==========

function WinLossAnalysis() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<any>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/win-loss-analysis", {});
      return res.json();
    },
    onSuccess: (data) => setAnalysis(data),
    onError: () => toast({ title: "Error", description: "Failed to analyze", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Win/Loss Analysis</CardTitle>
            <CardDescription>Understand why quotes convert or get lost</CardDescription>
          </div>
          <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} data-testid="button-win-loss">
            {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {analysis ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center"><p className="text-2xl font-bold">{analysis.stats?.total || 0}</p><p className="text-sm text-muted-foreground">Total Jobs</p></div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center"><p className="text-2xl font-bold text-green-600">{analysis.stats?.won || 0}</p><p className="text-sm text-muted-foreground">Won</p></div>
              <div className="p-4 bg-red-500/10 rounded-lg text-center"><p className="text-2xl font-bold text-red-600">{analysis.stats?.lost || 0}</p><p className="text-sm text-muted-foreground">Lost</p></div>
              <div className="p-4 bg-blue-500/10 rounded-lg text-center"><p className="text-2xl font-bold text-blue-600">{analysis.stats?.conversionRate || 0}%</p><p className="text-sm text-muted-foreground">Conversion</p></div>
            </div>
            <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{analysis.analysis}</p></div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Target className="h-8 w-8 mb-2" /><p className="text-sm">Click Analyze to see win/loss patterns</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueForecast() {
  const { toast } = useToast();
  const [forecast, setForecast] = useState<any>(null);

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/revenue-forecast", {});
      return res.json();
    },
    onSuccess: (data) => setForecast(data),
    onError: () => toast({ title: "Error", description: "Failed to forecast", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Revenue Forecast</CardTitle>
            <CardDescription>Predict weekly/monthly revenue based on pipeline</CardDescription>
          </div>
          <Button onClick={() => forecastMutation.mutate()} disabled={forecastMutation.isPending} data-testid="button-revenue-forecast">
            {forecastMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Forecast
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {forecast ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-500/10 rounded-lg text-center"><p className="text-2xl font-bold text-green-600">${forecast.data?.completedRevenue?.toFixed(0) || 0}</p><p className="text-sm text-muted-foreground">Last 30 Days</p></div>
              <div className="p-4 bg-blue-500/10 rounded-lg text-center"><p className="text-2xl font-bold text-blue-600">${forecast.data?.pipelineTotal?.toFixed(0) || 0}</p><p className="text-sm text-muted-foreground">In Pipeline</p></div>
              <div className="p-4 bg-muted rounded-lg text-center"><p className="text-2xl font-bold">${forecast.data?.weeklyAverage?.toFixed(0) || 0}</p><p className="text-sm text-muted-foreground">Weekly Avg</p></div>
            </div>
            <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{forecast.forecast}</p></div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><TrendingUp className="h-8 w-8 mb-2" /><p className="text-sm">Click Forecast to predict revenue</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function ChurnPrediction() {
  const { toast } = useToast();
  const [prediction, setPrediction] = useState<any>(null);

  const predictMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/churn-prediction", {});
      return res.json();
    },
    onSuccess: (data) => setPrediction(data),
    onError: () => toast({ title: "Error", description: "Failed to predict", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Customer Churn Prediction</CardTitle>
            <CardDescription>Identify customers unlikely to return</CardDescription>
          </div>
          <Button onClick={() => predictMutation.mutate()} disabled={predictMutation.isPending} data-testid="button-churn-prediction">
            {predictMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {prediction ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center"><p className="text-2xl font-bold">{prediction.stats?.totalCustomers || 0}</p><p className="text-sm text-muted-foreground">Total Customers</p></div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center"><p className="text-2xl font-bold text-green-600">{prediction.stats?.repeatCustomers || 0}</p><p className="text-sm text-muted-foreground">Repeat Customers</p></div>
            </div>
            <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{prediction.prediction}</p></div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Users className="h-8 w-8 mb-2" /><p className="text-sm">Click Analyze to identify churn risks</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function BestContactTime() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const getMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/best-contact-time", { phone, email });
      return res.json();
    },
    onSuccess: (data) => setRecommendation(data.recommendation),
    onError: () => toast({ title: "Error", description: "Failed to get recommendation", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Customer Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" data-testid="input-contact-phone" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" data-testid="input-contact-email" />
          <Button onClick={() => getMutation.mutate()} disabled={getMutation.isPending || (!phone && !email)} className="w-full" data-testid="button-best-time">
            {getMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
            Get Best Time
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recommendation</CardTitle></CardHeader>
        <CardContent>
          {recommendation ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{recommendation}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Clock className="h-8 w-8 mb-2" /><p className="text-sm">Enter customer info to get best contact time</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompetitorAnalysis() {
  const { toast } = useToast();
  const [competitorData, setCompetitorData] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/competitor-analysis", { competitorData });
      return res.json();
    },
    onSuccess: (data) => setAnalysis(data),
    onError: () => toast({ title: "Error", description: "Failed to analyze", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Competitor Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={competitorData} onChange={(e) => setCompetitorData(e.target.value)} placeholder="Enter competitor pricing info (optional)..." rows={6} data-testid="input-competitor-data" />
          <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} className="w-full" data-testid="button-competitor-analysis">
            {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
            Analyze Pricing
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Analysis</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {analysis ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{analysis.analysis}</p></div> : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><BarChart3 className="h-8 w-8 mb-2" /><p className="text-sm">Click Analyze to compare pricing</p></div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== OPERATIONS ==========

function SmartScheduling() {
  const { toast } = useToast();
  const [customerAddress, setCustomerAddress] = useState("");
  const [jobComplexity, setJobComplexity] = useState("Standard");
  const [suggestions, setSuggestions] = useState("");

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/smart-schedule", { customerAddress, jobComplexity });
      return res.json();
    },
    onSuccess: (data) => setSuggestions(data.suggestions),
    onError: () => toast({ title: "Error", description: "Failed to get suggestions", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Job Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Customer address" data-testid="input-schedule-address" />
          <Select value={jobComplexity} onValueChange={setJobComplexity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Simple">Simple (chip repair)</SelectItem>
              <SelectItem value="Standard">Standard (windshield)</SelectItem>
              <SelectItem value="Complex">Complex (back glass, calibration)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending} className="w-full" data-testid="button-smart-schedule">
            {scheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
            Get Scheduling Suggestions
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Scheduling Suggestions</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {suggestions ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{suggestions}</p></div> : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Calendar className="h-8 w-8 mb-2" /><p className="text-sm">Enter job details for scheduling suggestions</p></div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PartsPrediction() {
  const { toast } = useToast();
  const [prediction, setPrediction] = useState<any>(null);

  const predictMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/predict-parts", {});
      return res.json();
    },
    onSuccess: (data) => setPrediction(data),
    onError: () => toast({ title: "Error", description: "Failed to predict", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Parts Prediction</CardTitle>
            <CardDescription>Predict which parts to stock based on job history</CardDescription>
          </div>
          <Button onClick={() => predictMutation.mutate()} disabled={predictMutation.isPending} data-testid="button-parts-prediction">
            {predictMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Predict
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {prediction ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{prediction.predictions}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Package className="h-8 w-8 mb-2" /><p className="text-sm">Click Predict to see inventory recommendations</p></div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function JobTimeEstimation() {
  const { toast } = useToast();
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [glassType, setGlassType] = useState("Windshield");
  const [serviceType, setServiceType] = useState("Replacement");
  const [estimate, setEstimate] = useState("");

  const estimateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/estimate-time", { year, make, model, glassType, serviceType });
      return res.json();
    },
    onSuccess: (data) => setEstimate(data.estimate),
    onError: () => toast({ title: "Error", description: "Failed to estimate", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Job Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" data-testid="input-time-year" />
            <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" data-testid="input-time-make" />
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" data-testid="input-time-model" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={glassType} onValueChange={setGlassType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Windshield">Windshield</SelectItem>
                <SelectItem value="Front Door">Front Door</SelectItem>
                <SelectItem value="Rear Door">Rear Door</SelectItem>
                <SelectItem value="Back Glass">Back Glass</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Replacement">Replacement</SelectItem>
                <SelectItem value="Repair">Repair</SelectItem>
                <SelectItem value="Calibration">Calibration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => estimateMutation.mutate()} disabled={estimateMutation.isPending} className="w-full" data-testid="button-estimate-time">
            {estimateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
            Estimate Time
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Time Estimate</CardTitle></CardHeader>
        <CardContent>
          {estimate ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{estimate}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Clock className="h-8 w-8 mb-2" /><p className="text-sm">Enter job details for time estimate</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== SALES & MARKETING ==========

function UpsellSuggestions() {
  const { toast } = useToast();
  const [currentServices, setCurrentServices] = useState("");
  const [suggestions, setSuggestions] = useState("");

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/upsell-suggestions", { currentServices });
      return res.json();
    },
    onSuccess: (data) => setSuggestions(data.suggestions),
    onError: () => toast({ title: "Error", description: "Failed to get suggestions", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Current Services</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={currentServices} onChange={(e) => setCurrentServices(e.target.value)} placeholder="e.g., Windshield replacement" data-testid="input-current-services" />
          <Button onClick={() => suggestMutation.mutate()} disabled={suggestMutation.isPending} className="w-full" data-testid="button-upsell">
            {suggestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
            Get Upsell Ideas
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Upsell Opportunities</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {suggestions ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{suggestions}</p></div> : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><DollarSign className="h-8 w-8 mb-2" /><p className="text-sm">Enter current services for upsell ideas</p></div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewResponseGenerator() {
  const { toast } = useToast();
  const [reviewText, setReviewText] = useState("");
  const [starRating, setStarRating] = useState("5");
  const [customerName, setCustomerName] = useState("");
  const [responseText, setResponseText] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/generate-review-response", { reviewText, starRating: parseInt(starRating), customerName });
      return res.json();
    },
    onSuccess: (data) => setResponseText(data.response),
    onError: () => toast({ title: "Error", description: "Failed to generate", variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Review Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" data-testid="input-review-name" />
          <Select value={starRating} onValueChange={setStarRating}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Paste the customer review..." rows={4} data-testid="input-review-text" />
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !reviewText} className="w-full" data-testid="button-review-response">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Response
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Response</CardTitle>
            {responseText && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(responseText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {responseText ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{responseText}</p></div> : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Star className="h-8 w-8 mb-2" /><p className="text-sm">Paste a review to generate a response</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== QUALITY & TRAINING ==========

function SatisfactionPrediction() {
  const { toast } = useToast();
  const [prediction, setPrediction] = useState("");

  const predictMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/predict-satisfaction", {});
      return res.json();
    },
    onSuccess: (data) => setPrediction(data.prediction),
    onError: () => toast({ title: "Error", description: "Failed to predict", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><ThumbsUp className="h-5 w-5" />Customer Satisfaction Prediction</CardTitle>
            <CardDescription>Predict satisfaction before job is complete</CardDescription>
          </div>
          <Button onClick={() => predictMutation.mutate()} disabled={predictMutation.isPending} data-testid="button-satisfaction">
            {predictMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {prediction ? <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{prediction}</p></div> : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><ThumbsUp className="h-8 w-8 mb-2" /><p className="text-sm">Click Analyze to predict satisfaction risks</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function CSRCoaching() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("7");
  const [coaching, setCoaching] = useState<any>(null);

  const coachMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/csr-coaching", { dateRange: parseInt(dateRange) });
      return res.json();
    },
    onSuccess: (data) => setCoaching(data),
    onError: () => toast({ title: "Error", description: "Failed to get coaching", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />CSR Performance Coaching</CardTitle>
            <CardDescription>AI-powered performance insights and coaching</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => coachMutation.mutate()} disabled={coachMutation.isPending} data-testid="button-csr-coaching">
              {coachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Analyze
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {coaching ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg text-center"><p className="text-2xl font-bold">{coaching.totalActivities}</p><p className="text-sm text-muted-foreground">Total Activities</p></div>
              <div className="p-4 bg-muted rounded-lg"><p className="text-sm whitespace-pre-wrap">{coaching.coaching}</p></div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Award className="h-8 w-8 mb-2" /><p className="text-sm">Click Analyze for performance coaching</p></div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function CallTranscription() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" />Phone Call Transcription</CardTitle>
        <CardDescription>Automatically transcribe and summarize customer calls</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-lg">
          <AlertTriangle className="h-8 w-8 mb-2 text-yellow-500" />
          <p className="text-sm font-medium">Coming Soon</p>
          <p className="text-sm text-center mt-2">Phone call transcription requires Twilio voice recording integration.</p>
          <p className="text-sm text-center">Contact your administrator to enable this feature.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AITools() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          AI Tools
        </h1>
        <p className="text-muted-foreground">
          AI-powered tools to help with customer communication, technician work, and business intelligence
        </p>
        <Badge variant="secondary" className="mt-2">
          Powered by OpenAI via Replit AI Integrations
        </Badge>
      </div>

      <Tabs defaultValue="assistant" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="assistant" className="flex items-center gap-2" data-testid="tab-assistant">
            <Bot className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex items-center gap-2" data-testid="tab-compose">
            <Mail className="h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="communication" className="flex items-center gap-2" data-testid="tab-communication">
            <MessageSquare className="h-4 w-4" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="technician" className="flex items-center gap-2" data-testid="tab-technician">
            <Wrench className="h-4 w-4" />
            Technician
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2" data-testid="tab-intelligence">
            <BarChart3 className="h-4 w-4" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-2" data-testid="tab-operations">
            <Calendar className="h-4 w-4" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2" data-testid="tab-sales">
            <DollarSign className="h-4 w-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2" data-testid="tab-quality">
            <Award className="h-4 w-4" />
            Quality
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="h-[calc(100vh-280px)]">
          <ChatAssistant />
        </TabsContent>

        <TabsContent value="compose" className="space-y-6">
          <Tabs defaultValue="message">
            <TabsList>
              <TabsTrigger value="message">Message Composer</TabsTrigger>
              <TabsTrigger value="quote">Quote Generator</TabsTrigger>
              <TabsTrigger value="followup">Follow-up Suggester</TabsTrigger>
              <TabsTrigger value="insurance">Insurance Claims</TabsTrigger>
            </TabsList>
            <TabsContent value="message" className="mt-4"><MessageComposer /></TabsContent>
            <TabsContent value="quote" className="mt-4"><QuoteGenerator /></TabsContent>
            <TabsContent value="followup" className="mt-4"><FollowUpSuggester /></TabsContent>
            <TabsContent value="insurance" className="mt-4"><InsuranceClaimHelper /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          <Tabs defaultValue="smart-reply">
            <TabsList>
              <TabsTrigger value="smart-reply">Smart Reply</TabsTrigger>
              <TabsTrigger value="summary">Conversation Summary</TabsTrigger>
              <TabsTrigger value="sentiment">Sentiment Analysis</TabsTrigger>
              <TabsTrigger value="translate">Translation</TabsTrigger>
              <TabsTrigger value="transcription">Call Transcription</TabsTrigger>
            </TabsList>
            <TabsContent value="smart-reply" className="mt-4"><SmartReply /></TabsContent>
            <TabsContent value="summary" className="mt-4"><ConversationSummary /></TabsContent>
            <TabsContent value="sentiment" className="mt-4"><SentimentAnalysis /></TabsContent>
            <TabsContent value="translate" className="mt-4"><SpanishTranslation /></TabsContent>
            <TabsContent value="transcription" className="mt-4"><CallTranscription /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="technician" className="space-y-6">
          <Tabs defaultValue="damage">
            <TabsList>
              <TabsTrigger value="damage">Damage Assessment</TabsTrigger>
              <TabsTrigger value="guide">Installation Guide</TabsTrigger>
              <TabsTrigger value="safety">Safety Verification</TabsTrigger>
              <TabsTrigger value="photo">Photo Analysis</TabsTrigger>
            </TabsList>
            <TabsContent value="damage" className="mt-4"><DamageAssessment /></TabsContent>
            <TabsContent value="guide" className="mt-4"><InstallationGuide /></TabsContent>
            <TabsContent value="safety" className="mt-4"><SafetyVerification /></TabsContent>
            <TabsContent value="photo" className="mt-4"><PhotoAnalysis /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6">
          <Tabs defaultValue="winloss">
            <TabsList>
              <TabsTrigger value="winloss">Win/Loss Analysis</TabsTrigger>
              <TabsTrigger value="revenue">Revenue Forecast</TabsTrigger>
              <TabsTrigger value="churn">Churn Prediction</TabsTrigger>
              <TabsTrigger value="contact">Best Contact Time</TabsTrigger>
              <TabsTrigger value="competitor">Competitor Analysis</TabsTrigger>
            </TabsList>
            <TabsContent value="winloss" className="mt-4"><WinLossAnalysis /></TabsContent>
            <TabsContent value="revenue" className="mt-4"><RevenueForecast /></TabsContent>
            <TabsContent value="churn" className="mt-4"><ChurnPrediction /></TabsContent>
            <TabsContent value="contact" className="mt-4"><BestContactTime /></TabsContent>
            <TabsContent value="competitor" className="mt-4"><CompetitorAnalysis /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <Tabs defaultValue="schedule">
            <TabsList>
              <TabsTrigger value="schedule">Smart Scheduling</TabsTrigger>
              <TabsTrigger value="parts">Parts Prediction</TabsTrigger>
              <TabsTrigger value="time">Job Time Estimation</TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="mt-4"><SmartScheduling /></TabsContent>
            <TabsContent value="parts" className="mt-4"><PartsPrediction /></TabsContent>
            <TabsContent value="time" className="mt-4"><JobTimeEstimation /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <Tabs defaultValue="upsell">
            <TabsList>
              <TabsTrigger value="upsell">Upsell Suggestions</TabsTrigger>
              <TabsTrigger value="review">Review Responses</TabsTrigger>
            </TabsList>
            <TabsContent value="upsell" className="mt-4"><UpsellSuggestions /></TabsContent>
            <TabsContent value="review" className="mt-4"><ReviewResponseGenerator /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <Tabs defaultValue="satisfaction">
            <TabsList>
              <TabsTrigger value="satisfaction">Satisfaction Prediction</TabsTrigger>
              <TabsTrigger value="coaching">CSR Coaching</TabsTrigger>
            </TabsList>
            <TabsContent value="satisfaction" className="mt-4"><SatisfactionPrediction /></TabsContent>
            <TabsContent value="coaching" className="mt-4"><CSRCoaching /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
