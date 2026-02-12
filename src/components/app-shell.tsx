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
  const nav: NavItem[] = [
    { href: "/dashboard/me", label: "Mi Dashboard" },
    { href: "/dashboard/general", label: "Dashboard General", visible: canViewGlobal },
    { href: "/investors", label: "Fondos" },
    { href: "/contacts", label: "Contactos" },
    { href: "/imports", label: "Importaciones" },
    { href: "/exports", label: "Exportaciones" },
    { href: "/admin/users", label: "Usuarios" }
  ];

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <h2>SUMMAX CRM</h2>
        <nav>
          {nav
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
