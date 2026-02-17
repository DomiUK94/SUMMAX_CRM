import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  visible?: boolean;
};

export function AppShell({
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
  const coreNav: NavItem[] = [
    { href: "/dashboard/me", label: "Mi Dashboard" },
    { href: "/dashboard/general", label: "Dashboard General", visible: canViewGlobal }
  ];

  const crmNav: NavItem[] = [
    { href: "/contacts", label: "Contactos" },
    { href: "/investors", label: "Cuentas" },
    { href: "/acuerdos", label: "Acuerdos" },
    { href: "/actividades", label: "Actividades" },
    { href: "/reporte-financiacion", label: "Reporte financiación" }
  ];

  const opsNav: NavItem[] = [
    { href: "/imports", label: "Importaciones" },
    { href: "/exports", label: "Exportaciones" },
    { href: "/admin/users", label: "Usuarios" }
  ];

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <h2>SUMMAX CRM</h2>
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

          {opsNav
            .filter((item) => item.visible ?? true)
            .map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
        </nav>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <form action="/auth/logout" method="post">
            <button type="submit">Salir</button>
          </form>
        </header>
        <div>{children}</div>
      </section>
    </div>
  );
}
