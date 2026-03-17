import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { normalizeOptionalText } from "@/lib/validation/crm";
import { normalizeSavedViewModule, SAVED_VIEW_MODULES } from "@/lib/ui/saved-view-modules";

const ALLOWED_MODULES = new Set(SAVED_VIEW_MODULES);
const SYSTEM_COLUMN_PREFERENCE_NAME = "__columns__";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const moduleName = normalizeSavedViewModule(searchParams.get("module"));
  const name = normalizeOptionalText(searchParams.get("name"), 120);
  if (!moduleName || !ALLOWED_MODULES.has(moduleName)) {
    return NextResponse.json({ error: "Modulo invalido" }, { status: 400 });
  }

  let query = createSourceCrmServerClient()
    .from("saved_views")
    .select("id, module, name, filters_json, is_default, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("module", moduleName)
    .order("updated_at", { ascending: false });
  if (name) query = query.eq("name", name);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as
    | { module?: string; name?: string; filters?: Record<string, unknown>; is_default?: boolean }
    | null;

  const moduleName = normalizeSavedViewModule(payload?.module);
  const name = normalizeOptionalText(payload?.name, 120);
  if (!moduleName || !ALLOWED_MODULES.has(moduleName) || name !== SYSTEM_COLUMN_PREFERENCE_NAME) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const db = createSourceCrmServerClient();
  const { data, error } = await db
    .from("saved_views")
    .insert({
      user_id: user.id,
      module: moduleName,
      name,
      filters_json: payload?.filters ?? {},
      is_default: false
    })
    .select("id, module, name, filters_json, is_default, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  if (!id || name !== SYSTEM_COLUMN_PREFERENCE_NAME) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const db = createSourceCrmServerClient();
  const { data: current } = await db.from("saved_views").select("id, module, name").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!current) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const { data, error } = await db
    .from("saved_views")
    .update({
      name,
      filters_json: payload?.filters ?? {},
      is_default: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, module, name, filters_json, is_default, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ row: data });
}

