import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { writeAuditEntry } from "@/lib/db/audit";
import { normalizeOptionalText } from "@/lib/validation/crm";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const entityType = String(searchParams.get("entity_type") ?? "").trim();
  const entityId = String(searchParams.get("entity_id") ?? "").trim();

  const db = createSourceCrmServerClient();
  if (entityType && entityId) {
    const { data, error } = await db
      .from("entity_tags")
      .select("id, tag_id, tags(id, name, color)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  }

  const { data, error } = await db.from("tags").select("id, name, color").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as { name?: string; color?: string } | null;
  const name = normalizeOptionalText(payload?.name, 80);
  const color = normalizeOptionalText(payload?.color, 16) ?? "#0f97af";
  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const db = createSourceCrmServerClient();
  const { data, error } = await db
    .from("tags")
    .insert({ name, color, created_by_user_id: user.id })
    .select("id, name, color")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "tag",
    entityId: data.id,
    action: "create",
    changedByUserId: user.id,
    changedByEmail: user.email,
    newValue: data.name
  });

  return NextResponse.json({ row: data });
}

