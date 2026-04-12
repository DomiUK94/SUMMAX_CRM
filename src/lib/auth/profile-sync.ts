import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSourceCrmAdminClient } from "@/lib/supabase/sourcecrm-admin";

type CrmProfile = {
  id: string;
  email: string;
  role: AppRole;
  can_view_global_dashboard: boolean;
  is_active: boolean;
  full_name: string | null;
};

type LegacyProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  can_view_global_dashboard: boolean;
  is_active: boolean;
};

function normalizeRole(value: string | null | undefined): AppRole {
  if (value === "admin" || value === "manager") return value;
  return "user";
}

function mapProfile(profile: {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  can_view_global_dashboard: boolean;
  is_active: boolean;
}): CrmProfile {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name ?? null,
    role: normalizeRole(profile.role),
    can_view_global_dashboard: profile.can_view_global_dashboard,
    is_active: profile.is_active
  };
}

async function findLegacyProfile(authUser: Pick<User, "id" | "email">): Promise<LegacyProfile | null> {
  const supabase = createSupabaseAdminClient();
  const byId = await supabase
    .from("users")
    .select("id, email, full_name, role, can_view_global_dashboard, is_active")
    .eq("id", authUser.id)
    .maybeSingle();

  if (byId.error) throw byId.error;
  if (byId.data?.email) return byId.data as LegacyProfile;

  if (!authUser.email) return null;

  const byEmail = await supabase
    .from("users")
    .select("id, email, full_name, role, can_view_global_dashboard, is_active")
    .eq("email", authUser.email)
    .maybeSingle();

  if (byEmail.error) throw byEmail.error;
  return byEmail.data?.email ? (byEmail.data as LegacyProfile) : null;
}

export async function ensureCrmProfileForAuthUser(authUser: Pick<User, "id" | "email" | "user_metadata">): Promise<CrmProfile | null> {
  const sourcecrm = createSourceCrmAdminClient();
  const existing = await sourcecrm
    .from("users")
    .select("id, email, full_name, role, can_view_global_dashboard, is_active")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.email) return mapProfile(existing.data);

  const legacyProfile = await findLegacyProfile(authUser);
  if (!legacyProfile) return null;

  const fullName =
    typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name.trim()
      ? authUser.user_metadata.full_name.trim()
      : legacyProfile.full_name;

  const restored = await sourcecrm
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: authUser.email ?? legacyProfile.email,
        full_name: fullName || null,
        role: normalizeRole(legacyProfile.role),
        can_view_global_dashboard: Boolean(legacyProfile.can_view_global_dashboard),
        is_active: Boolean(legacyProfile.is_active),
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("id, email, full_name, role, can_view_global_dashboard, is_active")
    .single();

  if (restored.error) throw restored.error;
  return mapProfile(restored.data);
}
