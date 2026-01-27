import { useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Camera, 
  CreditCard, 
  CheckCircle2,
  Loader2,
  Pen,
  DollarSign,
  Image,
  X
} from "lucide-react";
import type { Job } from "@shared/schema";

type PaymentHistory = {
  id: string;
  date: string;
  source: "cash" | "credit_card" | "check" | "insurance";
  amount: number;
  notes: string;
};

export default function TechJobComplete() {
  const [, params] = useRoute("/tech/job/:id/complete");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id;
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [photos, setPhotos] = useState<{ [key: string]: string }>({
    preInspection: "",
    vin: "",
    partInstalled: "",
    after: ""
  });

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const job = jobs.find(j => j.id === jobId);

  const completeJobMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job Completed",
        description: "The job has been marked as completed.",
      });
      navigate("/tech");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete job",
        variant: "destructive",
      });
    },
  });

  const handlePhotoCapture = (slot: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prev => ({
            ...prev,
            [slot]: reader.result as string
          }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const clearPhoto = (slot: string) => {
    setPhotos(prev => ({
      ...prev,
      [slot]: ""
    }));
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ("touches" in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleCompleteJob = () => {
    if (!job) return;

    const newPayment: PaymentHistory = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      source: paymentMethod as "cash" | "credit_card" | "check" | "insurance",
      amount: parseFloat(paymentAmount) || 0,
      notes: paymentNotes,
    };

    const updatedPaymentHistory = [
      ...(job.paymentHistory || []),
      ...(paymentAmount && parseFloat(paymentAmount) > 0 ? [newPayment] : [])
    ];

    const totalPaid = updatedPaymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
    const newBalanceDue = (job.totalDue || 0) - totalPaid;

    completeJobMutation.mutate({
      pipelineStage: "paid_completed",
      paymentHistory: updatedPaymentHistory,
      amountPaid: totalPaid,
      balanceDue: newBalanceDue,
      paymentStatus: newBalanceDue <= 0 ? "paid" : "partial",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#29ABE2" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-100">
        <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#29ABE2" }}>
          <Link href="/tech">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-white">Job Not Found</h1>
        </header>
      </div>
    );
  }

  const photoSlots = [
    { key: "preInspection", label: "Pre-Inspection" },
    { key: "vin", label: "VIN" },
    { key: "partInstalled", label: "Part Installed" },
    { key: "after", label: "After" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-50 px-4 py-3" style={{ backgroundColor: "#29ABE2" }}>
        <div className="flex items-center gap-3">
          <Link href={`/tech/job/${job.id}`}>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Complete Job</h1>
            <p className="text-xs text-white/80">{job.jobNumber}</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-600" />
              Photo Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {photoSlots.map(slot => (
                <div key={slot.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{slot.label}</Label>
                  {photos[slot.key] ? (
                    <div className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden">
                      <img 
                        src={photos[slot.key]} 
                        alt={slot.label}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => clearPhoto(slot.key)}
                        data-testid={`button-clear-photo-${slot.key}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full aspect-square flex flex-col items-center justify-center gap-1"
                      onClick={() => handlePhotoCapture(slot.key)}
                      data-testid={`button-capture-${slot.key}`}
                    >
                      <Image className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs">Tap to capture</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Pen className="w-4 h-4 text-cyan-600" />
              Customer Signature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg bg-white overflow-hidden">
              <canvas
                ref={signatureCanvasRef}
                width={320}
                height={150}
                className="w-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                data-testid="canvas-signature"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {hasSignature ? "Signature captured" : "Sign above"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature}
                data-testid="button-clear-signature"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-600" />
              Collect Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Balance Due</div>
                <div className="text-xl font-bold text-slate-800">
                  ${job.balanceDue?.toFixed(2)}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  data-testid="input-payment-amount"
                />
              </div>

              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Payment notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="resize-none"
                  data-testid="textarea-payment-notes"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          size="lg" 
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleCompleteJob}
          disabled={completeJobMutation.isPending}
          data-testid="button-submit-complete"
        >
          {completeJobMutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-2" />
          )}
          Complete Job
        </Button>
      </main>
    </div>
  );
}
