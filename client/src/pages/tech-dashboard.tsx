import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Wrench, Phone, Calendar, CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { Job } from "@shared/schema";

export default function TechDashboard() {
  const { user, logout } = useAuth();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Filter jobs assigned to this technician (for now, show scheduled jobs)
  const scheduledJobs = jobs.filter(job => job.pipelineStage === "scheduled");
  const completedJobs = jobs.filter(job => job.pipelineStage === "paid_completed");

  // Get current week's jobs
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const thisWeekJobs = completedJobs.filter(job => {
    if (!job.installDate) return false;
    const installDate = new Date(job.installDate);
    return installDate >= startOfWeek && installDate < endOfWeek;
  });

  // Last week's jobs
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const lastWeekJobs = completedJobs.filter(job => {
    if (!job.installDate) return false;
    const installDate = new Date(job.installDate);
    return installDate >= startOfLastWeek && installDate < startOfWeek;
  });

  // Yearly stats
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const yearlyJobs = completedJobs.filter(job => {
    if (!job.installDate) return false;
    const installDate = new Date(job.installDate);
    return installDate >= startOfYear;
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "T";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#29ABE2" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#29ABE2" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">AutoGlass Pro</h1>
            <p className="text-xs text-white/80">Technician Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-white/30">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-white/20 text-white">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="text-white hover:bg-white/20"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="text-center py-2">
          <h2 className="text-xl font-semibold text-slate-800">
            Welcome, {user?.firstName || "Technician"}!
          </h2>
          <p className="text-slate-500 text-sm">Here's your job summary</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">{thisWeekJobs.length}</div>
              <div className="text-xs text-slate-500">This Week</div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-slate-600">{lastWeekJobs.length}</div>
              <div className="text-xs text-slate-500">Last Week</div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{yearlyJobs.length}</div>
              <div className="text-xs text-slate-500">This Year</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-600" />
              Scheduled Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduledJobs.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No scheduled jobs</p>
            ) : (
              scheduledJobs.map(job => (
                <div
                  key={job.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                  data-testid={`job-card-${job.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">
                        {job.jobNumber}
                      </div>
                      <div className="text-sm text-slate-600">
                        {job.firstName} {job.lastName}
                      </div>
                      {job.vehicles?.[0] && (
                        <div className="text-xs text-slate-500">
                          {job.vehicles[0].vehicleYear} {job.vehicles[0].vehicleMake} {job.vehicles[0].vehicleModel}
                        </div>
                      )}
                      {job.installDate && (
                        <div className="text-xs text-cyan-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.installDate} {job.installTime && `@ ${job.installTime}`}
                        </div>
                      )}
                    </div>
                    <a href={`tel:${job.phone}`}>
                      <Button
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        data-testid={`button-call-${job.id}`}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Recent Completions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedJobs.slice(0, 5).length === 0 ? (
              <p className="text-center text-slate-500 py-4">No completed jobs yet</p>
            ) : (
              completedJobs.slice(0, 5).map(job => (
                <div
                  key={job.id}
                  className="p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                  data-testid={`completed-job-${job.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{job.jobNumber}</div>
                      <div className="text-sm text-slate-600">
                        {job.firstName} {job.lastName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-600">
                        ${job.totalDue?.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500">{job.installDate}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
