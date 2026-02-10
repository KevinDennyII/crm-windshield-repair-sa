import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bell, Phone, PhoneMissed, MessageSquare, Mail, UserPlus } from "lucide-react";

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

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(() => {
    const stored = localStorage.getItem("notification_last_seen_count");
    return stored ? parseInt(stored, 10) : 0;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<NotificationData>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const totalCount = data?.totalCount || 0;
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
        <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto z-50 shadow-lg">
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold" data-testid="text-notification-title">Notifications</h3>
          </div>

          <div className="divide-y">
            {(!data || totalCount === 0) && (
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
                  <div key={lead.id} className="px-3 py-2 hover-elevate" data-testid={`notification-new-lead-${lead.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserPlus className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            #{lead.jobNumber} - {lead.firstName} {lead.lastName}
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
