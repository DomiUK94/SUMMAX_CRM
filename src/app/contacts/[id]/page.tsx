import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContactDetailCenter } from "@/components/contact-detail-center";
import { ContactProfileEditDialog } from "@/components/contact-profile-edit-dialog";
import { CrmIcon } from "@/components/ui/crm-icon";
import { requireUser } from "@/lib/auth/session";
import { addComment, changeContactStatus, getContactById, updateContactProfile } from "@/lib/db/crm";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

const STATUS_OPTIONS = [
  "Pendiente de contactar",
  "En contacto",
  "NDA en curso",
  "Revisi\u00f3n financiera",
  "Inter\u00e9s confirmado",
  "Contrato en curso",
  "Cerrado",
  "Descartado"
];

type PageProps = {
  params: { id: string };
  searchParams?: { ok?: string; error?: string };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES");
}

export default async function ContactDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const data = await getContactById(params.id);
  const db = createSourceCrmServerClient();
  const [tagLinksRes, allTagsRes, activitiesRes, dealsRes, auditRes] = await Promise.all([
    db.from("entity_tags").select("tag_id, tags(id, name, color)").eq("entity_type", "contact").eq("entity_id", params.id),
    db.from("tags").select("id, name, color").order("name", { ascending: true }),
    db.from("activities").select("id, title, activity_type, occurred_at, body").eq("entity_type", "contact").eq("entity_id", Number(params.id)).order("occurred_at", { ascending: false }).limit(8),
    data.contact?.investor_id
      ? db.from("inversion").select("company_id, compania, prioridad, inversion_maxima, updated_at").eq("company_id", Number(data.contact.investor_id)).limit(5)
      : Promise.resolve({ data: [] }),
    db.from("audit_log").select("id, field, old_value, new_value, action, changed_by_email, changed_at").eq("entity_type", "contact").eq("entity_id", params.id).order("changed_at", { ascending: false }).limit(12)
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
    redirect(`/contacts/${params.id}?ok=note`);
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
    revalidatePath("/contacts");
    redirect(`/contacts/${params.id}?ok=status`);
  }

  async function updateContactAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    try {
      await updateContactProfile({
        contact_id: params.id,
        full_name: String(formData.get("full_name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim() || undefined,
        phone: String(formData.get("phone") ?? "").trim() || undefined,
        role: String(formData.get("role") ?? "").trim() || undefined,
        other_contact: String(formData.get("other_contact") ?? "").trim() || undefined,
        linkedin: String(formData.get("linkedin") ?? "").trim() || undefined,
        comments: String(formData.get("comments") ?? "").trim() || undefined,
        status_name: String(formData.get("status_name") ?? "").trim() || undefined,
        actor_user_id: actor.id,
        actor_email: actor.email
      });

      revalidatePath(`/contacts/${params.id}`);
      redirect(`/contacts/${params.id}?ok=profile`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron guardar los cambios";
      redirect(`/contacts/${params.id}?error=${encodeURIComponent(message)}`);
    }
  }

  if (!data.contact) {
    return (
      <AppShell title="Contacto" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Contacto no encontrado.</div>
      </AppShell>
    );
  }

  const contact = data.contact;
  const activities = activitiesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const tags = tagLinksRes.data ?? [];
  const auditRows = auditRes.data ?? [];
  const comments = data.comments;
  const initials = contact.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");

  const quickActions = [
    { label: "Nota", icon: "report" as const, href: "#contact-notes" },
    { label: "Correo", icon: "mail" as const, href: contact.email ? `mailto:${contact.email}` : undefined },
    { label: "LinkedIn", icon: "linkedin" as const, href: contact.linkedin ? contact.linkedin : undefined },
    { label: "Tarea", icon: "task" as const, href: `/actividades/new?contact_id=${encodeURIComponent(params.id)}${contact.investor_id ? `&investor_id=${encodeURIComponent(contact.investor_id)}` : ""}` },
    { label: "Reuni\u00f3n", icon: "meeting" as const, href: `/actividades/new?contact_id=${encodeURIComponent(params.id)}${contact.investor_id ? `&investor_id=${encodeURIComponent(contact.investor_id)}` : ""}` },
    { label: "M\u00e1s", icon: "more" as const, href: contact.investor_id ? `/investors/${encodeURIComponent(contact.investor_id)}` : undefined }
  ];

  const relatedCompanies = contact.investor_name
    ? [{
        id: String(contact.investor_id ?? "company"),
        name: contact.investor_name,
        href: contact.investor_id ? `/investors/${encodeURIComponent(contact.investor_id)}` : undefined,
        detail: contact.role ?? "Compa\u00f1\u00eda vinculada"
      }]
    : [];

  const attachments: Array<{ id: string; label: string; meta: string; href?: string }> = [];
  const closedDeals = deals.filter((deal) => {
    const signal = `${deal.prioridad ?? ""} ${deal.compania ?? ""}`.toLowerCase();
    return signal.includes("cerrado") || signal.includes("ganado") || signal.includes("closed") || signal.includes("won");
  });
  const contactDefaults = {
    full_name: contact.full_name,
    status_name: contact.status_name ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    role: contact.role ?? "",
    other_contact: contact.other_contact ?? "",
    linkedin: contact.linkedin ?? "",
    comments: contact.comments ?? ""
  };

  return (
    <AppShell title={contact.full_name} subtitle="Ficha compacta de contacto" canViewGlobal={user.can_view_global_dashboard} showHeader={false}>
      <div className="contact-record-layout">
        <aside className="contact-record-aside stack">
          <section className="contact-record-primary card">
            <div className="contact-record-topbar">
              <Link href="/contacts" className="contact-record-back">
                <CrmIcon name="back" className="crm-icon" />
                <span>Contactos</span>
              </Link>
            </div>

            <div className="contact-record-hero">
              <div className="contact-record-avatar">{initials || "CT"}</div>
              <div className="contact-record-copy">
                <h2>{contact.full_name}</h2>
                <p>{contact.role ?? "Sin rol definido"}</p>
                <div className="contact-record-links">
                  <span>{contact.email ?? "Sin email"}</span>
                  {contact.linkedin ? <a href={contact.linkedin} target="_blank" rel="noreferrer">LinkedIn</a> : null}
                </div>
              </div>
            </div>

            <div className="contact-record-actions-grid">
              {quickActions.map((action) =>
                action.href ? (
                  <Link key={action.label} href={action.href} className="contact-record-action-pill">
                    <span className="contact-record-action-icon"><CrmIcon name={action.icon} className="crm-icon" /></span>
                    <span>{action.label}</span>
                  </Link>
                ) : (
                  <div key={action.label} className="contact-record-action-pill contact-record-action-pill-disabled">
                    <span className="contact-record-action-icon"><CrmIcon name={action.icon} className="crm-icon" /></span>
                    <span>{action.label}</span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="contact-record-info card">
            <div className="contact-record-section-head">
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <CrmIcon name="chevron_down" className="crm-icon" />
                <h3>{"Informaci\u00f3n clave"}</h3>
              </div>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <ContactProfileEditDialog action={updateContactAction} defaults={contactDefaults} />
              </div>
            </div>

            <div className="contact-record-info-list">
              <div><span>Correo</span><strong>{contact.email ?? "-"}</strong></div>
              <div><span>{"N\u00famero de tel\u00e9fono"}</span><strong>{contact.phone ?? "-"}</strong></div>
              <div><span>Nombre de la empresa</span><strong>{contact.investor_name ?? "-"}</strong></div>
              <div><span>Estado del lead</span><strong>{contact.status_name ?? "-"}</strong></div>
              <div><span>Otro contacto</span><strong>{contact.other_contact ?? "-"}</strong></div>
              <div><span>Propietario del contacto</span><strong>{contact.owner_email ?? "Sin propietario"}</strong></div>
            </div>
          </section>
        </aside>

        <ContactDetailCenter
          defaults={contactDefaults}
          info={{
            name: contact.full_name,
            status: contact.status_name ?? "--",
            email: contact.email ?? "--",
            phone: contact.phone ?? "--",
            role: contact.role ?? "--",
            otherContact: contact.other_contact ?? "--",
            linkedin: contact.linkedin ?? "--",
            comments: contact.comments ?? "--"
          }}
          closedDeals={closedDeals.map((deal) => ({
            id: String(deal.company_id),
            name: deal.compania ?? "--",
            priority: deal.prioridad ?? "--",
            amount: deal.inversion_maxima ?? "--"
          }))}
          comments={comments.map((comment) => ({
            id: comment.id,
            createdBy: comment.created_by_email ?? "-",
            createdAt: formatDateTime(comment.created_at),
            body: comment.body
          }))}
          activities={activities.map((activity) => ({
            id: String(activity.id),
            title: activity.title ?? "(sin t?tulo)",
            type: activity.activity_type ?? "--",
            occurredAt: formatDateTime(activity.occurred_at),
            body: activity.body ?? ""
          }))}
          auditRows={auditRows.map((row) => ({
            id: String(row.id),
            field: row.field ?? "general",
            changedAt: formatDateTime(row.changed_at),
            changedBy: row.changed_by_email ?? "-",
            oldValue: row.old_value ?? "--",
            newValue: row.new_value ?? "--"
          }))}
          advanced={{
            company: contact.investor_name ?? "--",
            owner: contact.owner_email ?? "Sin propietario",
            linkedin: contact.linkedin ?? "--",
            comments: contact.comments ?? "--",
            tags: tags.length > 0 ? tags.map((row) => ((row.tags as { name?: string } | null)?.name ?? "Tag")).join(", ") : "--",
            lastActivity: activities[0]?.occurred_at ? formatDateTime(activities[0].occurred_at) : "--"
          }}
          updateAction={updateContactAction}
          changeStatusAction={changeStatusAction}
          addCommentAction={addCommentAction}
        />

        <aside className="contact-record-right stack">
          <details className="contact-record-mini-panel" open>
            <summary className="contact-record-mini-summary">
              <div className="contact-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Empresas ({relatedCompanies.length})</span>
              </div>
              <details className="contact-record-mini-menu">
                <summary className="contact-record-mini-action">Agregar</summary>
                <div className="contact-record-mini-menu-list">
                  <Link href="/investors/new" className="contact-record-mini-menu-item">Agregar nueva empresa</Link>
                  <Link href="/investors" className="contact-record-mini-menu-item">Agregar existente</Link>
                </div>
              </details>
            </summary>
            <div className="contact-record-mini-body">
              {relatedCompanies.length > 0 ? relatedCompanies.map((company) => (
                company.href ? (
                  <Link key={company.id} href={company.href} className="contact-record-mini-item">
                    <strong>{company.name}</strong>
                    <span>{company.detail}</span>
                  </Link>
                ) : (
                  <div key={company.id} className="contact-record-mini-item">
                    <strong>{company.name}</strong>
                    <span>{company.detail}</span>
                  </div>
                )
              )) : <p className="muted">Sin empresas asociadas.</p>}
            </div>
          </details>

          <details className="contact-record-mini-panel" open>
            <summary className="contact-record-mini-summary">
              <div className="contact-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Negocios ({deals.length})</span>
              </div>
              <details className="contact-record-mini-menu">
                <summary className="contact-record-mini-action">Agregar</summary>
                <div className="contact-record-mini-menu-list">
                  <Link href={contact.investor_id ? `/acuerdos/new?investor_id=${encodeURIComponent(contact.investor_id)}&contact_id=${encodeURIComponent(params.id)}` : `/acuerdos/new?contact_id=${encodeURIComponent(params.id)}`} className="contact-record-mini-menu-item">Agregar nuevo</Link>
                  <Link href="/acuerdos" className="contact-record-mini-menu-item">Agregar existente</Link>
                </div>
              </details>
            </summary>
            <div className="contact-record-mini-body">
              {deals.length > 0 ? deals.map((deal) => (
                <div key={deal.company_id} className="contact-record-mini-item">
                  <strong>{deal.compania}</strong>
                  <span>{deal.prioridad ?? "Sin prioridad"} | {deal.inversion_maxima ?? "Sin ticket"}</span>
                </div>
              )) : <p className="muted">Sin negocios asociados.</p>}
            </div>
          </details>

          <details className="contact-record-mini-panel">
            <summary className="contact-record-mini-summary">
              <div className="contact-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Archivos adjuntos ({attachments.length})</span>
              </div>
              <span className="contact-record-mini-action">Agregar</span>
            </summary>
            <div className="contact-record-mini-body">
              {attachments.length > 0 ? attachments.map((file) => (
                file.href ? (
                  <Link key={file.id} href={file.href} className="contact-record-mini-item">
                    <strong>{file.label}</strong>
                    <span>{file.meta}</span>
                  </Link>
                ) : (
                  <div key={file.id} className="contact-record-mini-item">
                    <strong>{file.label}</strong>
                    <span>{file.meta}</span>
                  </div>
                )
              )) : <p className="muted">Sin archivos adjuntos.</p>}
            </div>
          </details>
        </aside>
      </div>
    </AppShell>
  );
}

