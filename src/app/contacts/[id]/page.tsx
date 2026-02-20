import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { addComment, changeContactStatus, getContactById } from "@/lib/db/crm";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

const STATUS_OPTIONS = [
  "Pendiente de contactar",
  "En contacto",
  "NDA en curso",
  "RevisiÃ³n financiera",
  "InterÃ©s confirmado",
  "Contrato en curso",
  "Cerrado",
  "Descartado"
];

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const data = await getContactById(params.id);
  const db = createSourceCrmServerClient();
  const [tagLinksRes, allTagsRes, activitiesRes, dealsRes, auditRes] = await Promise.all([
    db.from("entity_tags").select("tag_id, tags(id, name, color)").eq("entity_type", "contact").eq("entity_id", params.id),
    db.from("tags").select("id, name, color").order("name", { ascending: true }),
    db.from("activities").select("id, title, activity_type, occurred_at").eq("entity_type", "contact").eq("entity_id", Number(params.id)).order("occurred_at", { ascending: false }).limit(8),
    data.contact?.investor_id
      ? db.from("inversion").select("company_id, compania, prioridad, inversion_maxima, updated_at").eq("company_id", Number(data.contact.investor_id)).limit(5)
      : Promise.resolve({ data: [] }),
    db.from("audit_log").select("id, field, old_value, new_value, action, changed_by_email, changed_at").eq("entity_type", "contact").eq("entity_id", params.id).order("changed_at", { ascending: false }).limit(20)
  ]);

  async function addCommentAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    await addComment({
      entity_type: "contact",
      entity_id: params.id,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath(`/contacts/${params.id}`);
    revalidatePath("/dashboard/me");
  }

  async function changeStatusAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const to_status_name = String(formData.get("to_status_name") ?? "");
    const follow_up_date = String(formData.get("follow_up_date") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (!to_status_name || !follow_up_date) return;

    await changeContactStatus({
      contact_id: params.id,
      to_status_name,
      follow_up_date,
      note,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/contacts/${params.id}`);
    revalidatePath("/dashboard/me");
    revalidatePath("/dashboard/general");
    revalidatePath("/contacts");
  }

  if (!data.contact) {
    return (
      <AppShell title="Contacto" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Contacto no encontrado.</div>
      </AppShell>
    );
  }

  const initials = data.contact.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <AppShell title="Contactos" subtitle="Ficha de contacto" canViewGlobal={user.can_view_global_dashboard}>
      <div className="contact-detail-layout contact-detail-pro">
        <aside className="contact-left card contact-pane contact-pane-1">
          <Link href="/contacts" className="contact-back">
            Contactos
          </Link>
          <div className="contact-head">
            <div className="contact-avatar">{initials || "C"}</div>
            <div>
              <h2>{data.contact.full_name}</h2>
              <p className="muted">{data.contact.investor_name ?? "Sin compaÃ±Ã­a"}</p>
              <p>{data.contact.email ?? "-"}</p>
            </div>
          </div>

          <div className="contact-quick-actions">
            <Link
              href={`/acuerdos/new?contact_id=${encodeURIComponent(params.id)}${data.contact.investor_id ? `&investor_id=${encodeURIComponent(data.contact.investor_id)}` : ""}`}
              className="quick-action"
            >
              Nuevo negocio
            </Link>
            <Link
              href={`/actividades/new?contact_id=${encodeURIComponent(params.id)}${data.contact.investor_id ? `&investor_id=${encodeURIComponent(data.contact.investor_id)}` : ""}`}
              className="quick-action"
            >
              Nueva actividad
            </Link>
          </div>

          <div className="stack">
            <h3>InformaciÃ³n clave</h3>
            <p><strong>Correo:</strong> {data.contact.email ?? "-"}</p>
            <p><strong>TelÃ©fono:</strong> {data.contact.phone ?? "-"}</p>
            <p><strong>CompaÃ±Ã­a:</strong> {data.contact.investor_name ?? "-"}</p>
            <p><strong>Estado:</strong> {data.contact.status_name ?? "-"}</p>
          </div>
        </aside>

        <section className="contact-center contact-pane contact-pane-2">
          <div className="card contact-tabs contact-surface">
            <button className="contact-tab contact-tab-active">InformaciÃ³n</button>
            <button className="contact-tab">Actividades</button>
            <button className="contact-tab">Ingresos</button>
            <button className="contact-tab">InformaciÃ³n avanzada</button>
          </div>

          <div className="card contact-surface">
            <h3>Ãšltima actividad registrada</h3>
            <p className="muted">
              {data.comments.length > 0
                ? `Actualizado ${new Date(data.comments[0].created_at).toLocaleString("es-ES")}`
                : "TodavÃ­a no hay actividad registrada para este contacto."}
            </p>
            <div className="contact-comment-list">
              {data.comments.slice(0, 4).map((c) => (
                <article key={c.id} className="contact-comment-item">
                  <div className="muted">
                    {c.created_by_email} Â· {new Date(c.created_at).toLocaleString("es-ES")}
                  </div>
                  <p>{c.body}</p>
                </article>
              ))}
              {data.comments.length === 0 ? <div className="muted">Sin comentarios todavÃ­a.</div> : null}
            </div>
          </div>

          <div className="card contact-surface">
            <h3>Actualizar estado y acciÃ³n</h3>
            <form action={changeStatusAction} className="stack">
              <select name="to_status_name" defaultValue={data.contact.status_name ?? "Pendiente de contactar"}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input type="date" name="follow_up_date" required />
              <textarea name="note" rows={3} placeholder="Describe el siguiente paso o actualizaciÃ³n" />
              <button type="submit">Guardar actualizaciÃ³n</button>
            </form>
          </div>

          <div className="card contact-surface">
            <h3>Nueva nota</h3>
            <form action={addCommentAction} className="stack">
              <textarea name="body" rows={4} placeholder="AÃ±adir comentario..." />
              <button type="submit">Guardar nota</button>
            </form>
          </div>

          <div className="card contact-surface">
            <h3>Auditoria de cambios</h3>
            <div className="stack">
              {(auditRes.data ?? []).map((row) => (
                <p key={row.id} className="muted">
                  {new Date(row.changed_at).toLocaleString("es-ES")} | {row.changed_by_email} | {row.action} |{" "}
                  {row.field ?? "general"}: {row.old_value ?? "--"} {"->"} {row.new_value ?? "--"}
                </p>
              ))}
              {(auditRes.data ?? []).length === 0 ? <p className="muted">Sin cambios auditados.</p> : null}
            </div>
          </div>
        </section>

        <aside className="contact-right contact-pane contact-pane-3">
          <div className="card contact-surface">
            <div className="row">
              <h3 style={{ margin: 0 }}>Empresas</h3>
              <Link href="/investors" className="quick-link-add">
                Agregar
              </Link>
            </div>
            <p>{data.contact.investor_name ?? "Sin empresa asociada"}</p>
          </div>

          <div className="card contact-surface">
            <div className="row">
              <h3 style={{ margin: 0 }}>Negocios</h3>
              <Link
                href={`/acuerdos/new?contact_id=${encodeURIComponent(params.id)}${data.contact.investor_id ? `&investor_id=${encodeURIComponent(data.contact.investor_id)}` : ""}`}
                className="quick-link-add"
              >
                Agregar
              </Link>
            </div>
            <p className="muted">Asocia un negocio para esta cuenta desde aquÃ­.</p>
            <div className="stack">
              {(dealsRes.data ?? []).map((deal) => (
                <p key={deal.company_id} className="muted">
                  {deal.compania} | {deal.prioridad ?? "--"} | {deal.inversion_maxima ?? "--"}
                </p>
              ))}
            </div>
          </div>

          <div className="card contact-surface">
            <div className="row">
              <h3 style={{ margin: 0 }}>Etiquetas</h3>
              <form action="/api/tags/link" method="post" className="row" style={{ gap: 6 }}>
                <input type="hidden" name="entity_type" value="contact" />
                <input type="hidden" name="entity_id" value={params.id} />
                <select name="tag_id">
                  {(allTagsRes.data ?? []).map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <button type="submit">Agregar</button>
              </form>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {(tagLinksRes.data ?? []).map((row) => (
                <span
                  key={row.tag_id}
                  style={{
                    background: String((row.tags as { color?: string } | null)?.color ?? "#0f97af"),
                    color: "#fff",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12
                  }}
                >
                  {(row.tags as { name?: string } | null)?.name ?? "Tag"}
                </span>
              ))}
            </div>
          </div>

          <div className="card contact-surface">
            <h3 style={{ marginTop: 0 }}>Actividades relacionadas</h3>
            <div className="stack">
              {(activitiesRes.data ?? []).map((activity) => (
                <p key={activity.id} className="muted">
                  {activity.title ?? "(sin titulo)"} | {activity.activity_type ?? "--"} |{" "}
                  {activity.occurred_at ? new Date(activity.occurred_at).toLocaleString("es-ES") : "--"}
                </p>
              ))}
              {(activitiesRes.data ?? []).length === 0 ? <p className="muted">Sin actividades relacionadas.</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

