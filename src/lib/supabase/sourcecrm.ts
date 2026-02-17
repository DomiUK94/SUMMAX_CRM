import { createSupabaseServerClient } from "@/lib/supabase/server";

export function createSourceCrmServerClient() {
  return createSupabaseServerClient().schema("sourcecrm");
}
