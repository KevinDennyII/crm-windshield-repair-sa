import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/kanban-board";
import { JobDetailModal } from "@/components/job-detail-modal";
import { RepeatCustomerReminderDialog } from "@/components/repeat-customer-reminder-dialog";
import { type Job, type InsertJob, type PipelineStage, type PaymentHistoryEntry } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Opportunities() {
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewJob, setIsNewJob] = useState(false);
  
  const [pendingMoveJob, setPendingMoveJob] = useState<{ job: Job; newStage: PipelineStage } | null>(null);
  const [showRepeatReminder, setShowRepeatReminder] = useState(false);

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
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsModalOpen(false);
      toast({
        title: "Job updated",
        description: "Job details have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job. Please try again.",
        variant: "destructive",
      });
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
      const response = await apiRequest("PATCH", `/api/jobs/${id}/stage`, {
        pipelineStage,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move job. Please try again.",
        variant: "destructive",
      });
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

  return (
    <>
      <KanbanBoard
        jobs={jobs}
        onJobClick={handleJobClick}
        onAddJob={handleAddJob}
        onMoveJob={handleMoveJob}
      />

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
    </>
  );
}
