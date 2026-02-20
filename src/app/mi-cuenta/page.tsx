import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  return (
    <AppShell title="Mi cuenta" subtitle="Datos de usuario y permisos" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Perfil</h3>
          <form action={updateProfileAction} className="stack" style={{ maxWidth: 560 }}>
            <div>
              <label>Nombre completo</label>
              <input
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                placeholder="Tu nombre"
                style={{ width: "100%" }}
              />
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="submit">Guardar cambios</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Datos de acceso</h3>
          {searchParams?.pwd === "ok" ? <p style={{ color: "#0f766e" }}>Contrasena actualizada.</p> : null}
          {searchParams?.error ? <p style={{ color: "#b91c1c" }}>Error: {searchParams.error}</p> : null}
          <p><strong>Email:</strong> {profile?.email ?? user.email}</p>
          <p><strong>Rol:</strong> {profile?.role ?? user.role}</p>
          <p><strong>Activo:</strong> {(profile?.is_active ?? user.is_active) ? "Si" : "No"}</p>
          <p>
            <strong>Dashboard global:</strong>{" "}
            {(profile?.can_view_global_dashboard ?? user.can_view_global_dashboard) ? "Si" : "No"}
          </p>
          <p>
            <strong>Creado:</strong>{" "}
            {profile?.created_at ? new Date(profile.created_at).toLocaleString("es-ES") : "-"}
          </p>
          <p>
            <strong>Ultima actualizacion:</strong>{" "}
            {profile?.updated_at ? new Date(profile.updated_at).toLocaleString("es-ES") : "-"}
          </p>
          <hr style={{ border: 0, borderTop: "1px solid #e2ebf5", margin: "12px 0" }} />
          <h4 style={{ margin: "0 0 8px 0" }}>Cambiar contrasena</h4>
          <form action={updatePasswordAction} className="stack" style={{ maxWidth: 420 }}>
            <input name="new_password" type="password" placeholder="Nueva contrasena (min 8)" minLength={8} required />
            <input name="confirm_password" type="password" placeholder="Repetir contrasena" minLength={8} required />
            <div className="row" style={{ justifyContent: "start" }}>
              <button type="submit">Actualizar contrasena</button>
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
              Logout
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
