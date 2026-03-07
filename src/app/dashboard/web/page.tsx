import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { getWebDashboardData } from "@/lib/db/dashboard";
import { requireGlobalDashboardAccess } from "@/lib/auth/session";
import { CrmIcon } from "@/components/ui/crm-icon";

type SortField = "lastLoginAt" | "ndaAcceptedAt" | "lastCardOpenedAt";
type SortOrder = "asc" | "desc";

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

function getDateValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function compareNullableDates(a: string | null, b: string | null, order: SortOrder): number {
  const left = getDateValue(a);
  const right = getDateValue(b);

  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  return order === "asc" ? left - right : right - left;
}

function sortArrow(field: SortField, activeField: SortField | null, activeOrder: SortOrder): string {
  if (field !== activeField) return "↕";
  return activeOrder === "asc" ? "↑" : "↓";
}

export default async function WebDashboardPage({
  searchParams
}: {
  searchParams?: {
    email?: string;
    cards_opened_min?: string;
    sort?: string;
    order?: string;
  };
}) {
  const user = await requireGlobalDashboardAccess();
  const webData = await getWebDashboardData();

  const emailFilter = (searchParams?.email ?? "").trim().toLowerCase();
  const cardsOpenedMin = Number((searchParams?.cards_opened_min ?? "").trim() || "0");
  const sortField =
    searchParams?.sort === "lastLoginAt" || searchParams?.sort === "ndaAcceptedAt" || searchParams?.sort === "lastCardOpenedAt"
      ? (searchParams.sort as SortField)
      : null;
  const sortOrder: SortOrder = searchParams?.order === "asc" ? "asc" : "desc";

  const filteredWebRows = webData.rows
    .filter((row) => {
      const matchesEmail = !emailFilter || row.email.toLowerCase().includes(emailFilter);
      const matchesCardsOpened = !cardsOpenedMin || row.cardsOpened >= cardsOpenedMin;
      return matchesEmail && matchesCardsOpened;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      if (sortField === "lastLoginAt") return compareNullableDates(a.lastLoginAt, b.lastLoginAt, sortOrder);
      if (sortField === "ndaAcceptedAt") return compareNullableDates(a.ndaAcceptedAt, b.ndaAcceptedAt, sortOrder);
      return compareNullableDates(a.lastCardOpenedAt, b.lastCardOpenedAt, sortOrder);
    });

  const filteredWebTotals = {
    users: filteredWebRows.length,
    ndaAccepted: filteredWebRows.filter((row) => row.ndaAcceptedAt).length,
    cardsOpened: filteredWebRows.reduce((sum, row) => sum + row.cardsOpened, 0),
    usersWithCardsOpened: filteredWebRows.filter((row) => row.cardsOpened > 0).length
  };

  const buildSortHref = (field: SortField) => {
    const params = new URLSearchParams();
    if (searchParams?.email) params.set("email", searchParams.email);
    if (searchParams?.cards_opened_min) params.set("cards_opened_min", searchParams.cards_opened_min);
    params.set("sort", field);
    params.set("order", sortField === field && sortOrder === "desc" ? "asc" : "desc");
    return `/dashboard/web?${params.toString()}#dashboard-web-table`;
  };

  return (
    <AppShell title="Dashboard Web" subtitle="Actividad y engagement del portal web" canViewGlobal={user.can_view_global_dashboard}>
      <section className="dashboard-hero dashboard-web-hero">
        <div className="card dashboard-highlight-card dashboard-highlight-card-warm dashboard-web-highlight-card">
          <p className="workspace-kicker"><span className="workspace-kicker-icon" aria-hidden="true"><CrmIcon name="dashboard" className="crm-icon" /></span><span>Web</span></p>
          <h2>Actividad por usuario web</h2>
          <p className="muted">Pulsa en Ultimo login, NDA aceptado o Ultima carta abierta para ordenar ascendente o descendente.</p>

        </div>

        <div className="dashboard-web-kpi-grid">
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span>
            <span>NDA aceptado</span>
            <strong>{filteredWebTotals.ndaAccepted}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span>
            <span>Usuarios con aperturas</span>
            <strong>{filteredWebTotals.usersWithCardsOpened}</strong>
          </div>
        </div>
      </section>

      <div id="dashboard-web-table" className="card dashboard-table-card">
        <div className="dashboard-section-head">
          <div>
            <p className="workspace-kicker">Filtros</p>
            <h3>Dashboard Web</h3>
            <p className="muted">Email y aperturas mínimas se filtran abajo. Las fechas solo se ordenan desde la cabecera.</p>
          </div>
        </div>

        <StaticTable
          columns={[
            "Email",
            <Link key="last-login-sort" href={buildSortHref("lastLoginAt")} scroll={false} className="table-sort-link">
              <span>Ultimo login</span>
              <span className="table-sort-arrow">{sortArrow("lastLoginAt", sortField, sortOrder)}</span>
            </Link>,
            <Link key="nda-sort" href={buildSortHref("ndaAcceptedAt")} scroll={false} className="table-sort-link">
              <span>NDA aceptado</span>
              <span className="table-sort-arrow">{sortArrow("ndaAcceptedAt", sortField, sortOrder)}</span>
            </Link>,
            "Cartas abiertas",
            <Link key="last-card-sort" href={buildSortHref("lastCardOpenedAt")} scroll={false} className="table-sort-link">
              <span>Ultima carta abierta</span>
              <span className="table-sort-arrow">{sortArrow("lastCardOpenedAt", sortField, sortOrder)}</span>
            </Link>
          ]}
          headerFilters={[
            <input key="email" type="search" name="email" form="dashboard-web-filters" defaultValue={searchParams?.email ?? ""} placeholder="Filtrar email" />,
            <span key="last-login-empty" className="table-filter-placeholder" aria-hidden="true"></span>,
            <span key="nda-empty" className="table-filter-placeholder" aria-hidden="true"></span>,
            <input key="cards" type="number" min="0" name="cards_opened_min" form="dashboard-web-filters" defaultValue={searchParams?.cards_opened_min ?? ""} placeholder="Mínimo" />,
            <span key="last-card-empty" className="table-filter-placeholder" aria-hidden="true"></span>
          ]}
          rows={filteredWebRows.map((row) => [
            row.email,
            formatDateTime(row.lastLoginAt),
            formatDateTime(row.ndaAcceptedAt),
            String(row.cardsOpened),
            formatDateTime(row.lastCardOpenedAt)
          ])}
          emptyLabel="Sin usuarios para ese filtro."
          emptyHint="Ajusta email o aperturas mínimas para ampliar resultados."
          emptyAction={
            <div className="table-filter-actions">
              <button type="submit" form="dashboard-web-filters">Aplicar filtros</button>
              <Link href="/dashboard/web" className="companies-tab">Limpiar</Link>
            </div>
          }
        />

        <form id="dashboard-web-filters" method="get" className="dashboard-table-filter-form">
          {sortField ? <input type="hidden" name="sort" value={sortField} /> : null}
          <input type="hidden" name="order" value={sortOrder} />
          <div className="form-actions-bar form-actions-bar-start">
            <button type="submit">Aplicar filtros</button>
            <Link href="/dashboard/web" className="companies-tab">Limpiar</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}



