import { AppShell } from "@/components/app-shell";
import { getMyDashboardData } from "@/lib/db/dashboard";
import { requireUser } from "@/lib/auth/session";

export default async function MyDashboardPage() {
  const user = await requireUser();
  const data = await getMyDashboardData(user.id);

  return (
    <AppShell title="Mi Dashboard" subtitle="Operacion personal" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stats-grid">
        <div className="card"><strong>{data.totals.myContacts}</strong><div className="muted">Mis contactos</div></div>
        <div className="card"><strong>{data.totals.dueToday}</strong><div className="muted">Vencen hoy</div></div>
        <div className="card"><strong>{data.totals.overdue}</strong><div className="muted">Vencidos</div></div>
        <div className="card"><strong>{data.totals.upcoming}</strong><div className="muted">Proximos</div></div>
      </div>

      <div className="card">
        <h3>Mi bandeja operativa</h3>
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Fondo</th>
              <th>Estado</th>
              <th>Proxima accion</th>
              <th>Vence</th>
              <th>Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {data.queue.map((item) => (
              <tr key={item.id}>
                <td>{item.full_name}</td>
                <td>{item.investor_name ?? "-"}</td>
                <td>{item.status_name ?? "-"}</td>
                <td>{item.next_step ?? "-"}</td>
                <td>{item.due_date ?? "-"}</td>
                <td>{item.priority_level ?? 0}</td>
              </tr>
            ))}
            {data.queue.length === 0 ? (
              <tr>
                <td colSpan={6}>Sin contactos asignados todavia.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
