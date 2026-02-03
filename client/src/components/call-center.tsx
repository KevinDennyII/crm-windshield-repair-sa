import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, PhoneIncoming, PhoneMissed, Mic, MicOff, Volume2, VolumeX, X, History } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IncomingCall {
  callSid: string;
  from: string;
  contactName: string;
}

interface CallLog {
  id: string;
  callSid: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number | null;
  contactName: string | null;
  startedAt: string;
  endedAt: string | null;
}

interface CallCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CallCenter({ isOpen, onClose }: CallCenterProps) {
  const { toast } = useToast();
  const [device, setDevice] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const deviceRef = useRef<any>(null);

  const { data: voiceStatus } = useQuery<{
    configured: boolean;
    twilioConfigured: boolean;
    phoneNumber: string | null;
  }>({
    queryKey: ["/api/voice/status"],
  });

  const { data: callLogs } = useQuery<CallLog[]>({
    queryKey: ["/api/voice/calls"],
    enabled: showHistory,
  });

  const tokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/voice/token");
      return res.json();
    },
  });

  const initializeDevice = useCallback(async () => {
    if (!voiceStatus?.configured) {
      return;
    }

    try {
      setIsConnecting(true);
      const { token, identity } = await tokenMutation.mutateAsync();

      const { Device } = await import("@twilio/voice-sdk");
      
      const newDevice = new Device(token, {
        edge: "ashburn",
        logLevel: 1,
      });

      newDevice.on("registered", () => {
        console.log("Twilio Device registered");
        setCallStatus("ready");
        setIsConnecting(false);
      });

      newDevice.on("error", (error: any) => {
        console.error("Twilio Device error:", error);
        toast({
          title: "Call Error",
          description: error.message || "An error occurred with the phone system",
          variant: "destructive",
        });
        setCallStatus("error");
      });

      newDevice.on("incoming", (call: any) => {
        console.log("Incoming call:", call);
        console.log("Call parameters:", call.parameters);
        console.log("Custom parameters:", call.customParameters);
        
        // Get contact name from custom parameters passed via TwiML
        const contactName = call.customParameters?.get("contactName") || "Unknown Caller";
        
        setIncomingCall({
          callSid: call.parameters.CallSid,
          from: call.parameters.From,
          contactName: contactName,
        });
        setActiveCall(call);
        setCallStatus("ringing");

        call.on("accept", () => {
          setCallStatus("in-call");
          setIncomingCall(null);
        });

        call.on("disconnect", () => {
          setCallStatus("ready");
          setActiveCall(null);
          setIncomingCall(null);
          queryClient.invalidateQueries({ queryKey: ["/api/voice/calls"] });
        });

        call.on("cancel", () => {
          setCallStatus("ready");
          setActiveCall(null);
          setIncomingCall(null);
          toast({
            title: "Missed Call",
            description: `Call from ${call.parameters.From} was missed`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/voice/calls"] });
        });
      });

      await newDevice.register();
      deviceRef.current = newDevice;
      setDevice(newDevice);
    } catch (error: any) {
      console.error("Failed to initialize device:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to phone system",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  }, [voiceStatus?.configured, toast]);

  const answerCall = useCallback(() => {
    if (activeCall) {
      activeCall.accept();
    }
  }, [activeCall]);

  const declineCall = useCallback(() => {
    if (activeCall) {
      activeCall.reject();
      setCallStatus("ready");
      setActiveCall(null);
      setIncomingCall(null);
    }
  }, [activeCall]);

  const hangup = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
      setCallStatus("ready");
      setActiveCall(null);
    }
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-20 right-4 w-80 z-50 shadow-lg border-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call Center
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowHistory(!showHistory)}
              className="h-7 w-7"
              data-testid="button-call-history"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7"
              data-testid="button-close-call-center"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!voiceStatus?.configured ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>Voice calling not configured.</p>
            <p className="text-xs mt-1">
              Need: TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID
            </p>
          </div>
        ) : !device ? (
          <div className="text-center py-4">
            <Button
              onClick={initializeDevice}
              disabled={isConnecting}
              className="w-full"
              data-testid="button-connect-phone"
            >
              {isConnecting ? "Connecting..." : "Connect Phone System"}
            </Button>
            {voiceStatus.phoneNumber && (
              <p className="text-xs text-muted-foreground mt-2">
                Phone: {formatPhoneNumber(voiceStatus.phoneNumber)}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Badge variant={callStatus === "ready" ? "default" : callStatus === "in-call" ? "destructive" : "secondary"}>
                {callStatus === "ready" && "Ready"}
                {callStatus === "ringing" && "Incoming Call"}
                {callStatus === "in-call" && "On Call"}
                {callStatus === "error" && "Error"}
              </Badge>
              {voiceStatus.phoneNumber && (
                <span className="text-xs text-muted-foreground">
                  {formatPhoneNumber(voiceStatus.phoneNumber)}
                </span>
              )}
            </div>

            {callStatus === "ringing" && incomingCall && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <PhoneIncoming className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Incoming Call</span>
                </div>
                <p className="text-sm font-medium">{incomingCall.contactName}</p>
                <p className="text-xs text-muted-foreground">{formatPhoneNumber(incomingCall.from)}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={answerCall}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    data-testid="button-answer-call"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Answer
                  </Button>
                  <Button
                    onClick={declineCall}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-decline-call"
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {callStatus === "in-call" && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-5 w-5 text-blue-600 animate-pulse" />
                  <span className="font-medium">Active Call</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-toggle-mute"
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="h-4 w-4 mr-1" />
                        Unmute
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-1" />
                        Mute
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={hangup}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-hangup"
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    Hang Up
                  </Button>
                </div>
              </div>
            )}

            {showHistory && (
              <div className="border-t pt-3 mt-3">
                <h4 className="text-sm font-medium mb-2">Recent Calls</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {callLogs?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No call history</p>
                  ) : (
                    callLogs?.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          {log.status === "completed" ? (
                            <Phone className="h-3 w-3 text-green-600" />
                          ) : log.status === "missed" || log.status === "no-answer" ? (
                            <PhoneMissed className="h-3 w-3 text-red-600" />
                          ) : (
                            <Phone className="h-3 w-3 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{log.contactName || formatPhoneNumber(log.fromNumber)}</p>
                            <p className="text-muted-foreground">
                              {new Date(log.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <span className="text-muted-foreground">{formatDuration(log.duration)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function CallCenterButton({ onClick }: { onClick: () => void }) {
  const { data: voiceStatus } = useQuery<{
    configured: boolean;
    twilioConfigured: boolean;
    phoneNumber: string | null;
  }>({
    queryKey: ["/api/voice/status"],
  });

  if (!voiceStatus?.twilioConfigured) return null;

  return (
    <Button
      onClick={onClick}
      size="icon"
      variant="outline"
      className="rounded-full"
      data-testid="button-open-call-center"
    >
      <Phone className="h-4 w-4" />
    </Button>
  );
}
