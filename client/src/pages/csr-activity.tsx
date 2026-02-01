import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Activity, User, Briefcase, Mail, MessageSquare, Calendar, LogIn, ArrowRightLeft } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  userRole: string;
  actionType: string;
  actionCategory: string;
  jobId?: string;
  jobNumber?: string;
  details?: Record<string, any>;
  createdAt: string;
}

interface ActivitySummary {
  userId: string;
  username: string;
  userRole: string;
  totalActions: number;
  jobsCreated: number;
  stageChanges: number;
  emailsSent: number;
  smsSent: number;
  logins: number;
  firstActivity: string;
  lastActivity: string;
}

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function CsrActivity() {
  const [dateRange, setDateRange] = useState("7d");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const getDateRange = () => {
    const end = endOfDay(new Date());
    let start;
    switch (dateRange) {
      case "1d": start = startOfDay(new Date()); break;
      case "7d": start = startOfDay(subDays(new Date(), 7)); break;
      case "30d": start = startOfDay(subDays(new Date(), 30)); break;
      case "90d": start = startOfDay(subDays(new Date(), 90)); break;
      default: start = startOfDay(subDays(new Date(), 7));
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: summary = [], isLoading: summaryLoading } = useQuery<ActivitySummary[]>({
    queryKey: ["/api/activity-summary", getDateRange()],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const res = await fetch(`/api/activity-summary?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", selectedUser, getDateRange()],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      let url = `/api/activity-logs?startDate=${startDate}&endDate=${endDate}&limit=200`;
      if (selectedUser !== "all") {
        url += `&userId=${selectedUser}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "login":
      case "logout":
        return <LogIn className="h-4 w-4" />;
      case "job_created":
      case "job_updated":
        return <Briefcase className="h-4 w-4" />;
      case "job_stage_changed":
        return <ArrowRightLeft className="h-4 w-4" />;
      case "email_sent":
      case "email_replied":
        return <Mail className="h-4 w-4" />;
      case "sms_sent":
        return <MessageSquare className="h-4 w-4" />;
      case "calendar_event_created":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    return actionType.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const formatActionDetails = (log: ActivityLog) => {
    const details = log.details || {};
    switch (log.actionType) {
      case "job_created":
        return `Created job for ${details.customerName || "customer"}`;
      case "job_stage_changed":
        return `Moved from ${details.fromStage || "?"} to ${details.toStage || "?"}`;
      case "payment_recorded":
        return `Recorded $${details.amount?.toFixed(2) || "0"} payment`;
      case "email_sent":
      case "email_replied":
        return `To: ${details.to || "recipient"}`;
      case "sms_sent":
        return `To: ${details.to || "recipient"}`;
      case "login":
        return "Logged in";
      case "logout":
        return "Logged out";
      default:
        return JSON.stringify(details).substring(0, 50);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default";
      case "csr": return "secondary";
      case "technician": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">CSR Activity Report</h1>
          <p className="text-muted-foreground">Monitor staff actions and productivity</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {summaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : summary.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No activity recorded in this time period
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.map((user) => (
                <Card key={user.userId} data-testid={`card-user-${user.userId}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.username || "Unknown"}
                      </CardTitle>
                      <Badge variant={getRoleBadgeVariant(user.userRole)}>
                        {user.userRole?.toUpperCase()}
                      </Badge>
                    </div>
                    <CardDescription>
                      {user.totalActions} total actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <span>{user.jobsCreated} jobs created</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-purple-500" />
                        <span>{user.stageChanges} stage moves</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-green-500" />
                        <span>{user.emailsSent} emails</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-orange-500" />
                        <span>{user.smsSent} texts</span>
                      </div>
                    </div>
                    {user.lastActivity && (
                      <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                        Last active: {format(new Date(user.lastActivity), "MMM d, h:mm a")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-[200px]" data-testid="select-user-filter">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No activity found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {log.createdAt ? format(new Date(log.createdAt), "MMM d, h:mm a") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.username}</span>
                            <Badge variant="outline" className="text-xs">
                              {log.userRole}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.actionType)}
                            <span>{getActionLabel(log.actionType)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.jobNumber ? (
                            <Badge variant="outline">#{log.jobNumber}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {formatActionDetails(log)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
