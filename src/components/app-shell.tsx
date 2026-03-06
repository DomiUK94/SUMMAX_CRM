import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { WorkspaceQuickLinks } from "@/components/workspace-quick-links";
import { CrmIcon } from "@/components/ui/crm-icon";

type NavItem = {
  href: string;
  label: string;
  icon: Parameters<typeof CrmIcon>[0]["name"];
  visible?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

function renderNavGroups(groups: NavGroup[]) {
  return groups.map((group) => {
    const items = group.items.filter((item) => item.visible ?? true);
    if (items.length === 0) return null;

    const content = (
      <div className="nav-submenu">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            <span className="nav-link-icon" aria-hidden="true">
              <CrmIcon name={item.icon} className="crm-icon" />
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    );

    if (group.collapsible) {
      return (
        <details key={group.title} className="nav-group nav-group-collapsible" open={group.defaultOpen}>
          <summary className="nav-section-title nav-section-toggle">{group.title}</summary>
          {content}
        </details>
      );
    }

    return (
      <div key={group.title} className="nav-group">
        <div className="nav-section-title">{group.title}</div>
        {content}
      </div>
    );
  });
}

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

  const navGroups: NavGroup[] = [
    {
      title: "Inicio",
      items: [{ href: "/dashboard/me", label: "Mi dashboard", icon: "dashboard" }]
    },
    {
      title: "Operativa",
      items: [
        { href: "/search", label: "Búsqueda global", icon: "search" },
        { href: "/contacts", label: "Contactos", icon: "contacts" },
        { href: "/investors", label: "Cuentas", icon: "companies" },
        { href: "/acuerdos", label: "Negocios", icon: "deals" },
        { href: "/actividades", label: "Actividades", icon: "activity" }
      ]
    },
    {
      title: "Configuración",
      collapsible: true,
      defaultOpen: false,
      items: [
        { href: "/imports", label: "Importaciones", icon: "imports", visible: isAdmin },
        { href: "/exports", label: "Exportaciones", icon: "exports", visible: isAdmin },
        { href: "/changelog", label: "ChangeLog", icon: "changelog" },
        { href: "/sugerencias", label: "Sugerencias y bugs", icon: "feedback" },
        { href: "/usuarios", label: "Usuarios", icon: "users", visible: isAdmin || isManager },
        { href: "/mi-cuenta", label: "Mi cuenta", icon: "account" }
      ]
    },
    {
      title: "Analítica",
      collapsible: true,
      defaultOpen: false,
      items: [
        { href: "/dashboard/general", label: "Dashboard general", icon: "overview", visible: canViewGlobal },
        { href: "/reporte-financiacion", label: "Reporte financiación", icon: "report", visible: canViewGlobal }
      ]
    }
  ];

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="sidebar-brand-wrap">
          <div className="sidebar-brand">
            <Image src="/SUMMAX_CRM_Logo.png" alt="SUMMAX CRM" width={136} height={44} className="sidebar-logo" priority />
          </div>
        </div>

        <nav className="sidebar-nav">{renderNavGroups(navGroups)}</nav>
      </aside>

      <section className="workspace">
        <details className="mobile-nav card">
          <summary>Navegación</summary>
          <div className="mobile-nav-panel">{renderNavGroups(navGroups)}</div>
        </details>

        <header className="workspace-header card">
          <div className="workspace-header-copy">
            <h1>{title}</h1>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <div className="workspace-header-actions">
            <WorkspaceQuickLinks />
          </div>
        </header>
        <div>{children}</div>
      </section>
    </div>
  );
}

