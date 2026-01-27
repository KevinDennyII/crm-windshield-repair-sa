import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Phone,
  Car,
  DollarSign,
  GripVertical,
  MessageSquare,
  Mail,
} from "lucide-react";
import { type Job, type PipelineStage, pipelineStages } from "@shared/schema";
import { cn } from "@/lib/utils";
import { EmailComposeModal } from "./email-compose-modal";

const stageConfig: Record<
  PipelineStage,
  { label: string; color: string; bgColor: string }
> = {
  quote: {
    label: "Quote",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  scheduled: {
    label: "Scheduled",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
  },
  paid_completed: {
    label: "Paid/Completed",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  lost_opportunity: {
    label: "Lost Opportunity",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-red-100 dark:bg-red-950/40",
  },
};

interface KanbanBoardProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
  onAddJob: () => void;
  onMoveJob: (jobId: string, newStage: PipelineStage) => void;
}

export function KanbanBoard({
  jobs,
  onJobClick,
  onAddJob,
  onMoveJob,
}: KanbanBoardProps) {
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(
    null
  );
  const [emailJob, setEmailJob] = useState<Job | null>(null);
  const [hideLostOpportunity, setHideLostOpportunity] = useState(false);

  const activeJobsCount = hideLostOpportunity 
    ? jobs.filter(job => job.pipelineStage !== "lost_opportunity").length 
    : jobs.length;

  const handleDragStart = (e: React.DragEvent, job: Job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    if (draggedJob && draggedJob.pipelineStage !== stage) {
      onMoveJob(draggedJob.id, stage);
    }
    setDraggedJob(null);
    setDragOverStage(null);
  };

  const getJobsByStage = (stage: PipelineStage) =>
    jobs.filter((job) => job.pipelineStage === stage);

  const getPaymentBadge = (job: Job) => {
    switch (job.paymentStatus) {
      case "paid":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs"
          >
            Paid
          </Badge>
        );
      case "partial":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs"
          >
            Partial
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-xs"
          >
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-semibold">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            {activeJobsCount} active jobs in pipeline
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={hideLostOpportunity}
              onChange={(e) => setHideLostOpportunity(e.target.checked)}
              className="rounded border-gray-300"
              data-testid="checkbox-hide-lost"
            />
            Hide Lost from count
          </label>
          <Button onClick={onAddJob} data-testid="button-add-job">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex gap-4 min-w-max pb-4 md:min-w-0 md:grid md:grid-cols-4">
          {pipelineStages.map((stage) => {
            const config = stageConfig[stage];
            const stageJobs = getJobsByStage(stage);
            const isDragOver = dragOverStage === stage;

            return (
              <div
                key={stage}
                className={cn(
                  "flex flex-col min-w-[260px] md:min-w-0 rounded-lg transition-colors",
                  config.bgColor,
                  isDragOver && "ring-2 ring-primary ring-offset-2"
                )}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
                data-testid={`kanban-column-${stage}`}
              >
                <div className="p-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <h3 className={cn("font-medium text-sm", config.color)}>
                      {config.label}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-background/80 text-xs"
                    >
                      {stageJobs.length}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 kanban-column overflow-y-auto scrollbar-thin">
                  {stageJobs.map((job) => (
                    <Card
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      onClick={() => onJobClick(job)}
                      className={cn(
                        "p-3 cursor-pointer hover-elevate active-elevate-2 transition-all",
                        draggedJob?.id === job.id && "opacity-50"
                      )}
                      data-testid={`job-card-${job.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs text-muted-foreground">#{job.jobNumber}</span>
                              <span className="font-medium text-sm truncate">
                                {getCustomerName(job)}
                              </span>
                            </div>
                            {getPaymentBadge(job)}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{job.phone}</span>
                            </div>
                            {job.vehicles && job.vehicles.length > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Car className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {job.vehicles[0].vehicleYear} {job.vehicles[0].vehicleMake}{" "}
                                  {job.vehicles[0].vehicleModel}
                                  {job.vehicles.length > 1 && ` (+${job.vehicles.length - 1} more)`}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <DollarSign className="h-3 w-3 flex-shrink-0" />
                              <span>${job.totalDue.toFixed(2)}</span>
                              {job.balanceDue > 0 && job.balanceDue < job.totalDue && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  (${job.balanceDue.toFixed(2)} due)
                                </span>
                              )}
                            </div>
                          </div>

                          {job.phone && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={`tel:${job.phone}`}
                                  data-testid={`button-call-${job.id}`}
                                >
                                  <Phone className="h-3 w-3 mr-1" />
                                  Call
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={`sms:${job.phone}`}
                                  data-testid={`button-text-${job.id}`}
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Text
                                </a>
                              </Button>
                              {job.email && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEmailJob(job);
                                  }}
                                  data-testid={`button-email-${job.id}`}
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Email
                                </Button>
                              )}
                            </div>
                          )}

                          {job.vehicles && job.vehicles.length > 0 && job.vehicles[0].parts && job.vehicles[0].parts.length > 0 && job.vehicles[0].parts[0].glassPartNumber && (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                {job.vehicles[0].parts[0].glassPartNumber}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                  {stageJobs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="text-muted-foreground text-sm">
                        No jobs in this stage
                      </div>
                      <div className="text-xs text-muted-foreground/60 mt-1">
                        Drag cards here or create new
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {emailJob && (
        <EmailComposeModal
          job={emailJob}
          open={!!emailJob}
          onOpenChange={(open) => !open && setEmailJob(null)}
        />
      )}
    </div>
  );
}
