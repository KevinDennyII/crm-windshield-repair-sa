import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bot, Phone, Save, Clock, User, Car, FileText, ChevronDown, ChevronRight, Plus, Send, PhoneIncoming, PhoneOff, PhoneCall, Volume2, VolumeX, Loader2, ExternalLink, Zap, Shield, Webhook } from "lucide-react";
import { format } from "date-fns";

const ELEVENLABS_AGENT_ID = "agent_5201khahhwpefx9vjweqgpacqbrj";

export default function AIReceptionist() {
  const { toast } = useToast();
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/ai-receptionist/settings"],
  });

  const { data: calls, isLoading: callsLoading } = useQuery<any[]>({
    queryKey: ["/api/ai-receptionist/calls"],
  });

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (settings && !formData) {
      setFormData({
        isEnabled: settings.isEnabled ?? false,
        systemPrompt: settings.systemPrompt || "",
        businessContext: settings.businessContext || "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai-receptionist/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await apiRequest("POST", `/api/ai-receptionist/calls/${callId}/create-lead`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-receptionist/calls"] });
      toast({ title: "Lead created", description: `Job #${data.job?.jobNumber} created successfully` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create lead", description: err.message, variant: "destructive" });
    },
  });

  if (settingsLoading || !formData) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Voice Receptionist</h1>
        <Badge variant={formData.isEnabled ? "default" : "secondary"} data-testid="badge-receptionist-status">
          {formData.isEnabled ? "Active" : "Inactive"}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Zap className="w-3 h-3" />
          Powered by ElevenLabs
        </Badge>
      </div>

      <Tabs defaultValue="settings">
        <TabsList data-testid="tabs-receptionist">
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="training" data-testid="tab-training">Training</TabsTrigger>
          <TabsTrigger value="test" data-testid="tab-test">Test</TabsTrigger>
          <TabsTrigger value="calls" data-testid="tab-calls">Call Log</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                ElevenLabs AI Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4 bg-muted/30 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`w-3 h-3 rounded-full ${formData.isEnabled ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  <span className="font-medium">
                    {formData.isEnabled 
                      ? "ElevenLabs AI is answering your incoming calls" 
                      : "AI Receptionist is turned off — calls ring through normally"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isEnabled
                    ? "Incoming calls are routed to your ElevenLabs AI agent. Conversation data flows back to your CRM via webhook to create leads automatically."
                    : "Toggle the switch below to have incoming calls answered by the ElevenLabs AI agent."}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3 h-3" />
                  Agent ID: {ELEVENLABS_AGENT_ID}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-base font-medium">Enable AI Receptionist</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, incoming calls are answered by the ElevenLabs AI agent and leads are created automatically. 
                    When disabled, calls ring through normally.
                  </p>
                </div>
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                  data-testid="switch-enabled"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Voice & Personality
                    </div>
                    <p className="text-xs text-muted-foreground">Configured in ElevenLabs dashboard</p>
                    <a
                      href="https://elevenlabs.io/app/conversational-ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 pt-1"
                      data-testid="link-elevenlabs-voice"
                    >
                      Manage Voice <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                      Agent Prompt
                    </div>
                    <p className="text-xs text-muted-foreground">Configured in ElevenLabs dashboard</p>
                    <a
                      href="https://elevenlabs.io/app/conversational-ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 pt-1"
                      data-testid="link-elevenlabs-prompt"
                    >
                      Manage Prompt <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Webhook className="w-4 h-4 text-muted-foreground" />
                      Webhook
                    </div>
                    <p className="text-xs text-muted-foreground">Auto-creates leads from calls</p>
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 pt-1">
                      Connected
                    </span>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI Training (CRM Simulation)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  These prompts are used for the simulated call test feature in your CRM. 
                  Your actual ElevenLabs AI agent uses the prompt configured in the{" "}
                  <a 
                    href="https://elevenlabs.io/app/conversational-ai" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary underline"
                  >
                    ElevenLabs dashboard
                  </a>.
                </p>
              </div>
              <div className="space-y-2">
                <Label>System Prompt (for simulation)</Label>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                  data-testid="input-system-prompt"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Context (for simulation)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Business Information</Label>
                <Textarea
                  value={formData.businessContext}
                  onChange={(e) => setFormData({ ...formData, businessContext: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="input-business-context"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending}
              data-testid="button-save-training"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Training"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <SimulatedCall formData={formData} />
        </TabsContent>

        <TabsContent value="calls" className="space-y-4 mt-4">
          {callsLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !calls?.length ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <PhoneOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No AI receptionist calls yet</p>
                <p className="text-sm mt-1">Calls handled by ElevenLabs and widget conversations will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {calls.map((call: any) => {
                const isExpanded = expandedCall === call.id;
                const transcript = (call.transcript as any[]) || [];
                const extracted = call.extractedData as any;
                const isElevenLabs = call.callSid?.startsWith("elevenlabs") || call.callerNumber === "ElevenLabs Widget";

                return (
                  <Card key={call.id} data-testid={`card-call-${call.id}`}>
                    <CardContent className="pt-4">
                      <div
                        className="flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                        data-testid={`button-expand-call-${call.id}`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <PhoneIncoming className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{call.callerNumber}</span>
                          <Badge variant={call.status === "completed" ? "default" : "secondary"}>
                            {call.status}
                          </Badge>
                          {isElevenLabs && (
                            <Badge variant="outline" className="gap-1">
                              <Zap className="w-3 h-3" />
                              ElevenLabs
                            </Badge>
                          )}
                          {call.leadCreated && <Badge variant="outline">Lead Created</Badge>}
                          {call.duration && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, "0")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {call.createdAt ? format(new Date(call.createdAt), "MMM d, h:mm a") : ""}
                          </span>
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {extracted && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {extracted.firstName && (
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Name</p>
                                    <p className="text-sm font-medium">{extracted.firstName} {extracted.lastName || ""}</p>
                                  </div>
                                </div>
                              )}
                              {extracted.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Phone</p>
                                    <p className="text-sm font-medium">{extracted.phone}</p>
                                  </div>
                                </div>
                              )}
                              {(extracted.vehicleYear || extracted.vehicleMake) && (
                                <div className="flex items-center gap-2">
                                  <Car className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Vehicle</p>
                                    <p className="text-sm font-medium">{[extracted.vehicleYear, extracted.vehicleMake, extracted.vehicleModel].filter(Boolean).join(" ")}</p>
                                  </div>
                                </div>
                              )}
                              {extracted.glassType && (
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Service</p>
                                    <p className="text-sm font-medium">{extracted.glassType}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {transcript.length > 0 && (
                            <div className="space-y-2 border rounded-md p-3 bg-muted/20 max-h-64 overflow-y-auto">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Transcript</p>
                              {transcript.map((entry: any, idx: number) => (
                                <div key={idx} className={`flex gap-2 ${entry.role === "caller" ? "" : "justify-end"}`}>
                                  <div className={`rounded-md px-3 py-1.5 text-sm max-w-[80%] ${
                                    entry.role === "caller"
                                      ? "bg-muted"
                                      : "bg-primary/10"
                                  }`}>
                                    <span className="text-xs font-medium text-muted-foreground block mb-0.5">
                                      {entry.role === "caller" ? "Customer" : "AI Receptionist"}
                                    </span>
                                    {entry.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {!call.leadCreated && extracted && (extracted.firstName || extracted.phone) && (
                            <Button
                              size="sm"
                              onClick={() => createLeadMutation.mutate(call.id)}
                              disabled={createLeadMutation.isPending}
                              data-testid={`button-create-lead-${call.id}`}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              {createLeadMutation.isPending ? "Creating..." : "Create Lead from Call"}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ConversationEntry {
  role: "caller" | "assistant";
  content: string;
}

function SimulatedCall({ formData }: { formData: any }) {
  const { toast } = useToast();
  const [callActive, setCallActive] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (isMuted || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google US English"));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      inputRef.current?.focus();
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const startCall = async () => {
    setCallActive(true);
    setConversation([]);
    setCallDuration(0);

    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);

    try {
      const res = await apiRequest("POST", "/api/ai-receptionist/simulate/greeting");
      const data = await res.json();

      const greetingEntry: ConversationEntry = {
        role: "assistant",
        content: data.greeting,
      };
      setConversation([greetingEntry]);
      speakText(data.greeting);
    } catch (err: any) {
      toast({ title: "Failed to start call", description: err.message, variant: "destructive" });
      endCall();
    }
  };

  const endCall = () => {
    setCallActive(false);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isThinking) return;

    const userMsg = message.trim();
    setMessage("");

    const updatedConversation = [...conversation, { role: "caller" as const, content: userMsg }];
    setConversation(updatedConversation);
    setIsThinking(true);

    try {
      const res = await apiRequest("POST", "/api/ai-receptionist/simulate", {
        message: userMsg,
        conversationHistory: updatedConversation.map(e => ({ role: e.role, content: e.content })),
      });
      const data = await res.json();

      const aiEntry: ConversationEntry = {
        role: "assistant",
        content: data.response,
      };
      setConversation(prev => [...prev, aiEntry]);
      speakText(data.response);
    } catch (err: any) {
      toast({ title: "AI response failed", description: err.message, variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (!callActive) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4 py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <PhoneCall className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Simulated Call Test</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Test how the AI receptionist responds using text-based simulation.
                Type messages as a customer and the AI will respond using your training prompts.
              </p>
              <p className="text-xs text-muted-foreground">
                Uses CRM training prompts (not your ElevenLabs agent configuration)
              </p>
            </div>
            <Button onClick={startCall} data-testid="button-start-call">
              <PhoneCall className="w-4 h-4 mr-2" />
              Start Simulated Call
            </Button>
            {conversation.length > 0 && (
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">Previous conversation ({conversation.length} messages)</p>
                <Button variant="outline" size="sm" onClick={() => setConversation([])} data-testid="button-clear-history">
                  Clear History
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col" style={{ height: "calc(100vh - 300px)", minHeight: "400px" }}>
      <CardHeader className="flex-none border-b pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <CardTitle className="text-base">Simulated Call In Progress</CardTitle>
            <Badge variant="outline" data-testid="text-call-duration">{formatTime(callDuration)}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const newMuted = !isMuted;
                setIsMuted(newMuted);
                if (newMuted) {
                  window.speechSynthesis?.cancel();
                  setIsSpeaking(false);
                }
              }}
              data-testid="button-toggle-mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={endCall}
              data-testid="button-end-call"
            >
              <PhoneOff className="w-4 h-4 mr-1" />
              End Call
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto py-4 space-y-3">
        {conversation.map((entry, idx) => (
          <div
            key={idx}
            className={`flex gap-2 ${entry.role === "caller" ? "justify-end" : "justify-start"}`}
            data-testid={`message-${entry.role}-${idx}`}
          >
            <div className={`rounded-md px-3 py-2 max-w-[80%] space-y-1 ${
              entry.role === "caller"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              <p className={`text-xs font-medium ${entry.role === "caller" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {entry.role === "caller" ? "You (Customer)" : "AI Receptionist"}
              </p>
              <p className="text-sm">{entry.content}</p>
              {entry.role === "assistant" && !isMuted && (
                <button
                  className="text-xs flex items-center gap-1 mt-1 text-muted-foreground hover:text-foreground"
                  onClick={() => speakText(entry.content)}
                  data-testid={`button-replay-${idx}`}
                >
                  <Volume2 className="w-3 h-3" />
                  Replay
                </button>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex gap-2 justify-start">
            <div className="rounded-md px-3 py-2 bg-muted">
              <p className="text-xs font-medium text-muted-foreground">AI Receptionist</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}
        {isSpeaking && (
          <div className="flex justify-center">
            <Badge variant="outline" className="gap-1">
              <Volume2 className="w-3 h-3 animate-pulse" />
              Speaking...
            </Badge>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent>

      <div className="flex-none border-t p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type what the customer would say..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isThinking}
            autoFocus
            data-testid="input-simulate-message"
          />
          <Button
            onClick={sendMessage}
            disabled={isThinking || !message.trim()}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
