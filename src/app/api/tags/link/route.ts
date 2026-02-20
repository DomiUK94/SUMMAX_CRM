import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { writeAuditEntry } from "@/lib/db/audit";
import { normalizeOptionalText } from "@/lib/validation/crm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await request.json().catch(() => null)) as { entity_type?: string; entity_id?: string; tag_id?: string } | null)
    : (() => null)();
  const formData: FormData | null = payload ? null : await request.formData().catch(() => null);

  const entityType = normalizeOptionalText(payload?.entity_type ?? formData?.get("entity_type"), 32);
  const entityId = normalizeOptionalText(payload?.entity_id ?? formData?.get("entity_id"), 64);
  const tagId = normalizeOptionalText(payload?.tag_id ?? formData?.get("tag_id"), 64);
  if (!entityType || !entityId || !tagId) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const db = createSourceCrmServerClient();
  const { data, error } = await db
    .from("entity_tags")
    .insert({ entity_type: entityType, entity_id: entityId, tag_id: tagId, created_by_user_id: user.id })
    .select("id, entity_type, entity_id, tag_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "tag",
    entityId: tagId,
    action: "assign",
    changedByUserId: user.id,
    changedByEmail: user.email,
    metadata: { entityType, entityId }
  });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL(`/contacts/${encodeURIComponent(entityId)}`, request.url));
  }
  return NextResponse.json({ row: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const entityType = normalizeOptionalText(searchParams.get("entity_type"), 32);
  const entityId = normalizeOptionalText(searchParams.get("entity_id"), 64);
  const tagId = normalizeOptionalText(searchParams.get("tag_id"), 64);
  if (!entityType || !entityId || !tagId) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const db = createSourceCrmServerClient();
  const { error } = await db
    .from("entity_tags")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("tag_id", tagId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "tag",
    entityId: tagId,
    action: "delete",
    changedByUserId: user.id,
    changedByEmail: user.email,
    metadata: { entityType, entityId }
  });

  return NextResponse.json({ ok: true });
}

