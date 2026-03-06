import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
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

  const queue = focus === "unassigned" ? data.unassignedQueue : data.queue;
  const focusTitle = focus === "unassigned" ? "Pendientes de asignación" : focus === "stale" ? "Seguimiento retrasado" : "Actividad prioritaria";
  const focusCopy =
    focus === "unassigned"
      ? "Contactos sin responsable listos para repartir."
      : focus === "stale"
        ? "Contactos con señales de bloqueo o falta de avance reciente."
        : "Tu cartera con más potencial de seguimiento inmediato.";

  return (
    <AppShell title="Mi Dashboard" subtitle="Operativa diaria y seguimiento" canViewGlobal={user.can_view_global_dashboard}>
      <section className="dashboard-hero">
        <div className="card dashboard-highlight-card">
          <p className="workspace-kicker">Mi foco</p>
          <h2>{focusTitle}</h2>
          <p className="muted">{focusCopy}</p>
          <div className="dashboard-highlight-metric">
            <strong>{focus === "unassigned" ? data.totals.unassignedContacts : data.totals.stale7Days}</strong>
            <span>{focus === "unassigned" ? "contactos sin responsable" : "contactos para revisar hoy"}</span>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <Link href={kpiHref("none")} className="card dashboard-kpi-card">
            <span>Mis contactos</span>
            <strong>{data.totals.myContacts}</strong>
          </Link>
          <Link href={kpiHref("stale")} className="card dashboard-kpi-card">
            <span>Sin acción +7 días</span>
            <strong>{data.totals.stale7Days}</strong>
          </Link>
          <Link href={kpiHref("stale")} className="card dashboard-kpi-card dashboard-kpi-card-alert">
            <span>Crítico +14 días</span>
            <strong>{data.totals.stale14Days}</strong>
          </Link>
          <Link href={kpiHref("unassigned")} className="card dashboard-kpi-card">
            <span>Sin responsable</span>
            <strong>{data.totals.unassignedContacts}</strong>
          </Link>
          <Link href={kpiHref("none")} className="card dashboard-kpi-card">
            <span>Prioridad alta</span>
            <strong>{data.totals.highPriorityContacts}</strong>
          </Link>
        </div>
      </section>

      <div className="card dashboard-table-card">
        <div className="dashboard-section-head">
          <div>
            <p className="workspace-kicker">Cola operativa</p>
            <h3>{focus === "unassigned" ? "Contactos pendientes de owner" : "Contactos que requieren acción"}</h3>
          </div>
          <Link href="/contacts" className="quick-pill quick-pill-ghost">Abrir CRM</Link>
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
    </AppShell>
  );
}
