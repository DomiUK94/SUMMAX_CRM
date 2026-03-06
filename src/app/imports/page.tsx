import { AppShell } from "@/components/app-shell";
import { ImportJobsTable } from "@/components/import-jobs-table";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ImportsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    redirect("/forbidden");
  }
  const supabase = createSupabaseServerClient();
  const { data: jobs } = await supabase
    .from("import_batches")
    .select("id, source_type, filename, status, inserted_count, merged_count, warning_count, error_count, summary_json, created_at")
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
          <ImportJobsTable initialJobs={jobs ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
