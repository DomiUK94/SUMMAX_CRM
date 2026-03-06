import { revalidatePath } from "next/cache";
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
      .or(`compania.ilike.${pattern},vertical.ilike.${pattern},web.ilike.${pattern},sede.ilike.${pattern},tamano_empresa.ilike.${pattern},prioridad.ilike.${pattern},comentarios.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(120);
  }

  const { data: investors } = investorsQuery;

  return (
    <AppShell title="Edici\u00f3n de cuentas" subtitle="Panel de ajuste masivo con el mismo lenguaje visual del CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="editor-shell">
        <section className="card editor-hero editor-hero-warm">
          <div>
            <p className="workspace-kicker">Cuentas</p>
            <h2>Refina informaci\u00f3n clave sin salir de una sola superficie</h2>
            <p className="muted">
              Vertical, prioridad, tickets de inversi\u00f3n y comentarios conviven en una tabla con m\u00e1s jerarqu\u00eda visual, menos sensaci\u00f3n administrativa y mejor ritmo de lectura.
            </p>
          </div>
          <div className="editor-hero-metrics">
            <div className="editor-hero-metric">
              <strong>{investors?.length ?? 0}</strong>
              <span>cuentas visibles</span>
            </div>
          </div>
        </section>

        {searchParams?.ok === "1" ? <div className="notice notice-success">Cambios guardados correctamente.</div> : null}
        {searchParams?.error ? <div className="notice notice-error">Error: {searchParams.error}</div> : null}

        <section className="card editor-card">
          <div className="table-card-head">
            <div>
              <p className="workspace-kicker">Filtrado</p>
              <h3>Buscar bloque de cuentas</h3>
              <p className="muted">Filtra antes de editar para trabajar con una selecci\u00f3n m\u00e1s limpia y enfocada.</p>
            </div>
          </div>
          <form method="get" className="entity-toolbar form-toolbar-surface">
            <input className="toolbar-search" name="q" defaultValue={q} placeholder="Buscar por compa\u00f1\u00eda, vertical, web o comentario" />
            <button type="submit">Aplicar</button>
            {q ? <a href="/investors/manage" className="contacts-tab">Limpiar</a> : null}
          </form>
        </section>

        <section className="card editor-card">
          <form action={updateInvestorsBulkAction} className="editor-stack">
            <div className="form-actions-bar">
              <div>
                <p className="workspace-kicker">Edici\u00f3n masiva</p>
                <h3>Tabla editable</h3>
              </div>
              <button type="submit">Guardar cambios</button>
            </div>

            <StaticTable
              columns={["Compa\u00f1\u00eda", "Vertical", "Web", "Sede", "Tama\u00f1o", "Prioridad", "Inv. m\u00ednima", "Inv. m\u00e1xima", "Comentarios"]}
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
              emptyLabel="Sin cuentas."
              emptyHint="Ajusta la b\u00fasqueda o vuelve cuando haya cuentas disponibles para revisar."
            />
          </form>
        </section>
      </div>
    </AppShell>
  );
}
