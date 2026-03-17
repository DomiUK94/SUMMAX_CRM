import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function createSourceCrmAdminClient() {
  return createSupabaseAdminClient().schema("sourcecrm");
}
