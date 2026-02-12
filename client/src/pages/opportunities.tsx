import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/kanban-board";
import { JobDetailModal } from "@/components/job-detail-modal";
import { RepeatCustomerReminderDialog } from "@/components/repeat-customer-reminder-dialog";
import { ConfirmationSendModal } from "@/components/confirmation-send-modal";
import { type Job, type InsertJob, type PipelineStage, type PaymentHistoryEntry } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIContext } from "@/contexts/ai-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

export default function Opportunities() {
  const { toast } = useToast();
  const { setSelectedEntity, clearSelectedEntity } = useAIContext();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewJob, setIsNewJob] = useState(false);
  
  const [pendingMoveJob, setPendingMoveJob] = useState<{ job: Job; newStage: PipelineStage } | null>(null);
  const [showRepeatReminder, setShowRepeatReminder] = useState(false);
  
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [jobForConfirmation, setJobForConfirmation] = useState<Job | null>(null);
  const [pendingSaveData, setPendingSaveData] = useState<{ previousStage: string; newData: InsertJob } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  useEffect(() => {
    if (selectedJob && isModalOpen) {
      const firstVehicle = selectedJob.vehicles?.[0];
      const vehicleInfo = firstVehicle 
        ? `${firstVehicle.vehicleYear} ${firstVehicle.vehicleMake} ${firstVehicle.vehicleModel}`
        : "Unknown Vehicle";
      setSelectedEntity({
        type: "job",
        id: selectedJob.id,
        name: selectedJob.jobNumber || `Job ${selectedJob.id}`,
        details: {
          customerName: `${selectedJob.firstName} ${selectedJob.lastName}`,
          vehicleInfo,
          stage: selectedJob.pipelineStage,
        },
      });
    } else {
      clearSelectedEntity();
    }
  }, [selectedJob, isModalOpen, setSelectedEntity, clearSelectedEntity]);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const createJobMutation = useMutation({
    mutationFn: async (job: InsertJob) => {
      const response = await apiRequest("POST", "/api/jobs", job);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsModalOpen(false);
      toast({
        title: "Job created",
        description: "New job has been added to the pipeline.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertJob }) => {
      const response = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response.json();
    },
    onSuccess: (savedJob: Job) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsModalOpen(false);
      toast({
        title: "Job updated",
        description: "Job details have been saved.",
      });
      
      if (pendingSaveData && 
          pendingSaveData.newData.pipelineStage === 'scheduled' &&
          pendingSaveData.previousStage !== 'scheduled' &&
          pendingSaveData.newData.customerType === 'retail') {
        setJobForConfirmation(savedJob);
        setShowConfirmationModal(true);
      }
      setPendingSaveData(null);
    },
    onError: (error: any) => {
      if (error?.missingFields?.length > 0) {
        toast({
          title: "Cannot Save as Scheduled",
          description: `Missing required fields: ${error.missingFields.join(", ")}`,
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to update job. Please try again.",
          variant: "destructive",
        });
      }
      setPendingSaveData(null);
    },
  });

  const moveJobMutation = useMutation({
    mutationFn: async ({
      id,
      pipelineStage,
    }: {
      id: string;
      pipelineStage: PipelineStage;
    }) => {
      const response = await fetch(`/api/jobs/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      if (error?.missingFields?.length > 0) {
        toast({
          title: "Cannot Move to Scheduled",
          description: `Missing required fields: ${error.missingFields.join(", ")}`,
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to move job. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async ({
      id,
      payment,
    }: {
      id: string;
      payment: PaymentHistoryEntry;
    }) => {
      const response = await apiRequest("POST", `/api/jobs/${id}/payments`, payment);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSelectedJob(data);
      toast({
        title: "Payment added",
        description: "Payment has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsModalOpen(false);
      toast({
        title: "Job deleted",
        description: "Job has been removed from the pipeline.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/jobs/${id}/archive`, { action: "unarchive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job restored", description: "Job moved back to Paid/Completed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to restore job.", variant: "destructive" });
    },
  });

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsNewJob(false);
    setIsModalOpen(true);
  };

  const handleAddJob = () => {
    setSelectedJob(null);
    setIsNewJob(true);
    setIsModalOpen(true);
  };

  const handleSaveJob = (data: InsertJob) => {
    if (isNewJob) {
      createJobMutation.mutate(data);
    } else if (selectedJob) {
      // Track previous stage so we can show confirmation modal after save
      setPendingSaveData({
        previousStage: selectedJob.pipelineStage,
        newData: data
      });
      updateJobMutation.mutate({ id: selectedJob.id, data });
    }
  };

  const handleMoveJob = (jobId: string, newStage: PipelineStage) => {
    const job = jobs.find(j => j.id === jobId);
    
    if (job && newStage === "scheduled" && job.leadSource === "repeat") {
      setPendingMoveJob({ job, newStage });
      setShowRepeatReminder(true);
      return;
    }
    
    moveJobMutation.mutate({ id: jobId, pipelineStage: newStage });
  };

  const handleRepeatReminderConfirm = () => {
    if (pendingMoveJob) {
      moveJobMutation.mutate({ id: pendingMoveJob.job.id, pipelineStage: pendingMoveJob.newStage });
    }
    setShowRepeatReminder(false);
    setPendingMoveJob(null);
  };

  const handleRepeatReminderCancel = () => {
    setShowRepeatReminder(false);
    setPendingMoveJob(null);
  };

  const handleDeleteJob = (jobId: string) => {
    deleteJobMutation.mutate(jobId);
  };

  const handleAddPayment = (jobId: string, payment: PaymentHistoryEntry) => {
    addPaymentMutation.mutate({ id: jobId, payment });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="flex-1 p-4">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-[260px] space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const archivedJobs = jobs.filter(j => j.pipelineStage === "archived")
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <>
      <KanbanBoard
        jobs={jobs}
        onJobClick={handleJobClick}
        onAddJob={handleAddJob}
        onMoveJob={handleMoveJob}
      />

      {archivedJobs.length > 0 && (
        <div className="px-4 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="gap-2 text-muted-foreground"
            data-testid="button-toggle-archived"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            Archived Jobs
            <Badge variant="secondary">{archivedJobs.length}</Badge>
          </Button>

          {showArchived && (
            <Card className="mt-2">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {archivedJobs.map(job => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                      onClick={() => handleJobClick(job)}
                      data-testid={`archived-job-${job.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-muted-foreground font-mono">#{job.jobNumber}</span>
                        <span className="font-medium truncate">
                          {job.firstName} {job.lastName}
                        </span>
                        {job.completedAt && (
                          <span className="text-xs text-muted-foreground">
                            Completed {new Date(job.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">${Number(job.totalDue).toFixed(2)}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            unarchiveMutation.mutate(job.id);
                          }}
                          data-testid={`button-unarchive-${job.id}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <JobDetailModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveJob}
        onDelete={handleDeleteJob}
        onAddPayment={handleAddPayment}
        isNew={isNewJob}
      />

      <RepeatCustomerReminderDialog
        isOpen={showRepeatReminder}
        onConfirm={handleRepeatReminderConfirm}
        onCancel={handleRepeatReminderCancel}
        job={pendingMoveJob?.job || null}
      />

      {jobForConfirmation && (
        <ConfirmationSendModal
          isOpen={showConfirmationModal}
          onClose={() => {
            setShowConfirmationModal(false);
            setJobForConfirmation(null);
          }}
          job={jobForConfirmation}
          onSuccess={() => {
            setShowConfirmationModal(false);
            setJobForConfirmation(null);
          }}
        />
      )}
    </>
  );
}
