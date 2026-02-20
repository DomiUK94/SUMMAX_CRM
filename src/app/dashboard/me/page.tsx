import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { getMyDashboardData } from "@/lib/db/dashboard";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

function kpiHref(focus: "none" | "stale" | "unassigned") {
  return focus === "none" ? "/dashboard/me" : `/dashboard/me?focus=${focus}`;
}

export default async function MyDashboardPage({
  searchParams
}: {
  searchParams?: { focus?: string };
}) {
  const user = await requireUser();
  const focus = searchParams?.focus === "unassigned" ? "unassigned" : searchParams?.focus === "stale" ? "stale" : "none";
  const data = await getMyDashboardData(user.id);
  const sourcecrm = createSourceCrmServerClient();
  const { data: users } = await sourcecrm
    .from("users")
    .select("id, email, full_name, is_active")
    .eq("is_active", true)
    .order("email", { ascending: true });

  async function assignOwnerAction(formData: FormData) {
    "use server";
    await requireUser();
    const contactId = String(formData.get("contact_id") ?? "");
    const ownerUserId = String(formData.get("owner_user_id") ?? "");
    if (!contactId || !ownerUserId) return;

    const db = createSourceCrmServerClient();
    const { data: owner } = await db.from("users").select("email").eq("id", ownerUserId).single();
    const ownerEmail = owner?.email ?? "";
    if (!ownerEmail) return;

    await db
      .from("contactos")
      .update({
        owner_user_id: ownerUserId,
        owner_email: ownerEmail,
        updated_at: new Date().toISOString()
      })
      .eq("contact_id", Number(contactId));

    revalidatePath("/dashboard/me");
    revalidatePath("/contacts");
  }

  return (
    <AppShell title="Mi Dashboard" subtitle="KPIs operativos y seguimiento" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stats-grid">
        <Link href={kpiHref("none")} className="card kpi-link"><strong>{data.totals.myContacts}</strong><div className="muted">Mis contactos</div></Link>
        <Link href={kpiHref("stale")} className="card kpi-link"><strong>{data.totals.stale7Days}</strong><div className="muted">Sin acción (+7 días)</div></Link>
        <Link href={kpiHref("stale")} className="card kpi-link"><strong>{data.totals.stale14Days}</strong><div className="muted">Sin acción crítico (+14 días)</div></Link>
        <Link href={kpiHref("unassigned")} className="card kpi-link"><strong>{data.totals.unassignedContacts}</strong><div className="muted">Pendiente de owner</div></Link>
        <Link href={kpiHref("none")} className="card kpi-link"><strong>{data.totals.highPriorityContacts}</strong><div className="muted">Prioridad alta</div></Link>
      </div>

      <div className="card">
        <h3>{focus === "unassigned" ? "Contactos pendientes de owner" : "Contactos que requieren acción"}</h3>
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Compañía</th>
              <th>Estado</th>
              <th>Último avance</th>
              <th>Días sin acción</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {(focus === "unassigned" ? data.unassignedQueue : data.queue).map((item) => (
              <tr key={item.id}>
                <td>{item.full_name}</td>
                <td>{item.investor_name ?? "-"}</td>
                <td>{item.status_name ?? "-"}</td>
                <td>{item.next_step ?? "-"}</td>
                <td>{item.days_without_action}</td>
                <td>
                  {focus === "unassigned" ? (
                    <form action={assignOwnerAction} className="row" style={{ justifyContent: "start", gap: 8 }}>
                      <input type="hidden" name="contact_id" value={item.id} />
                      <select name="owner_user_id" defaultValue="">
                        <option value="">Seleccionar owner</option>
                        {(users ?? []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name?.trim() || u.email}
                          </option>
                        ))}
                      </select>
                      <button type="submit">Asignar</button>
                    </form>
                  ) : (
                    <Link href={`/contacts/${encodeURIComponent(item.id)}`} className="contacts-tab">
                      Abrir y actualizar
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {(focus === "unassigned" ? data.unassignedQueue : data.queue).length === 0 ? (
              <tr>
                <td colSpan={6}>
                  {focus === "unassigned"
                    ? "No hay contactos pendientes de owner."
                    : "No hay contactos de tu cartera con más de 7 días sin acción."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
