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
  Sparkles
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

export default function AITools() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          AI Tools
        </h1>
        <p className="text-muted-foreground">
          AI-powered tools to help with customer communication and job management
        </p>
        <Badge variant="secondary" className="mt-2">
          Powered by OpenAI via Replit AI Integrations
        </Badge>
      </div>

      <Tabs defaultValue="assistant" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="assistant" className="flex items-center gap-2" data-testid="tab-assistant">
            <Bot className="h-4 w-4" />
            Chat Assistant
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex items-center gap-2" data-testid="tab-compose">
            <Mail className="h-4 w-4" />
            Message Composer
          </TabsTrigger>
          <TabsTrigger value="quote" className="flex items-center gap-2" data-testid="tab-quote">
            <FileText className="h-4 w-4" />
            Quote Generator
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex items-center gap-2" data-testid="tab-followup">
            <Lightbulb className="h-4 w-4" />
            Follow-up Suggester
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2" data-testid="tab-insurance">
            <Shield className="h-4 w-4" />
            Insurance Claims
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="h-[calc(100vh-280px)]">
          <ChatAssistant />
        </TabsContent>

        <TabsContent value="compose">
          <MessageComposer />
        </TabsContent>

        <TabsContent value="quote">
          <QuoteGenerator />
        </TabsContent>

        <TabsContent value="followup">
          <FollowUpSuggester />
        </TabsContent>

        <TabsContent value="insurance">
          <InsuranceClaimHelper />
        </TabsContent>
      </Tabs>
    </div>
  );
}
