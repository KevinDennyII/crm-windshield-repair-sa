import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bell, Phone, PhoneMissed, MessageSquare, Mail, UserPlus, Send, PhoneCall, Clock, ChevronDown, ChevronUp, CheckCircle2, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MissedCall {
  id: string;
  fromNumber: string;
  contactName: string | null;
  startedAt: string;
}

interface NewLead {
  id: string;
  jobNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  actionType: string;
  details: any;
  jobNumber: string | null;
  createdAt: string;
}

interface NotificationData {
  totalCount: number;
  missedCalls: MissedCall[];
  newLeads: NewLead[];
  recentSms: ActivityItem[];
  recentEmails: ActivityItem[];
}

interface FollowUpNotification {
  id: string;
  jobId: string;
  sequenceNumber: number;
  taskType: string;
  status: string;
  scheduledAt: string;
  smsContent: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  vehicleInfo: string | null;
  jobNumber: string | null;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const SEQUENCE_LABELS: Record<number, string> = {
  1: "Quick Quote Receipt",
  2: "Value Proposition",
  3: "Availability Alert",
  4: "Transparent Pricing",
  5: "Safety & ADAS",
  6: "Special Offer",
  7: "Final Call",
};

function FollowUpItem({ task, onOpenJob }: { task: FollowUpNotification; onOpenJob: (jobId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showCallLog, setShowCallLog] = useState(false);
  const [callResult, setCallResult] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const { toast } = useToast();
  const isSent = task.status === "sent";

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/follow-up-tasks/${task.id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/follow-up-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { sendSms?: boolean; sendEmail?: boolean }) => {
      const res = await apiRequest("POST", `/api/follow-up-tasks/${task.id}/send`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Follow-up sent", description: `Sent to ${task.customerName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/follow-up-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({ title: "Failed to send", variant: "destructive" });
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async (data: { result: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/follow-up-tasks/${task.id}/log-call`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Call logged", description: `Result: ${callResult}` });
      setShowCallLog(false);
      setCallResult("");
      setCallNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/follow-up-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({ title: "Failed to log call", variant: "destructive" });
    },
  });

  return (
    <div className={`px-3 py-2 border-b last:border-b-0 ${isSent ? "bg-muted/30" : ""}`} data-testid={`notification-followup-${task.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
          onClick={() => onOpenJob(task.jobId)}
          data-testid={`link-open-job-${task.id}`}
        >
          <Clock className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isSent ? "text-green-500" : "text-amber-500"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate flex items-center gap-1">
              #{task.jobNumber} - {task.customerName}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </p>
            <p className="text-xs text-muted-foreground">{task.customerPhone}</p>
            <p className="text-xs text-muted-foreground">{task.vehicleInfo}</p>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                Seq {task.sequenceNumber}: {SEQUENCE_LABELS[task.sequenceNumber] || `Step ${task.sequenceNumber}`}
              </Badge>
              {isSent && (
                <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                  Sent
                </Badge>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground p-1"
          data-testid={`button-expand-followup-${task.id}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 pl-6">
          {task.smsContent && (
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> SMS Preview
              </p>
              <p className="text-xs leading-relaxed">{task.smsContent}</p>
            </div>
          )}
          {task.emailSubject && (
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email Preview
              </p>
              <p className="text-xs font-medium">{task.emailSubject}</p>
              <p className="text-xs leading-relaxed mt-1 line-clamp-3">{task.emailBody}</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => sendMutation.mutate({ sendSms: true, sendEmail: true })}
              disabled={sendMutation.isPending}
              data-testid={`button-send-followup-${task.id}`}
            >
              <Send className="h-3 w-3 mr-1" />
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
            {task.smsContent && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendMutation.mutate({ sendSms: true, sendEmail: false })}
                disabled={sendMutation.isPending}
                data-testid={`button-send-sms-${task.id}`}
              >
                <MessageSquare className="h-3 w-3 mr-1" /> SMS Only
              </Button>
            )}
            {task.emailSubject && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendMutation.mutate({ sendSms: false, sendEmail: true })}
                disabled={sendMutation.isPending}
                data-testid={`button-send-email-${task.id}`}
              >
                <Mail className="h-3 w-3 mr-1" /> Email Only
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCallLog(!showCallLog)}
              data-testid={`button-log-call-${task.id}`}
            >
              <PhoneCall className="h-3 w-3 mr-1" /> Log Call Result
            </Button>
          </div>

          {showCallLog && (
            <div className="space-y-2 border rounded-md p-2">
              <select
                value={callResult}
                onChange={(e) => setCallResult(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                data-testid={`select-call-result-${task.id}`}
              >
                <option value="">Select result...</option>
                <option value="answered_booked">Answered - Booked</option>
                <option value="answered_interested">Answered - Interested</option>
                <option value="answered_not_interested">Answered - Not Interested</option>
                <option value="voicemail">Left Voicemail</option>
                <option value="no_answer">No Answer</option>
                <option value="wrong_number">Wrong Number</option>
                <option value="callback_requested">Callback Requested</option>
              </select>
              <input
                type="text"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                data-testid={`input-call-notes-${task.id}`}
              />
              <Button
                size="sm"
                disabled={!callResult || logCallMutation.isPending}
                onClick={() => logCallMutation.mutate({ result: callResult, notes: callNotes })}
                data-testid={`button-submit-call-log-${task.id}`}
              >
                {logCallMutation.isPending ? "Saving..." : "Save Call Result"}
              </Button>
            </div>
          )}

          <div className="pt-2 border-t">
            <Button
              size="sm"
              variant={isSent ? "default" : "outline"}
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="w-full"
              data-testid={`button-complete-task-${task.id}`}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {completeMutation.isPending ? "Completing..." : "Mark Complete"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationBell() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(() => {
    const stored = localStorage.getItem("notification_last_seen_count");
    return stored ? parseInt(stored, 10) : 0;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleOpenJob = (jobId: string) => {
    setIsOpen(false);
    navigate(`/?openJob=${jobId}`);
  };

  const { data } = useQuery<NotificationData>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const { data: followUpNotifications } = useQuery<FollowUpNotification[]>({
    queryKey: ["/api/follow-up-notifications"],
    refetchInterval: 30000,
  });

  const followUpCount = followUpNotifications?.length || 0;
  const totalCount = (data?.totalCount || 0) + followUpCount;
  const unreadCount = Math.max(0, totalCount - lastSeenCount);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      setLastSeenCount(totalCount);
      localStorage.setItem("notification_last_seen_count", String(totalCount));
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className="relative"
        data-testid="button-notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            data-testid="badge-notification-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] overflow-auto z-50 shadow-lg">
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold" data-testid="text-notification-title">Notifications</h3>
          </div>

          <div className="divide-y">
            {followUpNotifications && followUpNotifications.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Follow-Up Tasks ({followUpNotifications.length})
                  </span>
                </div>
                {followUpNotifications.map((task) => (
                  <FollowUpItem key={task.id} task={task} onOpenJob={handleOpenJob} />
                ))}
              </div>
            )}

            {(!data || (data.totalCount === 0 && followUpCount === 0)) && (
              <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
                No recent notifications
              </div>
            )}

            {data?.missedCalls && data.missedCalls.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-muted/50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <PhoneMissed className="h-3 w-3" />
                    Missed Calls ({data.missedCalls.length})
                  </span>
                </div>
                {data.missedCalls.map((call) => (
                  <div key={call.id} className="px-3 py-2 hover-elevate" data-testid={`notification-missed-call-${call.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className="h-4 w-4 text-destructive flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {call.contactName || call.fromNumber}
                          </p>
                          {call.contactName && (
                            <p className="text-xs text-muted-foreground">{call.fromNumber}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(call.startedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data?.newLeads && data.newLeads.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-muted/50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    New Leads ({data.newLeads.length})
                  </span>
                </div>
                {data.newLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="px-3 py-2 hover-elevate cursor-pointer"
                    onClick={() => handleOpenJob(lead.id)}
                    data-testid={`notification-new-lead-${lead.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserPlus className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1">
                            #{lead.jobNumber} - {lead.firstName} {lead.lastName}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </p>
                          <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(lead.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data?.recentSms && data.recentSms.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-muted/50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    SMS Messages ({data.recentSms.length})
                  </span>
                </div>
                {data.recentSms.map((sms) => (
                  <div key={sms.id} className="px-3 py-2 hover-elevate" data-testid={`notification-sms-${sms.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {sms.jobNumber ? `Job #${sms.jobNumber}` : "SMS Sent"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(sms.details as any)?.to || (sms.details as any)?.preview || "Message sent"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(sms.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data?.recentEmails && data.recentEmails.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-muted/50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Emails ({data.recentEmails.length})
                  </span>
                </div>
                {data.recentEmails.map((email) => (
                  <div key={email.id} className="px-3 py-2 hover-elevate" data-testid={`notification-email-${email.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {email.jobNumber ? `Job #${email.jobNumber}` : "Email Sent"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(email.details as any)?.to || (email.details as any)?.subject || "Email sent"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(email.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
