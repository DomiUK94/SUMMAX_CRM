import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { getGlobalDashboardData } from "@/lib/db/dashboard";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";

export default async function GlobalDashboardPage() {
  const user = await requireGlobalDashboardAccess();
  const data = await getGlobalDashboardData();

  return (
    <AppShell title="Dashboard General" subtitle="Vista ejecutiva y ritmo del equipo" canViewGlobal={user.can_view_global_dashboard}>
      <section className="dashboard-hero">
        <div className="card dashboard-highlight-card dashboard-highlight-card-warm">
          <p className="workspace-kicker">Panorama</p>
          <h2>Resumen ejecutivo del CRM</h2>
          <p className="muted">Una lectura rápida del volumen, los pendientes y la actividad reciente del equipo.</p>
          <div className="dashboard-highlight-metric">
            <strong>{data.totals.contacts}</strong>
            <span>contactos activos en seguimiento</span>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <div className="card dashboard-kpi-card">
            <span>Fondos</span>
            <strong>{data.totals.investors}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span>Contactos</span>
            <strong>{data.totals.contacts}</strong>
          </div>
          <div className="card dashboard-kpi-card dashboard-kpi-card-alert">
            <span>Pendientes vencidos</span>
            <strong>{data.totals.overdue}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span>Próx. 48h</span>
            <strong>{data.totals.meetings48h}</strong>
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
            rows={data.byStatus.map((row) => [row.status, String(row.count)])}
            emptyLabel="Sin datos."
            emptyHint="Todavía no hay volumen suficiente para dibujar el embudo por estado."
          />
        </div>

        <div className="card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <p className="workspace-kicker">Alerta</p>
              <h3>Seguimiento bloqueado</h3>
            </div>
          </div>
          <StaticTable
            columns={["Contacto", "Estado", "Próxima acción", "Vence", "Owner", "Últ. update"]}
            rows={data.staleContacts.map((row) => [
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
