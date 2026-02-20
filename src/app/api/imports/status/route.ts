import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !isDevBypassEnabled()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
