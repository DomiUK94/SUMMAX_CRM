import { AppShell } from "@/components/app-shell";
import { ContactsTable } from "@/components/contacts-table";
import { QueryParamMemory } from "@/components/query-param-memory";
import { RowsPerPageSelect } from "@/components/rows-per-page-select";
import { requireUser } from "@/lib/auth/session";
import { normalizePerPage } from "@/lib/ui/pagination";
import { readContactColumnFilters, writeContactColumnFiltersToUrlSearchParams, type ContactColumnFilterState } from "@/lib/ui/contact-table-filters";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import Link from "next/link";
import { getContactQuickCounts, listContactsPage, type ContactsTab } from "@/lib/db/crm";
import { CrmIcon } from "@/components/ui/crm-icon";

const TABS: Array<{ key: ContactsTab; label: string }> = [
  { key: "mine", label: "Mis contactos" },
  { key: "all", label: "Todos los contactos" },
  { key: "unassigned", label: "Pendiente de seguimiento" },
  { key: "in_progress", label: "En progreso" }
];

function normalizeTab(value: string | undefined): ContactsTab {
  if (value === "mine" || value === "all" || value === "unassigned" || value === "in_progress") return value;
  return "mine";
}

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function hrefFor(tab: ContactsTab, page: number, perPage: number, columnFilters: ContactColumnFilterState): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  writeContactColumnFiltersToUrlSearchParams(params, columnFilters);
  return `/contacts?${params.toString()}`;
}

export default async function ContactsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const crmDb = createSourceCrmServerClient();
  const activeTab = normalizeTab(Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab);
  const requestedPage = normalizePage(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page);
  const perPage = normalizePerPage(Array.isArray(searchParams?.per_page) ? searchParams?.per_page[0] : searchParams?.per_page);
  const columnFilters = readContactColumnFilters(searchParams);

  let { rows: contacts, filteredCount, totalCount } = await listContactsPage({
    tab: activeTab,
    userId: user.id,
    page: requestedPage,
    pageSize: perPage,
    columnFilters
  });

  const totalPages = Math.max(1, Math.ceil(filteredCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);

  if (requestedPage !== currentPage) {
    const fallback = await listContactsPage({
      tab: activeTab,
      userId: user.id,
      page: currentPage,
      pageSize: perPage,
      columnFilters
    });
    contacts = fallback.rows;
    filteredCount = fallback.filteredCount;
    totalCount = fallback.totalCount;
  }

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const [mineCountRes, unassignedCountRes, inProgressCountRes] = await Promise.all([
    listContactsPage({ tab: "mine", userId: user.id, page: 1, pageSize: 1 }),
    listContactsPage({ tab: "unassigned", userId: user.id, page: 1, pageSize: 1 }),
    listContactsPage({ tab: "in_progress", userId: user.id, page: 1, pageSize: 1 })
  ]);
  const quickCounts = await getContactQuickCounts({
    tab: activeTab,
    userId: user.id,
    columnFilters
  });
  const tabCounts: Record<ContactsTab, number> = {
    mine: mineCountRes.filteredCount,
    all: totalCount,
    unassigned: unassignedCountRes.filteredCount,
    in_progress: inProgressCountRes.filteredCount
  };
  const { data: owners } = await crmDb
    .from("users")
    .select("id, email, full_name")
    .eq("is_active", true)
    .order("email", { ascending: true });

  return (
    <AppShell title="Contactos" subtitle="Vista CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="contacts-shell">
        <QueryParamMemory
          param="tab"
          value={activeTab}
          hasValue={Boolean(searchParams?.tab)}
          storageKey={`user:${user.id}:contacts:tab`}
        />
        <div className="contacts-top-tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={hrefFor(tab.key, 1, perPage, columnFilters)}
              className={`contacts-tab ${activeTab === tab.key ? "contacts-tab-active" : ""} ${tab.key === "unassigned" ? "contacts-tab-warning" : ""}`}
            >
              <span className="module-tab-icon" aria-hidden="true"><CrmIcon name={tab.key === "mine" ? "contacts" : tab.key === "all" ? "overview" : tab.key === "unassigned" ? "warning" : "activity"} className="crm-icon" /></span>
              <span>{tab.label}</span>
              <span className="contacts-badge">{tabCounts[tab.key]}</span>
            </Link>
          ))}
        </div>
        <div className="contacts-toolbar card">
          <ContactsTable contacts={contacts} owners={owners ?? []} quickCounts={quickCounts} storageKeyPrefix={`user:${user.id}:contacts`} />

          <div className="contacts-pagination">
            {hasPrev ? (
              <Link href={hrefFor(activeTab, currentPage - 1, perPage, columnFilters)} className="contacts-tab">
                Anterior
              </Link>
            ) : (
              <button disabled>Anterior</button>
            )}
            <span className="contacts-page-current">{currentPage}</span>
            {hasNext ? (
              <Link href={hrefFor(activeTab, currentPage + 1, perPage, columnFilters)} className="contacts-tab">
                Siguiente
              </Link>
            ) : (
              <button disabled>Siguiente</button>
            )}
            <RowsPerPageSelect value={perPage} storageKey={`user:${user.id}:contacts:per_page`} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}


