import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Bell, Pencil, X, Loader2, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CustomerReminderPopupProps {
  isOpen: boolean;
  onClose: () => void;
  customerKey: string;
  customerName: string;
  reminderMessage: string;
}

export function CustomerReminderPopup({
  isOpen,
  onClose,
  customerKey,
  customerName,
  reminderMessage,
}: CustomerReminderPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(reminderMessage);

  const updateReminderMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/customer-reminders", {
        customerKey,
        reminderMessage: message,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-reminders", customerKey] });
      toast({
        title: "Reminder Updated",
        description: "Customer reminder has been saved.",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update reminder.",
        variant: "destructive",
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/customer-reminders/${encodeURIComponent(customerKey)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-reminders", customerKey] });
      toast({
        title: "Reminder Deleted",
        description: `Reminder for ${customerName} has been removed.`,
      });
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
    if (editedMessage.trim()) {
      updateReminderMutation.mutate(editedMessage.trim());
    }
  };

  const handleEdit = () => {
    setEditedMessage(reminderMessage);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedMessage(reminderMessage);
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteReminderMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-customer-reminder">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Bell className="w-5 h-5" />
            Customer Reminder
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p className="font-medium text-foreground" data-testid="text-reminder-customer-name">
                {customerName}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isEditing ? (
            <div className="space-y-2">
              <Label>Reminder Message</Label>
              <Textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                placeholder="Enter reminder message..."
                className="min-h-[100px]"
                data-testid="textarea-edit-reminder"
              />
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap" data-testid="text-reminder-message">
                {reminderMessage}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleteReminderMutation.isPending}
                className="text-destructive border-destructive mr-auto"
                data-testid="button-delete-reminder"
              >
                {deleteReminderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                data-testid="button-cancel-edit-reminder"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateReminderMutation.isPending || !editedMessage.trim()}
                className="bg-amber-600"
                data-testid="button-save-reminder"
              >
                {updateReminderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleEdit}
                data-testid="button-edit-reminder"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                onClick={onClose}
                data-testid="button-close-reminder"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
