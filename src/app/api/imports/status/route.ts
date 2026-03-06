import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const appUser = await getCurrentUser();
  if (!canManageUsers(appUser)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("import_batches")
    .select("id, source_type, filename, status, inserted_count, merged_count, warning_count, error_count, summary_json, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: "cannot_fetch_imports" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}
