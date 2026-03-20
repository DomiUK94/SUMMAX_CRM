import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCrmAdmin } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { writeAuditEntry } from "@/lib/db/audit";

type AssignOwnerPayload = {
  contactIds?: string[];
  ownerUserId?: string;
};

function missingOwnerColumnsMessage() {
  return "Falta aplicar la migracion de propietarios en sourcecrm.contactos (20260218_phase6_sourcecrm_contact_owner.sql)";
}

function hasMissingOwnerColumns(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message ?? "");
  return (
    (error?.code === "PGRST204" || error?.code === "42703") &&
    (message.includes("owner_user_id") || message.includes("owner_email"))
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageCrmAdmin(user)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as AssignOwnerPayload | null;
  const contactIds = (payload?.contactIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id));
  const ownerUserId = String(payload?.ownerUserId ?? "").trim();
  if (!ownerUserId || contactIds.length === 0) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const sourceDb = createSourceCrmServerClient();
  const { data: owner } = await sourceDb.from("users").select("id, email").eq("id", ownerUserId).maybeSingle();
  if (!owner?.email) return NextResponse.json({ error: "Owner no valido" }, { status: 400 });

  const { error } = await sourceDb
    .from("contactos")
    .update({
      owner_user_id: owner.id,
      owner_email: owner.email,
      updated_at: new Date().toISOString()
    })
    .in("contact_id", contactIds);

  if (hasMissingOwnerColumns(error)) {
    return NextResponse.json({ error: missingOwnerColumnsMessage() }, { status: 500 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all(
    contactIds.map((id) =>
      writeAuditEntry({
        entityType: "contact",
        entityId: String(id),
        action: "assign",
        changedByUserId: user.id,
        changedByEmail: user.email,
        field: "owner_user_id",
        newValue: owner.id
      })
    )
  );

  return NextResponse.json({ ok: true, updated: contactIds.length });
}
