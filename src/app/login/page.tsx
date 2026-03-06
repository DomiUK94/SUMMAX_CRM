import { redirect } from "next/navigation";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    error?: string;
    reason?: string;
    next?: string;
  };
};

function formatError(error?: string, reason?: string) {
  if (!error) return null;
  if (error === "invalid_credentials") return "Email o contraseña incorrectos.";
  if (error === "forbidden" && reason === "not_in_crm_users") return "Tu usuario no está habilitado en el CRM.";
  if (error === "forbidden" && reason === "user_inactive") return "Tu usuario está inactivo.";
  if (error === "profile_sync_failed") return `No se pudo sincronizar tu perfil${reason ? `: ${reason}` : "."}`;
  return `Error: ${error}${reason ? ` (${reason})` : ""}`;
}

export default function LoginPage({ searchParams }: SearchProps) {
  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/dashboard/me");

    const supabase = createSupabaseServerClient();
    const sourcecrm = createSourceCrmServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      redirect("/login?error=invalid_credentials");
    }

    const { count: usersCount } = await sourcecrm.from("users").select("id", { count: "exact", head: true });
    const isFirstUser = (usersCount ?? 0) === 0;
    let profileError: { code?: string; message?: string; details?: string | null; hint?: string | null } | null = null;

    if (isFirstUser) {
      const result = await sourcecrm.from("users").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? email,
          role: "admin",
          can_view_global_dashboard: true,
          is_active: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      );
      profileError = result.error;
    } else {
      const { data: profile, error: readProfileError } = await sourcecrm
        .from("users")
        .select("id, is_active")
        .eq("id", data.user.id)
        .maybeSingle();
      profileError = readProfileError;
      if (!profile) {
        redirect("/login?error=forbidden&reason=not_in_crm_users");
      }
      if (!profile.is_active) {
        redirect("/login?error=forbidden&reason=user_inactive");
      }
      await sourcecrm
        .from("users")
        .update({
          email: data.user.email ?? email,
          updated_at: new Date().toISOString()
        })
        .eq("id", data.user.id);
    }

    if (profileError) {
      console.error("profile_sync_failed", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });
      const reasonRaw = [profileError.code, profileError.message, profileError.details, profileError.hint]
        .filter(Boolean)
        .join(" | ");
      const reason = encodeURIComponent(reasonRaw || "unknown");
      redirect(`/login?error=profile_sync_failed&reason=${reason}`);
    }

    redirect(next.startsWith("/") ? next : "/dashboard/me");
  }

  const errorMessage = formatError(searchParams?.error, searchParams?.reason);

  return (
    <main className="login-page login-page-simple">
      <section className="login-card card">
        <div className="login-logo-wrap">
          <Image src="/SUMMAX_CRM_Logo.png" alt="SUMMAX CRM" width={240} height={72} className="login-logo" priority />
        </div>
        <div className="login-copy">
          <h2>Acceder</h2>
          <p className="muted">Entra con tu email y tu contraseña.</p>
        </div>
        {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
        <form action={login} className="login-form stack">
          <input type="hidden" name="next" value={searchParams?.next ?? "/dashboard/me"} />
          <label className="stack">
            <span>Email</span>
            <input name="email" required type="email" placeholder="nombre@summax.com" autoComplete="email" />
          </label>
          <label className="stack">
            <span>Password</span>
            <input name="password" required type="password" placeholder="********" autoComplete="current-password" />
          </label>
          <button type="submit">Entrar al CRM</button>
        </form>
      </section>
    </main>
  );
}
