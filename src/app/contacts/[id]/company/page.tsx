import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { attachContactToInvestor, getContactById } from "@/lib/db/crm";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export default async function ContactCompanyPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const [contactData, investorsRes] = await Promise.all([
    getContactById(params.id),
    db.from("inversion").select("company_id, compania, updated_at").order("updated_at", { ascending: false }).limit(100)
  ]);

  async function attachAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const investorId = String(formData.get("investor_id") ?? "").trim();
    if (!investorId) return;

    await attachContactToInvestor({
      contact_id: params.id,
      investor_id: investorId,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/contacts/${params.id}`);
    revalidatePath("/contacts");
    revalidatePath(`/investors/${investorId}`);
    redirect(`/contacts/${params.id}`);
  }

  const contact = contactData.contact;
  const investors = (investorsRes.data ?? []).filter((row) => String(row.company_id) !== String(contact?.investor_id ?? ""));

  if (!contact) {
    return (
      <AppShell title="Contacto" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Contacto no encontrado.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Modificar compañía" subtitle={`Cambiar compañía de ${contact.full_name}`} canViewGlobal={user.can_view_global_dashboard}>
      <div className="card stack">
        <div className="row" style={{ alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Compañía actual</h3>
            <p className="muted" style={{ margin: "6px 0 0" }}>{contact.investor_name ?? "Sin compañía vinculada"}</p>
          </div>
          <Link href={`/contacts/${encodeURIComponent(params.id)}`} className="companies-tab">Volver</Link>
        </div>

        <div className="company-note-list stack">
          {investors.map((investor) => (
            <form key={investor.company_id} action={attachAction} className="company-note-item company-link-contact-row">
              <input type="hidden" name="investor_id" value={String(investor.company_id)} />
              <div>
                <strong>{investor.compania ?? `(Compañía ${investor.company_id})`}</strong>
                <div className="muted">ID {investor.company_id}</div>
              </div>
              <button type="submit" className="button-outline-success">Asignar compañía</button>
            </form>
          ))}
          {investors.length === 0 ? <p className="muted">No hay más compañías disponibles para reasignar.</p> : null}
        </div>
      </div>
    </AppShell>
  );
}
