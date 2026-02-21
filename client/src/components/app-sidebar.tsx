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
  LogOut,
  UserCog,
  UserPlus,
  Activity,
  Bot,
  PhoneCall,
  MapPin,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

// Full nav items for admin and technician roles
const allNavItems = [
  { title: "Launchpad", url: "/launchpad", icon: Rocket },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Conversations", url: "/conversations", icon: MessageSquare },
  { title: "Opportunities", url: "/", icon: Kanban },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "AI Tools", url: "/ai-tools", icon: Bot },
  { title: "AI Receptionist", url: "/ai-receptionist", icon: PhoneCall },
  { title: "Mobile Fee Map", url: "/mobile-fee-map", icon: MapPin },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Automation", url: "/automation", icon: Zap },
  { title: "Sites", url: "/sites", icon: Globe },
  { title: "Reputation", url: "/reputation", icon: Star },
  { title: "Reporting", url: "/reporting", icon: BarChart3 },
];

// CSR-only nav items (restricted access)
const csrNavItems = [
  { title: "Conversations", url: "/conversations", icon: MessageSquare },
  { title: "Opportunities", url: "/", icon: Kanban },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "AI Tools", url: "/ai-tools", icon: Bot },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Reputation", url: "/reputation", icon: Star },
];

// Reports-only nav items (restricted access)
const reportsNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Reporting", url: "/reporting", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, hasAdminAccess, isCsr, isReports, logout } = useAuth();

  // Determine which nav items to show based on role
  const navItems = isCsr ? csrNavItems : isReports ? reportsNavItems : allNavItems;

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

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
              {hasAdminAccess && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/users"}
                      tooltip="User Management"
                      className={cn(
                        "transition-colors",
                        location === "/users" &&
                          "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href="/users" data-testid="nav-users">
                        <UserCog className="h-4 w-4" />
                        <span>User Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/staff"}
                      tooltip="Staff Accounts"
                      className={cn(
                        "transition-colors",
                        location === "/staff" &&
                          "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href="/staff" data-testid="nav-staff">
                        <UserPlus className="h-4 w-4" />
                        <span>Staff Accounts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/csr-activity"}
                      tooltip="CSR Activity"
                      className={cn(
                        "transition-colors",
                        location === "/csr-activity" &&
                          "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href="/csr-activity" data-testid="nav-csr-activity">
                        <Activity className="h-4 w-4" />
                        <span>CSR Activity</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground text-xs">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-sidebar-foreground/60 truncate">
                {user?.email}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
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
        <NotificationBell />
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
