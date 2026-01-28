import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { 
  Menu, 
  X, 
  MapPin, 
  User, 
  Wifi, 
  Settings, 
  LogOut,
  Loader2,
  ChevronRight,
  Package,
  ChevronDown,
  ChevronUp,
  Truck
} from "lucide-react";
import type { Job, Part, Vehicle } from "@shared/schema";

type TabType = "current" | "last" | "yearly" | "pickup";

const DISTRIBUTOR_ADDRESSES = {
  mygrant: "4825 Eisenhauer Rd, San Antonio, TX",
  pgw: "3417 Steen Street Unit C, San Antonio, TX"
};

const TIME_FRAME_ORDER: Record<string, number> = {
  "9a-12p": 1,
  "10a-2p": 2,
  "12p-3p": 3,
  "2p-6p": 4,
  "3p-6p": 5,
  "custom": 6
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getStopLabel(index: number): string {
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
  return ordinals[index] || `${index + 1}th`;
}

export default function TechDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("current");
  const [pickupExpanded, setPickupExpanded] = useState<Record<string, boolean>>({
    mygrant: true,
    pgw: true
  });

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const scheduledJobs = jobs.filter(job => job.pipelineStage === "scheduled");
  const completedJobs = jobs.filter(job => job.pipelineStage === "paid_completed");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const sortJobsByRoute = (jobsToSort: Job[]): Job[] => {
    return [...jobsToSort].sort((a, b) => {
      // Put scheduled (non-completed) jobs at the top, completed jobs at the bottom
      const aIsComplete = a.pipelineStage === "paid_completed";
      const bIsComplete = b.pipelineStage === "paid_completed";
      if (aIsComplete !== bIsComplete) {
        return aIsComplete ? 1 : -1; // Completed jobs go to bottom
      }
      
      // Within each group, sort by time frame then install time
      const timeA = TIME_FRAME_ORDER[a.timeFrame || "custom"] || 99;
      const timeB = TIME_FRAME_ORDER[b.timeFrame || "custom"] || 99;
      if (timeA !== timeB) return timeA - timeB;
      
      const installTimeA = a.installTime || "23:59";
      const installTimeB = b.installTime || "23:59";
      return installTimeA.localeCompare(installTimeB);
    });
  };

  const getFilteredJobs = () => {
    const allJobs = [...scheduledJobs, ...completedJobs];
    
    switch (activeTab) {
      case "current":
        const currentWeekJobs = allJobs.filter(job => {
          if (!job.installDate) return false;
          const installDate = new Date(job.installDate);
          return installDate >= startOfWeek && installDate < endOfWeek;
        });
        return sortJobsByRoute(currentWeekJobs);
      case "last":
        const lastWeekJobs = allJobs.filter(job => {
          if (!job.installDate) return false;
          const installDate = new Date(job.installDate);
          return installDate >= startOfLastWeek && installDate < startOfWeek;
        });
        return sortJobsByRoute(lastWeekJobs);
      case "yearly":
        const yearlyJobs = allJobs.filter(job => {
          if (!job.installDate) return false;
          const installDate = new Date(job.installDate);
          return installDate >= startOfYear;
        });
        return sortJobsByRoute(yearlyJobs);
      case "pickup":
        return [];
      default:
        return sortJobsByRoute(scheduledJobs);
    }
  };

  const filteredJobs = getFilteredJobs();

  const todaysJobs = useMemo(() => {
    return scheduledJobs.filter(job => {
      if (!job.installDate) return false;
      const installDate = new Date(job.installDate);
      return installDate.toDateString() === today.toDateString();
    });
  }, [scheduledJobs, today]);

  const sortedTodaysJobs = useMemo(() => sortJobsByRoute(todaysJobs), [todaysJobs]);

  const pickupList = useMemo(() => {
    const list: { mygrant: { job: Job; vehicle: Vehicle; part: Part }[]; pgw: { job: Job; vehicle: Vehicle; part: Part }[]; other: { job: Job; vehicle: Vehicle; part: Part }[] } = {
      mygrant: [],
      pgw: [],
      other: []
    };

    sortedTodaysJobs.forEach(job => {
      job.vehicles?.forEach(vehicle => {
        vehicle.parts?.forEach(part => {
          const distributor = (part.distributor || "").toLowerCase();
          const item = { job, vehicle, part };
          
          if (distributor.includes("mygrant")) {
            list.mygrant.push(item);
          } else if (distributor.includes("pgw")) {
            list.pgw.push(item);
          } else if (distributor) {
            list.other.push(item);
          }
        });
      });
    });

    return list;
  }, [sortedTodaysJobs]);

  const getTabLabel = () => {
    switch (activeTab) {
      case "current": return "Current Week";
      case "last": return "Last Week";
      case "yearly": return "Yearly";
      case "pickup": return "Today's Pickup List";
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "T";
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };

  const handleLogout = () => {
    logout();
    setSidebarOpen(false);
  };

  const isJobComplete = (job: Job) => {
    return job.pipelineStage === "paid_completed";
  };

  const openMapsApp = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      window.location.href = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else {
      window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#29ABE2" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div 
        className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-all duration-300 ${
          sidebarOpen ? "translate-x-0 visible" : "-translate-x-full invisible"
        }`}
        style={{ backgroundColor: "#29ABE2" }}
        aria-hidden={!sidebarOpen}
      >
        <div className="p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="text-white hover:bg-white/20 mb-4"
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex flex-col items-center py-6">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <div className="relative">
                <User className="w-12 h-12 text-white" />
                <MapPin 
                  className="w-5 h-5 text-white absolute -top-1 -right-1" 
                  style={{ backgroundColor: "#29ABE2", borderRadius: "50%" }}
                />
              </div>
            </div>
            <p className="text-white/80 text-sm">Technician Area</p>
            <h2 className="text-white text-xl font-bold">
              {user?.firstName} {user?.lastName}
            </h2>
          </div>

          <nav className="space-y-2 mt-4">
            <button
              onClick={() => { setActiveTab("pickup"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "pickup" ? "bg-white/20" : "hover:bg-white/10"
              }`}
              data-testid="nav-pickup-list"
            >
              <Package className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Pickup List</span>
              <span className="text-white/70 text-sm ml-auto">{sortedTodaysJobs.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab("current"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "current" ? "bg-white/20" : "hover:bg-white/10"
              }`}
              data-testid="nav-current-week"
            >
              <Wifi className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Current Week</span>
              <span className="text-white/70 text-sm">(online)</span>
            </button>

            <button
              onClick={() => { setActiveTab("last"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "last" ? "bg-white/20" : "hover:bg-white/10"
              }`}
              data-testid="nav-last-week"
            >
              <Wifi className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Last Week</span>
              <span className="text-white/70 text-sm">(online)</span>
            </button>

            <button
              onClick={() => { setActiveTab("yearly"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "yearly" ? "bg-white/20" : "hover:bg-white/10"
              }`}
              data-testid="nav-yearly"
            >
              <Wifi className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Yearly</span>
              <span className="text-white/70 text-sm">(online)</span>
            </button>

            <button
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-white/10 transition-colors"
              data-testid="nav-settings"
            >
              <Settings className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Settings</span>
            </button>
          </nav>

          <div className="absolute bottom-8 left-4 right-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-white/20"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <header 
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: "#29ABE2" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-white hover:bg-white/20"
          data-testid="button-open-sidebar"
        >
          <Menu className="w-6 h-6" />
        </Button>

        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Dashboard</h1>
          {isOnline && (
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "#4ADE80" }}
            />
          )}
        </div>

        <div className="w-10" />
      </header>

      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: "#1B8EB8" }}
      >
        <h2 className="text-white text-lg font-semibold">{getTabLabel()}</h2>
        <div className="flex items-center gap-2">
          <Switch
            checked={isOnline}
            onCheckedChange={setIsOnline}
            className="data-[state=checked]:bg-green-500"
            data-testid="switch-online"
          />
          <span 
            className="text-xs font-medium px-2 py-1 rounded"
            style={{ 
              backgroundColor: isOnline ? "#4ADE80" : "#94A3B8", 
              color: "white" 
            }}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <main className="flex-1 overflow-auto">
        {activeTab === "pickup" ? (
          <div className="p-4 space-y-4">
            {pickupList.mygrant.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setPickupExpanded(prev => ({ ...prev, mygrant: !prev.mygrant }))}
                  className="w-full px-4 py-3 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors"
                  data-testid="button-expand-mygrant"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900">Mygrant Glass</h3>
                      <p className="text-sm text-gray-500">{DISTRIBUTOR_ADDRESSES.mygrant}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-600">{pickupList.mygrant.length} parts</span>
                    {pickupExpanded.mygrant ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                {pickupExpanded.mygrant && (
                  <div className="divide-y">
                    <button
                      onClick={() => openMapsApp(DISTRIBUTOR_ADDRESSES.mygrant)}
                      className="w-full px-4 py-2 flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      data-testid="button-navigate-mygrant"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="font-medium">Navigate to Mygrant</span>
                    </button>
                    {pickupList.mygrant.map((item, idx) => (
                      <div key={`mygrant-${idx}`} className="px-4 py-3 bg-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.vehicle.vehicleYear} {item.vehicle.vehicleMake} {item.vehicle.vehicleModel}
                            </p>
                            <p className="text-sm text-gray-600">
                              Part#: {item.part.glassPartNumber || "N/A"} - {item.part.glassType?.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-gray-500">
                              Customer: {item.job.firstName} {item.job.lastName}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-blue-600">#{item.job.jobNumber}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pickupList.pgw.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setPickupExpanded(prev => ({ ...prev, pgw: !prev.pgw }))}
                  className="w-full px-4 py-3 flex items-center justify-between bg-green-50 hover:bg-green-100 transition-colors"
                  data-testid="button-expand-pgw"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900">PGW</h3>
                      <p className="text-sm text-gray-500">{DISTRIBUTOR_ADDRESSES.pgw}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-600">{pickupList.pgw.length} parts</span>
                    {pickupExpanded.pgw ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                {pickupExpanded.pgw && (
                  <div className="divide-y">
                    <button
                      onClick={() => openMapsApp(DISTRIBUTOR_ADDRESSES.pgw)}
                      className="w-full px-4 py-2 flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors"
                      data-testid="button-navigate-pgw"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="font-medium">Navigate to PGW</span>
                    </button>
                    {pickupList.pgw.map((item, idx) => (
                      <div key={`pgw-${idx}`} className="px-4 py-3 bg-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.vehicle.vehicleYear} {item.vehicle.vehicleMake} {item.vehicle.vehicleModel}
                            </p>
                            <p className="text-sm text-gray-600">
                              Part#: {item.part.glassPartNumber || "N/A"} - {item.part.glassType?.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-gray-500">
                              Customer: {item.job.firstName} {item.job.lastName}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-green-600">#{item.job.jobNumber}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pickupList.other.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">Other Distributors</h3>
                    <span className="text-sm font-medium text-gray-600 ml-auto">{pickupList.other.length} parts</span>
                  </div>
                </div>
                <div className="divide-y">
                  {pickupList.other.map((item, idx) => (
                    <div key={`other-${idx}`} className="px-4 py-3 bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-600">{item.part.distributor}</p>
                          <p className="font-medium text-gray-900">
                            {item.vehicle.vehicleYear} {item.vehicle.vehicleMake} {item.vehicle.vehicleModel}
                          </p>
                          <p className="text-sm text-gray-600">
                            Part#: {item.part.glassPartNumber || "N/A"} - {item.part.glassType?.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-gray-600">#{item.job.jobNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pickupList.mygrant.length === 0 && pickupList.pgw.length === 0 && pickupList.other.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Package className="w-12 h-12 mb-3 text-gray-300" />
                <p>No parts to pick up today</p>
              </div>
            )}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No jobs for this period
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {(() => {
              // Pre-calculate stop numbers for today's incomplete jobs only
              const todaysIncompleteJobs = filteredJobs.filter(job => {
                const isComplete = isJobComplete(job);
                const isToday = job.installDate && new Date(job.installDate).toDateString() === today.toDateString();
                return isToday && !isComplete;
              });
              const stopIndexMap = new Map<string, number>();
              todaysIncompleteJobs.forEach((job, idx) => {
                stopIndexMap.set(job.id, idx);
              });
              
              return filteredJobs.map((job) => {
                const isComplete = isJobComplete(job);
                const isToday = job.installDate && new Date(job.installDate).toDateString() === today.toDateString();
                const stopIndex = stopIndexMap.get(job.id);
                
                return (
                  <Link key={job.id} href={`/tech/job/${job.id}`}>
                    <div 
                      className={`px-4 py-4 cursor-pointer transition-colors ${
                        isComplete 
                          ? "bg-white hover:bg-gray-50" 
                          : "hover:bg-blue-100"
                      }`}
                      style={{ 
                        backgroundColor: isComplete ? undefined : "#E3F2FD"
                      }}
                      data-testid={`job-card-${job.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {isToday && !isComplete && stopIndex !== undefined && (
                              <span 
                                className="text-xs font-bold px-2 py-1 rounded text-white"
                                style={{ backgroundColor: "#29ABE2" }}
                              >
                                {getStopLabel(stopIndex)} Stop
                              </span>
                            )}
                          <h3 className="text-lg font-bold text-gray-900">
                            {job.firstName} {job.lastName}
                          </h3>
                          {isComplete && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">
                              Complete
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-600">Schedule Date</span>
                            <span className="text-sm font-medium text-gray-900 ml-auto">
                              {formatDate(job.installDate)}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-600">Schedule Time</span>
                            <span className="text-sm font-medium text-gray-900 ml-auto">
                              {job.installTime || job.timeFrame?.replace(/-/g, " - ") || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-600">Payment Type</span>
                            <span className="text-sm font-medium text-gray-900 ml-auto capitalize">
                              {job.paymentMethod?.join(", ")?.replace(/_/g, " ") || "N/A"}
                            </span>
                          </div>
                          {job.streetAddress && (
                            <div className="flex items-center gap-2 mt-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600 truncate">
                                {job.streetAddress}, {job.city}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span 
                          className="text-sm font-semibold"
                          style={{ color: "#1B8EB8" }}
                        >
                          #{job.jobNumber}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
                );
              });
            })()}
          </div>
        )}
      </main>

      <footer 
        className="sticky bottom-0 px-4 py-3 flex items-center justify-center gap-2 border-t"
        style={{ backgroundColor: "#F8F9FA" }}
      >
        <Wifi className="w-5 h-5" style={{ color: "#29ABE2" }} />
        <span className="font-semibold text-gray-800">Orders</span>
      </footer>
    </div>
  );
}
