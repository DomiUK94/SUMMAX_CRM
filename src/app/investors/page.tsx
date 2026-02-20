import { AppShell } from "@/components/app-shell";
import { InvestorsTable } from "@/components/investors-table";
import { RowsPerPageSelect } from "@/components/rows-per-page-select";
import { requireUser } from "@/lib/auth/session";
import { normalizePerPage } from "@/lib/ui/pagination";
import Link from "next/link";
import { listInvestorsPage } from "@/lib/db/crm";

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function hrefFor(page: number, perPage: number): string {
  return `/investors?page=${page}&per_page=${perPage}`;
}

export default async function InvestorsPage({
  searchParams
}: {
  searchParams?: { page?: string; per_page?: string };
}) {
  const user = await requireUser();
  const requestedPage = normalizePage(searchParams?.page);
  const perPage = normalizePerPage(searchParams?.per_page);

  let { rows: investors, totalCount } = await listInvestorsPage({
    page: requestedPage,
    pageSize: perPage
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);

  if (requestedPage !== currentPage) {
    const fallback = await listInvestorsPage({
      page: currentPage,
      pageSize: perPage
    });
    investors = fallback.rows;
    totalCount = fallback.totalCount;
  }

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <AppShell title="Cuentas" subtitle="Vista CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="companies-shell">
        <div className="companies-top-tabs">
          <button className="companies-tab companies-tab-active">
            Todas las cuentas <span className="companies-badge">{totalCount}</span>
          </button>
          <Link href="/investors/manage" className="companies-edit">
            Modificar datos cuentas
          </Link>
          <button className="companies-add">Añadir</button>
        </div>
        <div className="companies-toolbar card">
          <InvestorsTable investors={investors} storageKeyPrefix={`user:${user.id}:investors`} />

          <div className="companies-pagination">
            {hasPrev ? (
              <Link href={hrefFor(currentPage - 1, perPage)} className="companies-tab">
                Anterior
              </Link>
            ) : (
              <button disabled>Anterior</button>
            )}
            <span className="companies-page-current">{currentPage}</span>
            {hasNext ? (
              <Link href={hrefFor(currentPage + 1, perPage)} className="companies-tab">
                Siguiente
              </Link>
            ) : (
              <button disabled>Siguiente</button>
            )}
            <RowsPerPageSelect value={perPage} storageKey={`user:${user.id}:investors:per_page`} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
