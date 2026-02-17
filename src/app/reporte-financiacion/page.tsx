import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

function parseAmount(input: string | null): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default async function ReporteFinanciacionPage() {
  const user = await requireUser();
  const db = createSourceCrmServerClient();

  const { data } = await db
    .from("inversion")
    .select("company_id, compania, vertical, prioridad, inversion_minima, inversion_maxima")
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []).map((r) => ({
    ...r,
    min_num: parseAmount(r.inversion_minima),
    max_num: parseAmount(r.inversion_maxima)
  }));

  const totalMin = rows.reduce((acc, r) => acc + r.min_num, 0);
  const totalMax = rows.reduce((acc, r) => acc + r.max_num, 0);

  return (
    <AppShell title="Reporte financiación" subtitle="Resumen económico de acuerdos por cuenta" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stats-grid">
        <div className="card">
          <strong>{rows.length}</strong>
          <div className="muted">Cuentas analizadas</div>
        </div>
        <div className="card">
          <strong>{totalMin.toLocaleString("es-ES")}</strong>
          <div className="muted">Suma inversión mínima</div>
        </div>
        <div className="card">
          <strong>{totalMax.toLocaleString("es-ES")}</strong>
          <div className="muted">Suma inversión máxima</div>
        </div>
        <div className="card">
          <strong>{(totalMax - totalMin).toLocaleString("es-ES")}</strong>
          <div className="muted">Rango total estimado</div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Company ID</th>
              <th>Cuenta</th>
              <th>Vertical</th>
              <th>Prioridad</th>
              <th>Inversión mínima</th>
              <th>Inversión máxima</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.company_id}>
                <td>{r.company_id}</td>
                <td>{r.compania}</td>
                <td>{r.vertical ?? "-"}</td>
                <td>{r.prioridad ?? "-"}</td>
                <td>{r.inversion_minima ?? "-"}</td>
                <td>{r.inversion_maxima ?? "-"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Sin datos de financiación.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
