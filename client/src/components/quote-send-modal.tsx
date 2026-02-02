import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, MessageSquare, Send, Loader2 } from "lucide-react";
import type { Job } from "@shared/schema";

interface QuoteSendModalProps {
  job: Job;
  calculatedTotal: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatGlassType(glassType: string): string {
  const typeMap: Record<string, string> = {
    windshield: "windshield",
    rear_windshield: "rear windshield",
    door_glass: "door glass",
    quarter_glass: "quarter glass",
    vent_glass: "vent glass",
    sunroof: "sunroof",
    back_glass: "back glass",
  };
  return typeMap[glassType] || glassType.replace(/_/g, " ");
}

function generateQuoteContent(job: Job, calculatedTotal: number): string {
  const vehicle = job.vehicles?.[0];
  const part = vehicle?.parts?.[0];
  
  const vehicleInfo = vehicle 
    ? `${vehicle.vehicleYear || ""} ${vehicle.vehicleMake || ""} ${vehicle.vehicleModel || ""}`.trim()
    : "Your Vehicle";
  
  const glassType = part ? formatGlassType(part.glassType || "windshield") : "windshield";
  const price = calculatedTotal;
  const vin = vehicle?.vin || "";
  
  let content = `Thank you for your interest in Windshield Repair SA! Here is your quote:

${vehicleInfo}

$${price.toFixed(2)} including the ${glassType}, tax, and installation

This also includes:
✅ free mobile service if the address is located inside loop 1604
✅ lifetime warranty on installation
✅ disposal of the replaced glass
✅ 1 free rock chip repair on this windshield within 1st year of installation (quarter size or smaller)

To get scheduled we'll need the following:

VIN number: ${vin || "(please provide)"}
Contact name & number: ${job.firstName || ""} ${job.lastName || ""} ${job.phone || ""}
Service address: ${job.streetAddress || "(please provide)"}
Payment method - cash or card (due at the beginning of service.)`;

  return content;
}

export function QuoteSendModal({ job, calculatedTotal, open, onOpenChange }: QuoteSendModalProps) {
  const { toast } = useToast();
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [quoteContent, setQuoteContent] = useState("");

  useEffect(() => {
    if (open) {
      setQuoteContent(generateQuoteContent(job, calculatedTotal));
    }
  }, [open, job, calculatedTotal]);

  const sendQuoteMutation = useMutation({
    mutationFn: async ({ email, sms }: { email: boolean; sms: boolean }) => {
      const results: { email?: boolean; sms?: boolean } = {};
      
      if (email && job.email) {
        await apiRequest("POST", "/api/quote/send-email", {
          jobId: job.id,
          to: job.email,
          content: quoteContent,
        });
        results.email = true;
      }
      
      if (sms && job.phone) {
        await apiRequest("POST", "/api/quote/send-sms", {
          jobId: job.id,
          to: job.phone,
          content: quoteContent,
        });
        results.sms = true;
      }
      
      return results;
    },
    onSuccess: (results) => {
      const methods: string[] = [];
      if (results.email) methods.push("email");
      if (results.sms) methods.push("SMS");
      
      toast({
        title: "Quote Sent",
        description: `Quote sent successfully via ${methods.join(" and ")}.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!sendEmail && !sendSms) {
      toast({
        title: "Select a method",
        description: "Please select at least one method to send the quote.",
        variant: "destructive",
      });
      return;
    }
    
    if (sendEmail && !job.email) {
      toast({
        title: "No email address",
        description: "This customer doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }
    
    if (sendSms && !job.phone) {
      toast({
        title: "No phone number",
        description: "This customer doesn't have a phone number on file.",
        variant: "destructive",
      });
      return;
    }
    
    sendQuoteMutation.mutate({ email: sendEmail, sms: sendSms });
  };

  const vehicle = job.vehicles?.[0];
  const vehicleInfo = vehicle 
    ? `${vehicle.vehicleYear || ""} ${vehicle.vehicleMake || ""} ${vehicle.vehicleModel || ""}`.trim()
    : "Vehicle not specified";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Quote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="text-sm text-muted-foreground">Sending to:</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Customer:</span> {job.firstName} {job.lastName}
              </div>
              <div>
                <span className="font-medium">Vehicle:</span> {vehicleInfo}
              </div>
              <div>
                <span className="font-medium">Email:</span> {job.email || "Not provided"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {job.phone || "Not provided"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Send via:</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="send-email" 
                  checked={sendEmail} 
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                  disabled={!job.email}
                  data-testid="checkbox-send-email"
                />
                <Label htmlFor="send-email" className="flex items-center gap-1 cursor-pointer">
                  <Mail className="h-4 w-4" />
                  Email
                  {!job.email && <span className="text-muted-foreground text-xs">(no email)</span>}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="send-sms" 
                  checked={sendSms} 
                  onCheckedChange={(checked) => setSendSms(checked === true)}
                  disabled={!job.phone}
                  data-testid="checkbox-send-sms"
                />
                <Label htmlFor="send-sms" className="flex items-center gap-1 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  SMS
                  {!job.phone && <span className="text-muted-foreground text-xs">(no phone)</span>}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-content">Quote Message (editable):</Label>
            <Textarea
              id="quote-content"
              value={quoteContent}
              onChange={(e) => setQuoteContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              data-testid="textarea-quote-content"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-quote"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendQuoteMutation.isPending || (!sendEmail && !sendSms)}
            data-testid="button-send-quote-confirm"
          >
            {sendQuoteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Quote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
