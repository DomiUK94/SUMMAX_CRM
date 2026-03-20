import { AppShell } from "@/components/app-shell";
import { ManageContactsTable } from "@/components/manage-contacts-table";
import { RowsPerPageSelect } from "@/components/rows-per-page-select";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { listContactsPage, type ContactsTab } from "@/lib/db/crm";
import { normalizePerPage } from "@/lib/ui/pagination";
import { readContactColumnFilters, writeContactColumnFiltersToUrlSearchParams } from "@/lib/ui/contact-table-filters";

function normalizeTab(value: string | undefined): ContactsTab {
  if (value === "mine" || value === "all" || value === "unassigned" || value === "in_progress") return value;
  return "mine";
}

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function hrefFor(tab: ContactsTab, page: number, perPage: number, returnTo: string, searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  params.set("return_to", returnTo);
  writeContactColumnFiltersToUrlSearchParams(params, readContactColumnFilters(searchParams));
  return `/contacts/manage?${params.toString()}`;
}

export default async function ManageContactsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const rawReturnTo = String(Array.isArray(searchParams?.return_to) ? searchParams?.return_to[0] : searchParams?.return_to ?? "/contacts");
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/contacts";
  const activeTab = normalizeTab(Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab);
  const requestedPage = normalizePage(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page);
  const perPage = normalizePerPage(Array.isArray(searchParams?.per_page) ? searchParams?.per_page[0] : searchParams?.per_page);
  const columnFilters = readContactColumnFilters(searchParams);

  const [contactsPage, { data: owners }] = await Promise.all([
    listContactsPage({
      tab: activeTab,
      userId: user.id,
      page: requestedPage,
      pageSize: perPage,
      columnFilters
    }),
    db.from("users").select("id, email, full_name").eq("is_active", true).order("email", { ascending: true })
  ]);

  const totalPages = Math.max(1, Math.ceil(contactsPage.filteredCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageData =
    currentPage === requestedPage
      ? contactsPage
      : await listContactsPage({
          tab: activeTab,
          userId: user.id,
          page: currentPage,
          pageSize: perPage,
          columnFilters
        });

  const contacts = pageData.rows.map((row) => ({
    id: row.id,
    investor_name: row.investor_name ?? null,
    full_name: row.full_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    role: row.role ?? "",
    other_contact: row.other_contact ?? "",
    linkedin: row.linkedin ?? "",
    comments: row.comments ?? "",
    is_financier: row.is_financier,
    is_prescriber: row.is_prescriber,
    owner_user_id: row.owner_user_id ?? "",
    owner_email: row.owner_email ?? null,
    updated_at: row.updated_at ?? null
  }));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <AppShell title="Modificacion multiple" subtitle="Edicion masiva de contactos" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{pageData.filteredCount}</strong> contacto{pageData.filteredCount === 1 ? "" : "s"} en la vista actual
          </div>
        </div>
        <ManageContactsTable contacts={contacts} owners={owners ?? []} returnTo={returnTo} />
        <div className="contacts-pagination">
          {hasPrev ? (
            <a href={hrefFor(activeTab, currentPage - 1, perPage, returnTo, searchParams)} className="contacts-tab">
              Anterior
            </a>
          ) : (
            <button disabled>Anterior</button>
          )}
          <span className="contacts-page-current">{currentPage}</span>
          {hasNext ? (
            <a href={hrefFor(activeTab, currentPage + 1, perPage, returnTo, searchParams)} className="contacts-tab">
              Siguiente
            </a>
          ) : (
            <button disabled>Siguiente</button>
          )}
          <RowsPerPageSelect value={perPage} storageKey={`user:${user.id}:contacts:manage:per_page`} />
        </div>
      </div>
    </AppShell>
  );
}
