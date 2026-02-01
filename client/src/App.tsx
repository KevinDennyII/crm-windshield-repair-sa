import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, MobileHeader } from "@/components/app-sidebar";
import { ReportsSidebar, ReportsMobileHeader } from "@/components/reports-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Opportunities from "@/pages/opportunities";
import Payments from "@/pages/payments";
import Dashboard from "@/pages/dashboard";
import Conversations from "@/pages/conversations";
import CalendarPage from "@/pages/calendar";
import TechDashboard from "@/pages/tech-dashboard";
import TechJobDetail from "@/pages/tech-job-detail";
import TechJobComplete from "@/pages/tech-job-complete";
import TechSignature from "@/pages/tech-signature";
import UserManagement from "@/pages/user-management";
import StaffManagement from "@/pages/staff-management";
import CsrActivity from "@/pages/csr-activity";
import { PlaceholderPage } from "@/pages/placeholder-page";
import Reports from "@/pages/reports";
import Contacts from "@/pages/contacts";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import {
  Rocket,
  MessageSquare,
  Users,
  Megaphone,
  Zap,
  Globe,
  Star,
  BarChart3,
} from "lucide-react";

function AdminCsrRouter() {
  return (
    <Switch>
      <Route path="/" component={Opportunities} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/payments" component={Payments} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/launchpad">
        <PlaceholderPage
          title="Launchpad"
          description="Quick access to key actions and shortcuts"
          icon={Rocket}
        />
      </Route>
      <Route path="/conversations" component={Conversations} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/marketing">
        <PlaceholderPage
          title="Marketing"
          description="Campaigns and lead generation"
          icon={Megaphone}
        />
      </Route>
      <Route path="/automation">
        <PlaceholderPage
          title="Automation"
          description="Workflow automation and triggers"
          icon={Zap}
        />
      </Route>
      <Route path="/sites">
        <PlaceholderPage
          title="Sites"
          description="Website and landing page builder"
          icon={Globe}
        />
      </Route>
      <Route path="/reputation">
        <PlaceholderPage
          title="Reputation"
          description="Reviews and customer feedback"
          icon={Star}
        />
      </Route>
      <Route path="/reporting" component={Reports} />
      <Route path="/users" component={UserManagement} />
      <Route path="/staff" component={StaffManagement} />
      <Route path="/csr-activity" component={CsrActivity} />
      <Route component={NotFound} />
    </Switch>
  );
}

function TechRouter() {
  return (
    <Switch>
      <Route path="/" component={TechDashboard} />
      <Route path="/tech" component={TechDashboard} />
      <Route path="/tech/job/:id/complete" component={TechJobComplete} />
      <Route path="/tech/job/:id/signature" component={TechSignature} />
      <Route path="/tech/job/:id" component={TechJobDetail} />
      <Route component={TechDashboard} />
    </Switch>
  );
}

function ReportsRouter() {
  return (
    <Switch>
      <Route path="/" component={Reports} />
      <Route path="/reporting" component={Reports} />
      <Route component={Reports} />
    </Switch>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, isLoading, isTechnician, isReports } = useAuth();
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Landing />;
  }

  // Technicians get the mobile-optimized view
  if (isTechnician) {
    return <TechRouter />;
  }

  // Reports-only users get limited interface with just Reports
  if (isReports) {
    return (
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full overflow-hidden">
          <ReportsSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <ReportsMobileHeader />
            <header className="hidden md:flex items-center justify-between gap-4 h-12 px-4 border-b bg-background flex-shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <ReportsRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Admins and CSRs get the full desktop interface
  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <MobileHeader />
          <header className="hidden md:flex items-center justify-between gap-4 h-12 px-4 border-b bg-background flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <AdminCsrRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
