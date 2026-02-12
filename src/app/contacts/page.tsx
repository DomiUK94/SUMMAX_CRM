import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createContact, listContacts, listInvestors } from "@/lib/db/crm";

export default async function ContactsPage() {
  const user = await requireUser();
  const [contacts, investors] = await Promise.all([listContacts(), listInvestors()]);

  async function createContactAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const investor_id = String(formData.get("investor_id") ?? "");
    const full_name = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    if (!investor_id || !full_name) return;

    await createContact({
      investor_id,
      full_name,
      email: email || undefined,
      phone: phone || undefined,
      owner_user_id: actor.id
    });

    revalidatePath("/contacts");
    revalidatePath("/dashboard/me");
  }

  return (
    <AppShell title="Contactos" subtitle="Gestion y alta manual" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Nuevo contacto</h3>
          <form action={createContactAction} className="row" style={{ alignItems: "end" }}>
            <div>
              <label>Fondo</label>
              <select name="investor_id" required defaultValue="">
                <option value="" disabled>Selecciona fondo...</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Nombre</label>
              <input name="full_name" required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" name="email" />
            </div>
            <div>
              <label>Telefono</label>
              <input name="phone" />
            </div>
            <button type="submit">Crear</button>
          </form>
        </div>

        <div className="card">
          <h3>Listado</h3>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Fondo</th><th>Estado</th><th>Email</th><th>Vence</th><th></th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td>{c.investor_name ?? "-"}</td>
                  <td>{c.status_name ?? "-"}</td>
                  <td>{c.email ?? "-"}</td>
                  <td>{c.due_date ?? "-"}</td>
                  <td><Link href={`/contacts/${c.id}`}>Detalle</Link></td>
                </tr>
              ))}
              {contacts.length === 0 ? <tr><td colSpan={6}>Sin contactos.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
