import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export default async function ExportsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    redirect("/forbidden");
  }

  return (
    <AppShell title="Exportaciones" subtitle="CSV simple y exportacion avanzada en Excel" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card stack">
          <p>Descarga rapida para trabajo externo.</p>
          <div className="row" style={{ justifyContent: "start" }}>
            <Link href="/api/exports/csv?mode=general">Descargar CSV General</Link>
            <Link href="/api/exports/csv?mode=detail">Descargar CSV Detallado</Link>
          </div>
        </div>

        <form action="/api/exports/csv" method="get" className="card stack exports-advanced-form">
          <input type="hidden" name="mode" value="advanced" />

          <div>
            <h3 style={{ margin: 0 }}>Exportacion avanzada</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Selecciona una o varias tablas. El Excel descargado generara una pestaña por tabla elegida.
            </p>
          </div>

          <div className="exports-table-grid">
            <label className="exports-table-option">
              <input type="checkbox" name="table" value="inversion" defaultChecked />
              <span>Companias</span>
            </label>
            <label className="exports-table-option">
              <input type="checkbox" name="table" value="contactos" defaultChecked />
              <span>Contactos</span>
            </label>
            <label className="exports-table-option">
              <input type="checkbox" name="table" value="prospects" />
              <span>Prospectos</span>
            </label>
            <label className="exports-table-option">
              <input type="checkbox" name="table" value="leads" />
              <span>Leads</span>
            </label>
            <label className="exports-table-option">
              <input type="checkbox" name="table" value="opportunities" />
              <span>Opportunities</span>
            </label>
          </div>

          <div className="editor-form-grid editor-form-grid-3">
            <label className="form-field company-detail-field-span-2">
              <span>Busqueda libre</span>
              <input name="q" placeholder="Nombre, email, compania, notas..." />
            </label>
            <label className="form-field">
              <span>Owner email</span>
              <input name="owner_email" placeholder="owner@summax.com" />
            </label>
            <label className="form-field">
              <span>Resolucion</span>
              <select name="resolution" defaultValue="">
                <option value="">Todas</option>
                <option value="open">Open</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="discarded">Discarded</option>
                <option value="not_interested">Not interested</option>
                <option value="converted">Converted</option>
              </select>
            </label>
            <label className="form-field">
              <span>Actualizado desde</span>
              <input name="updated_from" type="date" />
            </label>
            <label className="form-field">
              <span>Actualizado hasta</span>
              <input name="updated_to" type="date" />
            </label>
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="submit" className="button-outline-success">Descargar Excel avanzado</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
