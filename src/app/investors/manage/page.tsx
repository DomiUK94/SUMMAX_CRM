import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { canManageCrmBulkEdits } from "@/lib/auth/permissions";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    ok?: string;
    error?: string;
    q?: string;
  };
};

export default async function ManageInvestorsPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  if (!canManageCrmBulkEdits(user)) {
    redirect("/forbidden");
  }
  const db = createSourceCrmServerClient();
  const q = String(searchParams?.q ?? "").trim();

  async function updateInvestorsBulkAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!canManageCrmBulkEdits(actor)) {
      redirect("/forbidden");
    }
    const source = createSourceCrmServerClient();
    const ids = formData.getAll("company_ids").map((v) => String(v)).filter(Boolean);

    if (ids.length === 0) {
      redirect("/investors/manage?error=no_rows");
    }

    for (const id of ids) {
      const payload = {
        compania: String(formData.get(`compania_${id}`) ?? "").trim() || null,
        vertical: String(formData.get(`vertical_${id}`) ?? "").trim() || null,
        web: String(formData.get(`web_${id}`) ?? "").trim() || null,
        sede: String(formData.get(`sede_${id}`) ?? "").trim() || null,
        tamano_empresa: String(formData.get(`tamano_empresa_${id}`) ?? "").trim() || null,
        prioridad: String(formData.get(`prioridad_${id}`) ?? "").trim() || null,
        inversion_minima: String(formData.get(`inversion_minima_${id}`) ?? "").trim() || null,
        inversion_maxima: String(formData.get(`inversion_maxima_${id}`) ?? "").trim() || null,
        comentarios: String(formData.get(`comentarios_${id}`) ?? "").trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await source.from("inversion").update(payload).eq("company_id", Number(id));
      if (error) {
        redirect(`/investors/manage?error=${encodeURIComponent(error.message)}`);
      }
    }

    revalidatePath("/investors");
    revalidatePath("/investors/manage");
    redirect("/investors/manage?ok=1");
  }

  let investorsQuery = await db
    .from("inversion")
    .select("company_id, compania, vertical, web, sede, tamano_empresa, prioridad, inversion_minima, inversion_maxima, comentarios, updated_at")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (q) {
    const pattern = `%${q}%`;
    investorsQuery = await db
      .from("inversion")
      .select("company_id, compania, vertical, web, sede, tamano_empresa, prioridad, inversion_minima, inversion_maxima, comentarios, updated_at")
      .or(
        `compania.ilike.${pattern},vertical.ilike.${pattern},web.ilike.${pattern},sede.ilike.${pattern},tamano_empresa.ilike.${pattern},prioridad.ilike.${pattern},comentarios.ilike.${pattern}`
      )
      .order("updated_at", { ascending: false })
      .limit(120);
  }

  const { data: investors } = investorsQuery;

  return (
    <AppShell title="Modificar datos cuentas" subtitle="Edicion masiva" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card">
        {searchParams?.ok === "1" ? <p style={{ color: "#0f766e" }}>Cambios guardados correctamente.</p> : null}
        {searchParams?.error ? <p style={{ color: "#b91c1c" }}>Error: {searchParams.error}</p> : null}

        <form method="get" className="entity-toolbar" style={{ marginBottom: 12 }}>
          <input
            className="toolbar-search"
            name="q"
            defaultValue={q}
            placeholder="Filtra cuentas por cualquier campo visible"
          />
          <button type="submit">Filtrar</button>
          {q ? (
            <a href="/investors/manage" className="contacts-tab">
              Limpiar
            </a>
          ) : null}
        </form>

        <form action={updateInvestorsBulkAction} className="stack">
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="submit">Guardar cambios masivos</button>
          </div>

          <div className="contacts-table-wrap">
            <table className="companies-crm-table">
              <thead>
                <tr>
                  <th>Compania</th>
                  <th>Vertical</th>
                  <th>Web</th>
                  <th>Sede</th>
                  <th>Tamano</th>
                  <th>Prioridad</th>
                  <th>Inversion minima</th>
                  <th>Inversion maxima</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {(investors ?? []).map((inv) => {
                  const id = String(inv.company_id);
                  return (
                    <tr key={id}>
                      <td>
                        <input type="hidden" name="company_ids" value={id} />
                        <input name={`compania_${id}`} defaultValue={inv.compania ?? ""} />
                      </td>
                      <td><input name={`vertical_${id}`} defaultValue={inv.vertical ?? ""} /></td>
                      <td><input name={`web_${id}`} defaultValue={inv.web ?? ""} /></td>
                      <td><input name={`sede_${id}`} defaultValue={inv.sede ?? ""} /></td>
                      <td><input name={`tamano_empresa_${id}`} defaultValue={inv.tamano_empresa ?? ""} /></td>
                      <td><input name={`prioridad_${id}`} defaultValue={inv.prioridad ?? ""} /></td>
                      <td><input name={`inversion_minima_${id}`} defaultValue={inv.inversion_minima ?? ""} /></td>
                      <td><input name={`inversion_maxima_${id}`} defaultValue={inv.inversion_maxima ?? ""} /></td>
                      <td><input name={`comentarios_${id}`} defaultValue={inv.comentarios ?? ""} /></td>
                    </tr>
                  );
                })}
                {(investors ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={9}>Sin cuentas.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
