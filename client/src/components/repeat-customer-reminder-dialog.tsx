import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCcw, AlertCircle, Building2 } from "lucide-react";
import { type Job } from "@shared/schema";

interface RepeatCustomerReminderDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  job: Job | null;
}

export function RepeatCustomerReminderDialog({
  isOpen,
  onConfirm,
  onCancel,
  job,
}: RepeatCustomerReminderDialogProps) {
  if (!job) return null;

  const customerName = job.isBusiness 
    ? job.businessName || "Business Account"
    : `${job.firstName} ${job.lastName}`;

  const hasNotes = job.repeatCustomerNotes && job.repeatCustomerNotes.trim().length > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-md" data-testid="dialog-repeat-customer-reminder">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <RefreshCcw className="w-5 h-5" />
            Repeat Customer Reminder
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-medium">
                {job.isBusiness && <Building2 className="w-4 h-4 text-muted-foreground" />}
                <span data-testid="text-customer-name">{customerName}</span>
              </div>
              
              {hasNotes ? (
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-purple-800 dark:text-purple-200">
                      <p className="font-medium mb-1">Account Notes:</p>
                      <p className="whitespace-pre-wrap" data-testid="text-repeat-notes">{job.repeatCustomerNotes}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This is a repeat customer. Please confirm any special requirements before scheduling.
                </p>
              )}
              
              <p className="text-sm text-muted-foreground">
                Do you want to proceed with scheduling this job?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid="button-reminder-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-purple-600"
            data-testid="button-reminder-confirm"
          >
            Confirm Scheduling
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
