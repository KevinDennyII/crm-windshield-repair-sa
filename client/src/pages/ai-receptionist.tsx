import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Phone, Save, Clock, User, Car, FileText, ChevronDown, ChevronRight,
  Plus, PhoneIncoming, PhoneOff, Zap, ExternalLink, MapPin,
  RefreshCw, PhoneCall, MessageSquare, ArrowRight
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
          <Badge variant="outline" className="gap-1">
            <Zap className="w-3 h-3" />
            ElevenLabs
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <p className="text-xs text-muted-foreground mt-1">
              {effectiveEnabled ? "Answering calls on (210) 866-8144" : "Calls ring through normally"}
            </p>
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
              <Plus className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Leads Created</p>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-leads-created">{leadsCreated}</p>
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
          <span className="text-sm text-muted-foreground">Auto-refreshes every 30s</span>
        </div>

        {callsLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !calls?.length ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
              <PhoneOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No AI receptionist calls yet</p>
              <p className="text-sm mt-1">Calls answered by ElevenLabs will appear here automatically</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {calls.map((call: any) => {
              const isExpanded = expandedCall === call.id;
              const transcript = (call.transcript as any[]) || [];
              const extracted = call.extractedData as any;
              const hasTranscript = transcript.length > 0;
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
                        <PhoneIncoming className="w-4 h-4 text-muted-foreground shrink-0" />
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
                        {call.duration != null && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, "0")}
                          </span>
                        )}
                        {isShortCall && <Badge variant="secondary">Quick hangup</Badge>}
                        {call.leadCreated && <Badge variant="default">Lead Created</Badge>}
                        {call.jobId && !call.leadCreated && <Badge variant="outline">Existing Customer</Badge>}
                        {hasTranscript && !isShortCall && !call.leadCreated && !call.jobId && (
                          <Badge variant="secondary">Needs Review</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {call.createdAt ? format(new Date(call.createdAt), "MMM d, h:mm a") : ""}
                        </span>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        {call.transcriptSummary && (
                          <div className="rounded-md border p-3 bg-muted/20">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                            <p className="text-sm">{call.transcriptSummary}</p>
                          </div>
                        )}

                        {extracted && (extracted.firstName || extracted.phone || extracted.vehicleMake) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(extracted.firstName || extracted.lastName) && (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Name</p>
                                  <p className="text-sm font-medium">{extracted.firstName} {extracted.lastName || ""}</p>
                                </div>
                              </div>
                            )}
                            {(extracted.phone || call.callerNumber !== "Unknown") && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Phone</p>
                                  <p className="text-sm font-medium">{formatPhone(extracted.phone || call.callerNumber)}</p>
                                </div>
                              </div>
                            )}
                            {(extracted.vehicleYear || extracted.vehicleMake) && (
                              <div className="flex items-center gap-2">
                                <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Vehicle</p>
                                  <p className="text-sm font-medium">{[extracted.vehicleYear, extracted.vehicleMake, extracted.vehicleModel].filter(Boolean).join(" ")}</p>
                                </div>
                              </div>
                            )}
                            {extracted.glassType && (
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Service</p>
                                  <p className="text-sm font-medium">{extracted.glassType}</p>
                                </div>
                              </div>
                            )}
                            {extracted.address && (
                              <div className="flex items-center gap-2 col-span-2">
                                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Address</p>
                                  <p className="text-sm font-medium">{extracted.address}</p>
                                </div>
                              </div>
                            )}
                            {extracted.notes && (
                              <div className="flex items-center gap-2 col-span-2">
                                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Notes</p>
                                  <p className="text-sm font-medium">{extracted.notes}</p>
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
