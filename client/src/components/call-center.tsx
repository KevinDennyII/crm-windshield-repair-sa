import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Device } from "@twilio/voice-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Phone, PhoneOff, PhoneIncoming, PhoneMissed, Mic, MicOff, Volume2, VolumeX, X, History, Settings, PhoneForwarded, Grid3X3, Delete, ArrowRightLeft } from "lucide-react";
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
  dialNumber?: string | null;
  dialContactName?: string | null;
  onDialComplete?: () => void;
}

export function CallCenter({ isOpen, onClose, dialNumber, dialContactName, onDialComplete }: CallCenterProps) {
  const { toast } = useToast();
  const [device, setDevice] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDialPad, setShowDialPad] = useState(false);
  const [dialPadNumber, setDialPadNumber] = useState("");
  const [fwdNumber, setFwdNumber] = useState("");
  const [fwdTimeout, setFwdTimeout] = useState("5");
  const [fwdWhisper, setFwdWhisper] = useState("");
  const [outboundNumber, setOutboundNumber] = useState<string | null>(null);
  const [outboundContactName, setOutboundContactName] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [customTransferNumber, setCustomTransferNumber] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const deviceRef = useRef<any>(null);
  const hasInitiatedDialRef = useRef<string | null>(null);

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

  const { data: forwardingSettings } = useQuery<{
    id?: string;
    forwardingNumber: string;
    isEnabled: boolean;
    timeoutSeconds: number;
    whisperMessage: string;
  }>({
    queryKey: ["/api/voice/forwarding"],
    enabled: showSettings,
  });

  const forwardingMutation = useMutation({
    mutationFn: async (data: { forwardingNumber?: string; isEnabled?: boolean; timeoutSeconds?: number; whisperMessage?: string }) => {
      const res = await apiRequest("PUT", "/api/voice/forwarding", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/forwarding"] });
      toast({ title: "Forwarding settings updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update settings", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (forwardingSettings) {
      setFwdNumber(forwardingSettings.forwardingNumber || "");
      setFwdTimeout(String(forwardingSettings.timeoutSeconds ?? 5));
      setFwdWhisper(forwardingSettings.whisperMessage || "");
    }
  }, [forwardingSettings]);

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

  const transferCall = useCallback(async (transferTo: string) => {
    if (!activeCall) return;

    const callSid = activeCall.parameters?.CallSid;
    if (!callSid) {
      toast({
        title: "Transfer Failed",
        description: "Cannot identify active call for transfer.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTransferring(true);
      const response = await fetch("/api/voice/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid, transferTo }),
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Transfer failed");
      }

      toast({
        title: "Call Transferred",
        description: `Call is being transferred to ${transferTo}. If unanswered, it will return to you.`,
      });

      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus("ready");
      setShowTransfer(false);
      setCustomTransferNumber("");
    } catch (error: any) {
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to transfer the call.",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  }, [activeCall, toast]);

  // Initiate an outbound call
  const makeOutboundCall = useCallback(async (phoneNumber: string, contactName?: string) => {
    if (!device || callStatus !== "ready") {
      toast({
        title: "Cannot Make Call",
        description: "Call center is not ready. Please wait for initialization.",
        variant: "destructive",
      });
      return;
    }

    try {
      setOutboundNumber(phoneNumber);
      setOutboundContactName(contactName || null);
      setCallStatus("calling");

      // Format the phone number
      let formattedNumber = phoneNumber.replace(/\D/g, "");
      if (formattedNumber.length === 10) {
        formattedNumber = "+1" + formattedNumber;
      } else if (!formattedNumber.startsWith("+")) {
        formattedNumber = "+" + formattedNumber;
      }

      // Connect to the number via Twilio
      const call = await device.connect({
        params: {
          To: formattedNumber,
        },
      });

      setActiveCall(call);

      call.on("accept", () => {
        console.log("Outbound call accepted");
        setCallStatus("in-call");
      });

      call.on("disconnect", () => {
        console.log("Outbound call disconnected");
        setCallStatus("ready");
        setActiveCall(null);
        setOutboundNumber(null);
        setOutboundContactName(null);
        setShowDialPad(false);
        queryClient.invalidateQueries({ queryKey: ["/api/voice/calls"] });
      });

      call.on("cancel", () => {
        console.log("Outbound call cancelled");
        setCallStatus("ready");
        setActiveCall(null);
        setOutboundNumber(null);
        setOutboundContactName(null);
      });

      call.on("error", (error: any) => {
        console.error("Outbound call error:", error);
        toast({
          title: "Call Failed",
          description: error.message || "Failed to connect call",
          variant: "destructive",
        });
        setCallStatus("ready");
        setActiveCall(null);
        setOutboundNumber(null);
        setOutboundContactName(null);
      });

    } catch (error: any) {
      console.error("Failed to initiate outbound call:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Failed to initiate call",
        variant: "destructive",
      });
      setCallStatus("ready");
      setOutboundNumber(null);
      setOutboundContactName(null);
    }
  }, [device, callStatus, toast]);

  // Effect to handle incoming dialNumber prop
  useEffect(() => {
    if (dialNumber && device && callStatus === "ready" && hasInitiatedDialRef.current !== dialNumber) {
      hasInitiatedDialRef.current = dialNumber;
      makeOutboundCall(dialNumber, dialContactName || undefined);
      if (onDialComplete) {
        onDialComplete();
      }
    }
  }, [dialNumber, dialContactName, device, callStatus, makeOutboundCall, onDialComplete]);

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
              onClick={() => { setShowDialPad(!showDialPad); setShowSettings(false); setShowHistory(false); }}
              className={showDialPad ? "toggle-elevate toggle-elevated" : ""}
              data-testid="button-dial-pad"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { setShowSettings(!showSettings); setShowHistory(false); setShowDialPad(false); }}
              data-testid="button-call-forwarding-settings"
            >
              <PhoneForwarded className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { setShowHistory(!showHistory); setShowSettings(false); setShowDialPad(false); }}
              data-testid="button-call-history"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
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
              <Badge variant={callStatus === "ready" ? "default" : callStatus === "in-call" || callStatus === "calling" ? "destructive" : "secondary"}>
                {callStatus === "ready" && "Ready"}
                {callStatus === "ringing" && "Incoming Call"}
                {callStatus === "calling" && "Dialing..."}
                {callStatus === "in-call" && "On Call"}
                {callStatus === "error" && "Error"}
              </Badge>
              {voiceStatus.phoneNumber && (
                <span className="text-xs text-muted-foreground">
                  {formatPhoneNumber(voiceStatus.phoneNumber)}
                </span>
              )}
            </div>

            {/* Outbound calling state */}
            {(callStatus === "calling" || (callStatus === "in-call" && outboundNumber)) && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">{callStatus === "calling" ? "Calling..." : "Outbound Call"}</span>
                  </div>
                  {callStatus === "in-call" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowDialPad(!showDialPad)}
                      className={showDialPad ? "toggle-elevate toggle-elevated" : ""}
                      data-testid="button-outbound-dialpad"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {outboundContactName && <p className="text-sm font-medium">{outboundContactName}</p>}
                <p className="text-xs text-muted-foreground">{formatPhoneNumber(outboundNumber || "")}</p>
                {showDialPad && callStatus === "in-call" && (
                  <div className="grid grid-cols-3 gap-1 mt-2 mb-2">
                    {["1","2","3","4","5","6","7","8","9","*","0","#"].map((digit) => (
                      <Button
                        key={digit}
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => activeCall?.sendDigits(digit)}
                        data-testid={`button-out-dtmf-${digit === "*" ? "star" : digit === "#" ? "hash" : digit}`}
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    data-testid="button-mute-outbound"
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  {callStatus === "in-call" && (
                    <Button
                      onClick={() => setShowTransfer(!showTransfer)}
                      variant="outline"
                      size="sm"
                      className={showTransfer ? "flex-1 toggle-elevate toggle-elevated" : "flex-1"}
                      data-testid="button-transfer-outbound"
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Transfer
                    </Button>
                  )}
                  <Button
                    onClick={hangup}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    data-testid="button-hangup-outbound"
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    End
                  </Button>
                </div>
                {showTransfer && callStatus === "in-call" && (
                  <div className="mt-3 border rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Transfer to:</p>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={isTransferring}
                        onClick={() => transferCall("702-325-1702")}
                        data-testid="button-transfer-sara"
                      >
                        <PhoneForwarded className="h-4 w-4 mr-2" />
                        Sara (702-325-1702)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={isTransferring}
                        onClick={() => transferCall("956-775-7266")}
                        data-testid="button-transfer-christian"
                      >
                        <PhoneForwarded className="h-4 w-4 mr-2" />
                        Christian (956-775-7266)
                      </Button>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <Input
                        placeholder="Custom number"
                        value={customTransferNumber}
                        onChange={(e) => setCustomTransferNumber(e.target.value)}
                        className="text-sm"
                        data-testid="input-transfer-custom-number"
                      />
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isTransferring || !customTransferNumber.trim()}
                        onClick={() => transferCall(customTransferNumber)}
                        data-testid="button-transfer-custom"
                      >
                        {isTransferring ? "..." : "Go"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {callStatus === "in-call" && !outboundNumber && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600 animate-pulse" />
                    <span className="font-medium">Active Call</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowDialPad(!showDialPad)}
                    className={showDialPad ? "toggle-elevate toggle-elevated" : ""}
                    data-testid="button-in-call-dialpad"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
                {showDialPad && (
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {["1","2","3","4","5","6","7","8","9","*","0","#"].map((digit) => (
                      <Button
                        key={digit}
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => activeCall?.sendDigits(digit)}
                        data-testid={`button-dtmf-${digit === "*" ? "star" : digit === "#" ? "hash" : digit}`}
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                )}
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
                    onClick={() => setShowTransfer(!showTransfer)}
                    variant="outline"
                    className={showTransfer ? "flex-1 toggle-elevate toggle-elevated" : "flex-1"}
                    data-testid="button-transfer-incoming"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                    Transfer
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
                {showTransfer && (
                  <div className="mt-3 border rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Transfer to:</p>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={isTransferring}
                        onClick={() => transferCall("702-325-1702")}
                        data-testid="button-transfer-sara-incoming"
                      >
                        <PhoneForwarded className="h-4 w-4 mr-2" />
                        Sara (702-325-1702)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={isTransferring}
                        onClick={() => transferCall("956-775-7266")}
                        data-testid="button-transfer-christian-incoming"
                      >
                        <PhoneForwarded className="h-4 w-4 mr-2" />
                        Christian (956-775-7266)
                      </Button>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <Input
                        placeholder="Custom number"
                        value={customTransferNumber}
                        onChange={(e) => setCustomTransferNumber(e.target.value)}
                        className="text-sm"
                        data-testid="input-transfer-custom-incoming"
                      />
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isTransferring || !customTransferNumber.trim()}
                        onClick={() => transferCall(customTransferNumber)}
                        data-testid="button-transfer-custom-incoming"
                      >
                        {isTransferring ? "..." : "Go"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showDialPad && callStatus === "ready" && (
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 relative">
                    <Input
                      value={dialPadNumber}
                      onChange={(e) => setDialPadNumber(e.target.value)}
                      placeholder="Enter number"
                      className="text-center text-lg font-mono pr-9"
                      data-testid="input-dial-pad-number"
                    />
                    {dialPadNumber && (
                      <button
                        onClick={() => setDialPadNumber(dialPadNumber.slice(0, -1))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        data-testid="button-dial-pad-backspace"
                      >
                        <Delete className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { digit: "1", sub: "" },
                    { digit: "2", sub: "ABC" },
                    { digit: "3", sub: "DEF" },
                    { digit: "4", sub: "GHI" },
                    { digit: "5", sub: "JKL" },
                    { digit: "6", sub: "MNO" },
                    { digit: "7", sub: "PQRS" },
                    { digit: "8", sub: "TUV" },
                    { digit: "9", sub: "WXYZ" },
                    { digit: "*", sub: "" },
                    { digit: "0", sub: "+" },
                    { digit: "#", sub: "" },
                  ].map(({ digit, sub }) => (
                    <Button
                      key={digit}
                      variant="outline"
                      className="h-12 flex flex-col items-center justify-center"
                      onClick={() => setDialPadNumber(prev => prev + digit)}
                      data-testid={`button-dial-${digit === "*" ? "star" : digit === "#" ? "hash" : digit}`}
                    >
                      <span className="text-lg font-semibold leading-none">{digit}</span>
                      {sub && <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{sub}</span>}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!dialPadNumber.replace(/\D/g, "")}
                    onClick={() => {
                      makeOutboundCall(dialPadNumber);
                      setShowDialPad(false);
                    }}
                    data-testid="button-dial-call"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            )}

            {showSettings && (
              <div className="border-t pt-3 mt-3">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <PhoneForwarded className="h-4 w-4" />
                  Call Forwarding
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="forwarding-enabled" className="text-sm">Enable Forwarding</Label>
                    <Switch
                      id="forwarding-enabled"
                      checked={forwardingSettings?.isEnabled ?? false}
                      onCheckedChange={(checked) => forwardingMutation.mutate({ isEnabled: checked })}
                      data-testid="switch-forwarding-enabled"
                    />
                  </div>
                  <div>
                    <Label htmlFor="forwarding-number" className="text-xs text-muted-foreground">Forward to Number</Label>
                    <Input
                      id="forwarding-number"
                      placeholder="(210) 890-0210"
                      value={fwdNumber}
                      onChange={(e) => setFwdNumber(e.target.value)}
                      onBlur={() => {
                        const val = fwdNumber.replace(/\D/g, "");
                        if (val !== forwardingSettings?.forwardingNumber) {
                          forwardingMutation.mutate({ forwardingNumber: val });
                        }
                      }}
                      data-testid="input-forwarding-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="forwarding-timeout" className="text-xs text-muted-foreground">Ring Browser For (seconds)</Label>
                    <Input
                      id="forwarding-timeout"
                      type="number"
                      min={1}
                      max={30}
                      value={fwdTimeout}
                      onChange={(e) => setFwdTimeout(e.target.value)}
                      onBlur={() => {
                        const val = parseInt(fwdTimeout);
                        if (!isNaN(val) && val !== forwardingSettings?.timeoutSeconds) {
                          forwardingMutation.mutate({ timeoutSeconds: val });
                        }
                      }}
                      data-testid="input-forwarding-timeout"
                    />
                  </div>
                  <div>
                    <Label htmlFor="forwarding-whisper" className="text-xs text-muted-foreground">Whisper Message (heard when answering)</Label>
                    <Input
                      id="forwarding-whisper"
                      placeholder="Incoming call from Windshield Repair SA"
                      value={fwdWhisper}
                      onChange={(e) => setFwdWhisper(e.target.value)}
                      onBlur={() => {
                        if (fwdWhisper !== forwardingSettings?.whisperMessage) {
                          forwardingMutation.mutate({ whisperMessage: fwdWhisper });
                        }
                      }}
                      data-testid="input-forwarding-whisper"
                    />
                  </div>
                  {forwardingSettings?.isEnabled && (
                    <p className="text-xs text-muted-foreground">
                      Calls will ring in browser for {forwardingSettings.timeoutSeconds}s, then forward to {formatPhoneNumber(forwardingSettings.forwardingNumber)}.
                    </p>
                  )}
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

export function CallCenterButton({ onClick, className }: { onClick: () => void; className?: string }) {
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
      className={`rounded-full ${className || ""}`}
      data-testid="button-open-call-center"
    >
      <Phone className="h-4 w-4" />
    </Button>
  );
}
