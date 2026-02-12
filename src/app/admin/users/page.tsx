import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  if (!canManageUsers(user)) {
    return (
      <AppShell title="Usuarios" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">No tienes permisos para gestionar usuarios.</div>
      </AppShell>
    );
  }

  async function updateAccessAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!canManageUsers(actor)) return;

    const targetId = String(formData.get("target_id") ?? "");
    const canView = String(formData.get("can_view_global_dashboard") ?? "false") === "true";
    if (!targetId) return;

    const db = createSupabaseServerClient();

    await db.from("users").update({ can_view_global_dashboard: canView }).eq("id", targetId);

    await db.from("audit_logs").insert({
      actor_user_id: actor.id,
      action: "update_can_view_global_dashboard",
      entity_type: "user",
      entity_id: targetId,
      payload_json: { can_view_global_dashboard: canView }
    });

    revalidatePath("/admin/users");
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, email, role, is_active, can_view_global_dashboard")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <AppShell title="Usuarios" subtitle="Permisos y flag global" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card">
        <table>
          <thead>
            <tr><th>Email</th><th>Rol</th><th>Activo</th><th>Dashboard global</th><th>Accion</th></tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.is_active ? "Si" : "No"}</td>
                <td>{u.can_view_global_dashboard ? "Si" : "No"}</td>
                <td>
                  <form action={updateAccessAction} className="row" style={{ justifyContent: "start" }}>
                    <input type="hidden" name="target_id" value={u.id} />
                    <select name="can_view_global_dashboard" defaultValue={u.can_view_global_dashboard ? "true" : "false"}>
                      <option value="false">No</option>
                      <option value="true">Si</option>
                    </select>
                    <button type="submit">Guardar</button>
                  </form>
                </td>
              </tr>
            ))}
            {(users ?? []).length === 0 ? <tr><td colSpan={5}>Sin usuarios.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
