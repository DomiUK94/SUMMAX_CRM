import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { attachContactToInvestor } from "@/lib/db/crm";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export default async function LinkExistingContactPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const [investorRes, contactsRes] = await Promise.all([
    db.from("inversion").select("company_id, compania").eq("company_id", Number(params.id)).single(),
    db
      .from("contactos")
      .select("contact_id, persona_contacto, email, telefono, updated_at")
      .is("company_id", null)
      .order("updated_at", { ascending: false })
      .limit(50)
  ]);

  async function attachAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const contactId = String(formData.get("contact_id") ?? "").trim();
    if (!contactId) return;

    await attachContactToInvestor({
      contact_id: contactId,
      investor_id: params.id,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/investors/${params.id}`);
    revalidatePath("/contacts");
    redirect(`/investors/${params.id}`);
  }

  const investorName = investorRes.data?.compania ?? "Compañia";
  const contacts = contactsRes.data ?? [];

  return (
    <AppShell title="Agregar contacto existente" subtitle={`Vincular a ${investorName}`} canViewGlobal={user.can_view_global_dashboard}>
      <div className="card stack">
        <div className="row" style={{ alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Contactos sin compañia</h3>
            <p className="muted" style={{ margin: "6px 0 0" }}>Selecciona un contacto existente para asignarlo a esta compañia.</p>
          </div>
          <Link href={`/investors/${encodeURIComponent(params.id)}`} className="companies-tab">Volver</Link>
        </div>

        <div className="company-note-list stack">
          {contacts.map((contact) => (
            <form key={contact.contact_id} action={attachAction} className="company-note-item company-link-contact-row">
              <input type="hidden" name="contact_id" value={String(contact.contact_id)} />
              <div>
                <strong>{contact.persona_contacto ?? "(sin nombre)"}</strong>
                <div className="muted">{contact.email ?? contact.telefono ?? "Sin datos"}</div>
              </div>
              <button type="submit" className="button-outline-success">Agregar existente</button>
            </form>
          ))}
          {contacts.length === 0 ? <p className="muted">No hay contactos disponibles sin compañia.</p> : null}
        </div>
      </div>
    </AppShell>
  );
}
