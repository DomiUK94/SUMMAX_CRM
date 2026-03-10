import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { requireUser } from "@/lib/auth/session";
import { canManageCrmBulkEdits } from "@/lib/auth/permissions";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    ok?: string;
    error?: string;
    company?: string;
    vertical?: string;
    web?: string;
    sede?: string;
    size?: string;
    priority?: string;
    minInvestment?: string;
    maxInvestment?: string;
    comments?: string;
  };
};

export default async function ManageInvestorsPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  if (!canManageCrmBulkEdits(user)) {
    redirect("/forbidden");
  }
  const db = createSourceCrmServerClient();
  const filters = {
    company: String(searchParams?.company ?? "").trim(),
    vertical: String(searchParams?.vertical ?? "").trim(),
    web: String(searchParams?.web ?? "").trim(),
    sede: String(searchParams?.sede ?? "").trim(),
    size: String(searchParams?.size ?? "").trim(),
    priority: String(searchParams?.priority ?? "").trim(),
    minInvestment: String(searchParams?.minInvestment ?? "").trim(),
    maxInvestment: String(searchParams?.maxInvestment ?? "").trim(),
    comments: String(searchParams?.comments ?? "").trim()
  };

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

  let investorsQuery = db
    .from("inversion")
    .select("company_id, compania, vertical, web, sede, tamano_empresa, prioridad, inversion_minima, inversion_maxima, comentarios, updated_at")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (filters.company) {
    investorsQuery = investorsQuery.ilike("compania", `%${filters.company}%`);
  }
  if (filters.vertical) {
    investorsQuery = investorsQuery.ilike("vertical", `%${filters.vertical}%`);
  }
  if (filters.web) {
    investorsQuery = investorsQuery.ilike("web", `%${filters.web}%`);
  }
  if (filters.sede) {
    investorsQuery = investorsQuery.ilike("sede", `%${filters.sede}%`);
  }
  if (filters.size) {
    investorsQuery = investorsQuery.ilike("tamano_empresa", `%${filters.size}%`);
  }
  if (filters.priority) {
    investorsQuery = investorsQuery.ilike("prioridad", `%${filters.priority}%`);
  }
  if (filters.minInvestment) {
    investorsQuery = investorsQuery.ilike("inversion_minima", `%${filters.minInvestment}%`);
  }
  if (filters.maxInvestment) {
    investorsQuery = investorsQuery.ilike("inversion_maxima", `%${filters.maxInvestment}%`);
  }
  if (filters.comments) {
    investorsQuery = investorsQuery.ilike("comentarios", `%${filters.comments}%`);
  }

  const { data: investors } = await investorsQuery;

  return (
    <AppShell title="Modificar compañia" subtitle="Edici\u00f3n masiva con el mismo estilo del CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="editor-shell">
        {searchParams?.ok === "1" ? <div className="notice notice-success">Cambios guardados correctamente.</div> : null}
        {searchParams?.error ? <div className="notice notice-error">Error: {searchParams.error}</div> : null}

        <form id="investors-manage-filters" method="get" className="editor-hidden-filter-form" />

        <section className="card editor-card">
          <form action={updateInvestorsBulkAction} className="editor-stack">
            <div className="form-actions-bar form-actions-bar-manage-contacts">
              <div>
                <p className="workspace-kicker">Edici\u00f3n masiva</p>
                <h3>Tabla editable</h3>
              </div>
              <div className="table-filter-actions table-filter-actions-inline table-filter-actions-center">
                <button type="submit" form="investors-manage-filters" className="button-outline-success">Aplicar filtros</button>
                <Link href="/investors/manage" className="companies-tab">Limpiar</Link>
              </div>
              <button type="submit" className="button-outline-danger editor-save-button">Guardar cambios</button>
            </div>

            <StaticTable
              columns={["Compañia", "Vertical", "Web", "Sede", "Tamaño", "Prioridad", "Inv. mínima", "Inv. máxima", "Comentarios"]}
              headerFilters={[
                <input key="filter-company" name="company" form="investors-manage-filters" defaultValue={filters.company} placeholder="Filtrar" />,
                <input key="filter-vertical" name="vertical" form="investors-manage-filters" defaultValue={filters.vertical} placeholder="Filtrar" />,
                <input key="filter-web" name="web" form="investors-manage-filters" defaultValue={filters.web} placeholder="Filtrar" />,
                <input key="filter-sede" name="sede" form="investors-manage-filters" defaultValue={filters.sede} placeholder="Filtrar" />,
                <input key="filter-size" name="size" form="investors-manage-filters" defaultValue={filters.size} placeholder="Filtrar" />,
                <input key="filter-priority" name="priority" form="investors-manage-filters" defaultValue={filters.priority} placeholder="Filtrar" />,
                <input key="filter-min-investment" name="minInvestment" form="investors-manage-filters" defaultValue={filters.minInvestment} placeholder="Filtrar" />,
                <input key="filter-max-investment" name="maxInvestment" form="investors-manage-filters" defaultValue={filters.maxInvestment} placeholder="Filtrar" />,
                <input key="filter-comments" name="comments" form="investors-manage-filters" defaultValue={filters.comments} placeholder="Filtrar" />
              ]}
              rows={(investors ?? []).map((inv) => {
                const id = String(inv.company_id);
                return [
                  <>
                    <input type="hidden" name="company_ids" value={id} />
                    <input name={`compania_${id}`} defaultValue={inv.compania ?? ""} />
                  </>,
                  <input name={`vertical_${id}`} defaultValue={inv.vertical ?? ""} />,
                  <input name={`web_${id}`} defaultValue={inv.web ?? ""} />,
                  <input name={`sede_${id}`} defaultValue={inv.sede ?? ""} />,
                  <input name={`tamano_empresa_${id}`} defaultValue={inv.tamano_empresa ?? ""} />,
                  <input name={`prioridad_${id}`} defaultValue={inv.prioridad ?? ""} />,
                  <input name={`inversion_minima_${id}`} defaultValue={inv.inversion_minima ?? ""} />,
                  <input name={`inversion_maxima_${id}`} defaultValue={inv.inversion_maxima ?? ""} />,
                  <input name={`comentarios_${id}`} defaultValue={inv.comentarios ?? ""} />
                ];
              })}
              emptyLabel="Sin compañias."
              emptyHint="Ajusta los filtros de la cabecera o vuelve cuando haya compañias disponibles para revisar."
            />
          </form>
        </section>
      </div>
    </AppShell>
  );
}


