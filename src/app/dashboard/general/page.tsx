import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { getGlobalDashboardData } from "@/lib/db/dashboard";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";
import { CrmIcon } from "@/components/ui/crm-icon";

export default async function GlobalDashboardPage({
  searchParams
}: {
  searchParams?: {
    tab?: string;
    email?: string;
    cards_opened_min?: string;
    sort?: string;
    order?: string;
  };
}) {
  const user = await requireGlobalDashboardAccess();

  if (searchParams?.tab === "web") {
    const params = new URLSearchParams();
    if (searchParams.email) params.set("email", searchParams.email);
    if (searchParams.cards_opened_min) params.set("cards_opened_min", searchParams.cards_opened_min);
    if (searchParams.sort) params.set("sort", searchParams.sort);
    if (searchParams.order) params.set("order", searchParams.order);
    const query = params.toString();
    redirect(query ? `/dashboard/web?${query}` : "/dashboard/web");
  }

  const overviewData = await getGlobalDashboardData();

  return (
    <AppShell title="Dashboard General" subtitle="Vista ejecutiva y ritmo del equipo" canViewGlobal={user.can_view_global_dashboard}>
      <section className="dashboard-hero">
        <div className="card dashboard-highlight-card dashboard-highlight-card-warm">
          <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Panorama</span></p>
          <h2>Resumen ejecutivo del CRM</h2>
          <p className="muted">Una lectura rápida del volumen, los pendientes y la actividad reciente del equipo.</p>
          <div className="dashboard-highlight-metric">
            <strong>{overviewData.totals.contacts}</strong>
            <span>contactos activos en seguimiento</span>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="companies" className="crm-icon" /></span>
            <span>Fondos</span>
            <strong>{overviewData.totals.investors}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span>
            <span>Contactos</span>
            <strong>{overviewData.totals.contacts}</strong>
          </div>
          <div className="card dashboard-kpi-card dashboard-kpi-card-alert">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="warning" className="crm-icon" /></span>
            <span>Pendientes vencidos</span>
            <strong>{overviewData.totals.overdue}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span>Próx. 48h</span>
            <strong>{overviewData.totals.meetings48h}</strong>
          </div>
        </div>
      </section>

      <div className="dashboard-split-grid">
        <div className="card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <p className="workspace-kicker">Distribución</p>
              <h3>Pipeline por estado</h3>
            </div>
          </div>
          <StaticTable
            columns={["Estado", "Total"]}
            rows={overviewData.byStatus.map((row) => [row.status, String(row.count)])}
            emptyLabel="Sin datos."
            emptyHint="Todavía no hay volumen suficiente para dibujar el embudo por estado."
          />
        </div>

        <div className="card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="warning" className="crm-icon" /></span><span>Alerta</span></p>
              <h3>Seguimiento bloqueado</h3>
            </div>
          </div>
          <StaticTable
            columns={["Contacto", "Estado", "Próxima acción", "Vence", "Owner", "Últ. update"]}
            rows={overviewData.staleContacts.map((row) => [
              row.full_name,
              row.status_name ?? "-",
              row.next_step ?? "-",
              row.due_date ?? "-",
              row.owner_email ?? "-",
              new Date(row.updated_at).toLocaleDateString("es-ES")
            ])}
            emptyLabel="No hay estancados."
            emptyHint="No hay contactos con señales de bloqueo o seguimiento vencido en este momento."
          />
        </div>
      </div>
    </AppShell>
  );
}
