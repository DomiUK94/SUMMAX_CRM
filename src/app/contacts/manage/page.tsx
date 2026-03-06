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

export default async function ManageContactsPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  if (!canManageCrmBulkEdits(user)) {
    redirect("/forbidden");
  }
  const db = createSourceCrmServerClient();
  const q = String(searchParams?.q ?? "").trim();

  async function updateContactsBulkAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!canManageCrmBulkEdits(actor)) {
      redirect("/forbidden");
    }
    const source = createSourceCrmServerClient();

    const ownerOptions = await source.from("users").select("id, email");
    const ownerEmailById = new Map<string, string>((ownerOptions.data ?? []).map((u) => [u.id, u.email]));
    const ids = formData.getAll("contact_ids").map((v) => String(v)).filter(Boolean);

    if (ids.length === 0) {
      redirect("/contacts/manage?error=no_rows");
    }

    for (const id of ids) {
      const ownerUserIdRaw = String(formData.get(`owner_user_id_${id}`) ?? "").trim();
      const ownerUserId = ownerUserIdRaw || null;
      const ownerEmail = ownerUserId ? ownerEmailById.get(ownerUserId) ?? null : null;

      const payload = {
        persona_contacto: String(formData.get(`full_name_${id}`) ?? "").trim() || null,
        email: String(formData.get(`email_${id}`) ?? "").trim() || null,
        telefono: String(formData.get(`phone_${id}`) ?? "").trim() || null,
        rol: String(formData.get(`role_${id}`) ?? "").trim() || null,
        prioritario: String(formData.get(`status_name_${id}`) ?? "").trim() || null,
        owner_user_id: ownerUserId,
        owner_email: ownerEmail,
        comentarios: String(formData.get(`comments_${id}`) ?? "").trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await source.from("contactos").update(payload).eq("contact_id", Number(id));
      if (error) {
        redirect(`/contacts/manage?error=${encodeURIComponent(error.message)}`);
      }
    }

    revalidatePath("/contacts");
    revalidatePath("/contacts/manage");
    redirect("/contacts/manage?ok=1");
  }

  let contactsQuery = db
    .from("contactos")
    .select("contact_id, persona_contacto, compania, email, telefono, rol, prioritario, owner_user_id, comentarios, updated_at")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (q) {
    const pattern = `%${q}%`;
    contactsQuery = contactsQuery.or(
      `persona_contacto.ilike.${pattern},compania.ilike.${pattern},email.ilike.${pattern},telefono.ilike.${pattern},rol.ilike.${pattern},prioritario.ilike.${pattern},comentarios.ilike.${pattern}`
    );
  }

  const [{ data: contacts }, { data: owners }] = await Promise.all([
    contactsQuery,
    db.from("users").select("id, email, full_name").eq("is_active", true).order("email", { ascending: true })
  ]);

  return (
    <AppShell title="Edici\u00f3n de contactos" subtitle="Revisi\u00f3n masiva con el mismo acabado que el CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="editor-shell">
        <section className="card editor-hero">
          <div>
            <p className="workspace-kicker">Operativa</p>
            <h2>Actualiza contactos sin salir del flujo principal</h2>
            <p className="muted">
              Revisa propietarios, prioridad y datos base en una sola mesa de trabajo. La vista mantiene el tono del CRM y evita la sensaci\u00f3n de backoffice crudo.
            </p>
          </div>
          <div className="editor-hero-metrics">
            <div className="editor-hero-metric">
              <strong>{contacts?.length ?? 0}</strong>
              <span>contactos cargados</span>
            </div>
            <div className="editor-hero-metric">
              <strong>{owners?.length ?? 0}</strong>
              <span>owners activos</span>
            </div>
          </div>
        </section>

        {searchParams?.ok === "1" ? <div className="notice notice-success">Cambios guardados correctamente.</div> : null}
        {searchParams?.error ? <div className="notice notice-error">Error: {searchParams.error}</div> : null}

        <section className="card editor-card">
          <div className="table-card-head">
            <div>
              <p className="workspace-kicker">Filtrado</p>
              <h3>Buscar tramo de trabajo</h3>
              <p className="muted">Reduce la tabla antes de editar para trabajar con un bloque m\u00e1s claro y controlado.</p>
            </div>
          </div>
          <form method="get" className="entity-toolbar form-toolbar-surface">
            <input className="toolbar-search" name="q" defaultValue={q} placeholder="Buscar por nombre, compa\u00f1\u00eda, email o comentario" />
            <button type="submit">Aplicar</button>
            {q ? <a href="/contacts/manage" className="contacts-tab">Limpiar</a> : null}
          </form>
        </section>

        <section className="card editor-card">
          <form action={updateContactsBulkAction} className="editor-stack">
            <div className="form-actions-bar">
              <div>
                <p className="workspace-kicker">Edici\u00f3n masiva</p>
                <h3>Tabla editable</h3>
              </div>
              <button type="submit">Guardar cambios</button>
            </div>

            <StaticTable
              columns={["Nombre", "Compa\u00f1\u00eda", "Email", "Tel\u00e9fono", "Rol", "Prioridad", "Responsable", "Comentarios"]}
              rows={(contacts ?? []).map((c) => {
                const id = String(c.contact_id);
                return [
                  <>
                    <input type="hidden" name="contact_ids" value={id} />
                    <input name={`full_name_${id}`} defaultValue={c.persona_contacto ?? ""} />
                  </>,
                  c.compania ?? "-",
                  <input name={`email_${id}`} defaultValue={c.email ?? ""} />,
                  <input name={`phone_${id}`} defaultValue={c.telefono ?? ""} />,
                  <input name={`role_${id}`} defaultValue={c.rol ?? ""} />,
                  <select name={`status_name_${id}`} defaultValue={c.prioritario ?? ""}>
                    <option value="">--</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                    <option value="Pendiente de contactar">Pendiente de contactar</option>
                    <option value="En contacto">En contacto</option>
                    <option value="NDA en curso">NDA en curso</option>
                    <option value="Revision financiera">Revision financiera</option>
                    <option value="Interes confirmado">Interes confirmado</option>
                    <option value="Contrato en curso">Contrato en curso</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Descartado">Descartado</option>
                  </select>,
                  <select name={`owner_user_id_${id}`} defaultValue={c.owner_user_id ?? ""}>
                    <option value="">Sin responsable</option>
                    {(owners ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.full_name?.trim() || o.email}
                      </option>
                    ))}
                  </select>,
                  <input name={`comments_${id}`} defaultValue={c.comentarios ?? ""} />
                ];
              })}
              emptyLabel="Sin contactos."
              emptyHint="Ajusta la b\u00fasqueda o vuelve cuando haya registros disponibles para revisar."
            />
          </form>
        </section>
      </div>
    </AppShell>
  );
}
