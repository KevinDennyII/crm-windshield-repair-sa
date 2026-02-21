import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot, Phone, Clock, User, Car, FileText, ChevronDown, ChevronRight,
  Plus, PhoneIncoming, PhoneOff, Zap, ExternalLink, MapPin,
  RefreshCw, PhoneCall, MessageSquare, ArrowRight, Copy, Info,
  PhoneForwarded, Shield, Hash, Globe, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function AIReceptionist() {
  const { toast } = useToast();
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/ai-receptionist/settings"],
  });

  const { data: calls, isLoading: callsLoading, refetch: refetchCalls } = useQuery<any[]>({
    queryKey: ["/api/ai-receptionist/calls"],
    refetchInterval: 30000,
  });

  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const effectiveEnabled = isEnabled !== null ? isEnabled : (settings?.isEnabled ?? false);

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

  const toggleEnabled = (checked: boolean) => {
    setIsEnabled(checked);
    saveMutation.mutate({ isEnabled: checked });
  };

  const totalCalls = calls?.length || 0;
  const leadsCreated = calls?.filter((c: any) => c.leadCreated).length || 0;
  const aiCalls = calls?.filter((c: any) => c.callType === "ai").length || 0;
  const forwardedCalls = calls?.filter((c: any) => c.callType === "forwarded").length || 0;
  const avgDuration = totalCalls > 0
    ? Math.round((calls?.reduce((sum: number, c: any) => sum + (c.duration || 0), 0) || 0) / totalCalls)
    : 0;

  if (settingsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto overflow-auto h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Bot className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Receptionist</h1>
          <Badge variant={effectiveEnabled ? "default" : "secondary"} data-testid="badge-receptionist-status">
            {effectiveEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchCalls()}
            data-testid="button-refresh-calls"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <a
            href="https://elevenlabs.io/app/conversational-ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" data-testid="link-elevenlabs-dashboard">
              <ExternalLink className="w-4 h-4 mr-1" />
              ElevenLabs Dashboard
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">AI Receptionist</p>
                <p className="text-lg font-semibold">{effectiveEnabled ? "On" : "Off"}</p>
              </div>
              <Switch
                checked={effectiveEnabled}
                onCheckedChange={toggleEnabled}
                data-testid="switch-enabled"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total Calls</p>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-calls">{totalCalls}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">AI Calls</p>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-ai-calls">{aiCalls}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <PhoneForwarded className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Forwarded</p>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-forwarded-calls">{forwardedCalls}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Avg Duration</p>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-avg-duration">
              {Math.floor(avgDuration / 60)}:{String(avgDuration % 60).padStart(2, "0")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Call Log</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Plus className="w-3 h-3" />
              {leadsCreated} Leads
            </Badge>
            <span className="text-sm text-muted-foreground">Auto-refreshes every 30s</span>
          </div>
        </div>

        {callsLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !calls?.length ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
              <PhoneOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No calls recorded yet</p>
              <p className="text-sm mt-1">All incoming calls will appear here with full transcripts</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {calls.map((call: any) => {
              const isExpanded = expandedCall === call.id;
              const transcript = (call.transcript as any[]) || [];
              const extracted = call.extractedData as any;
              const isAI = call.callType === "ai";
              const isForwarded = call.callType === "forwarded";
              const isShortCall = (call.duration || 0) < 10 && transcript.length <= 1;

              return (
                <Card key={call.id} data-testid={`card-call-${call.id}`}>
                  <CardContent className="pt-3 pb-3">
                    <div
                      className="flex items-center justify-between gap-2 cursor-pointer"
                      onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                      data-testid={`button-expand-call-${call.id}`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        {isAI ? (
                          <Bot className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <PhoneForwarded className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <span className="font-medium">
                            {extracted?.firstName
                              ? `${extracted.firstName} ${extracted.lastName || ""}`.trim()
                              : formatPhone(call.callerNumber)}
                          </span>
                          {extracted?.firstName && call.callerNumber !== "Unknown" && (
                            <span className="text-sm text-muted-foreground ml-2">{formatPhone(call.callerNumber)}</span>
                          )}
                        </div>
                        <Badge variant={isAI ? "default" : "outline"} data-testid={`badge-call-type-${call.id}`}>
                          {isAI ? "AI" : "Forwarded"}
                        </Badge>
                        {call.duration != null && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, "0")}
                          </span>
                        )}
                        {isShortCall && <Badge variant="secondary">Quick hangup</Badge>}
                        {call.leadCreated && <Badge variant="default">Lead Created</Badge>}
                        {call.jobId && !call.leadCreated && <Badge variant="outline">Existing Customer</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {call.createdAt ? format(new Date(call.createdAt), "MMM d, h:mm a") : ""}
                        </span>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="w-full justify-start" data-testid={`tabs-call-${call.id}`}>
                            <TabsTrigger value="overview" data-testid={`tab-overview-${call.id}`}>Overview</TabsTrigger>
                            <TabsTrigger value="transcription" data-testid={`tab-transcription-${call.id}`}>Transcription</TabsTrigger>
                            <TabsTrigger value="client-data" data-testid={`tab-client-data-${call.id}`}>Client Data</TabsTrigger>
                            <TabsTrigger value="phone-call" data-testid={`tab-phone-call-${call.id}`}>Phone Call</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="space-y-4 mt-3">
                            {call.transcriptSummary && (
                              <div className="rounded-md border p-4">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Summary</p>
                                <p className="text-sm leading-relaxed">{call.transcriptSummary}</p>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Call Status</p>
                                <div className="flex items-center gap-2">
                                  {call.status === "completed" ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : call.status === "in_progress" ? (
                                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className="text-sm font-medium capitalize">{call.status || "Unknown"}</span>
                                </div>
                              </div>

                              <div className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                                <p className="text-sm font-medium">
                                  {call.duration != null
                                    ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, "0")}`
                                    : "N/A"}
                                </p>
                              </div>

                              <div className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Call Type</p>
                                <p className="text-sm font-medium">{isAI ? "AI Receptionist" : "Forwarded Call"}</p>
                              </div>

                              <div className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Caller</p>
                                <p className="text-sm font-medium">{formatPhone(call.callerNumber)}</p>
                              </div>
                            </div>

                            {call.recordingUrl && (
                              <div className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground mb-2">Recording</p>
                                <audio controls className="w-full" data-testid={`audio-recording-${call.id}`}>
                                  <source src={`/api/voice/recording-audio/${call.id}`} type="audio/mpeg" />
                                </audio>
                              </div>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              {!call.leadCreated && extracted && (extracted.firstName || extracted.phone) && (
                                <Button
                                  size="sm"
                                  onClick={() => createLeadMutation.mutate(call.id)}
                                  disabled={createLeadMutation.isPending}
                                  data-testid={`button-create-lead-${call.id}`}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                                </Button>
                              )}
                              {call.jobId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setLocation(`/?openJob=${call.jobId}`)}
                                  data-testid={`button-view-job-${call.id}`}
                                >
                                  <ArrowRight className="w-4 h-4 mr-1" />
                                  View Job
                                </Button>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="transcription" className="mt-3">
                            {transcript.length > 0 ? (
                              <div className="space-y-2 max-h-80 overflow-y-auto rounded-md border p-3">
                                {transcript.map((entry: any, idx: number) => (
                                  <div key={idx} className={`flex gap-2 ${entry.role === "caller" ? "" : "justify-end"}`}>
                                    <div className={`rounded-md px-3 py-2 text-sm max-w-[80%] ${
                                      entry.role === "caller"
                                        ? "bg-muted"
                                        : "bg-primary/10"
                                    }`}>
                                      <span className="text-xs font-medium text-muted-foreground block mb-0.5">
                                        {entry.role === "caller" ? "Customer" : (isAI ? "AI Receptionist" : "Staff")}
                                      </span>
                                      {entry.content}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-md border p-6 text-center text-muted-foreground">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">
                                  {call.status === "in_progress"
                                    ? "Transcription in progress..."
                                    : isShortCall
                                    ? "Call was too short to transcribe"
                                    : "No transcript available"}
                                </p>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="client-data" className="mt-3">
                            {extracted && (extracted.firstName || extracted.phone || extracted.vehicleMake) ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {(extracted.firstName || extracted.lastName) && (
                                    <div className="rounded-md border p-3 flex items-start gap-3">
                                      <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Name</p>
                                        <p className="text-sm font-medium">{extracted.firstName} {extracted.lastName || ""}</p>
                                      </div>
                                    </div>
                                  )}
                                  {(extracted.phone || call.callerNumber !== "Unknown") && (
                                    <div className="rounded-md border p-3 flex items-start gap-3">
                                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Phone</p>
                                        <p className="text-sm font-medium">{formatPhone(extracted.phone || call.callerNumber)}</p>
                                      </div>
                                    </div>
                                  )}
                                  {extracted.email && (
                                    <div className="rounded-md border p-3 flex items-start gap-3">
                                      <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="text-sm font-medium">{extracted.email}</p>
                                      </div>
                                    </div>
                                  )}
                                  {(extracted.vehicleYear || extracted.vehicleMake) && (
                                    <div className="rounded-md border p-3 flex items-start gap-3">
                                      <Car className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Vehicle</p>
                                        <p className="text-sm font-medium">{[extracted.vehicleYear, extracted.vehicleMake, extracted.vehicleModel].filter(Boolean).join(" ")}</p>
                                      </div>
                                    </div>
                                  )}
                                  {extracted.glassType && (
                                    <div className="rounded-md border p-3 flex items-start gap-3">
                                      <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Service Needed</p>
                                        <p className="text-sm font-medium capitalize">{extracted.glassType.replace(/_/g, " ")}{extracted.serviceType ? ` (${extracted.serviceType})` : ""}</p>
                                      </div>
                                    </div>
                                  )}
                                  {extracted.address && (
                                    <div className="rounded-md border p-3 flex items-start gap-3">
                                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Address</p>
                                        <p className="text-sm font-medium">{extracted.address}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {extracted.isInsurance && (
                                  <div className="rounded-md border p-3 flex items-start gap-3">
                                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">Insurance Claim</p>
                                      <p className="text-sm font-medium">Customer has insurance</p>
                                    </div>
                                  </div>
                                )}
                                {extracted.urgency && extracted.urgency !== "normal" && (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {extracted.urgency === "emergency" ? "Emergency" : "Urgent"}
                                  </Badge>
                                )}
                                {extracted.notes && (
                                  <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm">{extracted.notes}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-md border p-6 text-center text-muted-foreground">
                                <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">
                                  {call.status === "in_progress"
                                    ? "Extracting client data..."
                                    : "No client data extracted from this call"}
                                </p>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="phone-call" className="mt-3">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="rounded-md border p-3">
                                  <p className="text-xs text-muted-foreground mb-1">Caller Number</p>
                                  <p className="text-sm font-medium font-mono">{call.callerNumber || "Unknown"}</p>
                                </div>
                                {call.calledNumber && (
                                  <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Called Number</p>
                                    <p className="text-sm font-medium font-mono">{formatPhone(call.calledNumber)}</p>
                                  </div>
                                )}
                                {call.forwardedTo && (
                                  <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Forwarded To</p>
                                    <p className="text-sm font-medium font-mono">{formatPhone(call.forwardedTo)}</p>
                                  </div>
                                )}
                                <div className="rounded-md border p-3">
                                  <p className="text-xs text-muted-foreground mb-1">Date</p>
                                  <p className="text-sm font-medium">{call.createdAt ? format(new Date(call.createdAt), "MMM d, yyyy h:mm:ss a") : "N/A"}</p>
                                </div>
                                {call.callSid && (
                                  <div className="rounded-md border p-3">
                                    <div className="flex items-center gap-1 mb-1">
                                      <Hash className="w-3 h-3 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">Call SID</p>
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground break-all">{call.callSid}</p>
                                  </div>
                                )}
                                {call.elevenlabsConversationId && (
                                  <div className="rounded-md border p-3">
                                    <div className="flex items-center gap-1 mb-1">
                                      <Zap className="w-3 h-3 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">ElevenLabs Conversation ID</p>
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground break-all">{call.elevenlabsConversationId}</p>
                                  </div>
                                )}
                                {call.recordingSid && (
                                  <div className="rounded-md border p-3">
                                    <div className="flex items-center gap-1 mb-1">
                                      <Hash className="w-3 h-3 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">Recording SID</p>
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground break-all">{call.recordingSid}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatPhone(phone: string): string {
  if (!phone || phone === "Unknown") return "Unknown";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
