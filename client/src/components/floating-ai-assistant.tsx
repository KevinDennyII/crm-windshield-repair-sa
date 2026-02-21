import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAIContext } from "@/contexts/ai-context";
import {
  Bot,
  Send,
  X,
  Loader2,
  Plus,
  User,
  Sparkles,
  Mail,
  FileText,
  ClipboardList,
  Calendar,
  DollarSign,
  MessageSquare,
  Maximize2,
  Minimize2,
  Briefcase,
} from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: typeof Mail;
}

const pageContextMap: Record<string, { title: string; actions: QuickAction[] }> = {
  "/": {
    title: "Pipeline",
    actions: [
      { label: "Follow-up suggestions", prompt: "What leads should I follow up on today? Give me the top priorities.", icon: ClipboardList },
      { label: "Pipeline summary", prompt: "Give me a summary of my current pipeline - how many jobs at each stage and total value.", icon: FileText },
      { label: "Draft intro email", prompt: "Draft a professional introduction email for a new auto glass lead.", icon: Mail },
    ],
  },
  "/opportunities": {
    title: "Pipeline",
    actions: [
      { label: "Follow-up suggestions", prompt: "What leads should I follow up on today? Give me the top priorities.", icon: ClipboardList },
      { label: "Pipeline summary", prompt: "Give me a summary of my current pipeline - how many jobs at each stage and total value.", icon: FileText },
      { label: "Draft intro email", prompt: "Draft a professional introduction email for a new auto glass lead.", icon: Mail },
    ],
  },
  "/payments": {
    title: "Payments",
    actions: [
      { label: "Payment reminder", prompt: "Draft a friendly payment reminder email for an outstanding balance.", icon: DollarSign },
      { label: "Receipt explanation", prompt: "Help me explain a receipt to a customer who has questions about charges.", icon: FileText },
      { label: "Collection follow-up", prompt: "Draft a professional but firm follow-up for an overdue payment.", icon: Mail },
    ],
  },
  "/dashboard": {
    title: "Dashboard",
    actions: [
      { label: "Revenue insights", prompt: "Analyze my revenue trends and suggest ways to improve.", icon: DollarSign },
      { label: "Performance summary", prompt: "Give me a quick summary of key business metrics and areas needing attention.", icon: FileText },
      { label: "Weekly report", prompt: "Help me create a weekly business report for management.", icon: ClipboardList },
    ],
  },
  "/conversations": {
    title: "Conversations",
    actions: [
      { label: "Smart reply", prompt: "Help me draft a professional response to a customer inquiry.", icon: MessageSquare },
      { label: "Summarize thread", prompt: "Summarize this conversation thread and key action items.", icon: FileText },
      { label: "Translate message", prompt: "Translate this message to Spanish for a customer.", icon: Mail },
    ],
  },
  "/calendar": {
    title: "Calendar",
    actions: [
      { label: "Schedule suggestion", prompt: "Suggest the best time slots for appointments this week based on my current schedule.", icon: Calendar },
      { label: "Appointment reminder", prompt: "Draft an appointment reminder message for a customer.", icon: MessageSquare },
      { label: "Reschedule email", prompt: "Draft a professional email to reschedule an appointment.", icon: Mail },
    ],
  },
  "/contacts": {
    title: "Contacts",
    actions: [
      { label: "Customer outreach", prompt: "Draft a follow-up email to reconnect with a past customer.", icon: Mail },
      { label: "Thank you note", prompt: "Write a thank you message for a loyal customer.", icon: MessageSquare },
      { label: "Referral request", prompt: "Draft a message asking a satisfied customer for referrals.", icon: ClipboardList },
    ],
  },
  "/reporting": {
    title: "Reports",
    actions: [
      { label: "Analyze trends", prompt: "Help me understand patterns in my business data.", icon: FileText },
      { label: "Profitability tips", prompt: "Suggest ways to improve job profitability based on typical auto glass business metrics.", icon: DollarSign },
      { label: "CSR performance", prompt: "How should I evaluate CSR performance based on activity data?", icon: ClipboardList },
    ],
  },
};

const defaultActions: QuickAction[] = [
  { label: "Draft email", prompt: "Help me draft a professional email for a customer.", icon: Mail },
  { label: "Generate quote", prompt: "Help me create a quote description for an auto glass job.", icon: FileText },
  { label: "Follow-up ideas", prompt: "What are best practices for following up with auto glass leads?", icon: ClipboardList },
];

export function FloatingAIAssistant() {
  const { toast } = useToast();
  const [location] = useLocation();
  const { selectedEntity } = useAIContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentPage = pageContextMap[location] || { title: "CRM", actions: defaultActions };
  
  const getEntityActions = (): QuickAction[] => {
    if (!selectedEntity.type || !selectedEntity.name) return [];
    
    const entityName = selectedEntity.name;
    switch (selectedEntity.type) {
      case "job":
        return [
          { label: `Summarize ${entityName}`, prompt: `Give me a summary of job "${entityName}" including customer info, vehicle details, and current status.`, icon: FileText },
          { label: "Draft completion email", prompt: `Draft a job completion email for job "${entityName}" thanking the customer.`, icon: Mail },
          { label: "Generate invoice notes", prompt: `Generate professional invoice notes for job "${entityName}".`, icon: ClipboardList },
        ];
      case "lead":
        return [
          { label: `Follow up on ${entityName}`, prompt: `Help me write a follow-up message for lead "${entityName}".`, icon: Mail },
          { label: "Create quote", prompt: `Help me create a quote for lead "${entityName}".`, icon: FileText },
          { label: "Best contact approach", prompt: `What's the best way to approach lead "${entityName}" to close the deal?`, icon: ClipboardList },
        ];
      case "contact":
        return [
          { label: `Email ${entityName}`, prompt: `Draft a professional email for customer "${entityName}".`, icon: Mail },
          { label: "Service history", prompt: `What's the service history for customer "${entityName}"?`, icon: FileText },
          { label: "Referral request", prompt: `Draft a referral request message for customer "${entityName}".`, icon: ClipboardList },
        ];
      case "conversation":
        const source = selectedEntity.details?.source || "email";
        return [
          { label: "Summarize thread", prompt: `Summarize this ${source} conversation with "${entityName}" including key points and any action items.`, icon: FileText },
          { label: "Draft reply", prompt: `Help me draft a professional reply to "${entityName}" in this ${source} conversation.`, icon: Mail },
          { label: "Analyze sentiment", prompt: `Analyze the sentiment and tone of this conversation with "${entityName}". Is the customer satisfied, frustrated, or neutral?`, icon: ClipboardList },
        ];
      default:
        return [];
    }
  };
  
  const entityActions = getEntityActions();
  const hasEntityContext = entityActions.length > 0;

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/ai/conversations"],
    enabled: isOpen,
  });

  const { data: currentConversation } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/ai/conversations", selectedConversation],
    enabled: !!selectedConversation && isOpen,
  });

  const sendMessage = async (content?: string) => {
    const messageContent = content || messageInput.trim();
    if (!messageContent || isStreaming) return;

    if (!selectedConversation) {
      const res = await apiRequest("POST", "/api/ai/conversations", { title: `Chat - ${currentPage.title}` });
      const newConv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations"] });
      setSelectedConversation(newConv.id);
      await sendMessageToConversation(newConv.id, messageContent);
    } else {
      await sendMessageToConversation(selectedConversation, messageContent);
    }
  };

  const sendMessageToConversation = async (conversationId: string, content: string) => {
    setMessageInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, includeCRMContext: true }),
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
              queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", conversationId] });
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
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [currentConversation?.messages, streamingContent]);

  const messages = currentConversation?.messages || [];

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  const startNewChat = () => {
    setSelectedConversation(null);
    setMessageInput("");
    setStreamingContent("");
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full shadow-lg"
          data-testid="button-ai-assistant-open"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  const panelWidth = isExpanded ? "w-[500px]" : "w-[380px]";
  const panelHeight = isExpanded ? "h-[600px]" : "h-[500px]";

  return (
    <div
      className={`fixed bottom-6 right-6 ${panelWidth} ${panelHeight} bg-background border rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden`}
      data-testid="panel-ai-assistant"
    >
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-primary text-primary-foreground flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Bot className="h-5 w-5" />
          <span className="font-medium">AI Assistant</span>
          <Badge variant="secondary" className="text-xs">
            {currentPage.title}
          </Badge>
          {hasEntityContext && (
            <Badge variant="outline" className="text-xs bg-background/20 border-background/40">
              <Briefcase className="h-3 w-3 mr-1" />
              {selectedEntity.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="icon"
            variant="secondary"
            onClick={startNewChat}
            data-testid="button-ai-new-chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-ai-expand"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setIsOpen(false)}
            data-testid="button-ai-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!selectedConversation && messages.length === 0 && !isStreaming ? (
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
          <div className="text-center">
            <Sparkles className="h-10 w-10 mx-auto text-primary mb-2" />
            <h3 className="font-medium">How can I help?</h3>
            <p className="text-sm text-muted-foreground">
              {hasEntityContext 
                ? `Actions for ${selectedEntity.name}`
                : `Quick actions for ${currentPage.title}`
              }
            </p>
          </div>

          {hasEntityContext && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">For this {selectedEntity.type}:</p>
              {entityActions.map((action, index) => (
                <Button
                  key={`entity-${index}`}
                  variant="default"
                  className="w-full justify-start gap-2"
                  onClick={() => handleQuickAction(action)}
                  disabled={isStreaming}
                  data-testid={`button-entity-action-${index}`}
                >
                  <action.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-left truncate">{action.label}</span>
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {hasEntityContext && (
              <p className="text-xs text-muted-foreground font-medium">General actions:</p>
            )}
            {currentPage.actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => handleQuickAction(action)}
                disabled={isStreaming}
                data-testid={`button-quick-action-${index}`}
              >
                <action.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-left">{action.label}</span>
              </Button>
            ))}
          </div>

          {conversations.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Recent chats</p>
              <div className="space-y-1">
                {conversations.slice(0, 3).map((conv) => (
                  <Button
                    key={conv.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedConversation(conv.id)}
                    data-testid={`button-recent-chat-${conv.id}`}
                  >
                    <MessageSquare className="h-3 w-3 mr-2" />
                    <span className="truncate">{conv.title}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3" ref={scrollContainerRef}>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-wrap gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {isStreaming && streamingContent && (
              <div className="flex flex-wrap gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted">
                  <div className="whitespace-pre-wrap">{streamingContent}</div>
                </div>
              </div>
            )}
            {isStreaming && !streamingContent && (
              <div className="flex flex-wrap gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-3 border-t">
        <div className="flex flex-wrap gap-2">
          <Textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Ask me anything..."
            className="min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isStreaming}
            data-testid="input-ai-message"
          />
          <Button
            size="icon"
            onClick={() => sendMessage()}
            disabled={!messageInput.trim() || isStreaming}
            data-testid="button-ai-send"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
