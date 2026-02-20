import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { canManageCrmBulkEdits } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export default async function ManageDealsPage() {
  const user = await requireUser();
  if (!canManageCrmBulkEdits(user)) {
    redirect("/forbidden");
  }

  return (
    <AppShell title="Modificar datos negocios" subtitle="Edicion masiva" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card">
        <p>Esta pantalla queda preparada para edicion masiva de negocios.</p>
        <p className="muted">Siguiente paso: habilitar edicion inline por columna.</p>
      </div>
    </AppShell>
  );
}
