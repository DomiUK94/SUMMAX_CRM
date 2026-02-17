import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ActividadesPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("activities")
    .select("id, entity_type, activity_type, title, body, occurred_at, created_by_email")
    .order("occurred_at", { ascending: false })
    .limit(200);

  const activities = data ?? [];

  return (
    <AppShell title="Actividades" subtitle="Registro operativo reciente" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Entidad</th>
              <th>Título</th>
              <th>Detalle</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td>{a.occurred_at ? new Date(a.occurred_at).toLocaleString("es-ES") : "-"}</td>
                <td>{a.activity_type ?? "-"}</td>
                <td>{a.entity_type ?? "-"}</td>
                <td>{a.title ?? "-"}</td>
                <td>{a.body ?? "-"}</td>
                <td>{a.created_by_email ?? "-"}</td>
              </tr>
            ))}
            {activities.length === 0 ? (
              <tr>
                <td colSpan={6}>Sin actividades registradas.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
