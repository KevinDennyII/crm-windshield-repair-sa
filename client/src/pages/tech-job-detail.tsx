import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  Send
} from "lucide-react";
import type { Job } from "@shared/schema";

export default function TechJobDetail() {
  const [, params] = useRoute("/tech/job/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id;
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [taskStatus, setTaskStatus] = useState({
    onMyWay: false,
    onSite: false,
    takePayment: false
  });

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const job = jobs.find(j => j.id === jobId);

  const sendReceiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/send-receipt`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Receipt Sent",
        description: "The receipt has been emailed to the customer.",
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

  const vehicle = job.vehicles?.[0];
  const part = vehicle?.parts?.[0];

  const fullAddress = `${job.streetAddress}, ${job.city}, ${job.state} ${job.zipCode}`;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };

  const toggleTask = (task: keyof typeof taskStatus) => {
    setTaskStatus(prev => ({ ...prev, [task]: !prev[task] }));
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
        <a 
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 left-2 bg-white/90 rounded p-1 shadow"
          data-testid="link-open-maps"
        >
          <Check className="w-4 h-4 text-blue-500" />
        </a>
      </div>

      <div 
        className="grid grid-cols-4 text-center py-2"
        style={{ backgroundColor: "#1B8EB8" }}
      >
        <div>
          <div className="text-xs text-white/80 font-medium">YEAR</div>
          <div className="text-sm text-white font-semibold truncate px-1">
            {vehicle?.vehicleYear || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/80 font-medium">MAKE</div>
          <div className="text-sm text-white font-semibold truncate px-1">
            {vehicle?.vehicleMake || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/80 font-medium">MODEL</div>
          <div className="text-sm text-white font-semibold truncate px-1">
            {vehicle?.vehicleModel || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/80 font-medium">STYLE</div>
          <div className="text-sm text-white font-semibold truncate px-1">
            {vehicle?.bodyStyle || "N/A"}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto pb-4">
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

        <div className="divide-y divide-gray-200">
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">Service Type</span>
            <span className="font-semibold text-gray-900 capitalize">
              {part?.jobType?.replace(/_/g, " ") || "Replacement"}
            </span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">Glass Type</span>
            <span className="font-semibold text-gray-900 capitalize">
              {part?.jobType?.replace(/_/g, " ") || "Windshield"}
            </span>
          </div>
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
            <span className="text-gray-600">Warehouse Order#</span>
            <span className="font-semibold text-gray-900">
              {part?.glassPartNumber || "N/A"}
            </span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">Moldings</span>
            <span className="font-semibold text-gray-900">
              Not Available
            </span>
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

        <a 
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 flex items-start gap-2 border-t border-gray-200"
          data-testid="link-navigate"
        >
          <MapPin className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          <span className="text-gray-900">
            {job.streetAddress}, {job.city}, {job.state}, {job.zipCode}
          </span>
        </a>

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
              {job.installTime || "N/A"}
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
