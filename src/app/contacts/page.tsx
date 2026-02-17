import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { listContacts } from "@/lib/db/crm";

export default async function ContactsPage() {
  const user = await requireUser();
  const contacts = await listContacts();

  return (
    <AppShell title="Contactos" subtitle="Vista CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="contacts-shell">
        <div className="contacts-top-tabs">
          <button className="contacts-select">Contacts ▾</button>
          <button className="contacts-tab contacts-tab-active">All contacts <span className="contacts-badge">{contacts.length}</span></button>
          <button className="contacts-tab">Open opportunities</button>
          <button className="contacts-tab">Need follow up</button>
          <button className="contacts-tab">In progress</button>
          <button className="contacts-plus">+</button>
          <button className="contacts-add">Add contacts ▾</button>
        </div>

        <div className="contacts-toolbar card">
          <div className="contacts-toolbar-row">
            <input className="contacts-search" placeholder="Search" />
            <div className="contacts-actions">
              <button>Table view ▾</button>
              <button>Edit columns</button>
              <button>Filters</button>
              <button>Sort</button>
              <button>Export</button>
              <button>Save</button>
            </div>
          </div>

          <div className="contacts-filters-row">
            <button className="contacts-filter-chip">Contact owner ▾</button>
            <button className="contacts-filter-chip">Create date ▾</button>
            <button className="contacts-filter-chip">Last activity date ▾</button>
            <button className="contacts-filter-chip">Lead status ▾</button>
            <button className="contacts-filter-chip">+ More</button>
            <button className="contacts-filter-chip">Advanced filters</button>
          </div>

          <div className="contacts-table-wrap">
            <table className="contacts-crm-table">
              <thead>
                <tr>
                  <th><input type="checkbox" /></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Company Name</th>
                  <th>Lead Status</th>
                  <th>Lifecycle Stage</th>
                  <th>Buying Role</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" /></td>
                    <td>{c.full_name}</td>
                    <td>{c.email ?? "--"}</td>
                    <td>{c.phone ?? "--"}</td>
                    <td>{c.investor_name ?? "--"}</td>
                    <td>{c.status_name ?? "--"}</td>
                    <td>{c.status_name ? "Opportunity" : "--"}</td>
                    <td>--</td>
                  </tr>
                ))}
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Sin contactos.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="contacts-pagination">
            <button>Prev</button>
            <span className="contacts-page-current">1</span>
            <button>Next</button>
            <span>25 per page ▾</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
