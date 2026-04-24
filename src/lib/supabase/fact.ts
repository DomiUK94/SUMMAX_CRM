import { createSupabaseServerClient } from "@/lib/supabase/server";

export function createFactServerClient() {
  return createSupabaseServerClient().schema("fact");
}
