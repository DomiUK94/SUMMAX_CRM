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
    <AppShell title="Modificar datos contactos" subtitle="Edicion masiva" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card">
        {searchParams?.ok === "1" ? <p style={{ color: "#0f766e" }}>Cambios guardados correctamente.</p> : null}
        {searchParams?.error ? <p style={{ color: "#b91c1c" }}>Error: {searchParams.error}</p> : null}

        <form method="get" className="entity-toolbar" style={{ marginBottom: 12 }}>
          <input
            className="toolbar-search"
            name="q"
            defaultValue={q}
            placeholder="Filtra contactos por cualquier campo visible"
          />
          <button type="submit">Filtrar</button>
          {q ? (
            <a href="/contacts/manage" className="contacts-tab">
              Limpiar
            </a>
          ) : null}
        </form>

        <form action={updateContactsBulkAction} className="stack">
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="submit">Guardar cambios masivos</button>
          </div>

          <div className="contacts-table-wrap">
            <table className="contacts-crm-table">
              <thead>
                <tr>
                  <th>Nombre contacto</th>
                  <th>Compania</th>
                  <th>Email</th>
                  <th>Telefono</th>
                  <th>Rol</th>
                  <th>Prioridad</th>
                  <th>Owner</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {(contacts ?? []).map((c) => {
                  const id = String(c.contact_id);
                  return (
                    <tr key={id}>
                      <td>
                        <input type="hidden" name="contact_ids" value={id} />
                        <input name={`full_name_${id}`} defaultValue={c.persona_contacto ?? ""} />
                      </td>
                      <td>{c.compania ?? "-"}</td>
                      <td><input name={`email_${id}`} defaultValue={c.email ?? ""} /></td>
                      <td><input name={`phone_${id}`} defaultValue={c.telefono ?? ""} /></td>
                      <td><input name={`role_${id}`} defaultValue={c.rol ?? ""} /></td>
                      <td>
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
                        </select>
                      </td>
                      <td>
                        <select name={`owner_user_id_${id}`} defaultValue={c.owner_user_id ?? ""}>
                          <option value="">Sin owner</option>
                          {(owners ?? []).map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.full_name?.trim() || o.email}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td><input name={`comments_${id}`} defaultValue={c.comentarios ?? ""} /></td>
                    </tr>
                  );
                })}
                {(contacts ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8}>Sin contactos.</td>
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
