import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
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
    <AppShell title="Usuarios" subtitle="Altas, permisos y usuarios existentes" canViewGlobal={user.can_view_global_dashboard}>
      <div className="editor-shell">
        <section className="card editor-hero">
          <div>
            <p className="workspace-kicker">Acceso CRM</p>
            <h2>Gestiona altas y permisos sin salir del mismo lenguaje visual</h2>
            <p className="muted">
              Crea usuarios nuevos, incorpora usuarios existentes y revisa permisos desde una sola vista mas clara.
            </p>
          </div>
          <div className="editor-hero-metrics">
            <div className="editor-hero-metric">
              <strong>{users?.length ?? 0}</strong>
              <span>usuarios CRM</span>
            </div>
            <div className="editor-hero-metric">
              <strong>{publicNotInCrm.length}</strong>
              <span>por incorporar</span>
            </div>
          </div>
        </section>

        {searchParams?.ok === "user_created" ? <div className="notice notice-success">Usuario creado correctamente.</div> : null}
        {searchParams?.ok === "user_linked" ? <div className="notice notice-success">Usuario de Auth agregado a CRM.</div> : null}
        {searchParams?.error ? <div className="notice notice-error">Error: {searchParams.error}</div> : null}

        <section className="editor-grid-two">
          <div className="card editor-card">
            <div className="table-card-head">
              <div>
                <p className="workspace-kicker">Alta nueva</p>
                <h3>Crear usuario</h3>
                <p className="muted">Abre una cuenta nueva con rol y acceso alineados a tu nivel de permisos.</p>
              </div>
            </div>
            <form action={createUserAction} className="editor-stack">
              <div className="editor-form-grid editor-form-grid-3">
                <label className="form-field">
                  <span>Email</span>
                  <input name="email" type="email" required placeholder="email@empresa.com" />
                </label>
                <label className="form-field">
                  <span>Password temporal</span>
                  <input name="password" type="password" required placeholder="Temporal y segura" />
                </label>
                <label className="form-field">
                  <span>Nombre completo</span>
                  <input name="full_name" placeholder="Nombre completo" />
                </label>
              </div>

              {isAdmin ? (
                <div className="editor-form-grid editor-form-grid-3">
                  <label className="form-field">
                    <span>Rol</span>
                    <select name="role" defaultValue="user">
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Activo</span>
                    <select name="is_active" defaultValue="true">
                      <option value="true">S\u00ed</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Dashboard global</span>
                    <select name="can_view_global_dashboard" defaultValue="false">
                      <option value="false">No</option>
                      <option value="true">S\u00ed</option>
                    </select>
                  </label>
                </div>
              ) : (
                <>
                  <input type="hidden" name="role" value="user" />
                  <input type="hidden" name="is_active" value="true" />
                  <input type="hidden" name="can_view_global_dashboard" value="false" />
                  <p className="muted">Como manager, solo puedes crear cuentas tipo user con acceso de vista.</p>
                </>
              )}

              <div className="form-actions-bar form-actions-bar-start">
                <button type="submit">Crear usuario</button>
              </div>
            </form>
          </div>

          <div className="card editor-card">
            <div className="table-card-head">
              <div>
                <p className="workspace-kicker">Usuarios existentes</p>
                <h3>Agregar usuario existente</h3>
                <p className="muted">Trae usuarios ya creados en Public Users y dales acceso dentro del CRM.</p>
              </div>
            </div>
            <form action={linkExistingAuthUserAction} className="editor-stack">
              <label className="form-field">
                <span>Usuario de Public Users</span>
                <select name="public_user_id" required>
                  <option value="">Selecciona un usuario...</option>
                  {publicNotInCrm.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}{u.full_name ? ` - ${u.full_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {isAdmin ? (
                <div className="editor-form-grid editor-form-grid-3">
                  <label className="form-field">
                    <span>Rol</span>
                    <select name="role" defaultValue="user">
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Activo</span>
                    <select name="is_active" defaultValue="true">
                      <option value="true">S\u00ed</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Dashboard global</span>
                    <select name="can_view_global_dashboard" defaultValue="false">
                      <option value="false">No</option>
                      <option value="true">S\u00ed</option>
                    </select>
                  </label>
                </div>
              ) : (
                <>
                  <input type="hidden" name="role" value="user" />
                  <input type="hidden" name="is_active" value="true" />
                  <input type="hidden" name="can_view_global_dashboard" value="false" />
                  <p className="muted">Como manager, el usuario se agrega como user con acceso de vista.</p>
                </>
              )}

              <div className="form-actions-bar form-actions-bar-start">
                <button type="submit" disabled={publicNotInCrm.length === 0}>Agregar desde Public Users</button>
              </div>
              {publicNotInCrm.length === 0 ? <p className="muted">No hay usuarios pendientes de incorporar al CRM.</p> : null}
            </form>
          </div>
        </section>

        <section className="card editor-card">
          <div className="form-actions-bar">
            <div>
              <p className="workspace-kicker">Permisos</p>
              <h3>Usuarios CRM</h3>
              {!isAdmin ? <p className="muted">Como manager tienes acceso de solo lectura en esta tabla.</p> : null}
            </div>
          </div>
          <StaticTable
            columns={["Email", "Nombre", "Rol", "Activo", "Dashboard global", "Acci\u00f3n"]}
            rows={(users ?? []).map((u) => [
              u.email,
              u.full_name ?? "-",
              u.role,
              u.is_active ? "S\u00ed" : "No",
              u.can_view_global_dashboard ? "S\u00ed" : "No",
              isAdmin ? (
                <form action={updateUserAction} className="inline-form-grid">
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
                    <option value="true">Global: S\u00ed</option>
                  </select>
                  <button type="submit">Guardar</button>
                </form>
              ) : (
                <span className="muted">Solo lectura</span>
              )
            ])}
            emptyLabel="Sin usuarios CRM."
            emptyHint="Cuando se creen o se incorporen usuarios apareceran aqui con su configuracion."
          />
        </section>
      </div>
    </AppShell>
  );
}

