import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function friendlyError(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "pwd_min_8") return "La password debe tener al menos 8 caracteres.";
  if (raw === "pwd_mismatch") return "Las passwords no coinciden.";
  return raw;
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

  const errorText = friendlyError(searchParams?.error);

  return (
    <AppShell title="Mi cuenta" subtitle="Perfil, seguridad y sesion" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack mi-account-wrap">
        <section className="card mi-account-hero">
          <div>
            <div className="mi-account-eyebrow">Workspace profile</div>
            <h3 style={{ margin: "6px 0 4px" }}>{profile?.full_name?.trim() || "Usuario sin nombre"}</h3>
            <div className="muted">{profile?.email ?? user.email}</div>
          </div>
          <div className="mi-account-badges">
            <span className={`crm-chip ${(profile?.is_active ?? user.is_active) ? "crm-chip-status-resuelta" : "crm-chip-status-descartada"}`}>
              {(profile?.is_active ?? user.is_active) ? "Activo" : "Inactivo"}
            </span>
            <span className="crm-chip crm-chip-impact-global">Rol: {profile?.role ?? user.role}</span>
            <span className={`crm-chip ${(profile?.can_view_global_dashboard ?? user.can_view_global_dashboard) ? "crm-chip-status-abierta" : "crm-chip-status-en_revision"}`}>
              Dashboard global {(profile?.can_view_global_dashboard ?? user.can_view_global_dashboard) ? "SI" : "NO"}
            </span>
          </div>
        </section>

        <div className="mi-account-grid">
          <section className="card mi-account-panel">
            <h3>Perfil</h3>
            <p className="muted">Actualiza tus datos de visualizacion interna.</p>
            <form action={updateProfileAction} className="stack" style={{ maxWidth: 560 }}>
              <div>
                <label>Nombre completo</label>
                <input
                  name="full_name"
                  defaultValue={profile?.full_name ?? ""}
                  placeholder="Tu nombre"
                  style={{ width: "100%" }}
                  aria-label="Nombre completo"
                />
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="submit">Guardar perfil</button>
              </div>
            </form>
          </section>

          <section className="card mi-account-panel">
            <h3>Seguridad y acceso</h3>
            {searchParams?.pwd === "ok" ? <p style={{ color: "#0f766e" }}>Password actualizada correctamente.</p> : null}
            {errorText ? <p style={{ color: "#b91c1c" }}>Error: {errorText}</p> : null}
            <div className="mi-account-meta">
              <div><strong>Creado:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleString("es-ES") : "-"}</div>
              <div><strong>Ultima actualizacion:</strong> {profile?.updated_at ? new Date(profile.updated_at).toLocaleString("es-ES") : "-"}</div>
            </div>
            <hr style={{ border: 0, borderTop: "1px solid #e2ebf5", margin: "12px 0" }} />
            <h4 style={{ margin: "0 0 8px 0" }}>Cambiar password</h4>
            <form action={updatePasswordAction} className="stack" style={{ maxWidth: 460 }}>
              <input name="new_password" type="password" placeholder="Nueva password (min 8)" minLength={8} required aria-label="Nueva password" />
              <input name="confirm_password" type="password" placeholder="Repetir password" minLength={8} required aria-label="Confirmar password" />
              <div className="row" style={{ justifyContent: "start", gap: 10 }}>
                <button type="submit">Actualizar password</button>
              </div>
            </form>
            <form action="/auth/logout" method="post" style={{ marginTop: 12 }}>
              <button
                type="submit"
                style={{
                  background: "linear-gradient(145deg, #ef4444 0%, #b91c1c 100%)",
                  borderColor: "#991b1b",
                  color: "#fff"
                }}
              >
                Cerrar sesion
              </button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
