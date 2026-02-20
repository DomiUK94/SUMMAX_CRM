
import { type AppRole, type AppUser } from "@/lib/auth/permissions";

export function hasRole(user: AppUser | null, roles: AppRole[]): boolean {
  if (!user || !user.is_active) return false;
  return roles.includes(user.role);
}

export function canWriteCrm(user: AppUser | null): boolean {
  return hasRole(user, ["admin", "manager", "user"]);
}

export function canManageCrmAdmin(user: AppUser | null): boolean {
  return hasRole(user, ["admin", "manager"]);
}
