import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export function createDimServerClient() {
  return createSourceCrmServerClient();
}
