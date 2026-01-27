import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, UserRole } from "@shared/models/auth";

async function fetchUserWithRole(): Promise<User | null> {
  const response = await fetch("/api/auth/user-with-role", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user-with-role"],
    queryFn: fetchUserWithRole,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user-with-role"], null);
    },
  });

  const hasRole = (requiredRoles: UserRole[]): boolean => {
    if (!user || !user.role) return false;
    return requiredRoles.includes(user.role as UserRole);
  };

  const isAdmin = user?.role === "admin";
  const isCsr = user?.role === "csr";
  const isTechnician = user?.role === "technician";

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    hasRole,
    isAdmin,
    isCsr,
    isTechnician,
    role: user?.role as UserRole | undefined,
  };
}
