import { useState } from "react";
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
  ChevronRight
} from "lucide-react";
import type { Job } from "@shared/schema";

type TabType = "current" | "last" | "yearly";

export default function TechDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("current");

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const scheduledJobs = jobs.filter(job => job.pipelineStage === "scheduled");
  const completedJobs = jobs.filter(job => job.pipelineStage === "paid_completed");

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const getFilteredJobs = () => {
    const allJobs = [...scheduledJobs, ...completedJobs];
    
    switch (activeTab) {
      case "current":
        return allJobs.filter(job => {
          if (!job.installDate) return false;
          const installDate = new Date(job.installDate);
          return installDate >= startOfWeek && installDate < endOfWeek;
        });
      case "last":
        return allJobs.filter(job => {
          if (!job.installDate) return false;
          const installDate = new Date(job.installDate);
          return installDate >= startOfLastWeek && installDate < startOfWeek;
        });
      case "yearly":
        return allJobs.filter(job => {
          if (!job.installDate) return false;
          const installDate = new Date(job.installDate);
          return installDate >= startOfYear;
        });
      default:
        return scheduledJobs;
    }
  };

  const filteredJobs = getFilteredJobs();

  const getTabLabel = () => {
    switch (activeTab) {
      case "current": return "Current Week";
      case "last": return "Last Week";
      case "yearly": return "Yearly";
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
        {filteredJobs.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No jobs for this period
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredJobs.map(job => (
              <Link key={job.id} href={`/tech/job/${job.id}`}>
                <div 
                  className="px-4 py-4 hover:bg-gray-50 cursor-pointer"
                  data-testid={`job-card-${job.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {job.firstName} {job.lastName}
                      </h3>
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
                            {job.installTime || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-gray-600">Payment Type</span>
                          <span className="text-sm font-medium text-gray-900 ml-auto capitalize">
                            {job.paymentMethod?.join(", ")?.replace(/_/g, " ") || "N/A"}
                          </span>
                        </div>
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
            ))}
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
