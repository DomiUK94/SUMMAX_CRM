import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (text.includes('"') || text.includes(",") || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  });
  return lines.join("\n");
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "detail" ? "detail" : "general";

  if (mode === "detail") {
    const { data } = await supabase
      .from("contacts")
      .select("full_name, email, phone, status_name, next_step, due_date, investor_name, owner_email, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20000);

    const csv = toCsv(data ?? []);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="summax-detail-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  }

  const { data } = await supabase
    .from("investors")
    .select("name, category, status_name, website, sector, strategy, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20000);

  const csv = toCsv(data ?? []);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="summax-general-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
