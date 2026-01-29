import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Users,
  Briefcase,
  Calendar,
  Target,
  Banknote,
  Focus,
  Truck,
  Building2,
  User,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { type Job } from "@shared/schema";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

const stageLabels: Record<string, string> = {
  quote: "Quote",
  scheduled: "Scheduled",
  paid_completed: "Paid/Completed",
  lost_opportunity: "Lost",
};

const leadSourceLabels: Record<string, string> = {
  walkin: "Walk-in",
  phone: "Phone",
  website: "Website",
  referral: "Referral",
  insurance: "Insurance",
  fleet: "Fleet",
  dealer: "Dealer",
  repeat: "Repeat Customer",
  other: "Other",
};

const customerTypeLabels: Record<string, string> = {
  retail: "Retail",
  dealer: "Dealer",
  subcontractor: "Subcontractor",
  insurance: "Insurance",
  fleet: "Fleet",
};

function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function getMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function getYearBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(now.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function parseLocalDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  date.setHours(12, 0, 0, 0);
  return date;
}

function isInRange(dateStr: string | undefined, start: Date, end: Date): boolean {
  const date = parseLocalDate(dateStr);
  if (!date) return false;
  return date >= start && date <= end;
}

type TimePeriod = "week" | "month" | "year" | "all";

export default function Reports() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filteredJobs = useMemo(() => {
    if (timePeriod === "all") return jobs;
    
    const bounds = timePeriod === "week" 
      ? getWeekBounds() 
      : timePeriod === "month" 
        ? getMonthBounds() 
        : getYearBounds();
    
    return jobs.filter(job => {
      // For completed jobs, prefer installDate but fallback to createdAt
      const dateToCheck = job.pipelineStage === "paid_completed" 
        ? (job.installDate || job.createdAt) 
        : job.createdAt;
      if (!dateToCheck) return false;
      return isInRange(dateToCheck.split('T')[0], bounds.start, bounds.end);
    });
  }, [jobs, timePeriod]);

  const completedJobs = useMemo(() => 
    filteredJobs.filter(job => job.pipelineStage === "paid_completed"),
  [filteredJobs]);

  // Financial metrics
  const financialMetrics = useMemo(() => {
    const totalRevenue = completedJobs.reduce((sum, job) => sum + job.totalDue, 0);
    const totalCollected = completedJobs.reduce((sum, job) => sum + job.amountPaid, 0);
    const outstanding = totalRevenue - totalCollected;
    
    const materialsCost = completedJobs.reduce((sum, job) => {
      return sum + job.vehicles.reduce((vSum, vehicle) => {
        return vSum + vehicle.parts.reduce((pSum, part) => {
          return pSum + (part.partPrice || 0) + (part.accessoriesPrice || 0) + (part.urethanePrice || 0);
        }, 0);
      }, 0);
    }, 0);
    
    const laborRevenue = completedJobs.reduce((sum, job) => {
      return sum + job.vehicles.reduce((vSum, vehicle) => {
        return vSum + vehicle.parts.reduce((pSum, part) => pSum + (part.laborPrice || 0), 0);
      }, 0);
    }, 0);
    
    const CALIBRATION_COST = 100;
    const calibrationData = completedJobs.reduce((acc, job) => {
      job.vehicles.forEach(vehicle => {
        vehicle.parts.forEach(part => {
          if (part.calibrationType && part.calibrationType !== "none" && part.calibrationType !== "declined") {
            acc.totalFees += part.calibrationPrice || 0;
            acc.count += 1;
          }
        });
      });
      return acc;
    }, { totalFees: 0, count: 0 });
    
    const calibrationProfit = calibrationData.totalFees - (calibrationData.count * CALIBRATION_COST);
    const grossProfit = totalRevenue - materialsCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      totalCollected,
      outstanding,
      materialsCost,
      laborRevenue,
      calibrationProfit,
      calibrationCount: calibrationData.count,
      grossProfit,
      profitMargin,
      jobCount: completedJobs.length,
      avgJobValue: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
    };
  }, [completedJobs]);

  // Jobs by lead source
  const jobsByLeadSource = useMemo(() => {
    const counts: Record<string, number> = {};
    completedJobs.forEach(job => {
      const source = job.leadSource || "other";
      counts[source] = (counts[source] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: leadSourceLabels[name] || name,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [completedJobs]);

  // Jobs by stage (all filtered jobs, not just completed)
  const jobsByStage = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach(job => {
      counts[job.pipelineStage] = (counts[job.pipelineStage] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: stageLabels[name] || name,
      value,
    }));
  }, [filteredJobs]);

  // Revenue by customer type
  const revenueByCustomerType = useMemo(() => {
    const revenue: Record<string, number> = {};
    completedJobs.forEach(job => {
      const type = job.customerType || "retail";
      revenue[type] = (revenue[type] || 0) + job.totalDue;
    });
    return Object.entries(revenue).map(([name, value]) => ({
      name: customerTypeLabels[name] || name,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [completedJobs]);

  // Jobs by customer type
  const jobsByCustomerType = useMemo(() => {
    const counts: Record<string, number> = {};
    completedJobs.forEach(job => {
      const type = job.customerType || "retail";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: customerTypeLabels[name] || name,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [completedJobs]);

  // Technician performance
  const technicianPerformance = useMemo(() => {
    const techStats: Record<string, { jobs: number; revenue: number; name: string }> = {};
    completedJobs.forEach(job => {
      const techId = job.installedBy || "unassigned";
      const techName = job.installedBy || "Unassigned";
      if (!techStats[techId]) {
        techStats[techId] = { jobs: 0, revenue: 0, name: techName };
      }
      techStats[techId].jobs += 1;
      techStats[techId].revenue += job.totalDue;
    });
    return Object.values(techStats).sort((a, b) => b.jobs - a.jobs);
  }, [completedJobs]);

  // Top customers by revenue
  const topCustomers = useMemo(() => {
    const customerStats: Record<string, { revenue: number; jobs: number; name: string }> = {};
    completedJobs.forEach(job => {
      const customerName = job.isBusiness && job.businessName 
        ? job.businessName 
        : `${job.firstName} ${job.lastName}`;
      const key = customerName.toLowerCase();
      if (!customerStats[key]) {
        customerStats[key] = { revenue: 0, jobs: 0, name: customerName };
      }
      customerStats[key].revenue += job.totalDue;
      customerStats[key].jobs += 1;
    });
    return Object.values(customerStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [completedJobs]);

  // Repeat customers (based on filtered period)
  const repeatCustomerStats = useMemo(() => {
    const customerJobCounts: Record<string, number> = {};
    filteredJobs.forEach(job => {
      const customerName = job.isBusiness && job.businessName 
        ? job.businessName 
        : `${job.firstName} ${job.lastName}`;
      const key = customerName.toLowerCase();
      customerJobCounts[key] = (customerJobCounts[key] || 0) + 1;
    });
    
    const totalCustomers = Object.keys(customerJobCounts).length;
    const repeatCustomers = Object.values(customerJobCounts).filter(count => count > 1).length;
    const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    
    return {
      totalCustomers,
      repeatCustomers,
      repeatRate,
      newCustomers: totalCustomers - repeatCustomers,
    };
  }, [filteredJobs]);
  
  // Business accounts count (based on filtered period)
  const businessAccountsCount = useMemo(() => {
    return filteredJobs.filter(j => j.isBusiness).length;
  }, [filteredJobs]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-32 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
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

  const timePeriodLabel = timePeriod === "week" ? "This Week" 
    : timePeriod === "month" ? "This Month" 
    : timePeriod === "year" ? "This Year" 
    : "All Time";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Business analytics and insights
          </p>
        </div>
        <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <SelectTrigger className="w-[180px]" data-testid="select-time-period">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="financial" data-testid="tab-financial">Financial</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs</TabsTrigger>
          <TabsTrigger value="technicians" data-testid="tab-technicians">Technicians</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
        </TabsList>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-revenue">
                  {formatUSD(financialMetrics.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">{timePeriodLabel}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${financialMetrics.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} data-testid="text-gross-profit">
                  {formatUSD(financialMetrics.grossProfit)}
                </div>
                <p className="text-xs text-muted-foreground">{financialMetrics.profitMargin.toFixed(1)}% margin</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Materials Cost</CardTitle>
                <Briefcase className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-materials-cost">
                  {formatUSD(financialMetrics.materialsCost)}
                </div>
                <p className="text-xs text-muted-foreground">Parts + accessories</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Calibration Profit</CardTitle>
                <Focus className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${financialMetrics.calibrationProfit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`} data-testid="text-calibration-profit">
                  {formatUSD(financialMetrics.calibrationProfit)}
                </div>
                <p className="text-xs text-muted-foreground">{financialMetrics.calibrationCount} calibrations</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Revenue by Customer Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {revenueByCustomerType.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueByCustomerType}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {revenueByCustomerType.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatUSD(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No data for this period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Jobs Completed</span>
                    <span className="font-medium">{financialMetrics.jobCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average Job Value</span>
                    <span className="font-medium">{formatUSD(financialMetrics.avgJobValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Collected</span>
                    <span className="font-medium text-green-600">{formatUSD(financialMetrics.totalCollected)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Outstanding</span>
                    <span className="font-medium text-amber-600">{formatUSD(financialMetrics.outstanding)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Labor Revenue</span>
                    <span className="font-medium">{formatUSD(financialMetrics.laborRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Calibration Revenue</span>
                    <span className="font-medium">{formatUSD(financialMetrics.calibrationProfit + (financialMetrics.calibrationCount * 100))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-jobs">
                  {filteredJobs.length}
                </div>
                <p className="text-xs text-muted-foreground">{timePeriodLabel}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Target className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {completedJobs.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredJobs.length > 0 
                    ? `${((completedJobs.length / filteredJobs.length) * 100).toFixed(0)}% completion`
                    : "0% completion"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                <Calendar className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {filteredJobs.filter(j => j.pipelineStage === "scheduled").length}
                </div>
                <p className="text-xs text-muted-foreground">Pending install</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lost</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {filteredJobs.filter(j => j.pipelineStage === "lost_opportunity").length}
                </div>
                <p className="text-xs text-muted-foreground">Lost opportunities</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Jobs by Lead Source</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {jobsByLeadSource.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jobsByLeadSource} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0088FE" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No data for this period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Jobs by Pipeline Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {jobsByStage.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={jobsByStage}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {jobsByStage.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No data for this period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Jobs by Customer Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {jobsByCustomerType.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jobsByCustomerType}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technicians Tab */}
        <TabsContent value="technicians" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Completed</CardTitle>
                <Truck className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-tech-total">
                  {completedJobs.length}
                </div>
                <p className="text-xs text-muted-foreground">{timePeriodLabel}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Technicians</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {technicianPerformance.filter(t => t.name !== "Unassigned").length}
                </div>
                <p className="text-xs text-muted-foreground">With completed jobs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg per Tech</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {technicianPerformance.filter(t => t.name !== "Unassigned").length > 0 
                    ? (completedJobs.length / technicianPerformance.filter(t => t.name !== "Unassigned").length).toFixed(1)
                    : "0"}
                </div>
                <p className="text-xs text-muted-foreground">Jobs per technician</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Technician Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {technicianPerformance.length > 0 ? (
                <div className="space-y-4">
                  {technicianPerformance.map((tech, index) => (
                    <div key={tech.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{tech.name}</div>
                          <div className="text-sm text-muted-foreground">{tech.jobs} jobs completed</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {formatUSD(tech.revenue)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avg: {formatUSD(tech.revenue / tech.jobs)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No technician data for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Jobs by Technician</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {technicianPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={technicianPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="jobs" fill="#8884d8" name="Jobs" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-customers">
                  {repeatCustomerStats.totalCustomers}
                </div>
                <p className="text-xs text-muted-foreground">{timePeriodLabel}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repeat Customers</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {repeatCustomerStats.repeatCustomers}
                </div>
                <p className="text-xs text-muted-foreground">{repeatCustomerStats.repeatRate.toFixed(1)}% repeat rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Customers</CardTitle>
                <User className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {repeatCustomerStats.newCustomers}
                </div>
                <p className="text-xs text-muted-foreground">First-time only</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Business Accounts</CardTitle>
                <Building2 className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {businessAccountsCount}
                </div>
                <p className="text-xs text-muted-foreground">{timePeriodLabel}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top Customers by Revenue ({timePeriodLabel})</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length > 0 ? (
                <div className="space-y-4">
                  {topCustomers.map((customer, index) => (
                    <div key={customer.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">{customer.jobs} job{customer.jobs !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {formatUSD(customer.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No customer data for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue by Top Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {topCustomers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCustomers.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatUSD(value)} />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip formatter={(value: number) => formatUSD(value)} />
                      <Bar dataKey="revenue" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
