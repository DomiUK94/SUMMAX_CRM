import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { getGlobalDashboardData, getWebDashboardData } from "@/lib/db/dashboard";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";
import { CrmIcon } from "@/components/ui/crm-icon";

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function matchesDateRange(value: string | null, from: string | undefined, to: string | undefined): boolean {
  if (!from && !to) return true;
  if (!value) return false;

  const currentMs = new Date(value).getTime();
  if (Number.isNaN(currentMs)) return false;

  if (from) {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    if (currentMs < fromMs) return false;
  }

  if (to) {
    const toMs = new Date(`${to}T23:59:59.999`).getTime();
    if (currentMs > toMs) return false;
  }

  return true;
}

export default async function GlobalDashboardPage({
  searchParams
}: {
  searchParams?: {
    tab?: string;
    email?: string;
    last_login_from?: string;
    last_login_to?: string;
    nda_from?: string;
    nda_to?: string;
    cards_opened_min?: string;
    last_card_from?: string;
    last_card_to?: string;
  };
}) {
  const user = await requireGlobalDashboardAccess();
  const activeTab = searchParams?.tab === "web" ? "web" : "overview";
  const emailFilter = (searchParams?.email ?? "").trim().toLowerCase();
  const lastLoginFrom = (searchParams?.last_login_from ?? "").trim() || undefined;
  const lastLoginTo = (searchParams?.last_login_to ?? "").trim() || undefined;
  const ndaFrom = (searchParams?.nda_from ?? "").trim() || undefined;
  const ndaTo = (searchParams?.nda_to ?? "").trim() || undefined;
  const cardsOpenedMin = Number((searchParams?.cards_opened_min ?? "").trim() || "0");
  const lastCardFrom = (searchParams?.last_card_from ?? "").trim() || undefined;
  const lastCardTo = (searchParams?.last_card_to ?? "").trim() || undefined;

  const [overviewData, webData] = await Promise.all([
    activeTab === "overview" ? getGlobalDashboardData() : Promise.resolve(null),
    activeTab === "web" ? getWebDashboardData() : Promise.resolve(null)
  ]);

  const filteredWebRows =
    activeTab === "web" && webData
      ? webData.rows.filter((row) => {
          const matchesEmail = !emailFilter || row.email.toLowerCase().includes(emailFilter);
          const matchesLastLogin = matchesDateRange(row.lastLoginAt, lastLoginFrom, lastLoginTo);
          const matchesNda = matchesDateRange(row.ndaAcceptedAt, ndaFrom, ndaTo);
          const matchesCardsOpened = !cardsOpenedMin || row.cardsOpened >= cardsOpenedMin;
          const matchesLastCard = matchesDateRange(row.lastCardOpenedAt, lastCardFrom, lastCardTo);
          return matchesEmail && matchesLastLogin && matchesNda && matchesCardsOpened && matchesLastCard;
        })
      : [];

  const filteredWebTotals =
    activeTab === "web" && webData
      ? {
          users: filteredWebRows.length,
          ndaAccepted: filteredWebRows.filter((row) => row.ndaAcceptedAt).length,
          cardsOpened: filteredWebRows.reduce((sum, row) => sum + row.cardsOpened, 0),
          usersWithCardsOpened: filteredWebRows.filter((row) => row.cardsOpened > 0).length
        }
      : null;

  return (
    <AppShell title="Dashboard General" subtitle="Vista ejecutiva y ritmo del equipo" canViewGlobal={user.can_view_global_dashboard}>
      <div className="companies-top-tabs" style={{ marginBottom: 16 }}>
        <Link href="/dashboard/general" className={`companies-tab ${activeTab === "overview" ? "companies-tab-active" : ""}`}>
          <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Resumen CRM</span>
        </Link>
        <Link href="/dashboard/general?tab=web" className={`companies-tab ${activeTab === "web" ? "companies-tab-active" : ""}`}>
          <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="dashboard" className="crm-icon" /></span><span>Dashboard Web</span>
        </Link>
      </div>

      {activeTab === "overview" && overviewData ? (
        <>
          <section className="dashboard-hero">
            <div className="card dashboard-highlight-card dashboard-highlight-card-warm">
              <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Panorama</span></p>
              <h2>Resumen ejecutivo del CRM</h2>
              <p className="muted">Una lectura rápida del volumen, los pendientes y la actividad reciente del equipo.</p>
              <div className="dashboard-highlight-metric">
                <strong>{overviewData.totals.contacts}</strong>
                <span>contactos activos en seguimiento</span>
              </div>
            </div>

            <div className="dashboard-kpi-grid">
              <div className="card dashboard-kpi-card">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="companies" className="crm-icon" /></span>
                <span>Fondos</span>
                <strong>{overviewData.totals.investors}</strong>
              </div>
              <div className="card dashboard-kpi-card">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span>
                <span>Contactos</span>
                <strong>{overviewData.totals.contacts}</strong>
              </div>
              <div className="card dashboard-kpi-card dashboard-kpi-card-alert">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="warning" className="crm-icon" /></span>
                <span>Pendientes vencidos</span>
                <strong>{overviewData.totals.overdue}</strong>
              </div>
              <div className="card dashboard-kpi-card">
                <span>Próx. 48h</span>
                <strong>{overviewData.totals.meetings48h}</strong>
              </div>
            </div>
          </section>

          <div className="dashboard-split-grid">
            <div className="card dashboard-table-card">
              <div className="dashboard-section-head">
                <div>
                  <p className="workspace-kicker">Distribución</p>
                  <h3>Pipeline por estado</h3>
                </div>
              </div>
              <StaticTable
                columns={["Estado", "Total"]}
                rows={overviewData.byStatus.map((row) => [row.status, String(row.count)])}
                emptyLabel="Sin datos."
                emptyHint="Todavía no hay volumen suficiente para dibujar el embudo por estado."
              />
            </div>

            <div className="card dashboard-table-card">
              <div className="dashboard-section-head">
                <div>
                  <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="warning" className="crm-icon" /></span><span>Alerta</span></p>
                  <h3>Seguimiento bloqueado</h3>
                </div>
              </div>
              <StaticTable
                columns={["Contacto", "Estado", "Próxima acción", "Vence", "Owner", "Últ. update"]}
                rows={overviewData.staleContacts.map((row) => [
                  row.full_name,
                  row.status_name ?? "-",
                  row.next_step ?? "-",
                  row.due_date ?? "-",
                  row.owner_email ?? "-",
                  new Date(row.updated_at).toLocaleDateString("es-ES")
                ])}
                emptyLabel="No hay estancados."
                emptyHint="No hay contactos con señales de bloqueo o seguimiento vencido en este momento."
              />
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "web" && webData && filteredWebTotals ? (
        <>
          <section className="dashboard-hero">
            <div className="card dashboard-highlight-card dashboard-highlight-card-warm">
              <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="dashboard" className="crm-icon" /></span><span>Web</span></p>
              <h2>Actividad por usuario web</h2>
              <p className="muted">Lectura agregada por email usando users, nda_progress y card_progress.</p>
              <div className="dashboard-highlight-metric">
                <strong>{filteredWebTotals.users}</strong>
                <span>usuarios web tras aplicar filtros</span>
              </div>
            </div>

            <div className="dashboard-kpi-grid">
              <div className="card dashboard-kpi-card">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="users" className="crm-icon" /></span>
                <span>Usuarios</span>
                <strong>{filteredWebTotals.users}</strong>
              </div>
              <div className="card dashboard-kpi-card">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span>
                <span>NDA aceptado</span>
                <strong>{filteredWebTotals.ndaAccepted}</strong>
              </div>
              <div className="card dashboard-kpi-card">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="deals" className="crm-icon" /></span>
                <span>Cartas abiertas</span>
                <strong>{filteredWebTotals.cardsOpened}</strong>
              </div>
              <div className="card dashboard-kpi-card">
                <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span>
                <span>Usuarios con aperturas</span>
                <strong>{filteredWebTotals.usersWithCardsOpened}</strong>
              </div>
            </div>
          </section>

          <div className="card dashboard-table-card">
            <div className="dashboard-section-head">
              <div>
                <p className="workspace-kicker">Filtros</p>
                <h3>Dashboard Web</h3>
                <p className="muted">Ahora puedes filtrar también justo debajo de cada columna de la tabla.</p>
              </div>
            </div>

            <StaticTable
              columns={["Email", "Últ. login", "NDA aceptado", "Cartas abiertas", "Última carta abierta"]}
              headerFilters={[
                <input key="email" type="search" name="email" form="dashboard-web-filters" defaultValue={searchParams?.email ?? ""} placeholder="Filtrar email" />,
                <div key="last-login" className="table-filter-stack">
                  <input type="date" name="last_login_from" form="dashboard-web-filters" defaultValue={searchParams?.last_login_from ?? ""} />
                  <input type="date" name="last_login_to" form="dashboard-web-filters" defaultValue={searchParams?.last_login_to ?? ""} />
                </div>,
                <div key="nda" className="table-filter-stack">
                  <input type="date" name="nda_from" form="dashboard-web-filters" defaultValue={searchParams?.nda_from ?? ""} />
                  <input type="date" name="nda_to" form="dashboard-web-filters" defaultValue={searchParams?.nda_to ?? ""} />
                </div>,
                <input key="cards" type="number" min="0" name="cards_opened_min" form="dashboard-web-filters" defaultValue={searchParams?.cards_opened_min ?? ""} placeholder="Mínimo" />,
                <div key="last-card" className="table-filter-stack">
                  <input type="date" name="last_card_from" form="dashboard-web-filters" defaultValue={searchParams?.last_card_from ?? ""} />
                  <input type="date" name="last_card_to" form="dashboard-web-filters" defaultValue={searchParams?.last_card_to ?? ""} />
                </div>
              ]}
              rows={filteredWebRows.map((row) => [
                row.email,
                formatDateTime(row.lastLoginAt),
                formatDateTime(row.ndaAcceptedAt),
                String(row.cardsOpened),
                formatDateTime(row.lastCardOpenedAt)
              ])}
              emptyLabel="Sin usuarios para ese filtro."
              emptyHint="Ajusta email, rangos o aperturas mínimas para ampliar resultados."
              emptyAction={
                <div className="table-filter-actions">
                  <button type="submit" form="dashboard-web-filters">Aplicar filtros</button>
                  <Link href="/dashboard/general?tab=web" className="companies-tab">Limpiar</Link>
                </div>
              }
            />

            <form id="dashboard-web-filters" method="get" className="dashboard-table-filter-form">
              <input type="hidden" name="tab" value="web" />
              <div className="form-actions-bar form-actions-bar-start">
                <button type="submit">Aplicar filtros</button>
                <Link href="/dashboard/general?tab=web" className="companies-tab">Limpiar</Link>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
