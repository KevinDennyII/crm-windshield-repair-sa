import { useState, useRef, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Job } from "@shared/schema";

export default function TechSignature() {
  const [, params] = useRoute("/tech/job/:id/signature");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const job = jobs.find(j => j.id === jobId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Fill with dark background so signature is visible in dark mode emails
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1E3A5F";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const completeJobMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job Completed",
        description: "Signature captured and job marked as completed.",
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
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
    const canvas = canvasRef.current;
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
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Clear and refill with dark background
    ctx.fillStyle = "#1E3A5F";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleDone = () => {
    if (!job) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get signature as base64 image
    const signatureImage = canvas.toDataURL("image/png");
    
    completeJobMutation.mutate({
      pipelineStage: "paid_completed",
      paymentStatus: "paid",
      signatureImage: signatureImage,
    });
  };

  const handleCancel = () => {
    navigate(`/tech/job/${jobId}`);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Job not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          className="w-full h-full border border-gray-200 touch-none"
          style={{ minHeight: "400px", backgroundColor: "#1E3A5F" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          data-testid="canvas-signature"
        />
      </main>

      <footer className="grid grid-cols-3">
        <button
          onClick={handleCancel}
          className="py-4 text-center font-semibold"
          style={{ backgroundColor: "#29ABE2", color: "white" }}
          data-testid="button-cancel"
        >
          CANCEL
        </button>
        <button
          onClick={clearSignature}
          className="py-4 text-center font-semibold"
          style={{ backgroundColor: "#1E3A5F", color: "white" }}
          data-testid="button-clear"
        >
          CLEAR
        </button>
        <button
          onClick={handleDone}
          disabled={!hasSignature || completeJobMutation.isPending}
          className="py-4 text-center font-semibold disabled:opacity-50"
          style={{ backgroundColor: "#22C55E", color: "white" }}
          data-testid="button-done"
        >
          {completeJobMutation.isPending ? "..." : "DONE"}
        </button>
      </footer>
    </div>
  );
}
