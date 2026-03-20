import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContactEmailDialog } from "@/components/contact-email-dialog";
import { ContactDetailCenter } from "@/components/contact-detail-center";
import { EntityFilesPanel } from "@/components/entity-files-panel";
import { ContactProfileEditDialog } from "@/components/contact-profile-edit-dialog";
import { CrmIcon } from "@/components/ui/crm-icon";
import { requireUser } from "@/lib/auth/session";
import { toIsoFromDateTimeLocalInput } from "@/lib/datetime";
import { getBusinessContextForContact } from "@/lib/db/business";
import { addComment, getContactById, updateContactProfile } from "@/lib/db/crm";
import { deleteEntityFile, listEntityFilesWithUrls, normalizeEntityFileError, uploadEntityFile } from "@/lib/db/entity-files";
import { listAssignableUsers } from "@/lib/db/users";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type PageProps = {
  params: { id: string };
  searchParams?: { ok?: string; error?: string; tab?: string };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES");
}

function formatMoney(value: number | null) {
  if (value === null) return "--";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function ContactDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const data = await getContactById(params.id);
  const db = createSourceCrmServerClient();
  const auditPromise = (async () => {
    let result = await db
      .from("audit_log")
      .select("id, field, old_value, new_value, action, changed_by_email, changed_at")
      .eq("entity_type", "contact")
      .eq("entity_id", params.id)
      .order("changed_at", { ascending: false })
      .limit(12);

    if (result.error?.code === "PGRST205") {
      result = await db
        .from("audit_logs")
        .select("id, field, old_value, new_value, action, changed_by_email, changed_at")
        .eq("entity_type", "contact")
        .eq("entity_id", params.id)
        .order("changed_at", { ascending: false })
        .limit(12);
    }

    return result;
  })();

  const [tagLinksRes, auditRes, business, owners] = await Promise.all([
    db.from("entity_tags").select("tag_id, tags(id, name, color)").eq("entity_type", "contact").eq("entity_id", params.id),
    auditPromise,
    getBusinessContextForContact(params.id),
    listAssignableUsers()
  ]);

  async function addCommentAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const body = String(formData.get("body") ?? "").trim();
    const createdAt = toIsoFromDateTimeLocalInput(formData.get("occurred_at"));
    if (!body) return;

    await addComment({
      entity_type: "contact",
      entity_id: params.id,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email,
      created_at: createdAt
    });

    revalidatePath(`/contacts/${params.id}`);
    redirect(`/contacts/${params.id}?ok=note`);
  }

  async function updateContactAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    try {
      const ownerUserId = String(formData.get("owner_user_id") ?? "").trim();
      const owner = owners.find((entry) => entry.id === ownerUserId) ?? null;
      await updateContactProfile({
        contact_id: params.id,
        full_name: String(formData.get("full_name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim() || undefined,
        phone: String(formData.get("phone") ?? "").trim() || undefined,
        role: String(formData.get("role") ?? "").trim() || undefined,
        other_contact: String(formData.get("other_contact") ?? "").trim() || undefined,
        linkedin: String(formData.get("linkedin") ?? "").trim() || undefined,
        comments: String(formData.get("comments") ?? "").trim() || undefined,
        is_financier: String(formData.get("is_financier") ?? "No") === "Si",
        is_prescriber: String(formData.get("is_prescriber") ?? "No") === "Si",
        owner_user_id: owner?.id ?? undefined,
        owner_email: owner?.email ?? undefined,
        next_step: String(formData.get("next_step") ?? "").trim() || undefined,
        due_date: String(formData.get("due_date") ?? "").trim() || undefined,
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

  async function uploadFileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      redirect(`/contacts/${params.id}?error=file_missing`);
    }

    try {
      await uploadEntityFile({
        entityType: "contact",
        entityId: params.id,
        file,
        actorUserId: actor.id,
        actorEmail: actor.email
      });
    } catch (error) {
      redirect(`/contacts/${params.id}?error=${normalizeEntityFileError(error)}`);
    }

    revalidatePath(`/contacts/${params.id}`);
    redirect(`/contacts/${params.id}?ok=file_uploaded`);
  }

  async function deleteFileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const fileId = String(formData.get("file_id") ?? "").trim();

    if (!fileId) {
      redirect(`/contacts/${params.id}?error=file_not_found`);
    }

    try {
      await deleteEntityFile({
        entityType: "contact",
        entityId: params.id,
        fileId,
        actorUserId: actor.id,
        actorEmail: actor.email
      });
    } catch (error) {
      const code = normalizeEntityFileError(error) === "file_not_found" ? "file_not_found" : "file_delete_failed";
      redirect(`/contacts/${params.id}?error=${code}`);
    }

    revalidatePath(`/contacts/${params.id}`);
    redirect(`/contacts/${params.id}?ok=file_deleted`);
  }

  if (!data.contact) {
    return (
      <AppShell title="Contacto" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Contacto no encontrado.</div>
      </AppShell>
    );
  }

  const contact = data.contact;
  const tags = tagLinksRes.data ?? [];
  const auditRows = auditRes.data ?? [];
  const comments = data.comments;
  const attachments = await listEntityFilesWithUrls("contact", params.id);
  const initials = contact.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");

  const quickActions = [
    { label: "Nota", icon: "report" as const, href: `/contacts/${encodeURIComponent(params.id)}?tab=activities#contact-notes` },
    { label: "LinkedIn", icon: "linkedin" as const, href: contact.linkedin ? contact.linkedin : undefined },
    { label: "Tarea", icon: "task" as const, href: `/actividades?section=new&contact_id=${encodeURIComponent(params.id)}` },
    { label: "Compañia", icon: "companies" as const, href: contact.investor_id ? `/investors/${encodeURIComponent(contact.investor_id)}` : undefined },
    { label: "Visión 360", icon: "spark" as const, href: `/dashboard/vision-360/contactos/${encodeURIComponent(params.id)}` }
  ];

  const relatedCompanies = contact.investor_name
    ? [{
        id: String(contact.investor_id ?? "company"),
        name: contact.investor_name,
        href: contact.investor_id ? `/investors/${encodeURIComponent(contact.investor_id)}` : undefined,
        detail: contact.role ?? "Compania vinculada"
      }]
    : [];

  const contactDefaults = {
    full_name: contact.full_name,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    role: contact.role ?? "",
    other_contact: contact.other_contact ?? "",
    linkedin: contact.linkedin ?? "",
    comments: contact.comments ?? "",
    is_financier: "is_financier" in contact ? contact.is_financier : "No",
    is_prescriber: "is_prescriber" in contact ? contact.is_prescriber : "No",
    owner_user_id: contact.owner_user_id ?? "",
    next_step: "next_step" in contact && typeof contact.next_step === "string" ? contact.next_step : "",
    due_date: "due_date" in contact && typeof contact.due_date === "string" ? contact.due_date.slice(0, 10) : ""
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
                </div>
              </div>
            </div>

            <div className="contact-record-actions-grid">
              {contact.email ? (
                <ContactEmailDialog email={contact.email} title="Correo de contacto" description="Mostramos el email sin abrir el gestor de correo del equipo.">
                  <button type="button" className="contact-record-action-pill">
                    <span className="contact-record-action-icon"><CrmIcon name="mail" className="crm-icon" /></span>
                    <span>Correo</span>
                  </button>
                </ContactEmailDialog>
              ) : (
                <div className="contact-record-action-pill contact-record-action-pill-disabled">
                  <span className="contact-record-action-icon"><CrmIcon name="mail" className="crm-icon" /></span>
                  <span>Correo</span>
                </div>
              )}
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
                <h3>Informacion clave</h3>
              </div>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <ContactProfileEditDialog action={updateContactAction} defaults={contactDefaults} owners={owners} iconOnly />
              </div>
            </div>

            <div className="contact-record-info-list">
              <div><span>Correo</span><strong>{contact.email ?? "-"}</strong></div>
              <div><span>Numero de telefono</span><strong>{contact.phone ?? "-"}</strong></div>
              <div><span>Nombre de la empresa</span><strong>{contact.investor_name ?? "-"}</strong></div>
              <div><span>Leads asociados</span><strong>{business.leads.length}</strong></div>
              <div><span>Opportunities asociadas</span><strong>{business.opportunities.length}</strong></div>
              <div><span>Otro contacto</span><strong>{contact.other_contact ?? "-"}</strong></div>
              <div><span>Propietario del contacto</span><strong>{contact.owner_email ?? "Sin propietario"}</strong></div>
            </div>
          </section>
        </aside>

        <ContactDetailCenter
          defaults={contactDefaults}
          owners={owners.map((owner) => ({ id: owner.id, email: owner.email }))}
          info={{
            name: contact.full_name,
            email: contact.email ?? "--",
            phone: contact.phone ?? "--",
            role: contact.role ?? "--",
            otherContact: contact.other_contact ?? "--",
            linkedin: contact.linkedin ?? "--",
            isFinancier: "is_financier" in contact ? contact.is_financier : "No",
            isPrescriber: "is_prescriber" in contact ? contact.is_prescriber : "No",
            comments: contact.comments ?? "--"
          }}
          closedDeals={business.opportunities
            .filter((opportunity) => opportunity.resolution === "won")
            .map((opportunity) => ({
              id: opportunity.id,
              name: opportunity.name,
              priority: opportunity.productName,
              amount: formatMoney(opportunity.closedAmount)
            }))}
          comments={comments.map((comment) => ({
            id: comment.id,
            createdBy: comment.created_by_email ?? "-",
            createdAt: formatDateTime(comment.created_at),
            body: comment.body
          }))}
          activities={business.timeline}
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
            lastActivity: business.timeline[0]?.occurredAt ?? "--",
            leads: String(business.leads.length),
            opportunities: String(business.opportunities.length)
          }}
          updateAction={updateContactAction}
          addCommentAction={addCommentAction}
          initialTab={searchParams?.tab}
        />

        <aside className="contact-record-right stack">
          <details className="contact-record-mini-panel" open>
            <summary className="contact-record-mini-summary">
              <div className="contact-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Empresas ({relatedCompanies.length})</span>
              </div>
              <details className="contact-record-mini-menu">
                <summary className="contact-record-mini-action">{relatedCompanies.length > 0 ? "Modificar" : "Agregar"}</summary>
                <div className="contact-record-mini-menu-list">
                  {relatedCompanies.length > 0 ? (
                    <Link href={`/contacts/${encodeURIComponent(params.id)}/company`} className="contact-record-mini-menu-item">Modificar compañía</Link>
                  ) : (
                    <>
                      <Link href="/investors/new" className="contact-record-mini-menu-item">Agregar nueva empresa</Link>
                      <Link href="/investors" className="contact-record-mini-menu-item">Agregar existente</Link>
                    </>
                  )}
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
                <span>Leads ({business.leads.length})</span>
              </div>
            </summary>
            <div className="contact-record-mini-body">
              {business.leads.length > 0 ? business.leads.map((lead) => (
                <Link key={lead.id} href={`/acuerdos/leads/${encodeURIComponent(lead.id)}`} className="contact-record-mini-item">
                  <strong>{lead.name}</strong>
                  <span>{lead.stateName} · {lead.resolution}</span>
                </Link>
              )) : <p className="muted">Sin leads asociados.</p>}
            </div>
          </details>

          <details className="contact-record-mini-panel" open>
            <summary className="contact-record-mini-summary">
              <div className="contact-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Opportunities ({business.opportunities.length})</span>
              </div>
            </summary>
            <div className="contact-record-mini-body">
              {business.opportunities.length > 0 ? business.opportunities.map((opportunity) => (
                <Link key={opportunity.id} href={`/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`} className="contact-record-mini-item">
                  <strong>{opportunity.name}</strong>
                  <span>{opportunity.productName} · {opportunity.stateName}</span>
                </Link>
              )) : <p className="muted">Sin opportunities asociadas.</p>}
            </div>
          </details>

          <EntityFilesPanel
            theme="contact"
            entityType="contact"
            entityId={params.id}
            files={attachments}
            uploadAction={uploadFileAction}
            deleteAction={deleteFileAction}
            searchParams={searchParams}
          />
        </aside>
      </div>
    </AppShell>
  );
}
