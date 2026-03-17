import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export function createFactServerClient() {
  return createSourceCrmServerClient();
}
