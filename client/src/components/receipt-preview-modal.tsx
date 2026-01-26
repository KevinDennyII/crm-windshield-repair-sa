import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (isOpen && job) {
      setIsLoading(true);
      setError(null);
      setPdfUrl(null);

      generateReceiptPreview(job)
        .then(({ blobUrl, filename: fn }) => {
          setPdfUrl(blobUrl);
          setFilename(fn);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to generate receipt:", err);
          setError("Failed to generate receipt preview. Please try again.");
          setIsLoading(false);
        });
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, job]);

  const handleDownload = () => {
    if (pdfUrl && filename) {
      downloadReceipt(pdfUrl, filename);
    }
  };

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    onClose();
  };

  if (!job) return null;

  const receiptType = determineReceiptType(job);
  const receiptLabel = getReceiptTypeLabel(receiptType);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Receipt Preview - {receiptLabel}
          </DialogTitle>
          <DialogDescription>
            {job.isBusiness && job.businessName 
              ? job.businessName 
              : `${job.firstName} ${job.lastName}`} - Job #{job.jobNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[500px] border rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Generating receipt...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {pdfUrl && !isLoading && (
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="Receipt Preview"
              data-testid="iframe-receipt-preview"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-close-preview"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!pdfUrl || isLoading}
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
