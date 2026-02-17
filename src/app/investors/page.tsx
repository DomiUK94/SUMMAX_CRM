import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { listInvestors } from "@/lib/db/crm";

export default async function InvestorsPage() {
  const user = await requireUser();
  const investors = await listInvestors();

  return (
    <AppShell title="Cuentas" subtitle="Vista CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="companies-shell">
        <div className="companies-top-tabs">
          <button className="companies-select">Companies ▾</button>
          <button className="companies-tab companies-tab-active">All companies <span className="companies-badge">{investors.length}</span></button>
          <button className="companies-tab">My companies</button>
          <button className="companies-plus">+</button>
          <button className="companies-add">Add companies ▾</button>
        </div>

        <div className="companies-toolbar card">
          <div className="companies-toolbar-row">
            <input className="companies-search" placeholder="Search" />
            <div className="companies-actions">
              <button>Table view ▾</button>
              <button>Edit columns</button>
              <button>Filters</button>
              <button>Sort</button>
              <button>Export</button>
              <button>Save</button>
            </div>
          </div>

          <div className="companies-filters-row">
            <button className="companies-filter-chip">Company owner ▾</button>
            <button className="companies-filter-chip">Create date ▾</button>
            <button className="companies-filter-chip">Last activity date ▾</button>
            <button className="companies-filter-chip">Lead status ▾</button>
            <button className="companies-filter-chip">+ More</button>
            <button className="companies-filter-chip">Advanced filters</button>
          </div>

          <div className="companies-table-wrap">
            <table className="companies-crm-table">
              <thead>
                <tr>
                  <th><input type="checkbox" /></th>
                  <th>Company name</th>
                  <th>Company owner</th>
                  <th>Create Date (GMT+1)</th>
                  <th>Phone Number</th>
                  <th>Last Activity Date (GMT+1)</th>
                  <th>City</th>
                  <th>Country/Region</th>
                </tr>
              </thead>
              <tbody>
                {investors.map((inv) => (
                  <tr key={inv.id}>
                    <td><input type="checkbox" /></td>
                    <td>{inv.name}</td>
                    <td>No owner</td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td>{inv.category ?? "--"}</td>
                    <td>{inv.website ?? "--"}</td>
                  </tr>
                ))}
                {investors.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Sin cuentas.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="companies-pagination">
            <button>Prev</button>
            <span className="companies-page-current">1</span>
            <button>Next</button>
            <span>25 per page ▾</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
