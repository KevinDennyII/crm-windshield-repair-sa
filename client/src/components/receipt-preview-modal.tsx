import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X, Loader2 } from "lucide-react";
import type { Job } from "@shared/schema";
import { generateReceiptPreview, downloadReceipt, getReceiptTypeLabel, determineReceiptType } from "@/lib/receipt-generator";

interface ReceiptPreviewModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptPreviewModal({ job, isOpen, onClose }: ReceiptPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePdf = async () => {
    if (!job) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { blobUrl, filename: fn } = await generateReceiptPreview(job, {
        signatureImage: job.signatureImage || undefined,
      });
      setPdfUrl(blobUrl);
      setFilename(fn);
    } catch (err) {
      console.error("Failed to generate receipt:", err);
      setError("Failed to generate receipt. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPreview = async () => {
    if (!pdfUrl) {
      await generatePdf();
    }
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleGenerateAndOpen = async () => {
    if (!job) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { blobUrl, filename: fn } = await generateReceiptPreview(job, {
        signatureImage: job.signatureImage || undefined,
      });
      setPdfUrl(blobUrl);
      setFilename(fn);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error("Failed to generate receipt:", err);
      setError("Failed to generate receipt. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (pdfUrl && filename) {
      downloadReceipt(pdfUrl, filename);
    } else if (job) {
      setIsLoading(true);
      try {
        const { blobUrl, filename: fn } = await generateReceiptPreview(job, {
          signatureImage: job.signatureImage || undefined,
        });
        setPdfUrl(blobUrl);
        setFilename(fn);
        downloadReceipt(blobUrl, fn);
      } catch (err) {
        console.error("Failed to generate receipt:", err);
        setError("Failed to generate receipt. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setFilename("");
    setError(null);
    onClose();
  };

  if (!job) return null;

  const receiptType = determineReceiptType(job);
  const receiptLabel = getReceiptTypeLabel(receiptType);
  const customerName = job.isBusiness && job.businessName 
    ? job.businessName 
    : `${job.firstName} ${job.lastName}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {receiptLabel}
          </DialogTitle>
          <DialogDescription>
            {customerName} - Job #{job.jobNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Your receipt is ready. You can preview it in a new tab or download it directly.
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleGenerateAndOpen}
              disabled={isLoading}
              className="w-full"
              data-testid="button-open-preview"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Open Preview in New Tab
            </Button>

            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isLoading}
              className="w-full"
              data-testid="button-download-pdf"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={handleClose}
            data-testid="button-close-preview"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
