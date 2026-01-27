import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Car, 
  Clipboard, 
  Clock,
  Loader2,
  Navigation,
  Package,
  User,
  Wrench,
  CheckCircle2
} from "lucide-react";
import type { Job } from "@shared/schema";

export default function TechJobDetail() {
  const [, params] = useRoute("/tech/job/:id");
  const jobId = params?.id;

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const job = jobs.find(j => j.id === jobId);

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
        <main className="p-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">This job could not be found.</p>
              <Link href="/tech">
                <Button className="mt-4" data-testid="button-return">Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const vehicle = job.vehicles?.[0];
  const part = vehicle?.parts?.[0];

  const openMaps = () => {
    const address = `${job.streetAddress}, ${job.city}, ${job.state} ${job.zipCode}`;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-50 px-4 py-3" style={{ backgroundColor: "#29ABE2" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/tech">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">{job.jobNumber}</h1>
              <p className="text-xs text-white/80">
                {job.installDate} @ {job.installTime}
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="bg-white/20 text-white border-white/30"
            data-testid="badge-status"
          >
            {job.pipelineStage === "scheduled" ? "Scheduled" : "Completed"}
          </Badge>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-600" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="font-semibold text-lg">
                {job.firstName} {job.lastName}
              </div>
              {job.isBusiness && job.businessName && (
                <div className="text-sm text-muted-foreground">{job.businessName}</div>
              )}
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                {job.streetAddress}<br />
                {job.city}, {job.state} {job.zipCode}
              </div>
            </div>

            <div className="flex gap-2">
              <a href={`tel:${job.phone}`} className="flex-1">
                <Button className="w-full" size="lg" data-testid="button-call">
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
              </a>
              <Button 
                variant="outline" 
                size="lg" 
                className="flex-1"
                onClick={openMaps}
                data-testid="button-navigate"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
            </div>
          </CardContent>
        </Card>

        {vehicle && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-600" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Year/Make/Model</div>
                  <div className="font-medium">
                    {vehicle.vehicleYear} {vehicle.vehicleMake} {vehicle.vehicleModel}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Body Style</div>
                  <div className="font-medium">{vehicle.bodyStyle || "N/A"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Color</div>
                  <div className="font-medium">{vehicle.vehicleColor || "N/A"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">License Plate</div>
                  <div className="font-medium">{vehicle.licensePlate || "N/A"}</div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="text-muted-foreground text-xs">VIN</div>
                <div className="font-mono text-sm">{vehicle.vin || "N/A"}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {part && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-600" />
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Job Type</div>
                  <div className="font-medium capitalize">
                    {part.jobType?.replace(/_/g, " ") || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Location</div>
                  <div className="font-medium capitalize">
                    {job.repairLocation === "mobile" ? "Mobile" : "In-Shop"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Part Number</div>
                  <div className="font-medium">{part.glassPartNumber || "N/A"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Distributor</div>
                  <div className="font-medium">{part.distributor || "N/A"}</div>
                </div>
              </div>
              
              {part.calibrationType && part.calibrationType !== "none" && (
                <div className="pt-2 border-t">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    {part.calibrationType} Calibration Required
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-cyan-600" />
              Job Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Duration</div>
                <div className="font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {job.jobDuration || "2"} hours
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Installer</div>
                <div className="font-medium">{job.installer || "Unassigned"}</div>
              </div>
            </div>
            
            {job.installNotes && (
              <div className="pt-2 border-t">
                <div className="text-muted-foreground text-xs mb-1">Install Notes</div>
                <div className="text-sm bg-slate-50 p-2 rounded">
                  {job.installNotes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-600" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                "Inspect vehicle and verify damage",
                "Confirm customer details",
                "Remove old glass",
                "Clean and prep frame",
                "Install new glass",
                "Apply urethane and seal",
                "Perform calibration (if required)",
                "Final quality check",
                "Take photos",
                "Collect signature",
              ].map((task, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3 p-2 rounded bg-slate-50 border"
                  data-testid={`task-item-${index}`}
                >
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-400">
                    {index + 1}
                  </div>
                  <span className="text-sm">{task}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Due</div>
                <div className="text-2xl font-bold text-emerald-700">
                  ${job.totalDue?.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Balance Due</div>
                <div className="text-xl font-semibold text-slate-700">
                  ${job.balanceDue?.toFixed(2)}
                </div>
              </div>
            </div>
            
            <Link href={`/tech/job/${job.id}/complete`}>
              <Button 
                size="lg" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                data-testid="button-complete-job"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Complete Job
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
