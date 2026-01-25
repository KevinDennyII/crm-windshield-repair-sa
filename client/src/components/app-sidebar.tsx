import { Link, useLocation } from "wouter";
import {
  Rocket,
  LayoutDashboard,
  MessageSquare,
  Kanban,
  CreditCard,
  Calendar,
  Users,
  Megaphone,
  Zap,
  Globe,
  Star,
  BarChart3,
  Car,
  Menu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Launchpad", url: "/launchpad", icon: Rocket },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Conversations", url: "/conversations", icon: MessageSquare },
  { title: "Opportunities", url: "/", icon: Kanban },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Automation", url: "/automation", icon: Zap },
  { title: "Sites", url: "/sites", icon: Globe },
  { title: "Reputation", url: "/reputation", icon: Star },
  { title: "Reporting", url: "/reporting", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                AutoGlass Pro
              </span>
              <span className="text-xs text-sidebar-foreground/60">CRM</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location === "/" || location === ""
                    : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "transition-colors",
                        isActive &&
                          "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!isCollapsed && (
          <div className="text-xs text-sidebar-foreground/50 text-center">
            AutoGlass Pro v1.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function MobileHeader() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <div className="md:hidden flex items-center justify-between gap-2 p-3 border-b bg-sidebar">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Car className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">
          AutoGlass Pro
        </span>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-sidebar-foreground"
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
