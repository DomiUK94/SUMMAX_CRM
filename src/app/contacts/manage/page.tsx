import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ManageContactsTable } from "@/components/manage-contacts-table";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { listContactsPage, type ContactsTab } from "@/lib/db/crm";
import { readContactColumnFilters } from "@/lib/ui/contact-table-filters";

function normalizeTab(value: string | undefined): ContactsTab {
  if (value === "mine" || value === "all" || value === "unassigned" || value === "in_progress") return value;
  return "mine";
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
  const columnFilters = readContactColumnFilters(searchParams);

  const [contactsPage, { data: owners }] = await Promise.all([
    listContactsPage({
      tab: activeTab,
      userId: user.id,
      page: 1,
      pageSize: 5000,
      columnFilters
    }),
    db.from("users").select("id, email, full_name").eq("is_active", true).order("email", { ascending: true })
  ]);

  const contacts = contactsPage.rows.map((row) => ({
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

  return (
    <AppShell title="Modificacion multiple" subtitle="Edicion masiva de contactos" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{contacts.length}</strong> contacto{contacts.length === 1 ? "" : "s"} en la vista actual
          </div>
          <Link href={returnTo} className="contacts-tab">
            Volver a contactos
          </Link>
        </div>
        <ManageContactsTable contacts={contacts} owners={owners ?? []} returnTo={returnTo} />
      </div>
    </AppShell>
  );
}
