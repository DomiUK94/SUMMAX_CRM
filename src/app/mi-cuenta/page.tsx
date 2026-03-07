import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CrmIcon } from "@/components/ui/crm-icon";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function friendlyError(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "pwd_min_8") return "La password debe tener al menos 8 caracteres.";
  if (raw === "pwd_mismatch") return "Las passwords no coinciden.";
  return raw;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES");
}

export default async function MiCuentaPage({
  searchParams
}: {
  searchParams?: { pwd?: string; error?: string };
}) {
  const user = await requireUser();
  const supabase = createSourceCrmServerClient();

  async function updateProfileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const fullName = String(formData.get("full_name") ?? "").trim();

    const db = createSourceCrmServerClient();
    await db
      .from("users")
      .update({
        full_name: fullName || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", actor.id);

    revalidatePath("/mi-cuenta");
  }

  async function updatePasswordAction(formData: FormData) {
    "use server";
    await requireUser();
    const password = String(formData.get("new_password") ?? "").trim();
    const confirm = String(formData.get("confirm_password") ?? "").trim();

    if (password.length < 8) {
      redirect("/mi-cuenta?error=pwd_min_8");
    }
    if (password !== confirm) {
      redirect("/mi-cuenta?error=pwd_mismatch");
    }

    const auth = createSupabaseServerClient();
    const { error } = await auth.auth.updateUser({ password });
    if (error) {
      redirect(`/mi-cuenta?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/mi-cuenta?pwd=ok");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, role, can_view_global_dashboard, is_active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = profile?.full_name?.trim() || "Usuario sin nombre";
  const email = profile?.email ?? user.email;
  const isActive = profile?.is_active ?? user.is_active;
  const canViewGlobal = profile?.can_view_global_dashboard ?? user.can_view_global_dashboard;
  const role = profile?.role ?? user.role;
  const errorText = friendlyError(searchParams?.error);

  return (
    <AppShell title="Mi cuenta" subtitle="Perfil, seguridad y sesion" canViewGlobal={user.can_view_global_dashboard}>
      <div className="mi-account-shell">
        <section className="card mi-account-hero-v2">
          <div className="mi-account-hero-main">
            <p className="workspace-kicker">
              <span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="account" className="crm-icon" /></span>
              <span>Cuenta personal</span>
            </p>
            <h2>{fullName}</h2>
            <p className="mi-account-hero-copy">
              Gestiona tu identidad interna, revisa tu acceso actual y actualiza tu seguridad desde una vista mas clara.
            </p>
            <div className="mi-account-badges-v2">
              <span className={`crm-chip ${isActive ? "crm-chip-status-resuelta" : "crm-chip-status-descartada"}`}>
                {isActive ? "Activo" : "Inactivo"}
              </span>
              <span className="crm-chip crm-chip-impact-global">Rol: {role}</span>
              <span className={`crm-chip ${canViewGlobal ? "crm-chip-status-abierta" : "crm-chip-status-en_revision"}`}>
                Dashboard global {canViewGlobal ? "SI" : "NO"}
              </span>
            </div>
          </div>

          <div className="mi-account-hero-side">
            <div className="mi-account-avatar">{fullName.slice(0, 1).toUpperCase()}</div>
            <div className="mi-account-identity-card">
              <span>Email principal</span>
              <strong>{email}</strong>
            </div>
          </div>
        </section>

        <section className="mi-account-stats-grid">
          <article className="card mi-account-stat-card">
            <span>Rol actual</span>
            <strong>{role}</strong>
            <p>{canViewGlobal ? "Con acceso al area analitica global." : "Acceso limitado a tu operativa."}</p>
          </article>
          <article className="card mi-account-stat-card">
            <span>Alta en CRM</span>
            <strong>{formatDate(profile?.created_at)}</strong>
            <p>Fecha de incorporacion del perfil interno.</p>
          </article>
          <article className="card mi-account-stat-card">
            <span>Ultimo cambio</span>
            <strong>{formatDate(profile?.updated_at)}</strong>
            <p>Ultima actualizacion guardada en tu perfil.</p>
          </article>
        </section>

        <div className="mi-account-layout-v2">
          <section className="card mi-account-section-card">
            <div className="mi-account-section-head">
              <div>
                <p className="workspace-kicker">Perfil</p>
                <h3>Datos visibles dentro del equipo</h3>
                <p className="muted">Mantiene actualizada la forma en la que apareces en el CRM.</p>
              </div>
            </div>

            <form action={updateProfileAction} className="mi-account-form">
              <label className="form-field">
                <span>Nombre completo</span>
                <input
                  name="full_name"
                  defaultValue={profile?.full_name ?? ""}
                  placeholder="Tu nombre"
                  aria-label="Nombre completo"
                />
              </label>

              <div className="mi-account-info-strip">
                <div>
                  <span>Email</span>
                  <strong>{email}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>{isActive ? "Activo" : "Inactivo"}</strong>
                </div>
              </div>

              <div className="form-actions-bar form-actions-bar-start">
                <button type="submit">Guardar perfil</button>
              </div>
            </form>
          </section>

          <section className="card mi-account-section-card mi-account-security-card">
            <div className="mi-account-section-head">
              <div>
                <p className="workspace-kicker">Seguridad</p>
                <h3>Password y sesion</h3>
                <p className="muted">Renueva tu acceso cuando lo necesites y cierra sesion desde aqui.</p>
              </div>
            </div>

            {searchParams?.pwd === "ok" ? <div className="notice notice-success">Password actualizada correctamente.</div> : null}
            {errorText ? <div className="notice notice-error">Error: {errorText}</div> : null}

            <form action={updatePasswordAction} className="mi-account-form">
              <label className="form-field">
                <span>Nueva password</span>
                <input name="new_password" type="password" placeholder="Minimo 8 caracteres" minLength={8} required aria-label="Nueva password" />
              </label>
              <label className="form-field">
                <span>Confirmar password</span>
                <input name="confirm_password" type="password" placeholder="Repite la nueva password" minLength={8} required aria-label="Confirmar password" />
              </label>
              <div className="form-actions-bar form-actions-bar-start">
                <button type="submit">Actualizar password</button>
              </div>
            </form>

            <form action="/auth/logout" method="post" className="mi-account-logout-form">
              <button type="submit" className="mi-account-logout-button">Cerrar sesion</button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
