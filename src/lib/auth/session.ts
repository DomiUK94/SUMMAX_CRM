import { redirect } from "next/navigation";
import { bootstrapCrmProfileForCurrentSession, findVisibleCrmProfileForCurrentSession } from "@/lib/auth/profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, AppRole } from "@/lib/auth/permissions";

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  let profile = await findVisibleCrmProfileForCurrentSession(user.id);
  if (!profile) {
    profile = await bootstrapCrmProfileForCurrentSession();
  }
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as AppRole,
    can_view_global_dashboard: profile.can_view_global_dashboard,
    is_active: profile.is_active
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user || !user.is_active) {
    redirect("/login");
  }
  return user;
}

export async function requireGlobalDashboardAccess(): Promise<AppUser> {
  const user = await requireUser();
  if (!user.can_view_global_dashboard) {
    redirect("/forbidden");
  }
  return user;
}
