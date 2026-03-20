import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CrmIcon } from "@/components/ui/crm-icon";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";
import { listVision360Contacts, listVision360Investors } from "@/lib/db/dashboard-360";

export default async function Vision360LandingPage({
  searchParams
}: {
  searchParams?: {
    contact_q?: string;
    company_q?: string;
  };
}) {
  const user = await requireGlobalDashboardAccess();
  const contactQuery = String(searchParams?.contact_q ?? "").trim();
  const companyQuery = String(searchParams?.company_q ?? "").trim();

  const [contacts, companies] = await Promise.all([
    listVision360Contacts(contactQuery),
    listVision360Investors(companyQuery)
  ]);

  return (
    <AppShell title="Visión 360" subtitle="Entrada analítica a contacto y compañía" canViewGlobal={user.can_view_global_dashboard}>
      <div className="dashboard-360-landing-grid">
        <section className="card dashboard-360-landing-card">
          <div className="dashboard-360-section-head">
            <div>
              <p className="workspace-kicker">
                <span className="workspace-kicker-icon" aria-hidden="true">
                  <CrmIcon name="contacts" className="crm-icon" />
                </span>
                <span>Contactos</span>
              </p>
              <h3>Visión 360 contacto</h3>
              <p className="muted">Busca un contacto o entra a uno reciente sin pasar por el listado operativo.</p>
            </div>
          </div>

          <form method="get" className="dashboard-360-search-form">
            <input
              type="search"
              name="contact_q"
              defaultValue={contactQuery}
              placeholder="Buscar por contacto, compañía o email"
            />
            {companyQuery ? <input type="hidden" name="company_q" value={companyQuery} /> : null}
            <button type="submit">Buscar</button>
          </form>

          <div className="dashboard-360-landing-list">
            {contacts.length > 0 ? (
              contacts.map((item) => (
                <Link key={item.id} href={item.href} className="dashboard-360-landing-item">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <small>Último cambio: {item.updatedAt}</small>
                </Link>
              ))
            ) : (
              <div className="table-empty-state">
                <strong>Sin contactos para esta búsqueda.</strong>
                <p>Prueba con otro nombre, compañía o email.</p>
              </div>
            )}
          </div>
        </section>

        <section className="card dashboard-360-landing-card">
          <div className="dashboard-360-section-head">
            <div>
              <p className="workspace-kicker">
                <span className="workspace-kicker-icon" aria-hidden="true">
                  <CrmIcon name="companies" className="crm-icon" />
                </span>
                <span>Compañías</span>
              </p>
              <h3>Visión 360 compañía</h3>
              <p className="muted">Acceso rápido a la cuenta, sus relaciones, su pipeline y sus documentos.</p>
            </div>
          </div>

          <form method="get" className="dashboard-360-search-form">
            {contactQuery ? <input type="hidden" name="contact_q" value={contactQuery} /> : null}
            <input
              type="search"
              name="company_q"
              defaultValue={companyQuery}
              placeholder="Buscar por compañía, categoría o web"
            />
            <button type="submit">Buscar</button>
          </form>

          <div className="dashboard-360-landing-list">
            {companies.length > 0 ? (
              companies.map((item) => (
                <Link key={item.id} href={item.href} className="dashboard-360-landing-item">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <small>Último cambio: {item.updatedAt}</small>
                </Link>
              ))
            ) : (
              <div className="table-empty-state">
                <strong>Sin compañías para esta búsqueda.</strong>
                <p>Prueba con otro nombre, vertical o web.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
