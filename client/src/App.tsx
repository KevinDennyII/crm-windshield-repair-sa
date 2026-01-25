import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, MobileHeader } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Opportunities from "@/pages/opportunities";
import Payments from "@/pages/payments";
import Dashboard from "@/pages/dashboard";
import { PlaceholderPage } from "@/pages/placeholder-page";
import {
  Rocket,
  MessageSquare,
  Calendar,
  Users,
  Megaphone,
  Zap,
  Globe,
  Star,
  BarChart3,
} from "lucide-react";

function Router() {
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
      <Route path="/conversations">
        <PlaceholderPage
          title="Conversations"
          description="Manage customer communications"
          icon={MessageSquare}
        />
      </Route>
      <Route path="/calendar">
        <PlaceholderPage
          title="Calendar"
          description="Schedule and manage installations"
          icon={Calendar}
        />
      </Route>
      <Route path="/contacts">
        <PlaceholderPage
          title="Contacts"
          description="Customer and vendor directory"
          icon={Users}
        />
      </Route>
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
      <Route path="/reporting">
        <PlaceholderPage
          title="Reporting"
          description="Analytics and business insights"
          icon={BarChart3}
        />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
