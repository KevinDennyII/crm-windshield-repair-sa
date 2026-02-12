import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bot, Phone, Save, TestTube, Clock, User, Car, FileText, ChevronDown, ChevronRight, Plus, ArrowLeft, Send, PhoneIncoming, PhoneOff } from "lucide-react";
import { format } from "date-fns";

const VOICE_OPTIONS = [
  { value: "Polly.Joanna", label: "Joanna (Female, US English)" },
  { value: "Polly.Matthew", label: "Matthew (Male, US English)" },
  { value: "Polly.Salli", label: "Salli (Female, US English)" },
  { value: "Polly.Joey", label: "Joey (Male, US English)" },
  { value: "Polly.Kendra", label: "Kendra (Female, US English)" },
  { value: "Polly.Kimberly", label: "Kimberly (Female, US English)" },
  { value: "Polly.Ivy", label: "Ivy (Female, US English, Child)" },
  { value: "Polly.Lupe", label: "Lupe (Female, US Spanish)" },
  { value: "Polly.Pedro", label: "Pedro (Male, US Spanish)" },
];

export default function AIReceptionist() {
  const { toast } = useToast();
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
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
        greeting: settings.greeting || "",
        systemPrompt: settings.systemPrompt || "",
        businessContext: settings.businessContext || "",
        voiceName: settings.voiceName || "Polly.Joanna",
        maxTurns: settings.maxTurns || 10,
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

  const testMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai-receptionist/test-prompt", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setTestResponse(data.response);
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
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
                <Phone className="w-4 h-4" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-base font-medium">Enable AI Receptionist</Label>
                  <p className="text-sm text-muted-foreground">When enabled, unanswered calls will be handled by the AI receptionist</p>
                </div>
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                  data-testid="switch-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Voice</Label>
                <Select
                  value={formData.voiceName}
                  onValueChange={(val) => setFormData({ ...formData, voiceName: val })}
                >
                  <SelectTrigger data-testid="select-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Maximum Conversation Turns</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={formData.maxTurns}
                  onChange={(e) => setFormData({ ...formData, maxTurns: parseInt(e.target.value) || 10 })}
                  data-testid="input-max-turns"
                />
                <p className="text-sm text-muted-foreground">How many back-and-forth exchanges before the AI wraps up the call</p>
              </div>

              <div className="space-y-2">
                <Label>Greeting Message</Label>
                <Textarea
                  value={formData.greeting}
                  onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                  rows={3}
                  data-testid="input-greeting"
                />
                <p className="text-sm text-muted-foreground">The first thing the AI says when it answers a call</p>
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
              <CardTitle>AI Personality & Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <p className="text-sm text-muted-foreground">Controls the AI's personality, tone, and behavior during calls. This is where you train the AI on how to handle conversations.</p>
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
              <CardTitle>Business Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Business Information</Label>
                <p className="text-sm text-muted-foreground">Key details about your business that the AI should know: services, pricing guidelines, hours, locations, etc.</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-4 h-4" />
                Test Your AI Receptionist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Type a message as if you were a customer calling. The AI will respond using your current system prompt and business context. Save your settings first before testing.
              </p>
              <div className="space-y-2">
                <Label>Customer says:</Label>
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder='e.g. "Hi, I need a new windshield for my 2020 Toyota Camry"'
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && testMessage.trim()) {
                      testMutation.mutate({
                        message: testMessage,
                        systemPrompt: formData.systemPrompt,
                        businessContext: formData.businessContext,
                      });
                    }
                  }}
                  data-testid="input-test-message"
                />
              </div>
              <Button
                onClick={() => {
                  if (testMessage.trim()) {
                    testMutation.mutate({
                      message: testMessage,
                      systemPrompt: formData.systemPrompt,
                      businessContext: formData.businessContext,
                    });
                  }
                }}
                disabled={testMutation.isPending || !testMessage.trim()}
                data-testid="button-test-prompt"
              >
                <Send className="w-4 h-4 mr-2" />
                {testMutation.isPending ? "Thinking..." : "Test Response"}
              </Button>
              {testResponse && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <Bot className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">AI Receptionist responds:</p>
                        <p className="text-sm" data-testid="text-test-response">{testResponse}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
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
                <p className="text-sm mt-1">Calls handled by the AI receptionist will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {calls.map((call: any) => {
                const isExpanded = expandedCall === call.id;
                const transcript = (call.transcript as any[]) || [];
                const extracted = call.extractedData as any;

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
