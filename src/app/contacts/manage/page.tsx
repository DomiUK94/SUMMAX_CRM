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
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    role?: string;
    priority?: string;
    owner?: string;
    comments?: string;
  };
};

const PRIORITY_OPTIONS = [
  "Alta",
  "Media",
  "Baja",
  "Pendiente de contactar",
  "En contacto",
  "NDA en curso",
  "Revisión financiera",
  "Interés confirmado",
  "Contrato en curso",
  "Cerrado",
  "Descartado"
] as const;

export default async function ManageContactsPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  if (!canManageCrmBulkEdits(user)) {
    redirect("/forbidden");
  }
  const db = createSourceCrmServerClient();
  const filters = {
    name: String(searchParams?.name ?? "").trim(),
    company: String(searchParams?.company ?? "").trim(),
    email: String(searchParams?.email ?? "").trim(),
    phone: String(searchParams?.phone ?? "").trim(),
    role: String(searchParams?.role ?? "").trim(),
    priority: String(searchParams?.priority ?? "").trim(),
    owner: String(searchParams?.owner ?? "").trim(),
    comments: String(searchParams?.comments ?? "").trim()
  };

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

  if (filters.name) {
    contactsQuery = contactsQuery.ilike("persona_contacto", `%${filters.name}%`);
  }
  if (filters.company) {
    contactsQuery = contactsQuery.ilike("compania", `%${filters.company}%`);
  }
  if (filters.email) {
    contactsQuery = contactsQuery.ilike("email", `%${filters.email}%`);
  }
  if (filters.phone) {
    contactsQuery = contactsQuery.ilike("telefono", `%${filters.phone}%`);
  }
  if (filters.role) {
    contactsQuery = contactsQuery.ilike("rol", `%${filters.role}%`);
  }
  if (filters.priority) {
    contactsQuery = contactsQuery.eq("prioritario", filters.priority);
  }
  if (filters.owner) {
    contactsQuery = contactsQuery.eq("owner_user_id", filters.owner);
  }
  if (filters.comments) {
    contactsQuery = contactsQuery.ilike("comentarios", `%${filters.comments}%`);
  }

  const [{ data: contacts }, { data: owners }] = await Promise.all([
    contactsQuery,
    db.from("users").select("id, email, full_name").eq("is_active", true).order("email", { ascending: true })
  ]);

  return (
    <AppShell title="Modificar contactos" subtitle="Edición masiva con el mismo estilo del CRM" canViewGlobal={user.can_view_global_dashboard}>
      <div className="editor-shell">
        {searchParams?.ok === "1" ? <div className="notice notice-success">Cambios guardados correctamente.</div> : null}
        {searchParams?.error ? <div className="notice notice-error">Error: {searchParams.error}</div> : null}

        <form id="contacts-manage-filters" method="get" className="editor-hidden-filter-form" />

        <section className="card editor-card">
          <form action={updateContactsBulkAction} className="editor-stack">
            <div className="form-actions-bar form-actions-bar-manage-contacts">
              <div>
                <p className="workspace-kicker">Edición masiva</p>
                <h3>Tabla editable</h3>
              </div>
              <div className="table-filter-actions table-filter-actions-inline table-filter-actions-center">
                <button type="submit" form="contacts-manage-filters" className="button-outline-success">Aplicar filtros</button>
                <Link href="/contacts/manage" className="companies-tab">Limpiar</Link>
              </div>
              <button type="submit" className="button-outline-danger editor-save-button">Guardar cambios</button>
            </div>

            <StaticTable
              columns={["Nombre", "Compañía", "Email", "Teléfono", "Rol", "Prioridad", "Propietario", "Comentarios"]}
              headerFilters={[
                <input key="filter-name" name="name" form="contacts-manage-filters" defaultValue={filters.name} placeholder="Filtrar" />,
                <input key="filter-company" name="company" form="contacts-manage-filters" defaultValue={filters.company} placeholder="Filtrar" />,
                <input key="filter-email" name="email" form="contacts-manage-filters" defaultValue={filters.email} placeholder="Filtrar" />,
                <input key="filter-phone" name="phone" form="contacts-manage-filters" defaultValue={filters.phone} placeholder="Filtrar" />,
                <input key="filter-role" name="role" form="contacts-manage-filters" defaultValue={filters.role} placeholder="Filtrar" />,
                <select key="filter-priority" name="priority" form="contacts-manage-filters" defaultValue={filters.priority}>
                  <option value="">Todas</option>
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>,
                <select key="filter-owner" name="owner" form="contacts-manage-filters" defaultValue={filters.owner}>
                  <option value="">Todos</option>
                  {(owners ?? []).map((o) => (
                    <option key={o.id} value={o.id}>{o.full_name?.trim() || o.email}</option>
                  ))}
                </select>,
                <input key="filter-comments" name="comments" form="contacts-manage-filters" defaultValue={filters.comments} placeholder="Filtrar" />
              ]}
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
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>,
                  <select name={`owner_user_id_${id}`} defaultValue={c.owner_user_id ?? ""}>
                    <option value="">Sin propietario</option>
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
              emptyHint="Ajusta los filtros de la cabecera o vuelve cuando haya registros disponibles para revisar."
            />
          </form>
        </section>
      </div>
    </AppShell>
  );
}



