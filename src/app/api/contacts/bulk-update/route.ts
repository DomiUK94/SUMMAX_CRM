import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { updateContactProfile } from "@/lib/db/crm";

type BulkContactUpdateItem = {
  contact_id?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  other_contact?: string | null;
  linkedin?: string | null;
  comments?: string | null;
  is_financier?: boolean;
  is_prescriber?: boolean;
  owner_user_id?: string | null;
};

type BulkContactUpdatePayload = {
  contacts?: BulkContactUpdateItem[];
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as BulkContactUpdatePayload | null;
  const contacts = payload?.contacts ?? [];
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "No hay contactos para actualizar" }, { status: 400 });
  }

  const sourceDb = createSourceCrmServerClient();
  const ownerIds = Array.from(new Set(contacts.map((contact) => String(contact.owner_user_id ?? "").trim()).filter(Boolean)));
  const ownerMap = new Map<string, { id: string; email: string }>();

  if (ownerIds.length > 0) {
    const { data: owners, error: ownersError } = await sourceDb.from("users").select("id, email").in("id", ownerIds);
    if (ownersError) {
      return NextResponse.json({ error: ownersError.message }, { status: 500 });
    }
    for (const owner of owners ?? []) {
      if (owner.id && owner.email) {
        ownerMap.set(String(owner.id), { id: String(owner.id), email: String(owner.email) });
      }
    }
  }

  try {
    for (const contact of contacts) {
      const contactId = String(contact.contact_id ?? "").trim();
      const ownerUserId = String(contact.owner_user_id ?? "").trim();
      const owner = ownerUserId ? ownerMap.get(ownerUserId) ?? null : null;

      await updateContactProfile({
        contact_id: contactId,
        full_name: String(contact.full_name ?? "").trim(),
        email: String(contact.email ?? "").trim() || undefined,
        phone: String(contact.phone ?? "").trim() || undefined,
        role: String(contact.role ?? "").trim() || undefined,
        other_contact: String(contact.other_contact ?? "").trim() || undefined,
        linkedin: String(contact.linkedin ?? "").trim() || undefined,
        comments: String(contact.comments ?? "").trim() || undefined,
        is_financier: Boolean(contact.is_financier),
        is_prescriber: Boolean(contact.is_prescriber),
        owner_user_id: owner?.id ?? undefined,
        owner_email: owner?.email ?? undefined,
        actor_user_id: user.id,
        actor_email: user.email
      });

      revalidatePath(`/contacts/${contactId}`);
    }

    revalidatePath("/contacts");
    revalidatePath("/investors");
    return NextResponse.json({ ok: true, updated: contacts.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron aplicar los cambios" },
      { status: 500 }
    );
  }
}
