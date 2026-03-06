import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { addComment, changeContactStatus, getContactById } from "@/lib/db/crm";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

const STATUS_OPTIONS = [
  "Pendiente de contactar",
  "En contacto",
  "NDA en curso",
  "Revisión financiera",
  "Interés confirmado",
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

  const activities = activitiesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const tags = tagLinksRes.data ?? [];
  const auditRows = auditRes.data ?? [];
  const lastCommentAt = data.comments.length > 0 ? new Date(data.comments[0].created_at).toLocaleString("es-ES") : null;

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
              <p className="muted">{data.contact.investor_name ?? "Sin compañía"}</p>
              <p>{data.contact.email ?? "Sin email"}</p>
            </div>
          </div>

          <div className="contact-summary-grid">
            <article className="contact-summary-card">
              <strong>{activities.length}</strong>
              <span>Actividades</span>
            </article>
            <article className="contact-summary-card">
              <strong>{deals.length}</strong>
              <span>Negocios</span>
            </article>
            <article className="contact-summary-card">
              <strong>{tags.length}</strong>
              <span>Etiquetas</span>
            </article>
            <article className="contact-summary-card">
              <strong>{auditRows.length}</strong>
              <span>Cambios</span>
            </article>
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

          <div className="contact-meta-list stack">
            <h3>Información clave</h3>
            <div className="contact-meta-row"><span>Correo</span><strong>{data.contact.email ?? "-"}</strong></div>
            <div className="contact-meta-row"><span>Teléfono</span><strong>{data.contact.phone ?? "-"}</strong></div>
            <div className="contact-meta-row"><span>Compañía</span><strong>{data.contact.investor_name ?? "-"}</strong></div>
            <div className="contact-meta-row"><span>Estado</span><strong>{data.contact.status_name ?? "-"}</strong></div>
            <div className="contact-meta-row"><span>Última nota</span><strong>{lastCommentAt ?? "Sin actividad"}</strong></div>
          </div>
        </aside>

        <section className="contact-center contact-pane contact-pane-2">
          <Tabs.Root defaultValue="overview" className="contact-radix-tabs">
            <Tabs.List className="card contact-tabs contact-surface" aria-label="Secciones del contacto">
              <Tabs.Trigger value="overview" className="contact-tab">Resumen</Tabs.Trigger>
              <Tabs.Trigger value="activity" className="contact-tab">Seguimiento</Tabs.Trigger>
              <Tabs.Trigger value="notes" className="contact-tab">Notas</Tabs.Trigger>
              <Tabs.Trigger value="advanced" className="contact-tab">Auditoría</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="overview" className="contact-tab-panel stack">
              <div className="card contact-surface contact-hero-card">
                <div>
                  <p className="workspace-kicker">Resumen</p>
                  <h3>Vista operativa del contacto</h3>
                  <p className="muted">
                    {lastCommentAt
                      ? `Última interacción registrada el ${lastCommentAt}.`
                      : "Aún no hay comentarios o actividad manual registrada para este contacto."}
                  </p>
                </div>
                <div className="contact-inline-chips">
                  <span className="contact-inline-chip">{data.contact.status_name ?? "Sin estado"}</span>
                  <span className="contact-inline-chip contact-inline-chip-soft">{data.contact.investor_name ?? "Sin cuenta"}</span>
                </div>
              </div>

              <div className="card contact-surface">
                <h3>Última actividad registrada</h3>
                <div className="contact-comment-list">
                  {data.comments.slice(0, 4).map((c) => (
                    <article key={c.id} className="contact-comment-item">
                      <div className="muted">
                        {c.created_by_email} · {new Date(c.created_at).toLocaleString("es-ES")}
                      </div>
                      <p>{c.body}</p>
                    </article>
                  ))}
                  {data.comments.length === 0 ? <div className="muted">Sin comentarios todavía.</div> : null}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="activity" className="contact-tab-panel stack">
              <div className="card contact-surface">
                <h3>Actualizar estado y próxima acción</h3>
                <form action={changeStatusAction} className="stack">
                  <select name="to_status_name" defaultValue={data.contact.status_name ?? "Pendiente de contactar"}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input type="date" name="follow_up_date" required />
                  <textarea name="note" rows={3} placeholder="Describe el siguiente paso o actualización" />
                  <button type="submit">Guardar actualización</button>
                </form>
              </div>
            </Tabs.Content>

            <Tabs.Content value="notes" className="contact-tab-panel stack">
              <div className="card contact-surface">
                <h3>Nueva nota</h3>
                <form action={addCommentAction} className="stack">
                  <textarea name="body" rows={4} placeholder="Añadir comentario..." />
                  <button type="submit">Guardar nota</button>
                </form>
              </div>
            </Tabs.Content>

            <Tabs.Content value="advanced" className="contact-tab-panel stack">
              <div className="card contact-surface">
                <h3>Auditoría de cambios</h3>
                <div className="stack">
                  {auditRows.map((row) => (
                    <div key={row.id} className="contact-audit-item">
                      <strong>{row.field ?? "general"}</strong>
                      <p className="muted">{new Date(row.changed_at).toLocaleString("es-ES")} · {row.changed_by_email} · {row.action}</p>
                      <p>{row.old_value ?? "--"} {"->"} {row.new_value ?? "--"}</p>
                    </div>
                  ))}
                  {auditRows.length === 0 ? <p className="muted">Sin cambios auditados.</p> : null}
                </div>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </section>

        <aside className="contact-right contact-pane contact-pane-3">
          <div className="card contact-surface contact-side-card">
            <div className="row">
              <h3 style={{ margin: 0 }}>Empresa</h3>
              <Link href="/investors" className="quick-link-add">
                Ver cuentas
              </Link>
            </div>
            <p>{data.contact.investor_name ?? "Sin empresa asociada"}</p>
          </div>

          <div className="card contact-surface contact-side-card">
            <div className="row">
              <h3 style={{ margin: 0 }}>Negocios</h3>
              <Link
                href={`/acuerdos/new?contact_id=${encodeURIComponent(params.id)}${data.contact.investor_id ? `&investor_id=${encodeURIComponent(data.contact.investor_id)}` : ""}`}
                className="quick-link-add"
              >
                Agregar
              </Link>
            </div>
            <p className="muted">Asocia un negocio para esta cuenta desde aquí.</p>
            <div className="contact-side-list stack">
              {deals.map((deal) => (
                <div key={deal.company_id} className="contact-side-item">
                  <strong>{deal.compania}</strong>
                  <span>{deal.prioridad ?? "--"}</span>
                  <span>{deal.inversion_maxima ?? "--"}</span>
                </div>
              ))}
              {deals.length === 0 ? <p className="muted">Sin negocios asociados.</p> : null}
            </div>
          </div>

          <div className="card contact-surface contact-side-card">
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
              {tags.map((row) => (
                <span
                  key={row.tag_id}
                  className="contact-tag"
                  style={{ background: String((row.tags as { color?: string } | null)?.color ?? "#0f97af") }}
                >
                  {(row.tags as { name?: string } | null)?.name ?? "Tag"}
                </span>
              ))}
              {tags.length === 0 ? <p className="muted">Sin etiquetas todavía.</p> : null}
            </div>
          </div>

          <div className="card contact-surface contact-side-card">
            <h3 style={{ marginTop: 0 }}>Actividades relacionadas</h3>
            <div className="contact-side-list stack">
              {activities.map((activity) => (
                <div key={activity.id} className="contact-side-item">
                  <strong>{activity.title ?? "(sin título)"}</strong>
                  <span>{activity.activity_type ?? "--"}</span>
                  <span>{activity.occurred_at ? new Date(activity.occurred_at).toLocaleString("es-ES") : "--"}</span>
                </div>
              ))}
              {activities.length === 0 ? <p className="muted">Sin actividades relacionadas.</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
