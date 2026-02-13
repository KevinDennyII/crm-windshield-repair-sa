import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { generateReceiptBase64 } from "@/lib/receipt-generator";
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  User,
  Mic,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  Mail,
  Send,
  DollarSign,
  Plus,
  FileText
} from "lucide-react";
import type { Job } from "@shared/schema";

interface TechData {
  jobId: string;
  taskStatus: { onMyWay?: boolean; onSite?: boolean; takePayment?: boolean };
  partsChecklist: Record<string, boolean>;
}

export default function TechJobDetail() {
  const [, params] = useRoute("/tech/job/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id;
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentSource, setPaymentSource] = useState<string>("cash");

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const job = jobs.find(j => j.id === jobId);

  // Fetch persisted technician data for this job
  const { data: techData } = useQuery<TechData>({
    queryKey: ["/api/tech-data", jobId],
    enabled: !!jobId,
  });

  const taskStatus = techData?.taskStatus || { onMyWay: false, onSite: false, takePayment: false };

  // Mutation to update tech data
  const updateTechDataMutation = useMutation({
    mutationFn: async (data: { taskStatus?: any; partsChecklist?: any }) => {
      const response = await apiRequest("PATCH", `/api/tech-data/${jobId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tech-data", jobId] });
    },
  });

  // Mutation to record payment
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { amount: number; source: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/tech/jobs/${jobId}/payment`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setPaymentAmount("");
      toast({
        title: "Payment Recorded",
        description: "The payment has been added to this job.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const sendReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("Job not found");
      
      // Generate PDF with signature
      const { base64, filename } = await generateReceiptBase64(job, {
        signatureImage: job.signatureImage || undefined
      });
      
      // Send PDF to server for email
      const response = await apiRequest("POST", `/api/jobs/${jobId}/send-receipt`, {
        pdfBase64: base64,
        pdfFilename: filename
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Receipt Sent",
        description: "The PDF receipt has been emailed to the customer.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send receipt",
        variant: "destructive",
      });
    },
  });

  // Helper function to detect glass types from job parts
  const getGlassTypes = (job: Job): { hasWindshield: boolean; hasDoorGlass: boolean; hasBackGlass: boolean } => {
    const result = { hasWindshield: false, hasDoorGlass: false, hasBackGlass: false };
    
    for (const vehicle of job.vehicles || []) {
      for (const part of vehicle.parts || []) {
        const glassType = part.glassType?.toLowerCase() || "";
        if (glassType === "windshield") {
          result.hasWindshield = true;
        } else if (glassType === "door_glass") {
          result.hasDoorGlass = true;
        } else if (glassType === "back_glass" || glassType === "back_glass_powerslide") {
          result.hasBackGlass = true;
        }
      }
    }
    
    return result;
  };

  // Build "On My Way" message based on glass types
  const buildOnMyWayMessage = (job: Job): string => {
    const customerName = job.firstName || "there";
    const glassTypes = getGlassTypes(job);
    
    // Start message
    let message = `Hi ${customerName}, Good news, your technician is on the way!\n\n`;
    
    // Add glass-specific instructions
    const instructions: string[] = [];
    
    if (glassTypes.hasWindshield) {
      instructions.push(
        "If possible, could you please:\n" +
        "-Park in an area where both front doors can be fully opened\n\n" +
        "-If parked in a driveway, preferably park facing the street. If it's a 2 car driveway, preferably have the spot next to your vehicle available\n\n" +
        "-Remove any stickers you'd like to keep from the current windshield, as well as personal belongings from the dashboard area and front seats"
      );
    }
    
    if (glassTypes.hasDoorGlass) {
      instructions.push(
        "If possible, could you please:\n" +
        "-Park in an area where the door can be fully opened\n" +
        "-Park near an outlet so we can vacuum as much glass as we can (We do have an extension cord). If no outlet is available, we may not be able to vacuum glass debris\n" +
        "-Be present on-site with the vehicle keys, so we can make sure the door elevator is functioning.\n\n" +
        "In some cases, broken glass may affect the window elevator inside the door. If this happens, your technician will let you know and that part will have to be repaired by a mechanic."
      );
    }
    
    // Only show back glass instructions if there's no windshield (to avoid confusing the customer)
    if (glassTypes.hasBackGlass && !glassTypes.hasWindshield) {
      instructions.push(
        "If possible, could you please:\n" +
        "-Park in an area where both rear can be fully opened\n\n" +
        "-If parked in a driveway, preferably park facing the house/building. If it's a 2 car driveway, preferably have the spot next to your vehicle available\n\n" +
        "-Remove any stickers you'd like to keep from the current glass, as well as personal belongings from the trunk (or truck bed) area and back seats."
      );
    }
    
    // Join all instructions with spacing
    if (instructions.length > 0) {
      message += instructions.join("\n\n") + "\n\n";
    }
    
    // End message
    message += "As a reminder, we process payment at the beginning of the appointment. If you're paying cash, please have exact change as our technicians do not carry any change.\n\n";
    message += "Thank you, see you soon!";
    
    return message;
  };

  // Send "On My Way" SMS mutation
  const sendOnMyWayMutation = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("Job not found");
      if (!job.phone) throw new Error("Customer has no phone number");
      
      const message = buildOnMyWayMessage(job);
      
      const response = await apiRequest("POST", `/api/jobs/${jobId}/sms`, {
        body: message
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "On My Way notification sent to customer.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#29ABE2" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-white">
        <header 
          className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: "#29ABE2" }}
        >
          <Link href="/tech">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-white">Job Not Found</h1>
        </header>
        <main className="p-4 text-center">
          <p className="text-gray-500 py-8">This job could not be found.</p>
          <Link href="/tech">
            <Button data-testid="button-return">Return to Dashboard</Button>
          </Link>
        </main>
      </div>
    );
  }

  const vehicles = job.vehicles || [];
  const hasMultipleVehicles = vehicles.length > 1;
  const firstVehicle = vehicles[0];
  
  const totalParts = vehicles.reduce((sum, v) => sum + (v.parts?.length || 0), 0);

  const fullAddress = `${job.streetAddress}, ${job.city}, ${job.state} ${job.zipCode}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`;
  
  const openMapsApp = () => {
    const encodedAddress = encodeURIComponent(fullAddress);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      window.location.href = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else {
      window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };

  const toggleTask = (task: "onMyWay" | "onSite" | "takePayment") => {
    const currentValue = taskStatus[task] || false;
    const newValue = !currentValue;
    const newTaskStatus = { ...taskStatus, [task]: newValue };
    
    // Persist to database
    updateTechDataMutation.mutate({ taskStatus: newTaskStatus });
    
    // Send "On My Way" SMS when the task is toggled ON
    if (task === "onMyWay" && newValue) {
      if (!job?.phone) {
        toast({
          title: "Cannot Send Notification",
          description: "Customer has no phone number on file.",
          variant: "destructive",
        });
      } else {
        sendOnMyWayMutation.mutate();
      }
    }
  };


  const handleRecordPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }
    recordPaymentMutation.mutate({ amount, source: paymentSource });
  };

  const calculateTax = () => {
    return job.taxAmount || 0;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header 
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: "#29ABE2" }}
      >
        <Link href="/tech">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold text-white flex-1 text-center pr-8">
          Order # {job.jobNumber}
        </h1>
      </header>

      <div className="relative h-40 bg-gray-200">
        <iframe
          src={mapEmbedUrl}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Location Map"
        />
        <button 
          onClick={openMapsApp}
          className="absolute top-2 left-2 bg-white/90 rounded-lg px-3 py-2 shadow flex items-center gap-2"
          data-testid="button-open-maps"
        >
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">Navigate</span>
        </button>
      </div>

      {!hasMultipleVehicles && firstVehicle && (
        <div style={{ backgroundColor: "#1B8EB8" }}>
          <div className="grid grid-cols-4 text-center py-2">
            <div>
              <div className="text-xs text-white/80 font-medium">YEAR</div>
              <div className="text-sm text-white font-semibold truncate px-1">
                {firstVehicle.vehicleYear || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/80 font-medium">MAKE</div>
              <div className="text-sm text-white font-semibold truncate px-1">
                {firstVehicle.vehicleMake || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/80 font-medium">MODEL</div>
              <div className="text-sm text-white font-semibold truncate px-1">
                {firstVehicle.vehicleModel || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/80 font-medium">STYLE</div>
              <div className="text-sm text-white font-semibold truncate px-1">
                {firstVehicle.bodyStyle || "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto pb-4">
        {(hasMultipleVehicles || totalParts > 1) && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="font-semibold text-amber-800">
                {vehicles.length} {vehicles.length === 1 ? "Vehicle" : "Vehicles"}
              </span>
              <span className="text-amber-600">|</span>
              <span className="font-semibold text-amber-800">
                {totalParts} {totalParts === 1 ? "Service" : "Services"} Total
              </span>
            </div>
          </div>
        )}
        
        {job.installNotes && (
          <div className="px-4 py-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Job Notes</span>
              </div>
              <p className="text-sm text-amber-900 whitespace-pre-wrap" data-testid="text-install-notes">{job.installNotes}</p>
            </div>
          </div>
        )}

        <div className="px-4 py-3">
          <button
            onClick={() => setTasksExpanded(!tasksExpanded)}
            className="w-full py-3 rounded-full font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#29ABE2" }}
            data-testid="button-tasks-list"
          >
            My Tasks List
            {tasksExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {tasksExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => toggleTask("onMyWay")}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg border"
              data-testid="task-on-my-way"
            >
              <div 
                className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                  taskStatus.onMyWay 
                    ? "bg-green-500 border-green-500" 
                    : "border-gray-400 bg-white"
                }`}
              >
                {taskStatus.onMyWay && <Check className="w-5 h-5 text-white" />}
              </div>
              <span className={`text-base font-medium ${taskStatus.onMyWay ? "text-gray-500 line-through" : "text-gray-800"}`}>
                On My Way
              </span>
            </button>

            <button
              onClick={() => toggleTask("onSite")}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg border"
              data-testid="task-on-site"
            >
              <div 
                className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                  taskStatus.onSite 
                    ? "bg-green-500 border-green-500" 
                    : "border-gray-400 bg-white"
                }`}
              >
                {taskStatus.onSite && <Check className="w-5 h-5 text-white" />}
              </div>
              <span className={`text-base font-medium ${taskStatus.onSite ? "text-gray-500 line-through" : "text-gray-800"}`}>
                On Site
              </span>
            </button>

            <button
              onClick={() => toggleTask("takePayment")}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg border"
              data-testid="task-take-payment"
            >
              <div 
                className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                  taskStatus.takePayment 
                    ? "bg-green-500 border-green-500" 
                    : "border-gray-400 bg-white"
                }`}
              >
                {taskStatus.takePayment && <Check className="w-5 h-5 text-white" />}
              </div>
              <span className={`text-base font-medium ${taskStatus.takePayment ? "text-gray-500 line-through" : "text-gray-800"}`}>
                Take Payment
              </span>
            </button>
          </div>
        )}

        {/* Payment Recording Section */}
        <div className="px-4 py-3">
          <button
            onClick={() => setPaymentExpanded(!paymentExpanded)}
            className="w-full py-3 rounded-full font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#7C3AED" }}
            data-testid="button-record-payment"
          >
            <DollarSign className="w-5 h-5" />
            Record Payment
            {paymentExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {paymentExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Due:</span>
                <span className="font-bold">${(job.totalDue || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-bold text-green-600">${(job.amountPaid || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Balance Due:</span>
                <span className="font-bold text-red-600">${(job.balanceDue || job.totalDue || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-lg"
                  data-testid="input-payment-amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <Select value={paymentSource} onValueChange={setPaymentSource}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleRecordPayment}
                disabled={recordPaymentMutation.isPending}
                className="w-full py-6 text-lg font-semibold"
                style={{ backgroundColor: "#7C3AED" }}
                data-testid="button-submit-payment"
              >
                {recordPaymentMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Payment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {vehicles.map((veh, vehIndex) => {
          const vehParts = veh.parts || [];
          return (
            <div key={vehIndex}>
              {hasMultipleVehicles && (
                <div className="px-4 py-3 bg-blue-600">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">
                      Vehicle {vehIndex + 1} of {vehicles.length}
                    </span>
                    <span className="text-white/80 text-sm">
                      {veh.vehicleYear} {veh.vehicleMake} {veh.vehicleModel}
                    </span>
                  </div>
                </div>
              )}
              
              {vehParts.map((part, partIndex) => (
                <div key={partIndex} className="divide-y divide-gray-200">
                  {vehParts.length > 1 && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                      <span className="text-sm font-bold" style={{ color: "#29ABE2" }}>
                        Service {partIndex + 1} of {vehParts.length}
                      </span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-gray-600">Service Type</span>
                    <span className="font-semibold text-gray-900 capitalize">
                      {part?.serviceType?.replace(/_/g, " ") || "Replace"}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-gray-600">Glass Type</span>
                    <span className="font-semibold text-gray-900 capitalize">
                      {part?.glassType?.replace(/_/g, " ") || "Windshield"}
                    </span>
                  </div>
                  {part?.calibrationType && part.calibrationType !== "none" && part.calibrationType !== "declined" && (
                    <div className="px-4 py-3 flex justify-between bg-orange-50">
                      <span className="text-orange-700 font-medium">Calibration Required</span>
                      <span className="font-semibold text-orange-700 capitalize">
                        {part.calibrationType.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-gray-600">Part#</span>
                    <span className="font-semibold text-gray-900">
                      {part?.glassPartNumber || "N/A"}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-gray-600">Warehouse Name</span>
                    <span className="font-semibold text-gray-900">
                      {part?.distributor || "N/A"}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-gray-600">Accessories</span>
                    <span className="font-semibold text-gray-900">
                      {part?.accessories || "None"}
                    </span>
                  </div>
                  {partIndex === vehParts.length - 1 && (
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="text-gray-600">Media Attachments</span>
                      <Link href={`/tech/job/${job.id}/complete`}>
                        <Button
                          size="sm"
                          className="px-4"
                          style={{ backgroundColor: "#29ABE2" }}
                          data-testid={`button-view-media-${vehIndex}`}
                        >
                          View
                        </Button>
                      </Link>
                    </div>
                  )}
                  {partIndex < vehParts.length - 1 && (
                    <div className="h-2 bg-gray-100" />
                  )}
                </div>
              ))}
              
              {vehParts.length === 0 && (
                <div className="divide-y divide-gray-200">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-gray-600">Service Type</span>
                    <span className="font-semibold text-gray-900">N/A</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-gray-600">Media Attachments</span>
                    <Link href={`/tech/job/${job.id}/complete`}>
                      <Button
                        size="sm"
                        className="px-4"
                        style={{ backgroundColor: "#29ABE2" }}
                        data-testid={`button-view-media-${vehIndex}`}
                      >
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              
              {vehIndex < vehicles.length - 1 && (
                <div className="h-4 bg-gray-200" />
              )}
            </div>
          );
        })}
        
        {vehicles.length === 0 && (
          <div className="divide-y divide-gray-200">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-600">Service Type</span>
              <span className="font-semibold text-gray-900">N/A</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-gray-600">Media Attachments</span>
              <Link href={`/tech/job/${job.id}/complete`}>
                <Button
                  size="sm"
                  className="px-4"
                  style={{ backgroundColor: "#29ABE2" }}
                  data-testid="button-view-media"
                >
                  View
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="px-4 py-3 grid grid-cols-2 gap-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            <span className="text-gray-900 font-medium">
              {job.firstName} {job.lastName}
            </span>
          </div>
          <a 
            href={`tel:${job.phone}`}
            className="flex items-center gap-2"
            data-testid="link-call"
          >
            <Phone className="w-5 h-5 text-gray-500" />
            <span className="text-gray-900">{job.phone}</span>
          </a>
        </div>

        <button 
          onClick={openMapsApp}
          className="w-full px-4 py-3 flex items-start gap-2 border-t border-gray-200 text-left hover:bg-gray-50"
          data-testid="button-navigate"
        >
          <MapPin className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          <span className="text-gray-900">
            {job.streetAddress}, {job.city}, {job.state}, {job.zipCode}
          </span>
        </button>

        <div className="divide-y divide-gray-200 border-t border-gray-200">
          <div className="px-4 py-3 grid grid-cols-2">
            <span style={{ color: "#29ABE2" }} className="font-semibold">Payment Type</span>
            <span className="text-gray-900 text-right capitalize">
              {job.paymentMethod?.join(", ")?.replace(/_/g, " ") || "N/A"}
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2">
            <span style={{ color: "#29ABE2" }} className="font-semibold">Estimate/Tax</span>
            <span className="text-gray-900 text-right">
              ${(job.totalDue || 0).toFixed(2)}/${calculateTax().toFixed(2)}
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2">
            <span style={{ color: "#29ABE2" }} className="font-semibold">Total</span>
            <span className="text-gray-900 text-right font-bold">
              ${(job.totalDue || 0).toFixed(2)}
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2">
            <span style={{ color: "#29ABE2" }} className="font-semibold">Status</span>
            <span className="text-gray-900 text-right capitalize">
              {job.pipelineStage === "paid_completed" ? "Completed" : job.pipelineStage}
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2">
            <span style={{ color: "#29ABE2" }} className="font-semibold">Schedule Date</span>
            <span className="text-gray-900 text-right">
              {formatDate(job.installDate)}
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2">
            <span style={{ color: "#29ABE2" }} className="font-semibold">Schedule Time</span>
            <span className="text-gray-900 text-right">
              {job.timeFrame || "N/A"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-gray-200">
          <button
            className="py-4 flex items-center justify-center gap-2 border-r border-gray-200"
            style={{ backgroundColor: "#DC2626" }}
            data-testid="button-voice-recorder"
          >
            <Mic className="w-5 h-5 text-white" />
            <span className="text-white font-medium">Voice Recorder</span>
          </button>
          <button
            className="py-4 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#29ABE2" }}
            data-testid="button-invoice"
          >
            <Download className="w-5 h-5 text-white" />
            <span className="text-white font-medium">Invoice</span>
          </button>
        </div>

        <div className="px-4 py-4 border-t border-gray-200">
          <h3 className="text-xl font-bold text-center text-gray-900 mb-4">SIGNATURE</h3>
          {job.signatureImage ? (
            <div className="space-y-3">
              <div 
                className="w-full h-24 border-2 border-green-300 rounded-lg flex items-center justify-center bg-green-50"
                data-testid="signature-captured"
              >
                <img 
                  src={job.signatureImage} 
                  alt="Customer Signature" 
                  className="max-h-20 max-w-full object-contain"
                />
              </div>
              <button
                onClick={() => sendReceiptMutation.mutate()}
                disabled={sendReceiptMutation.isPending || !job.email}
                className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "#29ABE2" }}
                data-testid="button-send-receipt"
              >
                {sendReceiptMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                <span>
                  {sendReceiptMutation.isPending 
                    ? "Sending..." 
                    : job.receiptSentAt 
                      ? "Resend Receipt" 
                      : "Send Receipt to Customer"}
                </span>
              </button>
              {job.receiptSentAt && (
                <p className="text-xs text-center text-gray-500">
                  Receipt sent on {new Date(job.receiptSentAt).toLocaleDateString()}
                </p>
              )}
              {!job.email && (
                <p className="text-xs text-center text-red-500">
                  No email address on file
                </p>
              )}
            </div>
          ) : (
            <Link href={`/tech/job/${job.id}/signature`}>
              <div 
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50"
                data-testid="signature-area"
              >
                <span className="text-gray-400">Tap to sign</span>
              </div>
            </Link>
          )}
        </div>

        <div className="px-4 pb-4">
          <Link href={`/tech/job/${job.id}/complete`}>
            <Button 
              size="lg"
              className="w-full py-6 text-lg font-semibold"
              style={{ backgroundColor: "#22C55E" }}
              data-testid="button-completed"
            >
              Completed
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
