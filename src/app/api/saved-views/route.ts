import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { writeAuditEntry } from "@/lib/db/audit";
import { normalizeOptionalText } from "@/lib/validation/crm";

const ALLOWED_MODULES = new Set(["contacts", "investors", "deals", "activities"]);

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const moduleName = String(searchParams.get("module") ?? "").trim();
  if (!ALLOWED_MODULES.has(moduleName)) {
    return NextResponse.json({ error: "Modulo invalido" }, { status: 400 });
  }

  const db = createSourceCrmServerClient();
  const { data, error } = await db
    .from("saved_views")
    .select("id, module, name, filters_json, is_default, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("module", moduleName)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as
    | { module?: string; name?: string; filters?: Record<string, unknown>; is_default?: boolean }
    | null;

  const moduleName = String(payload?.module ?? "").trim();
  const name = normalizeOptionalText(payload?.name, 120);
  if (!ALLOWED_MODULES.has(moduleName) || !name) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const db = createSourceCrmServerClient();
  if (payload?.is_default) {
    await db.from("saved_views").update({ is_default: false }).eq("user_id", user.id).eq("module", moduleName);
  }
  const { data, error } = await db
    .from("saved_views")
    .insert({
      user_id: user.id,
      module: moduleName,
      name,
      filters_json: payload?.filters ?? {},
      is_default: Boolean(payload?.is_default)
    })
    .select("id, module, name, filters_json, is_default, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "saved_view",
    entityId: data.id,
    action: "create",
    changedByUserId: user.id,
    changedByEmail: user.email,
    newValue: name,
    metadata: { module: moduleName }
  });

  return NextResponse.json({ row: data });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as
    | { id?: string; name?: string; filters?: Record<string, unknown>; is_default?: boolean; module?: string }
    | null;
  const id = String(payload?.id ?? "").trim();
  const name = normalizeOptionalText(payload?.name, 120);
  const moduleName = normalizeOptionalText(payload?.module, 32);
  if (!id || !name) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const db = createSourceCrmServerClient();
  const { data: current } = await db.from("saved_views").select("id, module, name").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "No existe" }, { status: 404 });

  if (payload?.is_default) {
    await db.from("saved_views").update({ is_default: false }).eq("user_id", user.id).eq("module", current.module);
  }

  const { data, error } = await db
    .from("saved_views")
    .update({
      name,
      filters_json: payload?.filters ?? {},
      is_default: Boolean(payload?.is_default),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, module, name, filters_json, is_default, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "saved_view",
    entityId: data.id,
    action: "update",
    changedByUserId: user.id,
    changedByEmail: user.email,
    field: "name",
    oldValue: current.name,
    newValue: name,
    metadata: { module: moduleName ?? current.module }
  });

  return NextResponse.json({ row: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const db = createSourceCrmServerClient();
  const { data: current } = await db.from("saved_views").select("id, name").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const { error } = await db.from("saved_views").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "saved_view",
    entityId: current.id,
    action: "delete",
    changedByUserId: user.id,
    changedByEmail: user.email,
    oldValue: current.name
  });

  return NextResponse.json({ ok: true });
}

