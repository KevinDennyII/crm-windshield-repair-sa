import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Send, X, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

interface ConfirmationSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  onSuccess?: () => void;
}

interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
}

function validateJobForConfirmation(job: Job): ValidationResult {
  const missingFields: string[] = [];
  
  if (!job.installDate) missingFields.push("Install Date");
  if (!job.installTime) missingFields.push("Time Frame");
  if (!job.streetAddress) missingFields.push("Service Address");
  if (!job.totalDue || job.totalDue <= 0) missingFields.push("Total Price");
  if (!job.paymentMethod || (Array.isArray(job.paymentMethod) && job.paymentMethod.length === 0)) {
    missingFields.push("Payment Method");
  }
  
  const vehicle = job.vehicles?.[0];
  if (!vehicle) {
    missingFields.push("Vehicle Information");
  } else {
    if (!vehicle.vehicleYear && !vehicle.vehicleMake && !vehicle.vehicleModel) {
      missingFields.push("Vehicle Details (Year/Make/Model)");
    }
    const parts = vehicle.parts || [];
    if (parts.length === 0) {
      missingFields.push("Service/Glass Type");
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

function formatConfirmationPreview(job: Job): string {
  const vehicle = job.vehicles?.[0];
  const vehicleInfo = vehicle 
    ? `${vehicle.vehicleYear || ""} ${vehicle.vehicleMake || ""} ${vehicle.vehicleModel || ""}`.trim()
    : "Your Vehicle";
  
  const parts = vehicle?.parts || [];
  const serviceTypes = Array.from(new Set(parts.map(p => 
    p.serviceType === 'repair' ? 'Repair' : p.serviceType === 'replace' ? 'Replacement' : 'Calibration'
  )));
  const glassTypes = Array.from(new Set(parts.map(p => {
    const glassMap: Record<string, string> = {
      'windshield': 'Windshield',
      'door_glass': 'Door Glass',
      'back_glass': 'Back Glass',
      'back_glass_powerslide': 'Back Glass (Powerslide)',
      'quarter_glass': 'Quarter Glass',
      'sunroof': 'Sunroof',
      'side_mirror': 'Side Mirror'
    };
    return glassMap[p.glassType] || p.glassType;
  })));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const timeFrameMap: Record<string, string> = {
    'am': 'Morning (8am-12pm)',
    'pm': 'Afternoon (12pm-5pm)',
    'anytime': 'Anytime'
  };

  const paymentMethodText = Array.isArray(job.paymentMethod) && job.paymentMethod.length > 0
    ? job.paymentMethod.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')
    : 'TBD';

  return `Thank you for scheduling your auto glass service with Windshield Repair SA! If all information is correct can you reply with "confirm".

Service day: ${job.installDate ? formatDate(job.installDate) : 'TBD'}
Time frame: ${job.installTime ? timeFrameMap[job.installTime] || job.installTime : 'TBD'}
Vehicle: ${vehicleInfo}
Service: ${serviceTypes.join(', ') || 'Auto Glass Service'}
Glass: ${glassTypes.join(', ') || 'TBD'}
Address: ${job.streetAddress || 'TBD'}
Total price: $${Number(job.totalDue || 0).toFixed(2)}
Payment method: ${paymentMethodText}

Please be sure to be onsite so we can take payment before start work and please keep in mind that our technician do not have change on hand (if paying cash)

Please let us know of any changes.`;
}

export function ConfirmationSendModal({ isOpen, onClose, job, onSuccess }: ConfirmationSendModalProps) {
  const { toast } = useToast();
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  
  const validation = validateJobForConfirmation(job);
  const messagePreview = formatConfirmationPreview(job);
  
  const hasEmail = !!job.email;
  const hasPhone = !!job.phone;
  
  useEffect(() => {
    setSendEmail(hasEmail);
    setSendSms(hasPhone);
  }, [hasEmail, hasPhone, isOpen]);

  const sendConfirmationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/jobs/${job.id}/send-confirmation`, {
        sendEmail,
        sendSms
      });
      return response.json();
    },
    onSuccess: (data) => {
      const sentMethods: string[] = [];
      if (data.emailSent) sentMethods.push("email");
      if (data.smsSent) sentMethods.push("SMS");
      
      if (sentMethods.length > 0) {
        toast({
          title: "Confirmation Sent",
          description: `Appointment confirmation sent via ${sentMethods.join(" and ")}.`,
        });
      } else if (data.errors?.length > 0) {
        toast({
          title: "Confirmation Failed",
          description: data.errors.join(", "),
          variant: "destructive"
        });
      }
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send confirmation message.",
        variant: "destructive"
      });
    }
  });

  const handleSend = () => {
    if (!sendEmail && !sendSms) {
      toast({
        title: "Select a Method",
        description: "Please select at least one method to send the confirmation.",
        variant: "destructive"
      });
      return;
    }
    sendConfirmationMutation.mutate();
  };

  const handleSkip = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Appointment Confirmation
          </DialogTitle>
          <DialogDescription>
            Send a confirmation message to {job.firstName} {job.lastName} for their scheduled appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!validation.isValid && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Missing Required Information</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    The following fields should be filled before sending a confirmation:
                  </p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                    {validation.missingFields.map((field, i) => (
                      <li key={i}>{field}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-medium">Send via:</h4>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(!!checked)}
                  disabled={!hasEmail}
                  data-testid="checkbox-send-email"
                />
                <Label htmlFor="send-email" className={`flex items-center gap-2 ${!hasEmail ? 'text-muted-foreground' : ''}`}>
                  <Mail className="h-4 w-4" />
                  Email {hasEmail ? `(${job.email})` : "(No email on file)"}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-sms"
                  checked={sendSms}
                  onCheckedChange={(checked) => setSendSms(!!checked)}
                  disabled={!hasPhone}
                  data-testid="checkbox-send-sms"
                />
                <Label htmlFor="send-sms" className={`flex items-center gap-2 ${!hasPhone ? 'text-muted-foreground' : ''}`}>
                  <MessageSquare className="h-4 w-4" />
                  SMS {hasPhone ? `(${job.phone})` : "(No phone on file)"}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Message Preview:</h4>
            <div className="bg-muted/50 rounded-md p-4 text-sm whitespace-pre-wrap font-mono">
              {messagePreview}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={sendConfirmationMutation.isPending}
            data-testid="button-skip-confirmation"
          >
            <X className="h-4 w-4 mr-2" />
            Skip
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendConfirmationMutation.isPending || (!sendEmail && !sendSms) || !validation.isValid}
            data-testid="button-send-confirmation"
          >
            {sendConfirmationMutation.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Confirmation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
