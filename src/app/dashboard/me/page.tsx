import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { getMyDashboardData } from "@/lib/db/dashboard";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { CrmIcon } from "@/components/ui/crm-icon";

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

  const queue = focus === "unassigned" ? data.unassignedQueue : data.queue;

  return (
    <AppShell title="Mi Dashboard" subtitle="Operativa diaria y seguimiento" canViewGlobal={user.can_view_global_dashboard}>
      <section className="dashboard-hero dashboard-hero-compact">
        <aside className="dashboard-kpi-rail">
          <Link href={kpiHref("none")} className="card dashboard-kpi-card dashboard-kpi-card-compact">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span>
            <span>Mis contactos</span>
            <strong>{data.totals.myContacts}</strong>
          </Link>
          <Link href={kpiHref("stale")} className="card dashboard-kpi-card dashboard-kpi-card-compact">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="activity" className="crm-icon" /></span>
            <span>Sin acción +7 días</span>
            <strong>{data.totals.stale7Days}</strong>
          </Link>
          <Link href={kpiHref("stale")} className="card dashboard-kpi-card dashboard-kpi-card-compact dashboard-kpi-card-alert">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="warning" className="crm-icon" /></span>
            <span>Crítico +14 días</span>
            <strong>{data.totals.stale14Days}</strong>
          </Link>
          <Link href={kpiHref("unassigned")} className="card dashboard-kpi-card dashboard-kpi-card-compact">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="users" className="crm-icon" /></span>
            <span>Sin responsable</span>
            <strong>{data.totals.unassignedContacts}</strong>
          </Link>
          <Link href={kpiHref("none")} className="card dashboard-kpi-card dashboard-kpi-card-compact">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span>
            <span>Prioridad alta</span>
            <strong>{data.totals.highPriorityContacts}</strong>
          </Link>
        </aside>

        <div className="card dashboard-table-card dashboard-table-card-hero">
          <div className="dashboard-section-head">
            <div>
              <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Cola operativa</span></p>
              <h3>{focus === "unassigned" ? "Contactos pendientes de owner" : "Contactos que requieren acción"}</h3>
            </div>
            <Link href="/contacts" className="quick-pill quick-pill-ghost"><span className="quick-pill-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span><span>Abrir CRM</span></Link>
          </div>
          <StaticTable
            columns={["Contacto", "Compañía", "Estado", "Último avance", "Días sin acción", "Acción"]}
            rows={queue.map((item) => [
              item.full_name,
              item.investor_name ?? "-",
              item.status_name ?? "-",
              item.next_step ?? "-",
              String(item.days_without_action),
              focus === "unassigned" ? (
                <form action={assignOwnerAction} className="row" style={{ justifyContent: "start", gap: 8 }}>
                  <input type="hidden" name="contact_id" value={item.id} />
                  <select name="owner_user_id" defaultValue="">
                    <option value="">Seleccionar responsable</option>
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
              )
            ])}
            emptyLabel={focus === "unassigned" ? "No hay contactos pendientes de responsable." : "No hay contactos de tu cartera con más de 7 días sin acción."}
            emptyHint={focus === "unassigned" ? "Cuando entren nuevos contactos sin responsable aparecerán aquí para asignarlos rápido." : "Tu cartera está al día. Si aparece un bloqueo, volverá a esta cola automáticamente."}
            emptyAction={<Link href="/contacts" className="contacts-tab">Abrir contactos</Link>}
          />
        </div>
      </section>
    </AppShell>
  );
}
