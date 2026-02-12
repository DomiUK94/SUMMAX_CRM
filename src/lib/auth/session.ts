import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, AppRole } from "@/lib/auth/permissions";

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, role, can_view_global_dashboard, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const fallback: AppUser = {
      id: user.id,
      email: user.email ?? "",
      role: "user",
      can_view_global_dashboard: false,
      is_active: true
    };
    return fallback;
  }

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
