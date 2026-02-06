import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { triggerOutboundCall } from "@/App";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type Job,
  type InsertJob,
  type Vehicle,
  type Part,
  pipelineStages,
  paymentStatuses,
  serviceTypes,
  glassTypes,
  repairLocations,
  calibrationTypes,
  causesOfLoss,
  paymentSources,
  paymentMethods,
  customerTypes,
  leadSources,
  timeFrames,
  timeFrameDetails,
  type PaymentHistoryEntry,
  type CustomerType,
  type LeadSource,
  type TimeFrame,
  type PaymentMethod,
  type ServiceType,
  type GlassType,
} from "@shared/schema";
import {
  User,
  Car,
  Wrench,
  DollarSign,
  Save,
  X,
  Send,
  FileText,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
  Phone,
  MessageSquare,
  Mail,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCcw,
} from "lucide-react";
import { determineReceiptType, getReceiptTypeLabel } from "@/lib/receipt-generator";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";
import { EmailComposeModal } from "@/components/email-compose-modal";
import { QuoteSendModal } from "@/components/quote-send-modal";
import { CustomerReminderPopup } from "@/components/customer-reminder-popup";
import { SetReminderDialog } from "@/components/set-reminder-dialog";
import { useToast } from "@/hooks/use-toast";
import { type CustomerReminder } from "@shared/schema";
import { Bell } from "lucide-react";

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: InsertJob) => void;
  onDelete?: (jobId: string) => void;
  onAddPayment?: (jobId: string, payment: PaymentHistoryEntry) => void;
  isNew?: boolean;
}

const stageLabels: Record<string, string> = {
  new_lead: "New Lead",
  quote: "Quote",
  scheduled: "Scheduled",
  paid_completed: "Paid/Completed",
  lost_opportunity: "Lost Opportunity",
};

const serviceTypeLabels: Record<string, string> = {
  repair: "Repair",
  replace: "Replace",
  calibration: "Calibration",
};

const glassTypeLabels: Record<string, string> = {
  windshield: "Windshield",
  door_glass: "Door Glass",
  back_glass: "Back Glass",
  back_glass_powerslide: "Back Glass (Powerslide)",
  quarter_glass: "Quarter Glass",
  sunroof: "Sunroof",
  side_mirror: "Side Mirror",
};

// Helper to migrate legacy jobType to serviceType + glassType
function deriveServiceAndGlassType(part: Part): { serviceType: string; glassType: string } {
  // If new fields exist, use them
  if (part.serviceType && part.glassType) {
    return { serviceType: part.serviceType, glassType: part.glassType };
  }
  
  // Fallback: derive from legacy jobType field
  const legacyJobType = (part as any).jobType || "windshield_replacement";
  
  // Map legacy jobType to new fields
  if (legacyJobType === "windshield_repair") {
    return { serviceType: "repair", glassType: "windshield" };
  }
  if (legacyJobType === "windshield_replacement") {
    return { serviceType: "replace", glassType: "windshield" };
  }
  if (legacyJobType === "door_glass") {
    return { serviceType: "replace", glassType: "door_glass" };
  }
  if (legacyJobType === "back_glass") {
    return { serviceType: "replace", glassType: "back_glass" };
  }
  if (legacyJobType === "back_glass_powerslide") {
    return { serviceType: "replace", glassType: "back_glass_powerslide" };
  }
  if (legacyJobType === "quarter_glass") {
    return { serviceType: "replace", glassType: "quarter_glass" };
  }
  if (legacyJobType === "sunroof") {
    return { serviceType: "replace", glassType: "sunroof" };
  }
  if (legacyJobType === "side_mirror") {
    return { serviceType: "replace", glassType: "side_mirror" };
  }
  
  // Default fallback
  return { serviceType: "replace", glassType: "windshield" };
}

// Helper to get display label for a part
function getPartDisplayLabel(part: Part): string {
  const { serviceType, glassType } = deriveServiceAndGlassType(part);
  const service = serviceTypeLabels[serviceType] || "Replace";
  const glass = glassTypeLabels[glassType] || "Windshield";
  return `${glass} ${service}`;
}

const bodyStyleOptions = [
  "Sedan",
  "Coupe",
  "Mini SUV",
  "SUV",
  "Pickup",
  "Van",
  "Minivan",
  "Hatchback",
  "Wagon",
  "Convertible",
  "18 Wheeler",
  "Utility Vehicle",
] as const;

function calculateLaborPrice(
  serviceType: string,
  glassType: string,
  bodyStyle: string,
  vehicleYear: string,
  partCost: number,
  customerType?: string
): number {
  // Dealer customers always get $90 labor
  if (customerType === "dealer") {
    return 90;
  }
  
  // Subcontractor customers get default $100 labor (can be changed to 100/110/125 via dropdown)
  if (customerType === "subcontractor") {
    return 100;
  }
  
  const year = parseInt(vehicleYear) || new Date().getFullYear();
  const upperBodyStyle = bodyStyle.toUpperCase();
  
  const is18Wheeler = upperBodyStyle.includes("18 WHEELER") || upperBodyStyle.includes("SEMI");
  const isUtilityVehicle = upperBodyStyle.includes("UTILITY");
  const isSedan = upperBodyStyle.includes("SEDAN") || upperBodyStyle.includes("COUPE") || 
                  upperBodyStyle.includes("HATCHBACK") || upperBodyStyle.includes("CONVERTIBLE");
  const isMiniSUV = upperBodyStyle.includes("MINI SUV") || upperBodyStyle.includes("CROSSOVER");
  const isSUVOrPickup = upperBodyStyle.includes("SUV") || upperBodyStyle.includes("PICKUP") || 
                        upperBodyStyle.includes("TRUCK") || upperBodyStyle.includes("VAN") || 
                        upperBodyStyle.includes("WAGON");
  
  // Rule: For ANY glass where our cost is $250 or more, charge 75% of cost as labor
  if (partCost >= 250) {
    return Math.round(partCost * 0.75);
  }
  
  // Repair jobs - typically lower labor
  if (serviceType === "repair") {
    return 50; // Standard repair labor
  }
  
  // Calibration-only jobs
  if (serviceType === "calibration") {
    return 0; // Calibration labor is tracked separately via calibrationPrice
  }
  
  // Door glass, quarter glass, side mirror replacement rules
  if (glassType === "door_glass" || glassType === "quarter_glass" || glassType === "side_mirror") {
    if (is18Wheeler) {
      return 150; // 18 wheelers $150 any year for door glass
    }
    return 145; // All other vehicles $145 labor for door glass
  }
  
  // Windshield and Back Glass replacement rules
  if (glassType === "windshield" || glassType === "back_glass" || 
      glassType === "back_glass_powerslide" || glassType === "sunroof") {
    
    // 18 wheeler rule
    if (is18Wheeler) {
      return 250;
    }
    
    // Powerslide back glass
    if (glassType === "back_glass_powerslide") {
      return 185;
    }
    
    // $140 labor for ANY GLASS on any vehicle 2016 and under (except 18 wheelers or utility vehicles)
    if (year <= 2016 && !is18Wheeler && !isUtilityVehicle) {
      return 140;
    }
    
    // Standard pricing by body style for 2017+
    if (isSedan) {
      return 150;
    }
    if (isMiniSUV) {
      return 165;
    }
    if (isUtilityVehicle) {
      return 225;
    }
    if (isSUVOrPickup) {
      return 175;
    }
    
    // Default to SUV/Pickup pricing if body style not recognized
    return 175;
  }
  
  // Default fallback
  return 150;
}

const locationLabels: Record<string, string> = {
  in_shop: "In-Shop",
  mobile: "Mobile",
  customer_location: "Customer Location",
};

const calibrationLabels: Record<string, string> = {
  none: "None Required",
  static: "Static Calibration",
  dynamic: "Dynamic Calibration",
  dual: "Dual Calibration",
  approve: "Approve",
  declined: "Declined",
};

const causeLabels: Record<string, string> = {
  rock_chip: "Rock Chip",
  crack: "Crack",
  vandalism: "Vandalism",
  accident: "Accident",
  weather: "Weather",
  unknown: "Unknown",
  other: "Other",
};

const sourceLabels: Record<string, string> = {
  cash: "Cash",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  check: "Check",
  insurance: "Insurance",
  other: "Other",
};

const customerTypeLabels: Record<string, string> = {
  retail: "Retail Customer",
  dealer: "Dealer Account",
  fleet: "Fleet Account",
  subcontractor: "Subcontractor",
};

const leadSourceLabels: Record<string, string> = {
  google_ads: "Google Ads",
  referral: "Referral",
  dealer: "Dealer",
  repeat: "Repeat",
  subcontractor: "Subcontractor",
  facebook: "Facebook",
};

// Subcontractor labor rate options
const subcontractorLaborRates = [100, 110, 125] as const;

const durationOptions = [
  { value: "0.5", label: "30 minutes" },
  { value: "1", label: "1 hour" },
  { value: "1.5", label: "1.5 hours" },
  { value: "2", label: "2 hours" },
  { value: "2.5", label: "2.5 hours" },
  { value: "3", label: "3 hours" },
  { value: "4", label: "4 hours" },
];

function createDefaultPart(): Part {
  return {
    id: crypto.randomUUID(),
    serviceType: "replace",
    glassType: "windshield",
    glassPartNumber: "",
    isAftermarket: true,
    distributor: "",
    accessories: "",
    glassOrderedDate: "",
    glassArrivalDate: "",
    calibrationType: "none",
    calibrationLocation: "",
    urethaneKit: "",
    partPrice: 0,
    markup: 0,
    accessoriesPrice: 0,
    urethanePrice: 15,
    salesTaxPercent: 8.25,
    laborPrice: 0,
    calibrationPrice: 0,
    mobileFee: 0,
    materialCost: 0,
    subcontractorCost: 0,
    partsSubtotal: 0,
    partTotal: 0,
  };
}

function createDefaultVehicle(): Vehicle {
  return {
    id: crypto.randomUUID(),
    vin: "",
    licensePlate: "",
    mileage: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    bodyStyle: "",
    nagsCarId: "",
    vehicleColor: "",
    parts: [],
  };
}

function calculatePartTotals(part: Part, customerType?: string): { partsSubtotal: number; partTotal: number } {
  // For subcontractors: they buy their own parts, so only charge labor + mobile fee + manual cost
  if (customerType === "subcontractor") {
    const partTotal = part.laborPrice + part.mobileFee + (part.subcontractorCost || 0);
    return { partsSubtotal: 0, partTotal };
  }
  
  // Standard calculation for other customer types
  const partsSubtotal = 
    (part.partPrice + part.markup + part.accessoriesPrice + part.urethanePrice) * 
    (1 + part.salesTaxPercent / 100);
  const subtotalBeforeFee = partsSubtotal + part.laborPrice + part.calibrationPrice + part.mobileFee;
  
  // Dealers pay by check, so waive the 3.5% processing fee
  const partTotal = customerType === "dealer" 
    ? Math.ceil(subtotalBeforeFee) 
    : Math.ceil(subtotalBeforeFee * 1.035);
  return { partsSubtotal, partTotal };
}

function calculateJobTotal(vehicles: Vehicle[], customerType?: string): number {
  let total = 0;
  for (const vehicle of vehicles) {
    for (const part of vehicle.parts) {
      const { partTotal } = calculatePartTotals(part, customerType);
      total += partTotal;
    }
  }
  return total;
}

const getDefaultFormData = (): InsertJob => ({
  isBusiness: false,
  businessName: "",
  customerType: "retail",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  vehicles: [],
  pipelineStage: "quote",
  repairLocation: "in_shop",
  installer: "",
  installDate: "",
  timeFrame: undefined as TimeFrame | undefined,
  installTime: "",
  installEndTime: "",
  jobDuration: "2",
  claimNumber: "",
  dispatchNumber: "",
  policyNumber: "",
  dateOfLoss: "",
  causeOfLoss: undefined,
  insuranceCompany: "",
  subtotal: 0,
  taxAmount: 0,
  totalDue: 0,
  deductible: 0,
  rebate: 0,
  amountPaid: 0,
  balanceDue: 0,
  paymentStatus: "pending",
  paymentMethod: [],
  paymentHistory: [],
  installNotes: "",
  calibrationDeclined: false,
});

export function JobDetailModal({
  job,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onAddPayment,
  isNew = false,
}: JobDetailModalProps) {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState<InsertJob>(getDefaultFormData());
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [calculatedMobileFee, setCalculatedMobileFee] = useState<number | null>(null);
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("customer");
  const [newPayment, setNewPayment] = useState({
    source: "cash" as const,
    amount: 0,
    notes: "",
  });

  const [showInsurance, setShowInsurance] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [receiptPreviewJob, setReceiptPreviewJob] = useState<Job | null>(null);
  const [decodingVin, setDecodingVin] = useState<string | null>(null);
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [showSetReminderDialog, setShowSetReminderDialog] = useState(false);
  const [reminderShownForKey, setReminderShownForKey] = useState<string>("");
  const { toast } = useToast();

  const getCustomerKey = useCallback(() => {
    if (formData.isBusiness && formData.businessName?.trim()) {
      return formData.businessName.trim();
    }
    if (formData.firstName?.trim() && formData.lastName?.trim()) {
      return `${formData.firstName.trim()} ${formData.lastName.trim()}`;
    }
    return "";
  }, [formData.isBusiness, formData.businessName, formData.firstName, formData.lastName]);

  const customerKey = getCustomerKey();

  const { data: customerReminder } = useQuery<CustomerReminder | null>({
    queryKey: ["/api/customer-reminders", customerKey],
    queryFn: async () => {
      if (!customerKey) return null;
      const response = await fetch(`/api/customer-reminders/${encodeURIComponent(customerKey)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch reminder");
      return response.json();
    },
    enabled: !!customerKey,
  });

  useEffect(() => {
    if (customerReminder && customerKey && customerKey !== reminderShownForKey) {
      setShowReminderPopup(true);
      setReminderShownForKey(customerKey);
    }
  }, [customerReminder, customerKey, reminderShownForKey]);

  const jobTotal = calculateJobTotal(vehicles, formData.customerType);

  useEffect(() => {
    if (job) {
      const { id, jobNumber, createdAt, vehicles: jobVehicles, ...jobData } = job;
      // Normalize parts to ensure serviceType/glassType are populated from legacy jobType
      const normalizedVehicles = (jobVehicles || []).map((v: Vehicle) => ({
        ...v,
        parts: v.parts.map((p: Part) => {
          const { serviceType, glassType } = deriveServiceAndGlassType(p);
          return { ...p, serviceType, glassType };
        }),
      }));
      setFormData({ ...jobData, vehicles: normalizedVehicles });
      setVehicles(normalizedVehicles);
      if (normalizedVehicles.length > 0) {
        setExpandedVehicles(new Set([normalizedVehicles[0].id]));
      }
    } else {
      setFormData(getDefaultFormData());
      setVehicles([]);
      setExpandedVehicles(new Set());
    }
    setCalculatedMobileFee(null); // Reset mobile fee when modal opens/job changes
    setActiveTab("customer");
    setNewPayment({ source: "cash", amount: 0, notes: "" });
    setReminderShownForKey(""); // Reset so reminder can show again for new job
    setShowReminderPopup(false);
    if (job) {
      const hasInsuranceData = !!(job.insuranceCompany || job.claimNumber || job.policyNumber || job.dispatchNumber || job.dateOfLoss);
      setShowInsurance(hasInsuranceData);
    } else {
      setShowInsurance(false);
    }
  }, [job, isOpen]);

  const handleChange = (field: keyof InsertJob, value: string | number | boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddVehicle = () => {
    const newVehicle = createDefaultVehicle();
    setVehicles((prev) => [...prev, newVehicle]);
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      next.add(newVehicle.id);
      return next;
    });
  };

  const handleRemoveVehicle = (vehicleId: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      next.delete(vehicleId);
      return next;
    });
  };

  const handleVehicleChange = (vehicleId: string, field: keyof Vehicle, value: string) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, [field]: value } : v))
    );
  };

  const handleDecodeVin = async (vehicleId: string, vin: string) => {
    if (!vin || vin.length !== 17) {
      toast({
        title: "Invalid VIN",
        description: "VIN must be exactly 17 characters",
        variant: "destructive",
      });
      return;
    }

    setDecodingVin(vehicleId);
    try {
      const response = await fetch(`/api/vin/decode/${vin}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to decode VIN");
      }
      
      const decoded = await response.json();
      
      // Check if we got any valid data
      if (!decoded.year && !decoded.make && !decoded.model) {
        throw new Error("No vehicle data found for this VIN");
      }
      
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                vehicleYear: decoded.year || v.vehicleYear,
                vehicleMake: decoded.make || v.vehicleMake,
                vehicleModel: decoded.model || v.vehicleModel,
                bodyStyle: decoded.bodyStyle || v.bodyStyle,
              }
            : v
        )
      );
      
      toast({
        title: "VIN Decoded",
        description: `${decoded.year} ${decoded.make} ${decoded.model}`,
      });
    } catch (error: any) {
      toast({
        title: "VIN Decode Failed",
        description: error.message || "Failed to decode VIN",
        variant: "destructive",
      });
    } finally {
      setDecodingVin(null);
    }
  };

  const handleAddPart = (vehicleId: string) => {
    const newPart = createDefaultPart();
    
    // Find the vehicle to get its info for labor calculation
    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    // Calculate labor price based on vehicle info
    if (vehicle) {
      newPart.laborPrice = calculateLaborPrice(
        newPart.serviceType,
        newPart.glassType,
        vehicle.bodyStyle || "",
        vehicle.vehicleYear || "",
        newPart.partPrice,
        formData.customerType
      );
    }
    
    // For subcontractors, reset parts pricing fields since they provide their own materials
    if (formData.customerType === "subcontractor") {
      newPart.partPrice = 0;
      newPart.markup = 0;
      newPart.accessoriesPrice = 0;
      newPart.urethanePrice = 0;
      newPart.salesTaxPercent = 0;
      newPart.calibrationPrice = 0;
    }
    
    // Apply the calculated mobile fee from address selection (including $0 for local addresses)
    if (calculatedMobileFee !== null) {
      newPart.mobileFee = calculatedMobileFee;
    }
    
    // Calculate totals
    const { partsSubtotal, partTotal } = calculatePartTotals(newPart, formData.customerType);
    newPart.partsSubtotal = partsSubtotal;
    newPart.partTotal = partTotal;
    
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, parts: [...v.parts, newPart] } : v
      )
    );
  };

  const handleRemovePart = (vehicleId: string, partId: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? { ...v, parts: v.parts.filter((p) => p.id !== partId) }
          : v
      )
    );
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const openPartsSearch = () => {
    const width = 1000;
    const height = 700;
    const left = window.screenX + 50;
    const top = window.screenY + 50;
    window.open(
      "https://windshieldrepairsa.autoglasscrm.com/dashboard",
      "PartsSearch",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  const handlePartChange = (
    vehicleId: string,
    partId: string,
    field: keyof Part,
    value: string | number | boolean
  ) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              parts: v.parts.map((p) => {
                if (p.id === partId) {
                  const updatedPart = { ...p, [field]: value };
                  const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                  return { ...updatedPart, partsSubtotal, partTotal };
                }
                return p;
              }),
            }
          : v
      )
    );
  };

  const toggleVehicleExpanded = (vehicleId: string) => {
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = calculateJobTotal(vehicles, formData.customerType);
    const updatedFormData: InsertJob = {
      ...formData,
      vehicles,
      totalDue: total,
      balanceDue: Math.max(0, total - (formData.amountPaid || 0)),
    };
    onSave(updatedFormData);
  };

  const handleAddPayment = () => {
    if (job && onAddPayment && newPayment.amount > 0) {
      const payment: PaymentHistoryEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split("T")[0],
        source: newPayment.source,
        amount: newPayment.amount,
        notes: newPayment.notes,
      };
      onAddPayment(job.id, payment);
      setNewPayment({ source: "cash", amount: 0, notes: "" });
    }
  };

  const getVehicleDisplayName = (v: Vehicle, index: number) => {
    if (v.vehicleYear || v.vehicleMake || v.vehicleModel) {
      return `${v.vehicleYear} ${v.vehicleMake} ${v.vehicleModel}`.trim();
    }
    return `Vehicle ${index + 1}`;
  };

  const getJobHeaderInfo = () => {
    if (vehicles.length === 0) return null;
    if (vehicles.length === 1) {
      const v = vehicles[0];
      return `${v.vehicleYear} ${v.vehicleMake} ${v.vehicleModel}`.trim() || null;
    }
    return `${vehicles.length} vehicles`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isNew ? (
              "New Auto Glass Job"
            ) : (
              <>
                <span>Job #{job?.jobNumber}</span>
                {getJobHeaderInfo() && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {getJobHeaderInfo()}
                  </span>
                )}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isNew ? "Create a new auto glass job" : `Edit job ${job?.jobNumber}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="customer" className="gap-1.5" data-testid="tab-customer">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Customer</span>
                <span className="sm:hidden">Customer</span>
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-1.5" data-testid="tab-vehicles">
                <Car className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vehicles & Parts</span>
                <span className="sm:hidden">Vehicles</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5" data-testid="tab-payments">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Insurance & Payments</span>
                <span className="sm:hidden">Payments</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 pr-2">
              {/* Customer Tab */}
              <TabsContent value="customer" className="mt-0 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="isBusiness"
                        checked={formData.isBusiness}
                        onCheckedChange={(checked) => handleChange("isBusiness", checked)}
                        data-testid="switch-is-business"
                      />
                      <Label htmlFor="isBusiness">Business Account</Label>
                    </div>

                    {formData.isBusiness && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="businessName">Business Name</Label>
                          <Input
                            id="businessName"
                            value={formData.businessName}
                            onChange={(e) => handleChange("businessName", e.target.value)}
                            placeholder="Company Name"
                            data-testid="input-business-name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Account Type</Label>
                          <Select
                            value={formData.customerType || "retail"}
                            onValueChange={(value) => {
                              handleChange("customerType", value as CustomerType);
                              // Recalculate labor for all parts when customer type changes
                              const updatedVehicles = vehicles.map(vehicle => ({
                                ...vehicle,
                                parts: vehicle.parts.map(part => {
                                  const newLaborPrice = calculateLaborPrice(
                                    part.serviceType,
                                    part.glassType,
                                    vehicle.bodyStyle || "",
                                    vehicle.vehicleYear || "",
                                    part.partPrice,
                                    value
                                  );
                                  // For subcontractors, reset parts pricing fields since they provide their own
                                  const updatedPart = value === "subcontractor" 
                                    ? { 
                                        ...part, 
                                        laborPrice: newLaborPrice,
                                        partPrice: 0,
                                        markup: 0,
                                        accessoriesPrice: 0,
                                        urethanePrice: 0,
                                        salesTaxPercent: 0,
                                        calibrationPrice: 0
                                      }
                                    : { ...part, laborPrice: newLaborPrice };
                                  const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, value);
                                  return { ...updatedPart, partsSubtotal, partTotal };
                                })
                              }));
                              setVehicles(updatedVehicles);
                            }}
                          >
                            <SelectTrigger data-testid="select-customer-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {customerTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {customerTypeLabels[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Lead Source</Label>
                          <Select
                            value={formData.leadSource || ""}
                            onValueChange={(value) => handleChange("leadSource", value)}
                          >
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                              {leadSources.map((source) => (
                                <SelectItem key={source} value={source}>
                                  {leadSourceLabels[source]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Repeat Customer Notes for business accounts */}
                    {formData.isBusiness && formData.leadSource === "repeat" && (
                      <div className="grid gap-2 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                        <Label className="text-purple-700 dark:text-purple-300 font-medium flex items-center gap-2">
                          <RefreshCcw className="w-4 h-4" /> Repeat Customer Notes
                        </Label>
                        <Textarea
                          value={formData.repeatCustomerNotes || ""}
                          onChange={(e) => handleChange("repeatCustomerNotes", e.target.value)}
                          placeholder="Add notes about this repeat customer (e.g., 'Afternoon jobs only', 'Prefers cash payment', etc.)"
                          className="min-h-[80px] bg-white dark:bg-gray-900"
                          data-testid="textarea-repeat-customer-notes-business"
                        />
                      </div>
                    )}

                    {/* Lead Source - always visible */}
                    {!formData.isBusiness && (
                      <div className="grid gap-2">
                        <Label>Lead Source</Label>
                        <Select
                          value={formData.leadSource || ""}
                          onValueChange={(value) => handleChange("leadSource", value)}
                        >
                          <SelectTrigger data-testid="select-lead-source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            {leadSources.map((source) => (
                              <SelectItem key={source} value={source}>
                                {leadSourceLabels[source]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Repeat Customer Notes - appears when lead source is "repeat" */}
                    {formData.leadSource === "repeat" && (
                      <div className="grid gap-2 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                        <Label className="text-purple-700 dark:text-purple-300 font-medium flex items-center gap-2">
                          <RefreshCcw className="w-4 h-4" /> Repeat Customer Notes
                        </Label>
                        <Textarea
                          value={formData.repeatCustomerNotes || ""}
                          onChange={(e) => handleChange("repeatCustomerNotes", e.target.value)}
                          placeholder="Add notes about this repeat customer (e.g., 'Afternoon jobs only', 'Prefers cash payment', etc.)"
                          className="min-h-[80px] bg-white dark:bg-gray-900"
                          data-testid="textarea-repeat-customer-notes"
                        />
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleChange("firstName", e.target.value)}
                          placeholder="John"
                          required
                          data-testid="input-first-name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleChange("lastName", e.target.value)}
                          placeholder="Smith"
                          required
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>

                    {customerKey && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSetReminderDialog(true)}
                          className={customerReminder ? "border-amber-500 text-amber-600 dark:text-amber-400" : ""}
                          data-testid="button-set-reminder"
                        >
                          <Bell className="w-4 h-4 mr-2" />
                          {customerReminder ? "Edit Reminder" : "Set Reminder"}
                        </Button>
                        {customerReminder && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Reminder set for this customer
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          placeholder="(555) 123-4567"
                          required
                          data-testid="input-phone"
                        />
                        {formData.phone && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Trigger Twilio outbound call via Call Center
                                triggerOutboundCall(formData.phone, `${formData.firstName} ${formData.lastName}`);
                              }}
                              data-testid="button-call-customer"
                            >
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onClose();
                                navigate(`/conversations?phone=${encodeURIComponent(formData.phone)}`);
                              }}
                              data-testid="button-text-customer"
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Text
                            </Button>
                            {formData.email && job && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowEmailModal(true)}
                                data-testid="button-email-customer"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Email
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          placeholder="john@example.com"
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="streetAddress">Street Address</Label>
                      <AddressAutocomplete
                        value={formData.streetAddress || ""}
                        onChange={(value) => handleChange("streetAddress", value)}
                        onAddressSelect={(address) => {
                          // Update address fields
                          setFormData(prev => ({
                            ...prev,
                            streetAddress: address.street,
                            city: address.city,
                            state: address.state,
                            zipCode: address.zip
                          }));
                          
                          // Auto-set mobile fee on all parts if calculated
                          if (address.mobileFee !== undefined) {
                            // Store for future parts
                            setCalculatedMobileFee(address.mobileFee);
                            
                            // Apply to existing parts
                            if (vehicles.length > 0) {
                              const updatedVehicles = vehicles.map(vehicle => ({
                                ...vehicle,
                                parts: vehicle.parts.map(part => {
                                  const updatedPart = { ...part, mobileFee: address.mobileFee as number };
                                  const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                  return { ...updatedPart, partsSubtotal, partTotal };
                                })
                              }));
                              setVehicles(updatedVehicles);
                            }
                          }
                        }}
                        placeholder="Start typing an address..."
                        data-testid="input-street-address"
                      />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleChange("city", e.target.value)}
                          placeholder="Springfield"
                          data-testid="input-city"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => handleChange("state", e.target.value)}
                          placeholder="IL"
                          data-testid="input-state"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="zipCode">Zip Code</Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={(e) => handleChange("zipCode", e.target.value)}
                          placeholder="62701"
                          data-testid="input-zip-code"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Job Scheduling Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Scheduling & Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Pipeline Stage</Label>
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
                      <div className="grid gap-2">
                        <Label>Repair Location</Label>
                        <Select
                          value={formData.repairLocation}
                          onValueChange={(value) => handleChange("repairLocation", value)}
                        >
                          <SelectTrigger data-testid="select-repair-location">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {repairLocations.map((loc) => (
                              <SelectItem key={loc} value={loc}>
                                {locationLabels[loc]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-4 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="installer">Installer</Label>
                        <Input
                          id="installer"
                          value={formData.installer}
                          onChange={(e) => handleChange("installer", e.target.value)}
                          placeholder="John"
                          data-testid="input-installer"
                        />
                      </div>
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
                        <Label htmlFor="timeFrame">Time Frame</Label>
                        <Select
                          value={formData.timeFrame || ""}
                          onValueChange={(value: TimeFrame) => {
                            handleChange("timeFrame", value);
                            // Auto-fill start/end times from preset, or clear for custom
                            if (value === "custom") {
                              // Keep existing times or clear for custom entry
                              if (!formData.installTime) handleChange("installTime", "");
                              if (!formData.installEndTime) handleChange("installEndTime", "");
                            } else if (timeFrameDetails[value]) {
                              handleChange("installTime", timeFrameDetails[value].startTime);
                              handleChange("installEndTime", timeFrameDetails[value].endTime);
                            }
                          }}
                        >
                          <SelectTrigger data-testid="select-time-frame">
                            <SelectValue placeholder="Select time frame" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeFrames.map((frame) => (
                              <SelectItem key={frame} value={frame}>
                                {timeFrameDetails[frame]?.label || frame}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.timeFrame === "custom" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="installTime">Start Time</Label>
                            <Input
                              id="installTime"
                              type="time"
                              value={formData.installTime}
                              onChange={(e) => handleChange("installTime", e.target.value)}
                              data-testid="input-install-time"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="installEndTime">End Time</Label>
                            <Input
                              id="installEndTime"
                              type="time"
                              value={formData.installEndTime}
                              onChange={(e) => handleChange("installEndTime", e.target.value)}
                              data-testid="input-install-end-time"
                            />
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>Duration</Label>
                        <Select
                          value={formData.jobDuration || "2"}
                          onValueChange={(value) => handleChange("jobDuration", value)}
                        >
                          <SelectTrigger data-testid="select-job-duration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {durationOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="installNotes">Notes</Label>
                      <Textarea
                        id="installNotes"
                        value={formData.installNotes}
                        onChange={(e) => handleChange("installNotes", e.target.value)}
                        placeholder="Special instructions, access codes, etc."
                        rows={3}
                        data-testid="textarea-install-notes"
                      />
                    </div>

                  </CardContent>
                </Card>
              </TabsContent>

              {/* Vehicles & Parts Tab */}
              <TabsContent value="vehicles" className="mt-0 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">Vehicles</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddVehicle}
                    data-testid="button-add-vehicle"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Vehicle
                  </Button>
                </div>

                {vehicles.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No vehicles added yet. Click "Add Vehicle" to get started.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {vehicles.map((vehicle, vIndex) => (
                      <Card key={vehicle.id} data-testid={`card-vehicle-${vehicle.id}`}>
                        <Collapsible
                          open={expandedVehicles.has(vehicle.id)}
                          onOpenChange={() => toggleVehicleExpanded(vehicle.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <CardHeader className="pb-3 cursor-pointer">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  {expandedVehicles.has(vehicle.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Car className="h-4 w-4" />
                                  <CardTitle className="text-base">
                                    {getVehicleDisplayName(vehicle, vIndex)}
                                  </CardTitle>
                                  <Badge variant="secondary">
                                    {vehicle.parts.length} part{vehicle.parts.length !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveVehicle(vehicle.id);
                                  }}
                                  data-testid={`button-remove-vehicle-${vehicle.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <CardContent className="space-y-6">
                              {/* Vehicle Details */}
                              <div className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label>VIN</Label>
                                    <div className="flex gap-2">
                                      <Input
                                        value={vehicle.vin}
                                        onChange={(e) =>
                                          handleVehicleChange(
                                            vehicle.id,
                                            "vin",
                                            e.target.value.toUpperCase()
                                          )
                                        }
                                        placeholder="1HGCV1F34NA012345"
                                        className="flex-1"
                                        data-testid={`input-vehicle-vin-${vehicle.id}`}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        title="Decode VIN"
                                        onClick={() => handleDecodeVin(vehicle.id, vehicle.vin || "")}
                                        disabled={decodingVin === vehicle.id || !vehicle.vin || vehicle.vin.length !== 17}
                                        data-testid={`button-decode-vin-${vehicle.id}`}
                                      >
                                        {decodingVin === vehicle.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Search className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>License Plate</Label>
                                    <Input
                                      value={vehicle.licensePlate}
                                      onChange={(e) =>
                                        handleVehicleChange(
                                          vehicle.id,
                                          "licensePlate",
                                          e.target.value.toUpperCase()
                                        )
                                      }
                                      placeholder="ABC1234"
                                      data-testid={`input-vehicle-plate-${vehicle.id}`}
                                    />
                                  </div>
                                </div>

                                <div className="grid sm:grid-cols-4 gap-4">
                                  <div className="grid gap-2">
                                    <Label>Year</Label>
                                    <Input
                                      value={vehicle.vehicleYear}
                                      onChange={(e) => {
                                        const newYear = e.target.value;
                                        handleVehicleChange(vehicle.id, "vehicleYear", newYear);
                                        // Recalculate labor for all parts when year changes
                                        if (vehicle.parts.length > 0) {
                                          const updatedParts = vehicle.parts.map(part => {
                                            const newLaborPrice = calculateLaborPrice(
                                              part.serviceType,
                                              part.glassType,
                                              vehicle.bodyStyle || "",
                                              newYear,
                                              part.partPrice,
                                              formData.customerType
                                            );
                                            const updatedPart = { ...part, laborPrice: newLaborPrice };
                                            const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                            return { ...updatedPart, partsSubtotal, partTotal };
                                          });
                                          setVehicles(prev => prev.map(v => 
                                            v.id === vehicle.id ? { ...v, vehicleYear: newYear, parts: updatedParts } : v
                                          ));
                                        }
                                      }}
                                      placeholder="2024"
                                      data-testid={`input-vehicle-year-${vehicle.id}`}
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Make</Label>
                                    <Input
                                      value={vehicle.vehicleMake}
                                      onChange={(e) =>
                                        handleVehicleChange(vehicle.id, "vehicleMake", e.target.value)
                                      }
                                      placeholder="Honda"
                                      data-testid={`input-vehicle-make-${vehicle.id}`}
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Model</Label>
                                    <Input
                                      value={vehicle.vehicleModel}
                                      onChange={(e) =>
                                        handleVehicleChange(vehicle.id, "vehicleModel", e.target.value)
                                      }
                                      placeholder="Accord"
                                      data-testid={`input-vehicle-model-${vehicle.id}`}
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Mileage</Label>
                                    <Input
                                      value={vehicle.mileage}
                                      onChange={(e) =>
                                        handleVehicleChange(vehicle.id, "mileage", e.target.value)
                                      }
                                      placeholder="45000"
                                      data-testid={`input-vehicle-mileage-${vehicle.id}`}
                                    />
                                  </div>
                                </div>

                                <div className="grid sm:grid-cols-3 gap-4">
                                  <div className="grid gap-2">
                                    <Label>Body Style</Label>
                                    <Select
                                      value={vehicle.bodyStyle}
                                      onValueChange={(value) => {
                                        handleVehicleChange(vehicle.id, "bodyStyle", value);
                                        // Recalculate labor for all parts when body style changes
                                        const updatedParts = vehicle.parts.map(part => {
                                          const newLaborPrice = calculateLaborPrice(
                                            part.serviceType,
                                            part.glassType,
                                            value,
                                            vehicle.vehicleYear,
                                            part.partPrice,
                                            formData.customerType
                                          );
                                          const updatedPart = { ...part, laborPrice: newLaborPrice };
                                          const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                          return { ...updatedPart, partsSubtotal, partTotal };
                                        });
                                        setVehicles(prev => prev.map(v => 
                                          v.id === vehicle.id ? { ...v, bodyStyle: value, parts: updatedParts } : v
                                        ));
                                      }}
                                    >
                                      <SelectTrigger data-testid={`select-vehicle-body-${vehicle.id}`}>
                                        <SelectValue placeholder="Select body style" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {bodyStyleOptions.map((style) => (
                                          <SelectItem key={style} value={style}>
                                            {style}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Color</Label>
                                    <Input
                                      value={vehicle.vehicleColor}
                                      onChange={(e) =>
                                        handleVehicleChange(vehicle.id, "vehicleColor", e.target.value)
                                      }
                                      placeholder="White"
                                      data-testid={`input-vehicle-color-${vehicle.id}`}
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>NAGS Car ID</Label>
                                    <Input
                                      value={vehicle.nagsCarId}
                                      onChange={(e) =>
                                        handleVehicleChange(
                                          vehicle.id,
                                          "nagsCarId",
                                          e.target.value.toUpperCase()
                                        )
                                      }
                                      placeholder="HON24ACC"
                                      data-testid={`input-vehicle-nags-${vehicle.id}`}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Parts Section */}
                              <div className="border-t pt-4">
                                <div className="flex items-center justify-between gap-4 mb-4">
                                  <h4 className="font-medium">Parts</h4>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      onClick={openPartsSearch}
                                      data-testid={`button-search-parts-${vehicle.id}`}
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Search Parts
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAddPart(vehicle.id)}
                                      data-testid={`button-add-part-${vehicle.id}`}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Part
                                    </Button>
                                  </div>
                                </div>

                                {/* Quick Copy Bar for Parts Lookup */}
                                <div className="bg-muted/50 rounded-md p-3 mb-4 space-y-2">
                                  <div className="text-xs text-muted-foreground font-medium mb-2">
                                    Quick Copy for Parts Search:
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {vehicle.vin && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(vehicle.vin!, "VIN")}
                                        className="h-7 text-xs"
                                        data-testid={`button-copy-vin-${vehicle.id}`}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        VIN: {vehicle.vin.substring(0, 11)}...
                                      </Button>
                                    )}
                                    {vehicle.licensePlate && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(vehicle.licensePlate!, "License Plate")}
                                        className="h-7 text-xs"
                                        data-testid={`button-copy-plate-${vehicle.id}`}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Plate: {vehicle.licensePlate}
                                      </Button>
                                    )}
                                    {(vehicle.vehicleYear || vehicle.vehicleMake || vehicle.vehicleModel) && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(
                                          `${vehicle.vehicleYear} ${vehicle.vehicleMake} ${vehicle.vehicleModel}`.trim(),
                                          "Vehicle"
                                        )}
                                        className="h-7 text-xs"
                                        data-testid={`button-copy-vehicle-${vehicle.id}`}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        {vehicle.vehicleYear} {vehicle.vehicleMake} {vehicle.vehicleModel}
                                      </Button>
                                    )}
                                  </div>
                                  {!vehicle.vin && !vehicle.licensePlate && !vehicle.vehicleYear && !vehicle.vehicleMake && (
                                    <div className="text-xs text-muted-foreground italic">
                                      Fill in vehicle info above to enable quick copy
                                    </div>
                                  )}
                                </div>

                                {vehicle.parts.length === 0 ? (
                                  <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                                    No parts added. Click "Add Part" to add glass or service.
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    {vehicle.parts.map((part, pIndex) => {
                                      const { partsSubtotal, partTotal } = calculatePartTotals(part, formData.customerType);
                                      return (
                                        <Card
                                          key={part.id}
                                          className="bg-muted/30"
                                          data-testid={`card-part-${part.id}`}
                                        >
                                          <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between gap-4">
                                              <CardTitle className="text-sm">
                                                Part {pIndex + 1}: {getPartDisplayLabel(part)}
                                              </CardTitle>
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm">
                                                  ${partTotal.toFixed(2)}
                                                </span>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() =>
                                                    handleRemovePart(vehicle.id, part.id)
                                                  }
                                                  data-testid={`button-remove-part-${part.id}`}
                                                >
                                                  <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                              </div>
                                            </div>
                                          </CardHeader>
                                          <CardContent className="space-y-4">
                                            {/* Part Type & Glass Info */}
                                            <div className="grid sm:grid-cols-4 gap-4">
                                              <div className="grid gap-2">
                                                <Label>Job Type</Label>
                                                <Select
                                                  value={part.serviceType}
                                                  onValueChange={(value: ServiceType) => {
                                                    // Calculate new labor price based on service type
                                                    const newLaborPrice = calculateLaborPrice(
                                                      value,
                                                      part.glassType,
                                                      vehicle.bodyStyle || "",
                                                      vehicle.vehicleYear || "",
                                                      part.partPrice,
                                                      formData.customerType
                                                    );
                                                    const updatedPart = { ...part, serviceType: value, laborPrice: newLaborPrice };
                                                    const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                                    setVehicles(prev => prev.map(v => 
                                                      v.id === vehicle.id 
                                                        ? { ...v, parts: v.parts.map(p => 
                                                            p.id === part.id 
                                                              ? { ...updatedPart, partsSubtotal, partTotal }
                                                              : p
                                                          )}
                                                        : v
                                                    ));
                                                  }}
                                                >
                                                  <SelectTrigger
                                                    data-testid={`select-service-type-${part.id}`}
                                                  >
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {serviceTypes.map((type) => (
                                                      <SelectItem key={type} value={type}>
                                                        {serviceTypeLabels[type]}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <div className="grid gap-2">
                                                <Label>Glass Type</Label>
                                                <Select
                                                  value={part.glassType}
                                                  onValueChange={(value: GlassType) => {
                                                    // Calculate new labor price based on glass type
                                                    const newLaborPrice = calculateLaborPrice(
                                                      part.serviceType,
                                                      value,
                                                      vehicle.bodyStyle || "",
                                                      vehicle.vehicleYear || "",
                                                      part.partPrice,
                                                      formData.customerType
                                                    );
                                                    const updatedPart = { ...part, glassType: value, laborPrice: newLaborPrice };
                                                    const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                                    setVehicles(prev => prev.map(v => 
                                                      v.id === vehicle.id 
                                                        ? { ...v, parts: v.parts.map(p => 
                                                            p.id === part.id 
                                                              ? { ...updatedPart, partsSubtotal, partTotal }
                                                              : p
                                                          )}
                                                        : v
                                                    ));
                                                  }}
                                                >
                                                  <SelectTrigger
                                                    data-testid={`select-glass-type-${part.id}`}
                                                  >
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {glassTypes.map((type) => (
                                                      <SelectItem key={type} value={type}>
                                                        {glassTypeLabels[type]}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <div className="grid gap-2">
                                                <Label>Glass Part #</Label>
                                                <Input
                                                  value={part.glassPartNumber}
                                                  onChange={(e) =>
                                                    handlePartChange(
                                                      vehicle.id,
                                                      part.id,
                                                      "glassPartNumber",
                                                      e.target.value.toUpperCase()
                                                    )
                                                  }
                                                  placeholder="FW02345GTY"
                                                  data-testid={`input-part-number-${part.id}`}
                                                />
                                              </div>
                                              <div className="grid gap-2">
                                                <Label>Distributor</Label>
                                                <Select
                                                  value={part.distributor || ""}
                                                  onValueChange={(value) =>
                                                    handlePartChange(
                                                      vehicle.id,
                                                      part.id,
                                                      "distributor",
                                                      value
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger data-testid={`select-part-distributor-${part.id}`}>
                                                    <SelectValue placeholder="Select distributor" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="Mygrant">Mygrant</SelectItem>
                                                    <SelectItem value="PGW">PGW</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>
                                            
                                            {/* Accessories field */}
                                            <div className="grid gap-2">
                                              <Label>Accessories</Label>
                                              <Input
                                                value={part.accessories || ""}
                                                onChange={(e) =>
                                                  handlePartChange(
                                                    vehicle.id,
                                                    part.id,
                                                    "accessories",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Moldings, clips, seals, etc."
                                                data-testid={`input-part-accessories-${part.id}`}
                                              />
                                            </div>

                                            <div className="grid sm:grid-cols-4 gap-4">
                                              <div className="flex items-center gap-2">
                                                <Switch
                                                  checked={part.isAftermarket}
                                                  onCheckedChange={(checked) =>
                                                    handlePartChange(
                                                      vehicle.id,
                                                      part.id,
                                                      "isAftermarket",
                                                      checked
                                                    )
                                                  }
                                                  data-testid={`switch-aftermarket-${part.id}`}
                                                />
                                                <Label className="text-sm">Aftermarket</Label>
                                              </div>
                                              <div className="grid gap-2">
                                                <Label>Calibration</Label>
                                                <Select
                                                  value={part.calibrationType}
                                                  onValueChange={(value) =>
                                                    handlePartChange(
                                                      vehicle.id,
                                                      part.id,
                                                      "calibrationType",
                                                      value
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger
                                                    data-testid={`select-calibration-${part.id}`}
                                                  >
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {calibrationTypes.map((type) => (
                                                      <SelectItem key={type} value={type}>
                                                        {calibrationLabels[type]}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <div className="grid gap-2">
                                                <Label>Order Date</Label>
                                                <Input
                                                  type="date"
                                                  value={part.glassOrderedDate}
                                                  onChange={(e) =>
                                                    handlePartChange(
                                                      vehicle.id,
                                                      part.id,
                                                      "glassOrderedDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  data-testid={`input-order-date-${part.id}`}
                                                />
                                              </div>
                                              <div className="grid gap-2">
                                                <Label>Arrival Date</Label>
                                                <Input
                                                  type="date"
                                                  value={part.glassArrivalDate}
                                                  onChange={(e) =>
                                                    handlePartChange(
                                                      vehicle.id,
                                                      part.id,
                                                      "glassArrivalDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  data-testid={`input-arrival-date-${part.id}`}
                                                />
                                              </div>
                                            </div>

                                            {/* Part Pricing Calculator */}
                                            <div className="border-t pt-4">
                                              <h5 className="text-sm font-medium mb-3">
                                                Part Pricing {formData.customerType === "subcontractor" && <span className="text-muted-foreground font-normal">(Subcontractor - Labor + Mobile Fee Only)</span>}
                                              </h5>
                                              
                                              {formData.customerType === "subcontractor" ? (
                                                /* Subcontractor pricing: Labor dropdown, Mobile Fee, and Additional Cost only */
                                                <div className="grid sm:grid-cols-3 gap-3">
                                                  <div className="grid gap-1">
                                                    <Label className="text-xs">Labor Rate</Label>
                                                    <div className="flex gap-2">
                                                      <Select
                                                        value={
                                                          subcontractorLaborRates.includes(part.laborPrice as 100 | 110 | 125) 
                                                            ? part.laborPrice?.toString() 
                                                            : "other"
                                                        }
                                                        onValueChange={(value) => {
                                                          if (value === "other") {
                                                            // Set to a custom value (keep current or default to 0)
                                                            const currentPrice = part.laborPrice || 0;
                                                            const isPreset = subcontractorLaborRates.includes(currentPrice as 100 | 110 | 125);
                                                            const newLaborPrice = isPreset ? 0 : currentPrice;
                                                            const updatedPart = { ...part, laborPrice: newLaborPrice };
                                                            const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                                            setVehicles(prev => prev.map(v => 
                                                              v.id === vehicle.id 
                                                                ? { ...v, parts: v.parts.map(p => 
                                                                    p.id === part.id 
                                                                      ? { ...updatedPart, partsSubtotal, partTotal }
                                                                      : p
                                                                  )}
                                                                : v
                                                            ));
                                                          } else {
                                                            const newLaborPrice = parseInt(value);
                                                            const updatedPart = { ...part, laborPrice: newLaborPrice };
                                                            const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                                            setVehicles(prev => prev.map(v => 
                                                              v.id === vehicle.id 
                                                                ? { ...v, parts: v.parts.map(p => 
                                                                    p.id === part.id 
                                                                      ? { ...updatedPart, partsSubtotal, partTotal }
                                                                      : p
                                                                  )}
                                                                : v
                                                            ));
                                                          }
                                                        }}
                                                      >
                                                        <SelectTrigger data-testid={`select-labor-rate-${part.id}`} className={!subcontractorLaborRates.includes(part.laborPrice as 100 | 110 | 125) ? "w-24" : ""}>
                                                          <SelectValue placeholder="Select rate" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {subcontractorLaborRates.map((rate) => (
                                                            <SelectItem key={rate} value={rate.toString()}>
                                                              ${rate}
                                                            </SelectItem>
                                                          ))}
                                                          <SelectItem value="other">Other...</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                      {!subcontractorLaborRates.includes(part.laborPrice as 100 | 110 | 125) && (
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-sm text-muted-foreground">$</span>
                                                          <Input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={part.laborPrice ?? ""}
                                                            onChange={(e) => {
                                                              const newLaborPrice = parseFloat(e.target.value) || 0;
                                                              const updatedPart = { ...part, laborPrice: newLaborPrice };
                                                              const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                                              setVehicles(prev => prev.map(v => 
                                                                v.id === vehicle.id 
                                                                  ? { ...v, parts: v.parts.map(p => 
                                                                      p.id === part.id 
                                                                        ? { ...updatedPart, partsSubtotal, partTotal }
                                                                        : p
                                                                    )}
                                                                  : v
                                                              ));
                                                            }}
                                                            placeholder="Amount"
                                                            className="w-20"
                                                            data-testid={`input-custom-labor-rate-${part.id}`}
                                                          />
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="grid gap-1">
                                                    <Label className="text-xs">Mobile Fee</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      value={part.mobileFee ?? ""}
                                                      onChange={(e) =>
                                                        handlePartChange(
                                                          vehicle.id,
                                                          part.id,
                                                          "mobileFee",
                                                          parseFloat(e.target.value) || 0
                                                        )
                                                      }
                                                      data-testid={`input-mobile-fee-${part.id}`}
                                                    />
                                                  </div>
                                                  <div className="grid gap-1">
                                                    <Label className="text-xs">Additional Cost</Label>
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      value={part.subcontractorCost ?? ""}
                                                      onChange={(e) =>
                                                        handlePartChange(
                                                          vehicle.id,
                                                          part.id,
                                                          "subcontractorCost",
                                                          parseFloat(e.target.value) || 0
                                                        )
                                                      }
                                                      placeholder="Manual cost"
                                                      data-testid={`input-subcontractor-cost-${part.id}`}
                                                    />
                                                  </div>
                                                </div>
                                              ) : (
                                                /* Standard pricing for non-subcontractor customers */
                                                <>
                                              <div className="grid sm:grid-cols-4 gap-3">
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Part Price</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.partPrice || ""}
                                                    onChange={(e) => {
                                                      const newPartPrice = parseFloat(e.target.value) || 0;
                                                      // Recalculate labor if part price crosses $250 threshold
                                                      const newLaborPrice = calculateLaborPrice(
                                                        part.serviceType,
                                                        part.glassType,
                                                        vehicle.bodyStyle || "",
                                                        vehicle.vehicleYear || "",
                                                        newPartPrice,
                                                        formData.customerType
                                                      );
                                                      const updatedPart = { ...part, partPrice: newPartPrice, laborPrice: newLaborPrice };
                                                      const { partsSubtotal, partTotal } = calculatePartTotals(updatedPart, formData.customerType);
                                                      setVehicles(prev => prev.map(v => 
                                                        v.id === vehicle.id 
                                                          ? { ...v, parts: v.parts.map(p => 
                                                              p.id === part.id 
                                                                ? { ...updatedPart, partsSubtotal, partTotal }
                                                                : p
                                                            )}
                                                          : v
                                                      ));
                                                    }}
                                                    data-testid={`input-part-price-${part.id}`}
                                                  />
                                                </div>
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Markup</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.markup || ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "markup",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-markup-${part.id}`}
                                                  />
                                                </div>
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Accessories</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.accessoriesPrice || ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "accessoriesPrice",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-accessories-${part.id}`}
                                                  />
                                                </div>
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Urethane</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.urethanePrice || ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "urethanePrice",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-urethane-${part.id}`}
                                                  />
                                                </div>
                                              </div>
                                              <div className="grid sm:grid-cols-4 gap-3 mt-3">
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Sales Tax %</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.salesTaxPercent || ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "salesTaxPercent",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-tax-${part.id}`}
                                                  />
                                                </div>
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Labor</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.laborPrice || ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "laborPrice",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-labor-${part.id}`}
                                                  />
                                                </div>
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Calibration</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.calibrationPrice || ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "calibrationPrice",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-calibration-price-${part.id}`}
                                                  />
                                                </div>
                                                <div className="grid gap-1">
                                                  <Label className="text-xs">Mobile Fee</Label>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={part.mobileFee ?? ""}
                                                    onChange={(e) =>
                                                      handlePartChange(
                                                        vehicle.id,
                                                        part.id,
                                                        "mobileFee",
                                                        parseFloat(e.target.value) || 0
                                                      )
                                                    }
                                                    data-testid={`input-mobile-fee-${part.id}`}
                                                  />
                                                </div>
                                                </div>
                                                </>
                                              )}

                                              {/* Calculated Totals */}
                                              <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t text-sm">
                                                {formData.customerType !== "subcontractor" && (
                                                  <span className="text-muted-foreground">
                                                    Parts Subtotal: ${partsSubtotal.toFixed(2)}
                                                  </span>
                                                )}
                                                <span className="font-semibold">
                                                  Part Total: ${partTotal.toFixed(2)}
                                                </span>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Job Total Summary */}
                {vehicles.length > 0 && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Job Total (all parts):</span>
                        <span className="text-2xl font-bold">${jobTotal.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Includes 3.5% processing fee. Totals rounded up.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Method Selection */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ToggleGroup
                      type="multiple"
                      value={Array.isArray(formData.paymentMethod) ? formData.paymentMethod : []}
                      onValueChange={(value) => handleChange("paymentMethod", value as any)}
                      className="flex flex-wrap justify-start gap-2"
                    >
                      <ToggleGroupItem
                        value="cash"
                        variant="outline"
                        className="data-[state=on]:bg-sky-500 data-[state=on]:text-white data-[state=on]:border-sky-500"
                        data-testid="button-payment-method-cash"
                      >
                        Cash
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="card"
                        variant="outline"
                        className="data-[state=on]:bg-sky-500 data-[state=on]:text-white data-[state=on]:border-sky-500"
                        data-testid="button-payment-method-card"
                      >
                        Card
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="check"
                        variant="outline"
                        className="data-[state=on]:bg-sky-500 data-[state=on]:text-white data-[state=on]:border-sky-500"
                        data-testid="button-payment-method-check"
                      >
                        Check
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="zelle"
                        variant="outline"
                        className="data-[state=on]:bg-sky-500 data-[state=on]:text-white data-[state=on]:border-sky-500"
                        data-testid="button-payment-method-zelle"
                      >
                        Zelle
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="bank_deposit"
                        variant="outline"
                        className="data-[state=on]:bg-sky-500 data-[state=on]:text-white data-[state=on]:border-sky-500"
                        data-testid="button-payment-method-bank-deposit"
                      >
                        Bank Deposit
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Insurance & Payments Tab */}
              <TabsContent value="payments" className="mt-0 space-y-6">
                {/* Insurance Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle className="text-base">Insurance Information</CardTitle>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="insurance-toggle"
                          className="text-sm text-muted-foreground"
                        >
                          {showInsurance ? "Enabled" : "Disabled"}
                        </Label>
                        <Switch
                          id="insurance-toggle"
                          checked={showInsurance}
                          onCheckedChange={setShowInsurance}
                          data-testid="toggle-insurance"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  {showInsurance && (
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="insuranceCompany">Insurance Company</Label>
                          <Input
                            id="insuranceCompany"
                            value={formData.insuranceCompany}
                            onChange={(e) => handleChange("insuranceCompany", e.target.value)}
                            placeholder="State Farm"
                            data-testid="input-insurance-company"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="policyNumber">Policy Number</Label>
                          <Input
                            id="policyNumber"
                            value={formData.policyNumber}
                            onChange={(e) => handleChange("policyNumber", e.target.value)}
                            placeholder="POL-123456"
                            data-testid="input-policy-number"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="claimNumber">Claim Number</Label>
                          <Input
                            id="claimNumber"
                            value={formData.claimNumber}
                            onChange={(e) => handleChange("claimNumber", e.target.value)}
                            placeholder="CLM-2024-1234"
                            data-testid="input-claim-number"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="dispatchNumber">Dispatch Number</Label>
                          <Input
                            id="dispatchNumber"
                            value={formData.dispatchNumber}
                            onChange={(e) => handleChange("dispatchNumber", e.target.value)}
                            placeholder="DSP-5678"
                            data-testid="input-dispatch-number"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="dateOfLoss">Date of Loss</Label>
                          <Input
                            id="dateOfLoss"
                            type="date"
                            value={formData.dateOfLoss}
                            onChange={(e) => handleChange("dateOfLoss", e.target.value)}
                            data-testid="input-date-of-loss"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Cause of Loss</Label>
                          <Select
                            value={formData.causeOfLoss || ""}
                            onValueChange={(value) =>
                              handleChange("causeOfLoss", value || undefined)
                            }
                          >
                            <SelectTrigger data-testid="select-cause-of-loss">
                              <SelectValue placeholder="Select cause" />
                            </SelectTrigger>
                            <SelectContent>
                              {causesOfLoss.map((cause) => (
                                <SelectItem key={cause} value={cause}>
                                  {causeLabels[cause]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Payment Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Payment Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        {vehicles.map((v, vi) =>
                          v.parts.map((p, pi) => {
                            const { partTotal } = calculatePartTotals(p, formData.customerType);
                            return (
                              <div
                                key={p.id}
                                className="flex justify-between text-sm"
                                data-testid={`summary-part-${p.id}`}
                              >
                                <span className="text-muted-foreground">
                                  {v.vehicleYear} {v.vehicleMake} - {getPartDisplayLabel(p)}:
                                </span>
                                <span>${partTotal.toFixed(2)}</span>
                              </div>
                            );
                          })
                        )}
                        <div className="border-t pt-2 flex justify-between font-medium">
                          <span>Total Due:</span>
                          <span className="text-lg">${jobTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor="deductible">Deductible ($)</Label>
                          <Input
                            id="deductible"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.deductible}
                            onChange={(e) =>
                              handleChange("deductible", parseFloat(e.target.value) || 0)
                            }
                            data-testid="input-deductible"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="rebate">Rebate ($)</Label>
                          <Input
                            id="rebate"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.rebate}
                            onChange={(e) =>
                              handleChange("rebate", parseFloat(e.target.value) || 0)
                            }
                            data-testid="input-rebate"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${(formData.amountPaid || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Amount Paid</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          ${Math.max(0, jobTotal - (formData.amountPaid || 0)).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Balance Due</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Badge
                          className={
                            formData.paymentStatus === "paid"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : formData.paymentStatus === "partial"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }
                        >
                          {formData.paymentStatus === "paid"
                            ? "Paid"
                            : formData.paymentStatus === "partial"
                              ? "Partial"
                              : "Pending"}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">Status</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Entry & History (only for existing jobs) */}
                {!isNew && job && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Payment History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Add Payment Form */}
                      <div className="flex gap-3 items-end flex-wrap">
                        <div className="grid gap-2">
                          <Label>Source</Label>
                          <Select
                            value={newPayment.source}
                            onValueChange={(value: typeof newPayment.source) =>
                              setNewPayment((p) => ({ ...p, source: value }))
                            }
                          >
                            <SelectTrigger
                              className="w-[140px]"
                              data-testid="select-payment-source"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentSources.map((src) => (
                                <SelectItem key={src} value={src}>
                                  {sourceLabels[src]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Amount ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newPayment.amount || ""}
                            onChange={(e) =>
                              setNewPayment((p) => ({
                                ...p,
                                amount: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-[120px]"
                            data-testid="input-payment-amount"
                          />
                        </div>
                        <div className="grid gap-2 flex-1 min-w-[150px]">
                          <Label>Notes</Label>
                          <Input
                            value={newPayment.notes}
                            onChange={(e) =>
                              setNewPayment((p) => ({ ...p, notes: e.target.value }))
                            }
                            placeholder="Optional notes"
                            data-testid="input-payment-notes"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddPayment}
                          disabled={newPayment.amount <= 0}
                          data-testid="button-add-payment"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Payment
                        </Button>
                      </div>

                      {/* Payment History Table */}
                      {formData.paymentHistory && formData.paymentHistory.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Notes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {formData.paymentHistory.map((payment, idx) => (
                                <TableRow key={payment.id || idx}>
                                  <TableCell>{payment.date}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{sourceLabels[payment.source]}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    ${payment.amount.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {payment.notes || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          No payments recorded yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t mt-4 flex-shrink-0 flex-wrap">
            <div className="flex gap-2">
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
            <div className="flex items-center gap-2 flex-wrap">
              {!isNew && job && (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowQuoteModal(true)}
                    data-testid="button-send-quote"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Quote
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const updatedJob: Job = {
                        ...job,
                        ...formData,
                        vehicles,
                        totalDue: jobTotal,
                        balanceDue: Math.max(0, jobTotal - (formData.amountPaid || 0)),
                      };
                      setReceiptPreviewJob(updatedJob);
                      setShowReceiptPreview(true);
                    }}
                    data-testid="button-download-receipt"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Preview Receipt
                  </Button>
                </>
              )}
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

      <ReceiptPreviewModal
        job={receiptPreviewJob}
        isOpen={showReceiptPreview}
        onClose={() => {
          setShowReceiptPreview(false);
          setReceiptPreviewJob(null);
        }}
      />

      {job && (
        <EmailComposeModal
          job={job}
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
        />
      )}

      {job && (
        <QuoteSendModal
          job={job}
          calculatedTotal={jobTotal}
          open={showQuoteModal}
          onOpenChange={setShowQuoteModal}
        />
      )}

      {customerReminder && (
        <CustomerReminderPopup
          isOpen={showReminderPopup}
          onClose={() => setShowReminderPopup(false)}
          customerKey={customerKey}
          customerName={formData.isBusiness ? formData.businessName || "" : `${formData.firstName} ${formData.lastName}`}
          reminderMessage={customerReminder.reminderMessage}
        />
      )}

      <SetReminderDialog
        isOpen={showSetReminderDialog}
        onClose={() => setShowSetReminderDialog(false)}
        customerKey={customerKey}
        customerName={formData.isBusiness ? formData.businessName || "" : `${formData.firstName} ${formData.lastName}`}
      />
    </Dialog>
  );
}
