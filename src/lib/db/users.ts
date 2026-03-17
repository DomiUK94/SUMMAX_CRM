import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export type AssignableUser = {
  id: string;
  email: string;
  role: string;
};

export async function listAssignableUsers() {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("users")
    .select("id, email, role")
    .eq("is_active", true)
    .order("email", { ascending: true });

  if (result.error) throw result.error;
  return (result.data ?? []) as AssignableUser[];
}
