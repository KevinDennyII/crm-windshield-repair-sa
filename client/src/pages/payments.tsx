import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { type Job } from "@shared/schema";

const stageLabels: Record<string, string> = {
  quote: "Quote",
  scheduled: "Scheduled",
  paid_completed: "Paid/Completed",
  lost_opportunity: "Lost Opportunity",
};

export default function Payments() {
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const totalRevenue = jobs.reduce((sum, job) => sum + job.totalDue, 0);
  const totalDeductibles = jobs.reduce((sum, job) => sum + job.deductible, 0);
  const paidJobs = jobs.filter((job) => job.paymentStatus === "paid");
  const pendingJobs = jobs.filter((job) => job.paymentStatus === "pending");
  const partialJobs = jobs.filter((job) => job.paymentStatus === "partial");

  const paidAmount = paidJobs.reduce((sum, job) => sum + job.amountPaid, 0);
  const pendingAmount = jobs.reduce((sum, job) => sum + job.balanceDue, 0);

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Paid
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Partial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Pending
          </Badge>
        );
    }
  };

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
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Track financial data from all auto glass jobs
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {jobs.length} total jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-collected">
              ${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidJobs.length} paid jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-pending">
              ${pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingJobs.length + partialJobs.length} awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deductibles</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-deductibles">
              ${totalDeductibles.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Customer responsibility
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden sm:table-cell">Stage</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Deductible</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Paid</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No jobs found. Create your first job in Opportunities.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id} data-testid={`payment-row-${job.id}`}>
                      <TableCell className="font-mono text-xs">
                        #{job.jobNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getCustomerName(job)}</div>
                          <div className="text-sm text-muted-foreground md:hidden">
                            {job.vehicleYear} {job.vehicleMake} {job.vehicleModel}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {job.vehicleYear} {job.vehicleMake} {job.vehicleModel}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{stageLabels[job.pipelineStage]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${job.totalDue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        ${job.deductible.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-green-600 dark:text-green-400">
                        ${job.amountPaid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        {job.balanceDue > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            ${job.balanceDue.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">$0.00</span>
                        )}
                      </TableCell>
                      <TableCell>{getPaymentBadge(job.paymentStatus)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
