import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type NavItem = {
  href: string;
  label: string;
  visible?: boolean;
};

export async function AppShell({
  title,
  subtitle,
  children,
  canViewGlobal
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  canViewGlobal: boolean;
}) {
  const auth = createSupabaseServerClient();
  const sourcecrm = createSourceCrmServerClient();
  const {
    data: { user }
  } = await auth.auth.getUser();
  const { data: profile } = user
    ? await sourcecrm.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  const coreNav: NavItem[] = [
    { href: "/dashboard/me", label: "Mi Dashboard" },
    { href: "/dashboard/general", label: "Dashboard General", visible: canViewGlobal }
  ];

  const crmNav: NavItem[] = [
    { href: "/search", label: "Busqueda global" },
    { href: "/contacts", label: "Contactos" },
    { href: "/investors", label: "Cuentas" },
    { href: "/acuerdos", label: "Negocios" },
    { href: "/actividades", label: "Actividades" }
  ];

  const configNav: NavItem[] = [
    { href: "/imports", label: "Importaciones" },
    { href: "/exports", label: "Exportaciones" },
    { href: "/sugerencias", label: "Sugerencias" },
    { href: "/usuarios", label: "Usuarios", visible: isAdmin || isManager },
    { href: "/mi-cuenta", label: "Mi cuenta" }
  ];

  const analyticsNav: NavItem[] = [{ href: "/reporte-financiacion", label: "Reporte financiación" }];

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Image src="/SUMMAX_CRM_Logo.png" alt="SUMMAX CRM" width={120} height={30} className="sidebar-logo" priority />
        </div>
        <nav>
          {coreNav
            .filter((item) => item.visible ?? true)
            .map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}

          <div className="nav-section-title">CRM</div>
          <div className="nav-submenu">
            {crmNav
              .filter((item) => item.visible ?? true)
              .map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
          </div>

          <div className="nav-section-title">Configuración</div>
          <div className="nav-submenu">
            {configNav
              .filter((item) => item.visible ?? true)
              .map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
          </div>

          <div className="nav-section-title">Analítica</div>
          <div className="nav-submenu">
            {analyticsNav
              .filter((item) => item.visible ?? true)
              .map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
          </div>
        </nav>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <form method="get" action="/search" className="workspace-search-form">
            <input name="q" placeholder="Busqueda global..." className="workspace-search-input" />
            <button type="submit">Buscar</button>
          </form>
        </header>
        <div>{children}</div>
      </section>
    </div>
  );
}
