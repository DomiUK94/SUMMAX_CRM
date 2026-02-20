import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { canAccessUsersProvisioning, canManageUsers } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SearchProps = {
  searchParams?: {
    ok?: string;
    error?: string;
  };
};

export default async function UsuariosPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const isAdmin = canManageUsers(user);
  const isManager = user.role === "manager";
  if (!canAccessUsersProvisioning(user)) {
    return (
      <AppShell title="Usuarios" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">No tienes permisos para gestionar usuarios.</div>
      </AppShell>
    );
  }

  async function createUserAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!canAccessUsersProvisioning(actor)) return;

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "").trim();
    const fullName = String(formData.get("full_name") ?? "").trim();
    const requestedRole = String(formData.get("role") ?? "user");
    const requestedCanViewGlobal = String(formData.get("can_view_global_dashboard") ?? "false") === "true";
    const requestedIsActive = String(formData.get("is_active") ?? "true") === "true";
    const actorIsAdmin = canManageUsers(actor);
    const role = actorIsAdmin && (requestedRole === "admin" || requestedRole === "manager") ? requestedRole : "user";
    const canViewGlobal = actorIsAdmin ? requestedCanViewGlobal : false;
    const isActive = actorIsAdmin ? requestedIsActive : true;

    if (!email || !password) {
      redirect("/usuarios?error=email_password_required");
    }

    const admin = createSupabaseAdminClient();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined
    });

    if (created.error || !created.data.user) {
      redirect(`/usuarios?error=${encodeURIComponent(created.error?.message ?? "auth_create_failed")}`);
    }

    const db = createSourceCrmServerClient();
    const profile = await db.from("users").upsert(
      {
        id: created.data.user.id,
        email,
        full_name: fullName || null,
        role: role === "admin" || role === "manager" ? role : "user",
        can_view_global_dashboard: canViewGlobal,
        is_active: isActive,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (profile.error) {
      redirect(`/usuarios?error=${encodeURIComponent(profile.error.message)}`);
    }

    revalidatePath("/usuarios");
    redirect("/usuarios?ok=user_created");
  }

  async function updateUserAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!canManageUsers(actor)) {
      redirect("/forbidden");
    }

    const targetId = String(formData.get("target_id") ?? "");
    const role = String(formData.get("role") ?? "user");
    const canViewGlobal = String(formData.get("can_view_global_dashboard") ?? "false") === "true";
    const isActive = String(formData.get("is_active") ?? "true") === "true";
    if (!targetId) return;

    const db = createSourceCrmServerClient();
    await db
      .from("users")
      .update({
        role: role === "admin" || role === "manager" ? role : "user",
        can_view_global_dashboard: canViewGlobal,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq("id", targetId);

    revalidatePath("/usuarios");
  }

  async function linkExistingAuthUserAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!canAccessUsersProvisioning(actor)) return;

    const publicUserId = String(formData.get("public_user_id") ?? "").trim();
    const requestedRole = String(formData.get("role") ?? "user");
    const requestedCanViewGlobal = String(formData.get("can_view_global_dashboard") ?? "false") === "true";
    const requestedIsActive = String(formData.get("is_active") ?? "true") === "true";
    const actorIsAdmin = canManageUsers(actor);
    const role = actorIsAdmin && (requestedRole === "admin" || requestedRole === "manager") ? requestedRole : "user";
    const canViewGlobal = actorIsAdmin ? requestedCanViewGlobal : false;
    const isActive = actorIsAdmin ? requestedIsActive : true;
    if (!publicUserId) {
      redirect("/usuarios?error=public_user_required");
    }

    const supabase = createSupabaseServerClient();
    const { data: publicUser, error: publicUserError } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("id", publicUserId)
      .maybeSingle();
    if (publicUserError || !publicUser?.email) {
      redirect(`/usuarios?error=${encodeURIComponent(publicUserError?.message ?? "public_user_not_found")}`);
    }

    const db = createSourceCrmServerClient();
    const profile = await db.from("users").upsert(
      {
        id: publicUser.id,
        email: publicUser.email,
        full_name: publicUser.full_name ?? null,
        role: role === "admin" || role === "manager" ? role : "user",
        can_view_global_dashboard: canViewGlobal,
        is_active: isActive,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (profile.error) {
      redirect(`/usuarios?error=${encodeURIComponent(profile.error.message)}`);
    }

    revalidatePath("/usuarios");
    redirect("/usuarios?ok=user_linked");
  }

  const db = createSourceCrmServerClient();
  const { data: users } = await db
    .from("users")
    .select("id, email, full_name, role, is_active, can_view_global_dashboard, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const supabase = createSupabaseServerClient();
  const { data: publicUsers } = await supabase
    .from("users")
    .select("id, email, full_name")
    .order("created_at", { ascending: false })
    .limit(1000);
  const crmUserIds = new Set((users ?? []).map((u) => u.id));
  const publicNotInCrm = (publicUsers ?? [])
    .filter((u) => u.email && !crmUserIds.has(u.id))
    .map((u) => ({ id: u.id, email: u.email as string, full_name: u.full_name as string | null }))
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

  return (
    <AppShell title="Usuarios" subtitle="Alta y permisos CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Crear nuevo usuario</h3>
          {searchParams?.ok === "user_created" ? <p style={{ color: "#0f766e" }}>Usuario creado correctamente.</p> : null}
          {searchParams?.ok === "user_linked" ? <p style={{ color: "#0f766e" }}>Usuario de Auth agregado a CRM.</p> : null}
          {searchParams?.error ? <p style={{ color: "#b91c1c" }}>Error: {searchParams.error}</p> : null}
          <form action={createUserAction} className="stack" style={{ maxWidth: 720 }}>
            <div className="row" style={{ gap: 10, justifyContent: "start" }}>
              <input name="email" type="email" required placeholder="email@empresa.com" style={{ width: 280 }} />
              <input name="password" type="password" required placeholder="Password temporal" style={{ width: 220 }} />
              <input name="full_name" placeholder="Nombre completo" style={{ width: 220 }} />
            </div>
            <div className="row" style={{ gap: 10, justifyContent: "start" }}>
              {isAdmin ? (
                <>
                  <label>
                    Rol
                    <select name="role" defaultValue="user">
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <label>
                    Activo
                    <select name="is_active" defaultValue="true">
                      <option value="true">Si</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                  <label>
                    Dashboard global
                    <select name="can_view_global_dashboard" defaultValue="false">
                      <option value="false">No</option>
                      <option value="true">Si</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <input type="hidden" name="role" value="user" />
                  <input type="hidden" name="is_active" value="true" />
                  <input type="hidden" name="can_view_global_dashboard" value="false" />
                  <p className="muted">Como manager, solo puedes crear cuentas de tipo user con acceso de vista.</p>
                </>
              )}
            </div>
            <div>
              <button type="submit">Crear usuario</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Anadir usuario existente de Public Users</h3>
          <form action={linkExistingAuthUserAction} className="stack" style={{ maxWidth: 720 }}>
            <div className="row" style={{ gap: 10, justifyContent: "start" }}>
              <select name="public_user_id" required style={{ minWidth: 380 }}>
                <option value="">Selecciona usuario de Public Users...</option>
                {publicNotInCrm.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}{u.full_name ? ` - ${u.full_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="row" style={{ gap: 10, justifyContent: "start" }}>
              {isAdmin ? (
                <>
                  <label>
                    Rol
                    <select name="role" defaultValue="user">
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <label>
                    Activo
                    <select name="is_active" defaultValue="true">
                      <option value="true">Si</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                  <label>
                    Dashboard global
                    <select name="can_view_global_dashboard" defaultValue="false">
                      <option value="false">No</option>
                      <option value="true">Si</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <input type="hidden" name="role" value="user" />
                  <input type="hidden" name="is_active" value="true" />
                  <input type="hidden" name="can_view_global_dashboard" value="false" />
                  <p className="muted">Como manager, el usuario se agrega como user con acceso de vista.</p>
                </>
              )}
            </div>
            <div>
              <button type="submit" disabled={publicNotInCrm.length === 0}>
                Agregar desde Public Users
              </button>
            </div>
            {publicNotInCrm.length === 0 ? (
              <p className="muted">No hay usuarios en Public Users pendientes de agregar a CRM.</p>
            ) : null}
          </form>
        </div>

        <div className="card">
          <h3>Usuarios CRM</h3>
          {!isAdmin ? <p className="muted">Como manager tienes solo acceso de lectura en esta tabla.</p> : null}
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Activo</th>
                <th>Dashboard global</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.full_name ?? "-"}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? "Si" : "No"}</td>
                  <td>{u.can_view_global_dashboard ? "Si" : "No"}</td>
                  <td>
                    {isAdmin ? (
                      <form action={updateUserAction} className="row" style={{ justifyContent: "start", gap: 8 }}>
                        <input type="hidden" name="target_id" value={u.id} />
                        <select name="role" defaultValue={u.role}>
                          <option value="user">user</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                        <select name="is_active" defaultValue={u.is_active ? "true" : "false"}>
                          <option value="true">Activo</option>
                          <option value="false">Inactivo</option>
                        </select>
                        <select name="can_view_global_dashboard" defaultValue={u.can_view_global_dashboard ? "true" : "false"}>
                          <option value="false">Global: No</option>
                          <option value="true">Global: Si</option>
                        </select>
                        <button type="submit">Guardar</button>
                      </form>
                    ) : (
                      <span className="muted">Solo lectura</span>
                    )}
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin usuarios CRM.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
