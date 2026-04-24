import { createSupabaseServerClient } from "@/lib/supabase/server";

export function createDimServerClient() {
  return createSupabaseServerClient().schema("dim");
}
