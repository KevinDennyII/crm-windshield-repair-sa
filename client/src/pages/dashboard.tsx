import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Kanban,
  DollarSign,
  Car,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import { type Job } from "@shared/schema";

const stageLabels: Record<string, string> = {
  quote: "Quote",
  scheduled: "Scheduled",
  paid_completed: "Paid/Completed",
  lost_opportunity: "Lost Opportunity",
};

// Get Monday-Saturday week boundaries (resets every Monday at midnight)
function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days since last Monday
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Start of week (Monday at 00:00:00)
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  
  // End of week (Saturday at 23:59:59)
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

// Check if a date falls within Mon-Sat of current week
function isInCurrentWeek(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  // Parse date string as local date (YYYY-MM-DD format) to avoid timezone issues
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  date.setHours(12, 0, 0, 0); // Set to noon to avoid edge cases
  const { start, end } = getWeekBounds();
  return date >= start && date <= end;
}

// Format currency as USD
function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Dashboard() {
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const totalJobs = jobs.length;
  const totalRevenue = jobs.reduce((sum, job) => sum + job.totalDue, 0);
  const paidJobs = jobs.filter((job) => job.paymentStatus === "paid").length;
  const pendingJobs = jobs.filter((job) => job.paymentStatus === "pending").length;
  const scheduledJobs = jobs.filter((job) => job.pipelineStage === "scheduled").length;
  const totalCollected = jobs.reduce((sum, job) => sum + job.amountPaid, 0);

  // Weekly metrics (Mon-Sat) - only count Paid/Completed jobs
  const weeklyCompletedJobs = jobs.filter(
    (job) => job.pipelineStage === "paid_completed" && isInCurrentWeek(job.installDate)
  );
  
  // Materials Cost: sum of all materialCost from parts in completed jobs this week
  const weeklyMaterialsCost = weeklyCompletedJobs.reduce((sum, job) => {
    const jobMaterialsCost = job.vehicles.reduce((vSum, vehicle) => {
      return vSum + vehicle.parts.reduce((pSum, part) => pSum + (part.materialCost || 0), 0);
    }, 0);
    return sum + jobMaterialsCost;
  }, 0);
  
  // Weekly Revenue: sum of totalDue from completed jobs this week
  const weeklyRevenue = weeklyCompletedJobs.reduce((sum, job) => sum + job.totalDue, 0);
  
  // Weekly Profit: revenue minus materials
  const weeklyProfit = weeklyRevenue - weeklyMaterialsCost;

  const jobsByStage = jobs.reduce((acc, job) => {
    acc[job.pipelineStage] = (acc[job.pipelineStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentJobs = [...jobs]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const getCustomerName = (job: Job) => {
    if (job.isBusiness && job.businessName) {
      return job.businessName;
    }
    return `${job.firstName} ${job.lastName}`;
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-32 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your auto glass business
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Kanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-jobs">{totalJobs}</div>
            <p className="text-xs text-muted-foreground">Active in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-value">
              ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">Pipeline value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400" data-testid="text-scheduled">
              {scheduledJobs}
            </div>
            <p className="text-xs text-muted-foreground">Ready for install</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-completed">
              {paidJobs}
            </div>
            <p className="text-xs text-muted-foreground">Paid & completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materials Cost</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-materials-cost">
              {formatUSD(weeklyMaterialsCost)}
            </div>
            <p className="text-xs text-muted-foreground">This week (Mon-Sat)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Profit</CardTitle>
            <Banknote className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${weeklyProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} data-testid="text-weekly-profit">
              {formatUSD(weeklyProfit)}
            </div>
            <p className="text-xs text-muted-foreground">This week (Mon-Sat)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stageLabels).map(([stage, label]) => {
                const count = jobsByStage[stage] || 0;
                const percentage = totalJobs > 0 ? (count / totalJobs) * 100 : 0;

                return (
                  <div key={stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pending Payment</p>
                  <p className="text-xs text-muted-foreground">
                    {pendingJobs} jobs awaiting payment
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Collected</p>
                  <p className="text-xs text-muted-foreground">
                    ${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 0 })} received
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Avg Job Value</p>
                  <p className="text-xs text-muted-foreground">
                    ${totalJobs > 0 ? (totalRevenue / totalJobs).toFixed(0) : 0} per job
                  </p>
                </div>
              </div>

              {pendingJobs > 3 && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Action Needed</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingJobs} jobs need follow-up
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`recent-job-${job.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background">
                      <Car className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{job.jobNumber}</span>
                        <p className="text-sm font-medium">{getCustomerName(job)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.vehicles.length > 0 
                          ? `${job.vehicles[0].vehicleYear} ${job.vehicles[0].vehicleMake} ${job.vehicles[0].vehicleModel}${job.vehicles.length > 1 ? ` +${job.vehicles.length - 1} more` : ''}`
                          : 'No vehicle info'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${job.totalDue.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {stageLabels[job.pipelineStage]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
