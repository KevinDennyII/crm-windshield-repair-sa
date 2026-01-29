import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Car,
  Menu,
  LogOut,
} from "lucide-react";
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

const navItems = [
  { title: "Reports", url: "/", icon: BarChart3 },
];

export function ReportsSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, logout } = useAuth();

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
              <span className="text-xs text-sidebar-foreground/60">Reports</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === "/" || location === "" || location === "/reporting";
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

export function ReportsMobileHeader() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <div className="md:hidden flex items-center justify-between gap-2 p-3 border-b bg-sidebar">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Car className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">
          AutoGlass Pro Reports
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
