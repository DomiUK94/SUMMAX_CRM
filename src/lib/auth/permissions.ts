export type AppRole = "admin" | "manager" | "user";

export type AppUser = {
  id: string;
  email: string;
  role: AppRole;
  can_view_global_dashboard: boolean;
  is_active: boolean;
};

export function canViewGlobalDashboard(user: AppUser | null): boolean {
  if (!user) return false;
  return user.is_active && user.can_view_global_dashboard;
}

export function canManageUsers(user: AppUser | null): boolean {
  if (!user) return false;
  return user.is_active && user.role === "admin";
}
