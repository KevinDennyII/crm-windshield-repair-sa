import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  CreditCard,
  Clock,
  Car,
  Package,
  UserCheck,
  FileText,
} from "lucide-react";
import { type Job } from "@shared/schema";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658", "#ff7c7c"];

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

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  check: "Check",
  insurance: "Insurance",
  fleet: "Fleet Account",
  dealer: "Dealer Account",
  financing: "Financing",
};

const glassTypeLabels: Record<string, string> = {
  windshield: "Windshield",
  door_glass: "Door Glass",
  back_glass: "Back Glass",
  back_glass_powerslide: "Back Glass (Powerslide)",
  quarter_glass: "Quarter Glass",
  sunroof: "Sunroof",
  side_mirror: "Side Mirror",
};

function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function getYesterdayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Monday to Sunday = 6 days
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function getLastWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceMonday - 7); // Previous Monday
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Previous Sunday
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

function getLastMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / oneDay);
}

type TimePeriod = "day" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "custom" | "year" | "all";

interface JobListModalState {
  isOpen: boolean;
  title: string;
  jobs: Job[];
}

export default function Reports() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [jobListModal, setJobListModal] = useState<JobListModalState>({
    isOpen: false,
    title: "",
    jobs: [],
  });
  
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const openJobListModal = (title: string, jobList: Job[]) => {
    setJobListModal({ isOpen: true, title, jobs: jobList });
  };

  const closeJobListModal = () => {
    setJobListModal({ isOpen: false, title: "", jobs: [] });
  };

  const filteredJobs = useMemo(() => {
    if (timePeriod === "all") return jobs;
    
    let bounds: { start: Date; end: Date };
    
    if (timePeriod === "custom") {
      if (!customStartDate || !customEndDate) return jobs;
      bounds = {
        start: new Date(customStartDate + "T00:00:00"),
        end: new Date(customEndDate + "T23:59:59"),
      };
    } else {
      switch (timePeriod) {
        case "day": bounds = getDayBounds(); break;
        case "yesterday": bounds = getYesterdayBounds(); break;
        case "week": bounds = getWeekBounds(); break;
        case "lastWeek": bounds = getLastWeekBounds(); break;
        case "month": bounds = getMonthBounds(); break;
        case "lastMonth": bounds = getLastMonthBounds(); break;
        case "year": bounds = getYearBounds(); break;
        default: bounds = getMonthBounds();
      }
    }
    
    return jobs.filter(job => {
      const dateToCheck = job.pipelineStage === "paid_completed" 
        ? (job.installDate || job.createdAt) 
        : job.createdAt;
      if (!dateToCheck) return false;
      return isInRange(dateToCheck.split('T')[0], bounds.start, bounds.end);
    });
  }, [jobs, timePeriod, customStartDate, customEndDate]);

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

  // Daily sales data for chart
  const dailySalesData = useMemo(() => {
    const salesByDate: Record<string, number> = {};
    
    completedJobs.forEach(job => {
      const dateStr = job.installDate || job.createdAt?.split('T')[0];
      if (dateStr) {
        const shortDate = dateStr.split('T')[0];
        salesByDate[shortDate] = (salesByDate[shortDate] || 0) + job.totalDue;
      }
    });
    
    return Object.entries(salesByDate)
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: date,
        amount,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .slice(-30); // Last 30 days
  }, [completedJobs]);

  // A/R Aging Report
  const arAgingData = useMemo(() => {
    const today = new Date();
    const buckets = {
      current: { label: "0-30 Days", amount: 0, count: 0, jobs: [] as Job[] },
      thirtyPlus: { label: "31-60 Days", amount: 0, count: 0, jobs: [] as Job[] },
      sixtyPlus: { label: "61-90 Days", amount: 0, count: 0, jobs: [] as Job[] },
      ninetyPlus: { label: "90+ Days", amount: 0, count: 0, jobs: [] as Job[] },
    };
    
    // Include all jobs with outstanding balance, not just filtered ones
    jobs.forEach(job => {
      const outstanding = job.totalDue - job.amountPaid;
      if (outstanding <= 0) return;
      
      const jobDate = parseLocalDate(job.installDate || job.createdAt?.split('T')[0]);
      if (!jobDate) return;
      
      const daysOld = daysBetween(jobDate, today);
      
      if (daysOld <= 30) {
        buckets.current.amount += outstanding;
        buckets.current.count += 1;
        buckets.current.jobs.push(job);
      } else if (daysOld <= 60) {
        buckets.thirtyPlus.amount += outstanding;
        buckets.thirtyPlus.count += 1;
        buckets.thirtyPlus.jobs.push(job);
      } else if (daysOld <= 90) {
        buckets.sixtyPlus.amount += outstanding;
        buckets.sixtyPlus.count += 1;
        buckets.sixtyPlus.jobs.push(job);
      } else {
        buckets.ninetyPlus.amount += outstanding;
        buckets.ninetyPlus.count += 1;
        buckets.ninetyPlus.jobs.push(job);
      }
    });
    
    return Object.values(buckets);
  }, [jobs]);

  // Sales by payment method
  const salesByPaymentMethod = useMemo(() => {
    const methodTotals: Record<string, number> = {};
    
    completedJobs.forEach(job => {
      const methods = job.paymentMethod || ["cash"];
      const amountPerMethod = job.totalDue / methods.length;
      
      methods.forEach(method => {
        methodTotals[method] = (methodTotals[method] || 0) + amountPerMethod;
      });
    });
    
    return Object.entries(methodTotals)
      .map(([method, amount]) => ({
        name: paymentMethodLabels[method] || method,
        value: amount,
      }))
      .sort((a, b) => b.value - a.value);
  }, [completedJobs]);

  // Jobs by CSR - using leadSource as proxy since createdBy isn't tracked on jobs
  // TODO: Track who created each job in the schema
  const jobsByCSR = useMemo(() => {
    const csrStats: Record<string, { jobs: number; revenue: number; name: string }> = {};
    
    completedJobs.forEach(job => {
      // Use lead source as a proxy for CSR performance tracking
      const source = leadSourceLabels[job.leadSource || "other"] || "Other";
      if (!csrStats[source]) {
        csrStats[source] = { jobs: 0, revenue: 0, name: source };
      }
      csrStats[source].jobs += 1;
      csrStats[source].revenue += job.totalDue;
    });
    
    return Object.values(csrStats).sort((a, b) => b.jobs - a.jobs);
  }, [completedJobs]);

  // Technician performance (jobs per installer)
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

  // Purchases by distributor
  const purchasesByDistributor = useMemo(() => {
    const distributorTotals: Record<string, { parts: number; cost: number }> = {};
    
    completedJobs.forEach(job => {
      job.vehicles.forEach(vehicle => {
        vehicle.parts.forEach(part => {
          const distributor = part.distributor || "Unknown";
          if (!distributorTotals[distributor]) {
            distributorTotals[distributor] = { parts: 0, cost: 0 };
          }
          distributorTotals[distributor].parts += 1;
          distributorTotals[distributor].cost += part.partPrice || 0;
        });
      });
    });
    
    return Object.entries(distributorTotals)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cost - a.cost);
  }, [completedJobs]);

  // Customer detail report (completed jobs)
  const customerDetailData = useMemo(() => {
    return completedJobs.map(job => ({
      jobNumber: job.jobNumber,
      customerName: job.isBusiness && job.businessName 
        ? job.businessName 
        : `${job.firstName} ${job.lastName}`,
      phone: job.phone || "N/A",
      email: job.email || "N/A",
      vehicle: job.vehicles?.[0] 
        ? `${job.vehicles[0].vehicleYear || ""} ${job.vehicles[0].vehicleMake || ""} ${job.vehicles[0].vehicleModel || ""}`.trim()
        : "N/A",
      service: job.vehicles?.[0]?.parts?.[0]?.glassType 
        ? glassTypeLabels[job.vehicles[0].parts[0].glassType] || job.vehicles[0].parts[0].glassType
        : "N/A",
      completedDate: formatDate(job.installDate),
      total: job.totalDue,
      paid: job.amountPaid,
    })).slice(0, 50); // Limit to 50 for performance
  }, [completedJobs]);

  // Most popular glass parts (by glass type)
  const popularGlassParts = useMemo(() => {
    const partCounts: Record<string, number> = {};
    
    completedJobs.forEach(job => {
      job.vehicles.forEach(vehicle => {
        vehicle.parts.forEach(part => {
          const glassType = part.glassType || "unknown";
          partCounts[glassType] = (partCounts[glassType] || 0) + 1;
        });
      });
    });
    
    return Object.entries(partCounts)
      .map(([type, count]) => ({
        name: glassTypeLabels[type] || type,
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [completedJobs]);

  // Most popular parts by Part Number
  const popularPartNumbers = useMemo(() => {
    const partCounts: Record<string, { count: number; glassType: string }> = {};
    
    completedJobs.forEach(job => {
      job.vehicles.forEach(vehicle => {
        vehicle.parts.forEach(part => {
          const partNumber = part.glassPartNumber?.trim();
          if (partNumber) {
            if (!partCounts[partNumber]) {
              partCounts[partNumber] = { count: 0, glassType: part.glassType || "unknown" };
            }
            partCounts[partNumber].count += 1;
          }
        });
      });
    });
    
    return Object.entries(partCounts)
      .map(([partNum, data]) => ({
        partNumber: partNum,
        name: partNum,
        glassType: glassTypeLabels[data.glassType] || data.glassType,
        value: data.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15); // Top 15 part numbers
  }, [completedJobs]);

  // Most popular vehicles
  const popularVehicles = useMemo(() => {
    const vehicleCounts: Record<string, number> = {};
    
    completedJobs.forEach(job => {
      job.vehicles.forEach(vehicle => {
        const makeModel = `${vehicle.vehicleMake || "Unknown"} ${vehicle.vehicleModel || ""}`.trim();
        vehicleCounts[makeModel] = (vehicleCounts[makeModel] || 0) + 1;
      });
    });
    
    return Object.entries(vehicleCounts)
      .map(([vehicle, count]) => ({
        name: vehicle,
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
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

  const timePeriodLabel = timePeriod === "day" ? "Today"
    : timePeriod === "yesterday" ? "Yesterday"
    : timePeriod === "week" ? "This Week" 
    : timePeriod === "lastWeek" ? "Last Week"
    : timePeriod === "month" ? "This Month" 
    : timePeriod === "lastMonth" ? "Last Month"
    : timePeriod === "year" ? "This Year"
    : timePeriod === "custom" ? "Custom Range"
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
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[160px]" data-testid="select-time-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="lastWeek">Last Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          {timePeriod === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-start-date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-end-date"
              />
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1">
          <TabsTrigger value="sales" data-testid="tab-sales" className="text-xs sm:text-sm">Sales</TabsTrigger>
          <TabsTrigger value="ar" data-testid="tab-ar" className="text-xs sm:text-sm">A/R Aging</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs" className="text-xs sm:text-sm">Jobs</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team" className="text-xs sm:text-sm">Team</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers" className="text-xs sm:text-sm">Customers</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Revenue - Completed Jobs", completedJobs)}
              data-testid="card-total-revenue"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Gross Profit - Completed Jobs", completedJobs)}
              data-testid="card-gross-profit"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Completed Jobs", completedJobs)}
              data-testid="card-jobs-completed"
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jobs Completed</CardTitle>
                <Briefcase className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-jobs-count">
                  {financialMetrics.jobCount}
                </div>
                <p className="text-xs text-muted-foreground">Avg: {formatUSD(financialMetrics.avgJobValue)}</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Outstanding Balance", completedJobs.filter(j => j.totalDue > j.amountPaid))}
              data-testid="card-outstanding"
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-outstanding">
                  {formatUSD(financialMetrics.outstanding)}
                </div>
                <p className="text-xs text-muted-foreground">Unpaid balance</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Sales Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daily Sales ({timePeriodLabel})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {dailySalesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySalesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatUSD(value)} />
                      <Bar dataKey="amount" fill="#0088FE" name="Sales" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No sales data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Sales by Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sales by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {salesByPaymentMethod.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesByPaymentMethod}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {salesByPaymentMethod.map((_, index) => (
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

            {/* Revenue by Customer Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sales by Billing Type</CardTitle>
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
          </div>

          {/* Sales Trend Line */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {dailySalesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailySalesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatUSD(value)} />
                      <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No trend data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/R Aging Tab */}
        <TabsContent value="ar" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Shows all outstanding balances regardless of date filter
          </p>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {arAgingData.map((bucket, index) => (
              <Card 
                key={bucket.label}
                className="cursor-pointer hover-elevate"
                onClick={() => openJobListModal(`A/R Aging: ${bucket.label}`, bucket.jobs)}
                data-testid={`card-ar-${index}`}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{bucket.label}</CardTitle>
                  <Clock className={`h-4 w-4 ${
                    index === 0 ? "text-green-500" : 
                    index === 1 ? "text-yellow-500" : 
                    index === 2 ? "text-orange-500" : "text-red-500"
                  }`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    index === 0 ? "text-green-600 dark:text-green-400" : 
                    index === 1 ? "text-yellow-600 dark:text-yellow-400" : 
                    index === 2 ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatUSD(bucket.amount)}
                  </div>
                  <p className="text-xs text-muted-foreground">{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">A/R Aging Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {arAgingData.some(b => b.amount > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={arAgingData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatUSD(value)} />
                      <Bar dataKey="amount" name="Outstanding">
                        {arAgingData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={
                            index === 0 ? "#22c55e" : 
                            index === 1 ? "#eab308" : 
                            index === 2 ? "#f97316" : "#ef4444"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No outstanding balances
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Outstanding: {formatUSD(arAgingData.reduce((sum, b) => sum + b.amount, 0))}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {arAgingData.map((bucket, index) => (
                  <div key={bucket.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? "bg-green-500" : 
                        index === 1 ? "bg-yellow-500" : 
                        index === 2 ? "bg-orange-500" : "bg-red-500"
                      }`} />
                      <span className="text-sm">{bucket.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{formatUSD(bucket.amount)}</span>
                      <span className="text-muted-foreground text-sm ml-2">({bucket.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Total Jobs", filteredJobs)}
              data-testid="card-total-jobs"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Completed Jobs", completedJobs)}
              data-testid="card-completed-jobs"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Scheduled Jobs", filteredJobs.filter(j => j.pipelineStage === "scheduled"))}
              data-testid="card-scheduled-jobs"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Lost Opportunities", filteredJobs.filter(j => j.pipelineStage === "lost_opportunity"))}
              data-testid="card-lost-jobs"
            >
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

          {/* Most Popular Part Numbers Table */}
          <Card data-testid="card-popular-part-numbers">
            <CardHeader>
              <CardTitle className="text-sm font-medium" data-testid="title-popular-parts">Most Popular Parts by Part # ({timePeriodLabel})</CardTitle>
            </CardHeader>
            <CardContent>
              {popularPartNumbers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table data-testid="table-popular-parts">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-12">#</TableHead>
                        <TableHead>Glass Part #</TableHead>
                        <TableHead>Glass Type</TableHead>
                        <TableHead className="text-right">Installs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {popularPartNumbers.map((part, index) => (
                        <TableRow key={part.partNumber} data-testid={`row-part-${index}`}>
                          <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-mono font-medium" data-testid={`text-part-number-${index}`}>{part.partNumber}</TableCell>
                          <TableCell data-testid={`text-glass-type-${index}`}>{part.glassType}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" data-testid={`badge-install-count-${index}`}>{part.value}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground" data-testid="text-no-parts">
                  No part numbers recorded for this period
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Most Popular Glass Parts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Most Popular Glass Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {popularGlassParts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={popularGlassParts} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8" name="Jobs" />
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

            {/* Most Popular Vehicles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Most Popular Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {popularVehicles.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={popularVehicles} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#00C49F" name="Jobs" />
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
        </TabsContent>

        {/* Team Tab (CSR + Technicians) */}
        <TabsContent value="team" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Jobs by Lead Source (proxy for CSR performance) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Jobs by Lead Source</CardTitle>
              </CardHeader>
              <CardContent>
                {jobsByCSR.length > 0 ? (
                  <div className="space-y-4">
                    {jobsByCSR.map((csr, index) => (
                      <div key={csr.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 font-medium text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{csr.name}</div>
                            <div className="text-sm text-muted-foreground">{csr.jobs} jobs sold</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600 dark:text-green-400">
                            {formatUSD(csr.revenue)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Avg: {formatUSD(csr.revenue / csr.jobs)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No CSR data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Jobs per Installer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Jobs per Installer</CardTitle>
              </CardHeader>
              <CardContent>
                {technicianPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {technicianPerformance.map((tech, index) => (
                      <div key={tech.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 font-medium text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{tech.name}</div>
                            <div className="text-sm text-muted-foreground">{tech.jobs} jobs installed</div>
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
                    No installer data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Jobs by Lead Source Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {jobsByCSR.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jobsByCSR}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="jobs" fill="#0088FE" name="Jobs Sold" />
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
                <CardTitle className="text-sm font-medium">Installer Performance Chart</CardTitle>
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
                        <Bar dataKey="jobs" fill="#8884d8" name="Jobs Installed" />
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
          </div>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Purchases by Distributor</CardTitle>
            </CardHeader>
            <CardContent>
              {purchasesByDistributor.length > 0 ? (
                <div className="space-y-4">
                  {purchasesByDistributor.map((dist, index) => (
                    <div key={dist.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 font-medium text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{dist.name}</div>
                          <div className="text-sm text-muted-foreground">{dist.parts} parts ordered</div>
                        </div>
                      </div>
                      <div className="font-medium text-orange-600 dark:text-orange-400">
                        {formatUSD(dist.cost)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No distributor data for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Purchases by Distributor Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {purchasesByDistributor.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={purchasesByDistributor} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatUSD(value)} />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip formatter={(value: number) => formatUSD(value)} />
                      <Bar dataKey="cost" fill="#f97316" name="Total Cost" />
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
            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("All Customer Jobs", filteredJobs)}
              data-testid="card-total-customers"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Repeat Customer Jobs", filteredJobs.filter(j => {
                const key = j.phone || j.email;
                const count = filteredJobs.filter(job => job.phone === key || job.email === key).length;
                return count > 1;
              }))}
              data-testid="card-repeat-customers"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("New Customer Jobs", filteredJobs.filter(j => {
                const key = j.phone || j.email;
                const count = filteredJobs.filter(job => job.phone === key || job.email === key).length;
                return count === 1;
              }))}
              data-testid="card-new-customers"
            >
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

            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => openJobListModal("Business Account Jobs", filteredJobs.filter(j => j.isBusiness))}
              data-testid="card-business-accounts"
            >
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

          {/* Customer Detail Report */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Customer Detail Report (Completed Jobs)</CardTitle>
            </CardHeader>
            <CardContent>
              {customerDetailData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerDetailData.map((row) => (
                        <TableRow key={row.jobNumber}>
                          <TableCell className="font-medium">{row.jobNumber}</TableCell>
                          <TableCell>{row.customerName}</TableCell>
                          <TableCell>{row.phone}</TableCell>
                          <TableCell>{row.vehicle}</TableCell>
                          <TableCell>{row.service}</TableCell>
                          <TableCell>{row.completedDate}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.total)}</TableCell>
                          <TableCell className={`text-right ${row.paid < row.total ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatUSD(row.paid)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No completed jobs for this period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Job List Modal */}
      <Dialog open={jobListModal.isOpen} onOpenChange={(open) => !open && closeJobListModal()}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{jobListModal.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {jobListModal.jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Vehicle(s)</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobListModal.jobs.map((job) => (
                    <TableRow key={job.id} data-testid={`modal-job-row-${job.id}`}>
                      <TableCell className="font-medium">{job.jobNumber}</TableCell>
                      <TableCell>{job.isBusiness ? job.businessName : `${job.firstName} ${job.lastName}`}</TableCell>
                      <TableCell>
                        <Badge variant={
                          job.pipelineStage === "paid_completed" ? "default" :
                          job.pipelineStage === "scheduled" ? "secondary" :
                          job.pipelineStage === "lost_opportunity" ? "destructive" :
                          "outline"
                        }>
                          {stageLabels[job.pipelineStage] || job.pipelineStage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {job.vehicles.map((v, i) => (
                          <div key={i} className="text-sm">
                            {v.vehicleYear} {v.vehicleMake} {v.vehicleModel}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {formatDate(job.installDate || job.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">{formatUSD(job.totalDue)}</TableCell>
                      <TableCell className={`text-right ${job.amountPaid < job.totalDue ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatUSD(job.amountPaid)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No jobs found
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {jobListModal.jobs.length} job{jobListModal.jobs.length !== 1 ? 's' : ''}
            </span>
            <Button variant="outline" onClick={closeJobListModal}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
