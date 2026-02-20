import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { normalizeDateInput, normalizeEmail, normalizeOptionalText, normalizePhone } from "@/lib/validation/crm";
import { writeAuditEntry } from "@/lib/db/audit";

type InlinePayload = {
  field?: "owner_user_id" | "prioritario" | "next_action_date" | "email" | "telefono";
  value?: string | null;
};

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const contactId = Number(context.params.id);
  if (!Number.isFinite(contactId)) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

  const payload = (await request.json().catch(() => null)) as InlinePayload | null;
  const field = payload?.field;
  if (!field) return NextResponse.json({ error: "Campo requerido" }, { status: 400 });

  const db = createSourceCrmServerClient();
  const { data: current, error: currentError } = await db
    .from("contactos")
    .select("contact_id, owner_user_id, owner_email, prioritario, comentarios, email, telefono")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  let oldValue: string | null = null;
  let newValue: string | null = null;

  if (field === "owner_user_id") {
    const ownerId = normalizeOptionalText(payload?.value, 64);
    if (!ownerId) {
      patch.owner_user_id = null;
      patch.owner_email = null;
      oldValue = current.owner_user_id;
      newValue = null;
    } else {
      const { data: owner } = await db.from("users").select("id, email").eq("id", ownerId).maybeSingle();
      if (!owner?.id || !owner.email) return NextResponse.json({ error: "Owner invalido" }, { status: 400 });
      patch.owner_user_id = owner.id;
      patch.owner_email = owner.email;
      oldValue = current.owner_user_id;
      newValue = owner.id;
    }
  }

  if (field === "prioritario") {
    const status = normalizeOptionalText(payload?.value, 80);
    patch.prioritario = status;
    oldValue = current.prioritario;
    newValue = status;
  }

  if (field === "email") {
    const email = normalizeEmail(payload?.value);
    patch.email = email;
    oldValue = current.email;
    newValue = email;
  }

  if (field === "telefono") {
    const phone = normalizePhone(payload?.value);
    patch.telefono = phone;
    oldValue = current.telefono;
    newValue = phone;
  }

  if (field === "next_action_date") {
    const dateIso = normalizeDateInput(payload?.value);
    const currentComments = String(current.comentarios ?? "").trim();
    const nextTag = dateIso ? `next_action=${dateIso.slice(0, 10)}` : "next_action=none";
    patch.comentarios = [currentComments, nextTag].filter(Boolean).join(" | ");
    oldValue = currentComments;
    newValue = patch.comentarios;
  }

  const { error } = await db.from("contactos").update(patch).eq("contact_id", contactId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEntry({
    entityType: "contact",
    entityId: String(contactId),
    action: field === "prioritario" ? "status_change" : "update",
    changedByUserId: user.id,
    changedByEmail: user.email,
    field,
    oldValue,
    newValue
  });

  return NextResponse.json({ ok: true });
}

