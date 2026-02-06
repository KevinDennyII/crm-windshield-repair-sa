import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIContext } from "@/contexts/ai-context";
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
import { useSearch } from "wouter";

interface SmsStatus {
  configured: boolean;
  phoneNumber: string | null;
}

interface SmsMessage {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string;
  direction: "inbound" | "outbound-api" | "outbound-call" | "outbound-reply";
  dateSent: string | null;
  dateCreated: string;
}

interface SmsConversation {
  phoneNumber: string;
  messages: SmsMessage[];
  lastMessage: SmsMessage;
}

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

interface BluehostStatus {
  configured: boolean;
  email: string | null;
}

interface BluehostThread {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messages: EmailMessage[];
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
  const { setSelectedEntity, clearSelectedEntity } = useAIContext();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const phoneParam = urlParams.get("phone");
  const [activeTab, setActiveTab] = useState<string>(phoneParam ? "sms" : "all");
  const [selectedConversation, setSelectedConversation] = useState<EmailThread | null>(null);
  const [selectedSmsConversation, setSelectedSmsConversation] = useState<SmsConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [smsText, setSmsText] = useState("");
  const phoneParamHandled = useRef(false);

  const [selectedBluehostConversation, setSelectedBluehostConversation] = useState<BluehostThread | null>(null);
  const [bluehostReplyText, setBluehostReplyText] = useState("");

  useEffect(() => {
    if (selectedConversation) {
      setSelectedEntity({
        type: "conversation",
        id: selectedConversation.threadId,
        name: selectedConversation.from,
        details: {
          subject: selectedConversation.subject,
          source: "gmail",
          email: selectedConversation.fromEmail,
        },
      });
    } else if (selectedSmsConversation) {
      setSelectedEntity({
        type: "conversation",
        id: selectedSmsConversation.phoneNumber,
        name: selectedSmsConversation.phoneNumber,
        details: {
          source: "sms",
          messageCount: selectedSmsConversation.messages.length,
        },
      });
    } else if (selectedBluehostConversation) {
      setSelectedEntity({
        type: "conversation",
        id: selectedBluehostConversation.id,
        name: selectedBluehostConversation.from,
        details: {
          subject: selectedBluehostConversation.subject,
          source: "bluehost",
          email: selectedBluehostConversation.fromEmail,
        },
      });
    } else {
      clearSelectedEntity();
    }
  }, [selectedConversation, selectedSmsConversation, selectedBluehostConversation, setSelectedEntity, clearSelectedEntity]);

  const { data: emailThreads, isLoading: loadingEmails, refetch: refetchEmails } = useQuery<EmailThread[]>({
    queryKey: ["/api/emails/inbox"],
  });

  const { data: smsStatus } = useQuery<SmsStatus>({
    queryKey: ["/api/sms/status"],
  });

  const { data: smsConversations, isLoading: loadingSms, refetch: refetchSms } = useQuery<SmsConversation[]>({
    queryKey: ["/api/sms/conversations"],
    enabled: smsStatus?.configured === true,
  });

  const { data: bluehostStatus } = useQuery<BluehostStatus>({
    queryKey: ["/api/bluehost/status"],
  });

  const { data: bluehostThreads, isLoading: loadingBluehost, refetch: refetchBluehost } = useQuery<BluehostThread[]>({
    queryKey: ["/api/bluehost/threads"],
    enabled: bluehostStatus?.configured === true,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  useEffect(() => {
    if (!phoneParam || phoneParamHandled.current) return;
    if (smsStatus && !smsStatus.configured) {
      phoneParamHandled.current = true;
      setActiveTab("sms");
      toast({ title: "Twilio SMS is not configured yet.", variant: "destructive" });
      return;
    }
    if (!smsConversations) return;
    phoneParamHandled.current = true;
    const normalizedPhone = phoneParam.replace(/\D/g, "");
    const match = smsConversations.find((c) => {
      const convPhone = c.phoneNumber.replace(/\D/g, "");
      return convPhone.includes(normalizedPhone) || normalizedPhone.includes(convPhone);
    });
    if (match) {
      setSelectedSmsConversation(match);
    } else {
      toast({ title: "No SMS thread found for this number. You can start a new conversation." });
    }
    setActiveTab("sms");
  }, [phoneParam, smsConversations, smsStatus]);

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

  const sendSmsMutation = useMutation({
    mutationFn: async ({ to, body }: { to: string; body: string }) => {
      return apiRequest("POST", "/api/sms/send", { to, body });
    },
    onSuccess: () => {
      toast({ title: "SMS sent successfully" });
      setSmsText("");
      refetchSms();
    },
    onError: () => {
      toast({ title: "Failed to send SMS", variant: "destructive" });
    },
  });

  const sendBluehostReplyMutation = useMutation({
    mutationFn: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
      return apiRequest("POST", "/api/bluehost/reply", { to, subject, body });
    },
    onSuccess: () => {
      toast({ title: "Reply sent successfully" });
      setBluehostReplyText("");
      refetchBluehost();
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

  const handleSendSms = () => {
    if (!selectedSmsConversation || !smsText.trim()) return;
    
    sendSmsMutation.mutate({
      to: selectedSmsConversation.phoneNumber,
      body: smsText,
    });
  };

  const handleSendBluehostReply = () => {
    if (!selectedBluehostConversation || !bluehostReplyText.trim()) return;
    
    sendBluehostReplyMutation.mutate({
      to: selectedBluehostConversation.fromEmail,
      subject: selectedBluehostConversation.subject,
      body: bluehostReplyText,
    });
  };

  const findMatchingJobByPhone = (phone: string): Job | undefined => {
    if (!jobs) return undefined;
    const cleanPhone = phone.replace(/\D/g, "");
    return jobs.find(job => {
      const jobPhone = job.phone?.replace(/\D/g, "");
      return jobPhone && (jobPhone === cleanPhone || jobPhone.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(jobPhone.slice(-10)));
    });
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const filteredSmsConversations = smsConversations?.filter(conv => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchingJob = findMatchingJobByPhone(conv.phoneNumber);
      return (
        conv.phoneNumber.includes(query) ||
        conv.lastMessage.body.toLowerCase().includes(query) ||
        `${matchingJob?.firstName} ${matchingJob?.lastName}`.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

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

  const filteredBluehostThreads = bluehostThreads?.filter(thread => {
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
          onClick={() => {
            refetchEmails();
            if (smsStatus?.configured) refetchSms();
            if (bluehostStatus?.configured) refetchBluehost();
          }}
          disabled={loadingEmails || loadingSms || loadingBluehost}
          data-testid="button-refresh-conversations"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", (loadingEmails || loadingSms || loadingBluehost) && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r flex flex-col bg-muted/30 overflow-hidden">
          <div className="p-3 border-b flex-shrink-0">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid w-full grid-cols-5 px-2 pt-2 flex-shrink-0">
              <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
                <Inbox className="h-3 w-3 mr-1" />
                All
              </TabsTrigger>
              <TabsTrigger value="gmail" className="text-xs" data-testid="tab-gmail">
                <Mail className="h-3 w-3 mr-1" />
                Gmail
              </TabsTrigger>
              <TabsTrigger value="bluehost" className="text-xs" data-testid="tab-bluehost">
                <Mail className="h-3 w-3 mr-1" />
                Info
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

            <TabsContent value="all" className="flex-1 m-0 overflow-hidden min-h-0">
              <div className="h-full overflow-y-auto">
                <ConversationList
                  threads={filteredThreads}
                  selectedId={selectedConversation?.id}
                  onSelect={setSelectedConversation}
                  formatDate={formatDate}
                  findMatchingJob={findMatchingJob}
                  isLoading={loadingEmails}
                />
              </div>
            </TabsContent>

            <TabsContent value="gmail" className="flex-1 m-0 overflow-hidden min-h-0">
              <div className="h-full overflow-y-auto">
                <ConversationList
                  threads={filteredThreads}
                  selectedId={selectedConversation?.id}
                  onSelect={(thread) => {
                    setSelectedConversation(thread);
                    setSelectedSmsConversation(null);
                    setSelectedBluehostConversation(null);
                  }}
                  formatDate={formatDate}
                  findMatchingJob={findMatchingJob}
                  isLoading={loadingEmails}
                />
              </div>
            </TabsContent>

            <TabsContent value="bluehost" className="flex-1 m-0 overflow-hidden min-h-0">
              {bluehostStatus?.configured ? (
                <div className="flex flex-col h-full overflow-hidden">
                  {bluehostStatus.email && (
                    <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2 flex-shrink-0">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Business: <span className="font-medium text-foreground">{bluehostStatus.email}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <BluehostConversationList
                      threads={filteredBluehostThreads}
                      selectedId={selectedBluehostConversation?.id}
                      onSelect={(thread) => {
                        setSelectedBluehostConversation(thread);
                        setSelectedConversation(null);
                        setSelectedSmsConversation(null);
                      }}
                      formatDate={formatDate}
                      findMatchingJob={findMatchingJob}
                      isLoading={loadingBluehost}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Mail className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium text-muted-foreground">Bluehost Email Not Connected</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Configure IMAP credentials to access info@windshieldrepairsa.com
                  </p>
                  <Badge variant="secondary" className="mt-3">Setup Required</Badge>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sms" className="flex-1 m-0 overflow-hidden min-h-0">
              {smsStatus?.configured ? (
                <div className="flex flex-col h-full overflow-hidden">
                  {smsStatus.phoneNumber && (
                    <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2 flex-shrink-0">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Business Line: <span className="font-medium text-foreground">{formatPhoneNumber(smsStatus.phoneNumber)}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <SmsConversationList
                    conversations={filteredSmsConversations}
                    selectedPhone={selectedSmsConversation?.phoneNumber}
                    onSelect={(conv) => {
                      setSelectedSmsConversation(conv);
                      setSelectedConversation(null);
                    }}
                    formatDate={formatDate}
                    formatPhoneNumber={formatPhoneNumber}
                      findMatchingJob={findMatchingJobByPhone}
                      isLoading={loadingSms}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium text-muted-foreground">SMS Not Connected</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Connect Twilio to send and receive text messages
                  </p>
                  <Badge variant="secondary" className="mt-3">Coming Soon</Badge>
                </div>
              )}
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
          ) : selectedSmsConversation ? (
            <>
              <div className="p-4 border-b bg-background flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 flex-shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">
                        {findMatchingJobByPhone(selectedSmsConversation.phoneNumber) 
                          ? `${findMatchingJobByPhone(selectedSmsConversation.phoneNumber)!.firstName} ${findMatchingJobByPhone(selectedSmsConversation.phoneNumber)!.lastName}` 
                          : formatPhoneNumber(selectedSmsConversation.phoneNumber)}
                      </h2>
                      <p className="text-sm text-muted-foreground">{formatPhoneNumber(selectedSmsConversation.phoneNumber)}</p>
                    </div>
                  </div>
                  {findMatchingJobByPhone(selectedSmsConversation.phoneNumber) && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      Job #{findMatchingJobByPhone(selectedSmsConversation.phoneNumber)?.jobNumber}
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedSmsConversation.messages.map((message) => {
                    const isOutbound = message.direction !== "inbound";
                    return (
                      <div
                        key={message.sid}
                        className={cn(
                          "flex",
                          isOutbound ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg p-3",
                            isOutbound
                              ? "bg-green-600 text-white"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                          <div
                            className={cn(
                              "text-xs mt-2 flex items-center gap-1",
                              isOutbound
                                ? "text-white/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatDate(message.dateCreated)}
                            {isOutbound && (
                              <span className="text-xs">
                                {message.status === "delivered" ? " - Delivered" : 
                                 message.status === "sent" ? " - Sent" :
                                 message.status === "failed" ? " - Failed" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-background flex-shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    className="resize-none"
                    rows={3}
                    data-testid="input-sms-message"
                  />
                  <Button
                    onClick={handleSendSms}
                    disabled={!smsText.trim() || sendSmsMutation.isPending}
                    className="self-end bg-green-600 hover:bg-green-700"
                    data-testid="button-send-sms"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : selectedBluehostConversation ? (
            <>
              <div className="p-4 border-b bg-background flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 flex-shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{selectedBluehostConversation.from}</h2>
                      <p className="text-sm text-muted-foreground">{selectedBluehostConversation.fromEmail}</p>
                    </div>
                  </div>
                  {findMatchingJob(selectedBluehostConversation.fromEmail) && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      Job #{findMatchingJob(selectedBluehostConversation.fromEmail)?.jobNumber}
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium">{selectedBluehostConversation.subject}</h3>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedBluehostConversation.messages.map((message) => (
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
                            ? "bg-blue-600 text-white"
                            : "bg-muted"
                        )}
                      >
                        <div className="text-sm whitespace-pre-wrap">
                          {message.body}
                        </div>
                        <div
                          className={cn(
                            "text-xs mt-2",
                            message.isFromMe
                              ? "text-white/70"
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
                    value={bluehostReplyText}
                    onChange={(e) => setBluehostReplyText(e.target.value)}
                    className="resize-none"
                    rows={3}
                    data-testid="input-bluehost-reply-message"
                  />
                  <Button
                    onClick={handleSendBluehostReply}
                    disabled={!bluehostReplyText.trim() || sendBluehostReplyMutation.isPending}
                    className="self-end bg-blue-600 hover:bg-blue-700"
                    data-testid="button-send-bluehost-reply"
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

interface SmsConversationListProps {
  conversations: SmsConversation[];
  selectedPhone?: string;
  onSelect: (conversation: SmsConversation) => void;
  formatDate: (date: string) => string;
  formatPhoneNumber: (phone: string) => string;
  findMatchingJob: (phone: string) => Job | undefined;
  isLoading: boolean;
}

function SmsConversationList({
  conversations,
  selectedPhone,
  onSelect,
  formatDate,
  formatPhoneNumber,
  findMatchingJob,
  isLoading,
}: SmsConversationListProps) {
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

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No SMS conversations found</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conv) => {
        const matchingJob = findMatchingJob(conv.phoneNumber);
        return (
          <button
            key={conv.phoneNumber}
            onClick={() => onSelect(conv)}
            className={cn(
              "w-full p-3 text-left hover-elevate transition-colors",
              selectedPhone === conv.phoneNumber && "bg-accent"
            )}
            data-testid={`sms-conversation-${conv.phoneNumber}`}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 flex-shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate text-sm">
                    {matchingJob ? `${matchingJob.firstName} ${matchingJob.lastName}` : formatPhoneNumber(conv.phoneNumber)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDate(conv.lastMessage.dateCreated)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {formatPhoneNumber(conv.phoneNumber)}
                </p>
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                  {conv.lastMessage.body}
                </p>
                {matchingJob && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Job #{matchingJob.jobNumber}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface BluehostConversationListProps {
  threads: BluehostThread[];
  selectedId?: string;
  onSelect: (thread: BluehostThread) => void;
  formatDate: (date: string) => string;
  findMatchingJob: (email: string) => Job | undefined;
  isLoading: boolean;
}

function BluehostConversationList({
  threads,
  selectedId,
  onSelect,
  formatDate,
  findMatchingJob,
  isLoading,
}: BluehostConversationListProps) {
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
        <p className="text-sm text-muted-foreground">No Bluehost emails found</p>
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
            data-testid={`bluehost-conversation-item-${thread.id}`}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 flex-shrink-0">
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
            </div>
          </button>
        );
      })}
    </div>
  );
}
