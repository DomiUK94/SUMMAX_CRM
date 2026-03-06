import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

function parseAmount(input: string | null): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function estimateAmount(min: number, max: number): number {
  if (min > 0 && max > 0) return (min + max) / 2;
  if (max > 0) return max;
  if (min > 0) return min;
  return 0;
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
    max_num: parseAmount(r.inversion_maxima),
    estimated_num: estimateAmount(parseAmount(r.inversion_minima), parseAmount(r.inversion_maxima))
  }));

  const totalEstimated = rows.reduce((acc, r) => acc + r.estimated_num, 0);

  return (
    <AppShell title="Reporte financiación" subtitle="Resumen económico de negocios por cuenta" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stats-grid">
        <div className="card">
          <strong>{rows.length}</strong>
          <div className="muted">Cuentas analizadas</div>
        </div>
        <div className="card">
          <strong>{totalEstimated.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</strong>
          <div className="muted">Monto estimado total</div>
        </div>
      </div>

      <div className="card">
        <StaticTable
          columns={["Company ID", "Cuenta", "Vertical", "Prioridad", "Inversión mínima", "Inversión máxima", "Monto estimado"]}
          rows={rows.map((r) => [
            String(r.company_id),
            r.compania,
            r.vertical ?? "-",
            r.prioridad ?? "-",
            r.inversion_minima ?? "-",
            r.inversion_maxima ?? "-",
            r.estimated_num > 0 ? r.estimated_num.toLocaleString("es-ES", { maximumFractionDigits: 0 }) : "-"
          ])}
          emptyLabel="Sin datos de financiación."
        />
      </div>
    </AppShell>
  );
}

