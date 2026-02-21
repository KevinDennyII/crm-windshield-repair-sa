import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Users, UserCog } from "lucide-react";
import type { User, UserRole } from "@shared/models/auth";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  manager: "Manager",
  csr: "Customer Service",
  technician: "Technician",
  reports: "Reports Only",
};

const roleColors: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  manager: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  csr: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  technician: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  reports: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

export default function UserManagement() {
  const { user: currentUser, hasAdminAccess } = useAuth();
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: hasAdminAccess,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  if (!hasAdminAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only administrators can access user management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          User Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage user roles and access permissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Assign roles to control what each user can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map(user => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
                data-testid={`user-row-${user.id}`}
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.firstName} {user.lastName}
                      {user.id === currentUser?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className={roleColors[user.role as UserRole] || ""}>
                    {roleLabels[user.role as UserRole] || user.role}
                  </Badge>

                  {user.id !== currentUser?.id && (
                    <Select
                      value={user.role || "technician"}
                      onValueChange={(role) => 
                        updateRoleMutation.mutate({ userId: user.id, role: role as UserRole })
                      }
                      disabled={updateRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-role-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="csr">Customer Service</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="reports">Reports Only</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found. Users will appear here after they log in.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>What each role can access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Administrator</h3>
              <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                <li>Full dashboard access</li>
                <li>Pipeline management</li>
                <li>Financial reports</li>
                <li>User management</li>
                <li>All settings</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Customer Service</h3>
              <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                <li>Pipeline access</li>
                <li>Quote management</li>
                <li>Scheduling</li>
                <li>Customer communication</li>
                <li>Limited reporting</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Technician</h3>
              <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                <li>Assigned jobs only</li>
                <li>Mobile interface</li>
                <li>Photo uploads</li>
                <li>Signature capture</li>
                <li>Payment collection</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
