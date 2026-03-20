import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ManageInvestorsTable } from "@/components/manage-investors-table";
import { requireUser } from "@/lib/auth/session";
import { listInvestorsPage } from "@/lib/db/crm";
import { readInvestorColumnFilters } from "@/lib/ui/investor-table-filters";

export default async function ManageInvestorsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const q = String(Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q ?? "").trim();
  const columnFilters = readInvestorColumnFilters(searchParams);
  const rawReturnTo = String(Array.isArray(searchParams?.return_to) ? searchParams?.return_to[0] : searchParams?.return_to ?? "/investors");
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/investors";

  const investorsPage = await listInvestorsPage({
    page: 1,
    pageSize: 5000,
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

  return (
    <AppShell title="Modificacion multiple" subtitle="Edicion masiva de companias" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{investors.length}</strong> compania{investors.length === 1 ? "" : "s"} en la vista actual
          </div>
          <Link href={returnTo} className="companies-tab">
            Volver a companias
          </Link>
        </div>
        <ManageInvestorsTable investors={investors} returnTo={returnTo} />
      </div>
    </AppShell>
  );
}
