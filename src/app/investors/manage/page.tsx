import { AppShell } from "@/components/app-shell";
import { ManageInvestorsTable } from "@/components/manage-investors-table";
import { RowsPerPageSelect } from "@/components/rows-per-page-select";
import { requireUser } from "@/lib/auth/session";
import { listInvestorsPage } from "@/lib/db/crm";
import { normalizePerPage } from "@/lib/ui/pagination";
import { readInvestorColumnFilters, writeInvestorColumnFiltersToUrlSearchParams } from "@/lib/ui/investor-table-filters";

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function hrefFor(page: number, perPage: number, q: string, returnTo: string, searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  params.set("return_to", returnTo);
  if (q) params.set("q", q);
  writeInvestorColumnFiltersToUrlSearchParams(params, readInvestorColumnFilters(searchParams));
  return `/investors/manage?${params.toString()}`;
}

export default async function ManageInvestorsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const q = String(Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q ?? "").trim();
  const requestedPage = normalizePage(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page);
  const perPage = normalizePerPage(Array.isArray(searchParams?.per_page) ? searchParams?.per_page[0] : searchParams?.per_page);
  const columnFilters = readInvestorColumnFilters(searchParams);
  const rawReturnTo = String(Array.isArray(searchParams?.return_to) ? searchParams?.return_to[0] : searchParams?.return_to ?? "/investors");
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/investors";

  const investorsResult = await listInvestorsPage({
    page: requestedPage,
    pageSize: perPage,
    q,
    columnFilters
  });
  const totalPages = Math.max(1, Math.ceil(investorsResult.totalCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const investorsPage =
    currentPage === requestedPage
      ? investorsResult
      : await listInvestorsPage({
          page: currentPage,
          pageSize: perPage,
          q,
          columnFilters
        });
  const investors = investorsPage.rows.map((row) => ({
    id: row.id,
    name: row.name ?? "",
    category: row.category ?? "",
    website: row.website ?? "",
    strategy: row.strategy ?? "",
    status_name: row.status_name ?? "",
    sector: row.sector ?? "",
    updated_at: row.updated_at ?? null
  }));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <AppShell title="Modificacion multiple" subtitle="Edicion masiva de companias" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{investorsResult.totalCount}</strong> compania{investorsResult.totalCount === 1 ? "" : "s"} en la vista actual
          </div>
        </div>
        <ManageInvestorsTable investors={investors} returnTo={returnTo} />
        <div className="companies-pagination">
          {hasPrev ? (
            <a href={hrefFor(currentPage - 1, perPage, q, returnTo, searchParams)} className="companies-tab">
              Anterior
            </a>
          ) : (
            <button disabled>Anterior</button>
          )}
          <span className="companies-page-current">{currentPage}</span>
          {hasNext ? (
            <a href={hrefFor(currentPage + 1, perPage, q, returnTo, searchParams)} className="companies-tab">
              Siguiente
            </a>
          ) : (
            <button disabled>Siguiente</button>
          )}
          <RowsPerPageSelect value={perPage} storageKey={`user:${user.id}:investors:manage:per_page`} />
        </div>
      </div>
    </AppShell>
  );
}
