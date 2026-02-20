import { AppShell } from "@/components/app-shell";
import { ActivitiesTable } from "@/components/activities-table";
import { RowsPerPageSelect } from "@/components/rows-per-page-select";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePerPage } from "@/lib/ui/pagination";
import Link from "next/link";

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function hrefFor(page: number, perPage: number): string {
  return `/actividades?page=${page}&per_page=${perPage}`;
}

export default async function ActividadesPage({
  searchParams
}: {
  searchParams?: { page?: string; per_page?: string };
}) {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();
  const requestedPage = normalizePage(searchParams?.page);
  const perPage = normalizePerPage(searchParams?.per_page);
  const from = (requestedPage - 1) * perPage;
  const to = from + (perPage - 1);

  let result = await supabase
    .from("activities")
    .select("id, entity_type, activity_type, title, body, occurred_at, created_by_email", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(from, to);

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);

  if (currentPage !== requestedPage) {
    const safeFrom = (currentPage - 1) * perPage;
    const safeTo = safeFrom + (perPage - 1);
    result = await supabase
      .from("activities")
      .select("id, entity_type, activity_type, title, body, occurred_at, created_by_email", { count: "exact" })
      .order("occurred_at", { ascending: false })
      .range(safeFrom, safeTo);
  }

  const activities = result.data ?? [];
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <AppShell title="Actividades" subtitle="Registro operativo reciente" canViewGlobal={user.can_view_global_dashboard}>
      <div className="companies-shell">
        <div className="companies-top-tabs">
          <button className="companies-tab companies-tab-active">
            Todas las actividades <span className="companies-badge">{totalCount}</span>
          </button>
          <Link href="/actividades/manage" className="activities-edit">
            Modificar actividades
          </Link>
          <Link href="/actividades/new" className="companies-add">
            Añadir
          </Link>
        </div>
        <div className="card">
          <ActivitiesTable activities={activities} storageKeyPrefix={`user:${user.id}:activities`} />

          <div className="companies-pagination" style={{ marginTop: 12 }}>
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
            <RowsPerPageSelect value={perPage} storageKey={`user:${user.id}:activities:per_page`} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
