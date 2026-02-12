import { AppShell } from "@/components/app-shell";
import { getGlobalDashboardData } from "@/lib/db/dashboard";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";

export default async function GlobalDashboardPage() {
  const user = await requireGlobalDashboardAccess();
  const data = await getGlobalDashboardData();

  return (
    <AppShell title="Dashboard General" subtitle="Vista ejecutiva y pendientes" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stats-grid">
        <div className="card"><strong>{data.totals.investors}</strong><div className="muted">Fondos</div></div>
        <div className="card"><strong>{data.totals.contacts}</strong><div className="muted">Contactos</div></div>
        <div className="card"><strong>{data.totals.overdue}</strong><div className="muted">Pendientes vencidos</div></div>
        <div className="card"><strong>{data.totals.meetings48h}</strong><div className="muted">Prox. 48h</div></div>
      </div>

      <div className="stack">
        <div className="card">
          <h3>Embudo por estado</h3>
          <table>
            <thead><tr><th>Estado</th><th>Total</th></tr></thead>
            <tbody>
              {data.byStatus.map((row) => (
                <tr key={row.status}><td>{row.status}</td><td>{row.count}</td></tr>
              ))}
              {data.byStatus.length === 0 ? <tr><td colSpan={2}>Sin datos.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Importante: estado estancado</h3>
          <table>
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Proxima accion</th>
                <th>Vence</th>
                <th>Owner</th>
                <th>Ult. update</th>
              </tr>
            </thead>
            <tbody>
              {data.staleContacts.map((row) => (
                <tr key={row.id}>
                  <td>{row.full_name}</td>
                  <td>{row.status_name ?? "-"}</td>
                  <td>{row.next_step ?? "-"}</td>
                  <td>{row.due_date ?? "-"}</td>
                  <td>{row.owner_email ?? "-"}</td>
                  <td>{new Date(row.updated_at).toLocaleDateString("es-ES")}</td>
                </tr>
              ))}
              {data.staleContacts.length === 0 ? <tr><td colSpan={6}>No hay estancados.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
