import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, Loader2 } from "lucide-react";
import type { Job } from "@shared/schema";

interface EmailComposeModalProps {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailComposeModal({ job, open, onOpenChange }: EmailComposeModalProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; body: string }) => {
      return apiRequest("POST", `/api/jobs/${job.id}/email`, data);
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: `Email sent to ${job.email}`,
      });
      setSubject("");
      setBody("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both subject and message",
        variant: "destructive",
      });
      return;
    }
    sendEmailMutation.mutate({ subject, body });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Email to {job.firstName} {job.lastName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>To</Label>
            <Input value={job.email || ""} disabled data-testid="email-to" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              data-testid="input-email-subject"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[150px]"
              data-testid="input-email-body"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-email"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmailMutation.isPending}
            data-testid="button-send-email"
          >
            {sendEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
