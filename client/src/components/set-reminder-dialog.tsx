import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bell, Loader2, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type CustomerReminder } from "@shared/schema";

interface SetReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customerKey: string;
  customerName: string;
}

export function SetReminderDialog({
  isOpen,
  onClose,
  customerKey,
  customerName,
}: SetReminderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: existingReminder, isLoading } = useQuery<CustomerReminder | null>({
    queryKey: ["/api/customer-reminders", customerKey],
    queryFn: async () => {
      const response = await fetch(`/api/customer-reminders/${encodeURIComponent(customerKey)}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch reminder");
      }
      return response.json();
    },
    enabled: isOpen && !!customerKey,
  });

  useEffect(() => {
    if (existingReminder?.reminderMessage) {
      setMessage(existingReminder.reminderMessage);
    } else {
      setMessage("");
    }
  }, [existingReminder, isOpen]);

  const saveReminderMutation = useMutation({
    mutationFn: async (reminderMessage: string) => {
      const response = await apiRequest("POST", "/api/customer-reminders", {
        customerKey,
        reminderMessage,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-reminders", customerKey] });
      toast({
        title: "Reminder Saved",
        description: `Reminder for ${customerName} has been saved.`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save reminder.",
        variant: "destructive",
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/customer-reminders/${encodeURIComponent(customerKey)}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-reminders", customerKey] });
      toast({
        title: "Reminder Deleted",
        description: `Reminder for ${customerName} has been removed.`,
      });
      setMessage("");
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete reminder.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (message.trim()) {
      saveReminderMutation.mutate(message.trim());
    }
  };

  const handleDelete = () => {
    deleteReminderMutation.mutate();
  };

  const hasExistingReminder = !!existingReminder?.reminderMessage;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-set-reminder">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Bell className="w-5 h-5" />
            {hasExistingReminder ? "Edit Reminder" : "Set Reminder"}
          </DialogTitle>
          <DialogDescription>
            {hasExistingReminder 
              ? `Update the reminder for ${customerName}`
              : `Create a reminder that will appear when you enter this customer's name`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="text-sm font-medium text-foreground" data-testid="text-set-reminder-customer">
            Customer: {customerName}
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reminder-message">Reminder Message</Label>
              <Textarea
                id="reminder-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter a reminder message (e.g., 'Afternoon jobs only', 'Prefers cash payment', 'Call before arriving')"
                className="min-h-[100px]"
                data-testid="textarea-set-reminder"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {hasExistingReminder && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleteReminderMutation.isPending}
              className="text-destructive border-destructive"
              data-testid="button-delete-reminder"
            >
              {deleteReminderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-set-reminder"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveReminderMutation.isPending || !message.trim()}
            className="bg-amber-600"
            data-testid="button-save-set-reminder"
          >
            {saveReminderMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
