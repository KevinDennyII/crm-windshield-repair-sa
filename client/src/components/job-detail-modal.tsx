import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Job, type InsertJob, pipelineStages, paymentStatuses } from "@shared/schema";
import { User, Car, Wrench, Sparkles, Save, X } from "lucide-react";

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: InsertJob) => void;
  onDelete?: (jobId: string) => void;
  isNew?: boolean;
}

const stageLabels: Record<string, string> = {
  quote: "Quote",
  glass_ordered: "Glass Ordered",
  glass_arrived: "Glass Arrived",
  scheduled: "Scheduled",
  paid_completed: "Paid/Completed",
};

const paymentLabels: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
};

export function JobDetailModal({
  job,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isNew = false,
}: JobDetailModalProps) {
  const [formData, setFormData] = useState<InsertJob>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleVin: "",
    vehicleColor: "",
    glassType: "",
    glassPartNumber: "",
    glassSupplier: "",
    installDate: "",
    installTime: "",
    installLocation: "",
    installNotes: "",
    totalDue: 0,
    deductible: 0,
    paymentStatus: "pending",
    pipelineStage: "quote",
  });

  const [activeTab, setActiveTab] = useState("customer");

  useEffect(() => {
    if (job) {
      setFormData({
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        customerEmail: job.customerEmail || "",
        customerAddress: job.customerAddress || "",
        vehicleYear: job.vehicleYear,
        vehicleMake: job.vehicleMake,
        vehicleModel: job.vehicleModel,
        vehicleVin: job.vehicleVin || "",
        vehicleColor: job.vehicleColor || "",
        glassType: job.glassType,
        glassPartNumber: job.glassPartNumber || "",
        glassSupplier: job.glassSupplier || "",
        installDate: job.installDate || "",
        installTime: job.installTime || "",
        installLocation: job.installLocation || "",
        installNotes: job.installNotes || "",
        totalDue: job.totalDue,
        deductible: job.deductible,
        paymentStatus: job.paymentStatus,
        pipelineStage: job.pipelineStage,
      });
    } else {
      setFormData({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        customerAddress: "",
        vehicleYear: "",
        vehicleMake: "",
        vehicleModel: "",
        vehicleVin: "",
        vehicleColor: "",
        glassType: "",
        glassPartNumber: "",
        glassSupplier: "",
        installDate: "",
        installTime: "",
        installLocation: "",
        installNotes: "",
        totalDue: 0,
        deductible: 0,
        paymentStatus: "pending",
        pipelineStage: "quote",
      });
    }
    setActiveTab("customer");
  }, [job, isOpen]);

  const handleChange = (field: keyof InsertJob, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isNew ? "New Auto Glass Job" : "Job Details"}
            {!isNew && job && (
              <span className="text-sm font-normal text-muted-foreground">
                #{job.id.slice(0, 8)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="customer" className="gap-1.5" data-testid="tab-customer">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Customer</span>
              </TabsTrigger>
              <TabsTrigger value="vehicle" className="gap-1.5" data-testid="tab-vehicle">
                <Car className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vehicle</span>
              </TabsTrigger>
              <TabsTrigger value="install" className="gap-1.5" data-testid="tab-install">
                <Wrench className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Install</span>
              </TabsTrigger>
              <TabsTrigger value="glass" className="gap-1.5" data-testid="tab-glass">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Glass</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="customer" className="mt-0 space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="customerName">Customer Name *</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName}
                      onChange={(e) => handleChange("customerName", e.target.value)}
                      placeholder="John Smith"
                      required
                      data-testid="input-customer-name"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customerPhone">Phone *</Label>
                      <Input
                        id="customerPhone"
                        value={formData.customerPhone}
                        onChange={(e) => handleChange("customerPhone", e.target.value)}
                        placeholder="(555) 123-4567"
                        required
                        data-testid="input-customer-phone"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customerEmail">Email</Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) => handleChange("customerEmail", e.target.value)}
                        placeholder="john@example.com"
                        data-testid="input-customer-email"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="customerAddress">Address</Label>
                    <Textarea
                      id="customerAddress"
                      value={formData.customerAddress}
                      onChange={(e) => handleChange("customerAddress", e.target.value)}
                      placeholder="123 Main St, City, State 12345"
                      rows={2}
                      data-testid="input-customer-address"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="vehicle" className="mt-0 space-y-4">
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleYear">Year *</Label>
                      <Input
                        id="vehicleYear"
                        value={formData.vehicleYear}
                        onChange={(e) => handleChange("vehicleYear", e.target.value)}
                        placeholder="2024"
                        required
                        data-testid="input-vehicle-year"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleMake">Make *</Label>
                      <Input
                        id="vehicleMake"
                        value={formData.vehicleMake}
                        onChange={(e) => handleChange("vehicleMake", e.target.value)}
                        placeholder="Toyota"
                        required
                        data-testid="input-vehicle-make"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleModel">Model *</Label>
                      <Input
                        id="vehicleModel"
                        value={formData.vehicleModel}
                        onChange={(e) => handleChange("vehicleModel", e.target.value)}
                        placeholder="Camry"
                        required
                        data-testid="input-vehicle-model"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleVin">VIN</Label>
                      <Input
                        id="vehicleVin"
                        value={formData.vehicleVin}
                        onChange={(e) => handleChange("vehicleVin", e.target.value)}
                        placeholder="1HGBH41JXMN109186"
                        data-testid="input-vehicle-vin"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleColor">Color</Label>
                      <Input
                        id="vehicleColor"
                        value={formData.vehicleColor}
                        onChange={(e) => handleChange("vehicleColor", e.target.value)}
                        placeholder="Silver"
                        data-testid="input-vehicle-color"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="install" className="mt-0 space-y-4">
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="installDate">Install Date</Label>
                      <Input
                        id="installDate"
                        type="date"
                        value={formData.installDate}
                        onChange={(e) => handleChange("installDate", e.target.value)}
                        data-testid="input-install-date"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="installTime">Install Time</Label>
                      <Input
                        id="installTime"
                        type="time"
                        value={formData.installTime}
                        onChange={(e) => handleChange("installTime", e.target.value)}
                        data-testid="input-install-time"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="installLocation">Install Location</Label>
                    <Input
                      id="installLocation"
                      value={formData.installLocation}
                      onChange={(e) => handleChange("installLocation", e.target.value)}
                      placeholder="Shop / Mobile / Customer Location"
                      data-testid="input-install-location"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="installNotes">Notes</Label>
                    <Textarea
                      id="installNotes"
                      value={formData.installNotes}
                      onChange={(e) => handleChange("installNotes", e.target.value)}
                      placeholder="Special instructions, access codes, etc."
                      rows={3}
                      data-testid="input-install-notes"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pipelineStage">Pipeline Stage</Label>
                    <Select
                      value={formData.pipelineStage}
                      onValueChange={(value) => handleChange("pipelineStage", value)}
                    >
                      <SelectTrigger data-testid="select-pipeline-stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelineStages.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stageLabels[stage]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="glass" className="mt-0 space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="glassType">Glass Type *</Label>
                    <Select
                      value={formData.glassType}
                      onValueChange={(value) => handleChange("glassType", value)}
                    >
                      <SelectTrigger data-testid="select-glass-type">
                        <SelectValue placeholder="Select glass type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Windshield">Windshield</SelectItem>
                        <SelectItem value="Front Door Left">Front Door Left</SelectItem>
                        <SelectItem value="Front Door Right">Front Door Right</SelectItem>
                        <SelectItem value="Rear Door Left">Rear Door Left</SelectItem>
                        <SelectItem value="Rear Door Right">Rear Door Right</SelectItem>
                        <SelectItem value="Back Glass">Back Glass</SelectItem>
                        <SelectItem value="Quarter Glass">Quarter Glass</SelectItem>
                        <SelectItem value="Sunroof">Sunroof</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="glassPartNumber">Part Number</Label>
                      <Input
                        id="glassPartNumber"
                        value={formData.glassPartNumber}
                        onChange={(e) => handleChange("glassPartNumber", e.target.value)}
                        placeholder="FW04512GTY"
                        data-testid="input-glass-part-number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="glassSupplier">Supplier</Label>
                      <Input
                        id="glassSupplier"
                        value={formData.glassSupplier}
                        onChange={(e) => handleChange("glassSupplier", e.target.value)}
                        placeholder="Pilkington"
                        data-testid="input-glass-supplier"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="totalDue">Total Due ($) *</Label>
                      <Input
                        id="totalDue"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.totalDue}
                        onChange={(e) => handleChange("totalDue", parseFloat(e.target.value) || 0)}
                        required
                        data-testid="input-total-due"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="deductible">Deductible ($)</Label>
                      <Input
                        id="deductible"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.deductible}
                        onChange={(e) => handleChange("deductible", parseFloat(e.target.value) || 0)}
                        data-testid="input-deductible"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="paymentStatus">Payment Status</Label>
                    <Select
                      value={formData.paymentStatus}
                      onValueChange={(value) => handleChange("paymentStatus", value)}
                    >
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {paymentLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between gap-3 pt-4 border-t mt-4 flex-shrink-0">
            <div>
              {!isNew && job && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(job.id)}
                  data-testid="button-delete-job"
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" data-testid="button-save-job">
                <Save className="h-4 w-4 mr-2" />
                {isNew ? "Create Job" : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
