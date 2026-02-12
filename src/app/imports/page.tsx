import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ImportsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();
  const { data: jobs } = await supabase
    .from("import_batches")
    .select("id, source_type, filename, status, inserted_count, merged_count, warning_count, error_count, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <AppShell title="Importaciones" subtitle="Excel prioritario y CSV canonico" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Nuevo import</h3>
          <form action="/api/imports" method="post" encType="multipart/form-data" className="stack">
            <input type="file" name="file" accept=".xlsx,.csv" required />
            <button type="submit">Subir y procesar</button>
          </form>
        </div>

        <div className="card">
          <h3>Historial</h3>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th>Estado</th><th>Inserted</th><th>Merged</th><th>Warnings</th><th>Errors</th></tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((j) => (
                <tr key={j.id}>
                  <td>{new Date(j.created_at).toLocaleString("es-ES")}</td>
                  <td>{j.source_type}</td>
                  <td>{j.filename}</td>
                  <td>{j.status}</td>
                  <td>{j.inserted_count}</td>
                  <td>{j.merged_count}</td>
                  <td>{j.warning_count}</td>
                  <td>{j.error_count}</td>
                </tr>
              ))}
              {(jobs ?? []).length === 0 ? <tr><td colSpan={8}>Sin importaciones todavia.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
