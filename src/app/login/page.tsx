import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

export default function LoginPage({ searchParams }: SearchProps) {
  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/dashboard/me");

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      redirect("/login?error=invalid_credentials");
    }

    const { count: usersCount } = await supabase.from("users").select("id", { count: "exact", head: true });
    const isFirstUser = (usersCount ?? 0) === 0;

    const { error: profileError } = await supabase.from("users").upsert(
      {
        id: data.user.id,
        email: data.user.email ?? email,
        role: isFirstUser ? "admin" : "user",
        can_view_global_dashboard: isFirstUser,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (profileError) {
      redirect("/login?error=profile_sync_failed");
    }

    redirect(next.startsWith("/") ? next : "/dashboard/me");
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 420, margin: "48px auto" }}>
        <h1>Login</h1>
        <p>Acceso por email y password.</p>
        {searchParams?.error ? <p style={{ color: "#b91c1c" }}>Error: {searchParams.error}</p> : null}
        <form action={login}>
          <input type="hidden" name="next" value={searchParams?.next ?? "/dashboard/me"} />
          <label>Email</label>
          <input name="email" required type="email" placeholder="nombre@summax.com" style={{ width: "100%", marginBottom: 12 }} />
          <label>Password</label>
          <input name="password" required type="password" placeholder="********" style={{ width: "100%", marginBottom: 12 }} />
          <button type="submit">Entrar</button>
        </form>
      </div>
    </main>
  );
}
