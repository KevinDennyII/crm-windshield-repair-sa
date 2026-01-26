import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  MessageSquare,
  Phone,
  Send,
  RefreshCw,
  Search,
  User,
  Clock,
  ChevronRight,
  Inbox,
  Facebook,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Job } from "@shared/schema";

interface EmailThread {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messages: EmailMessage[];
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isFromMe: boolean;
}

interface ConversationContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  source: "email" | "sms" | "facebook" | "instagram";
  jobId?: string;
}

export default function Conversations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<EmailThread | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");

  const { data: emailThreads, isLoading: loadingEmails, refetch: refetchEmails } = useQuery<EmailThread[]>({
    queryKey: ["/api/emails/inbox"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const sendReplyMutation = useMutation({
    mutationFn: async ({ threadId, to, subject, body }: { threadId: string; to: string; subject: string; body: string }) => {
      return apiRequest("POST", "/api/emails/reply", { threadId, to, subject, body });
    },
    onSuccess: () => {
      toast({ title: "Reply sent successfully" });
      setReplyText("");
      refetchEmails();
    },
    onError: () => {
      toast({ title: "Failed to send reply", variant: "destructive" });
    },
  });

  const findMatchingJob = (email: string, phone?: string): Job | undefined => {
    if (!jobs) return undefined;
    return jobs.find(job => 
      job.email?.toLowerCase() === email.toLowerCase() ||
      (phone && job.phone === phone)
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleSendReply = () => {
    if (!selectedConversation || !replyText.trim()) return;
    
    sendReplyMutation.mutate({
      threadId: selectedConversation.threadId,
      to: selectedConversation.fromEmail,
      subject: `Re: ${selectedConversation.subject}`,
      body: replyText,
    });
  };

  const filteredThreads = emailThreads?.filter(thread => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        thread.from.toLowerCase().includes(query) ||
        thread.subject.toLowerCase().includes(query) ||
        thread.snippet.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-background flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground">
            Manage all customer communications in one place
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchEmails()}
          disabled={loadingEmails}
          data-testid="button-refresh-conversations"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loadingEmails && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r flex flex-col bg-muted/30">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-conversations"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-4 px-2 pt-2">
              <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
                <Inbox className="h-3 w-3 mr-1" />
                All
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs" data-testid="tab-email">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="text-xs" data-testid="tab-sms">
                <MessageSquare className="h-3 w-3 mr-1" />
                SMS
              </TabsTrigger>
              <TabsTrigger value="social" className="text-xs" data-testid="tab-social">
                <Facebook className="h-3 w-3 mr-1" />
                Social
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <ConversationList
                  threads={filteredThreads}
                  selectedId={selectedConversation?.id}
                  onSelect={setSelectedConversation}
                  formatDate={formatDate}
                  findMatchingJob={findMatchingJob}
                  isLoading={loadingEmails}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="email" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <ConversationList
                  threads={filteredThreads}
                  selectedId={selectedConversation?.id}
                  onSelect={setSelectedConversation}
                  formatDate={formatDate}
                  findMatchingJob={findMatchingJob}
                  isLoading={loadingEmails}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sms" className="flex-1 m-0 p-4">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium text-muted-foreground">SMS Not Connected</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Connect Twilio to send and receive text messages
                </p>
                <Badge variant="secondary" className="mt-3">Coming Soon</Badge>
              </div>
            </TabsContent>

            <TabsContent value="social" className="flex-1 m-0 p-4">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="flex gap-2 mb-3">
                  <Facebook className="h-8 w-8 text-muted-foreground/50" />
                  <Instagram className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-medium text-muted-foreground">Social Not Connected</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Connect Facebook & Instagram to manage leads
                </p>
                <Badge variant="secondary" className="mt-3">Coming Soon</Badge>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b bg-background flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{selectedConversation.from}</h2>
                      <p className="text-sm text-muted-foreground">{selectedConversation.fromEmail}</p>
                    </div>
                  </div>
                  {findMatchingJob(selectedConversation.fromEmail) && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      Job #{findMatchingJob(selectedConversation.fromEmail)?.jobNumber}
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium">{selectedConversation.subject}</h3>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.isFromMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg p-3",
                          message.isFromMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <div
                          className="text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: message.body }}
                        />
                        <div
                          className={cn(
                            "text-xs mt-2",
                            message.isFromMe
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatDate(message.date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-background flex-shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="resize-none"
                    rows={3}
                    data-testid="input-reply-message"
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sendReplyMutation.isPending}
                    className="self-end"
                    data-testid="button-send-reply"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-lg font-medium text-muted-foreground">
                  Select a conversation
                </h2>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Choose a conversation from the list to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConversationListProps {
  threads: EmailThread[];
  selectedId?: string;
  onSelect: (thread: EmailThread) => void;
  formatDate: (date: string) => string;
  findMatchingJob: (email: string) => Job | undefined;
  isLoading: boolean;
}

function ConversationList({
  threads,
  selectedId,
  onSelect,
  formatDate,
  findMatchingJob,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="p-8 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No conversations found</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {threads.map((thread) => {
        const matchingJob = findMatchingJob(thread.fromEmail);
        return (
          <button
            key={thread.id}
            onClick={() => onSelect(thread)}
            className={cn(
              "w-full p-3 text-left hover-elevate transition-colors",
              selectedId === thread.id && "bg-accent"
            )}
            data-testid={`conversation-item-${thread.id}`}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "font-medium truncate text-sm",
                    thread.isUnread && "font-semibold"
                  )}>
                    {thread.from}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDate(thread.date)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {thread.subject}
                </p>
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                  {thread.snippet}
                </p>
                {matchingJob && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Job #{matchingJob.jobNumber}
                  </Badge>
                )}
              </div>
              {thread.isUnread && (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
