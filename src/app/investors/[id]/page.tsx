import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CrmIcon } from "@/components/ui/crm-icon";
import { CompanyDetailCenter } from "@/components/company-detail-center";
import { EntityFilesPanel } from "@/components/entity-files-panel";
import { CompanyProfileEditDialog } from "@/components/company-profile-edit-dialog";
import { CompanyNotesDialog } from "@/components/company-notes-dialog";
import { requireUser } from "@/lib/auth/session";
import { toIsoFromDateTimeLocalInput } from "@/lib/datetime";
import { getBusinessContextForInvestor } from "@/lib/db/business";
import { addEntityNote, getInvestorById, updateInvestorProfile } from "@/lib/db/crm";
import { deleteEntityFile, listEntityFilesWithUrls, normalizeEntityFileError, uploadEntityFile } from "@/lib/db/entity-files";

type PageProps = {
  params: { id: string };
  searchParams?: { ok?: string; error?: string };
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

export default async function InvestorDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const [data, business] = await Promise.all([getInvestorById(params.id), getBusinessContextForInvestor(params.id)]);

  async function addNoteAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const body = String(formData.get("body") ?? "").trim();
    const createdAt = toIsoFromDateTimeLocalInput(formData.get("occurred_at"));
    if (!body) return;

    await addEntityNote({
      entity_type: "investor",
      entity_id: params.id,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email,
      created_at: createdAt
    });

    revalidatePath(`/investors/${params.id}`);
    redirect(`/investors/${params.id}?ok=note`);
  }

  async function updateInvestorAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    try {
      await updateInvestorProfile({
        investor_id: params.id,
        name: String(formData.get("name") ?? "").trim(),
        category: String(formData.get("category") ?? "").trim() || undefined,
        website: String(formData.get("website") ?? "").trim() || undefined,
        strategy: String(formData.get("strategy") ?? "").trim() || undefined,
        address: String(formData.get("address") ?? "").trim() || undefined,
        linkedin: String(formData.get("linkedin") ?? "").trim() || undefined,
        portfolio: String(formData.get("portfolio") ?? "").trim() || undefined,
        comments: String(formData.get("comments") ?? "").trim() || undefined,
        fit: String(formData.get("fit") ?? "").trim() || undefined,
        reason: String(formData.get("reason") ?? "").trim() || undefined,
        min_investment: String(formData.get("min_investment") ?? "").trim() || undefined,
        max_investment: String(formData.get("max_investment") ?? "").trim() || undefined,
        priority: String(formData.get("priority") ?? "").trim() || undefined,
        office: String(formData.get("office") ?? "").trim() || undefined,
        company_size: String(formData.get("company_size") ?? "").trim() || undefined,
        actor_user_id: actor.id,
        actor_email: actor.email
      });

      revalidatePath(`/investors/${params.id}`);
      redirect(`/investors/${params.id}?ok=profile`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron guardar los cambios";
      redirect(`/investors/${params.id}?error=${encodeURIComponent(message)}`);
    }
  }

  async function uploadFileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      redirect(`/investors/${params.id}?error=file_missing`);
    }

    try {
      await uploadEntityFile({
        entityType: "investor",
        entityId: params.id,
        file,
        actorUserId: actor.id,
        actorEmail: actor.email
      });
    } catch (error) {
      redirect(`/investors/${params.id}?error=${normalizeEntityFileError(error)}`);
    }

    revalidatePath(`/investors/${params.id}`);
    redirect(`/investors/${params.id}?ok=file_uploaded`);
  }

  async function deleteFileAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const fileId = String(formData.get("file_id") ?? "").trim();

    if (!fileId) {
      redirect(`/investors/${params.id}?error=file_not_found`);
    }

    try {
      await deleteEntityFile({
        entityType: "investor",
        entityId: params.id,
        fileId,
        actorUserId: actor.id,
        actorEmail: actor.email
      });
    } catch (error) {
      const code = normalizeEntityFileError(error) === "file_not_found" ? "file_not_found" : "file_delete_failed";
      redirect(`/investors/${params.id}?error=${code}`);
    }

    revalidatePath(`/investors/${params.id}`);
    redirect(`/investors/${params.id}?ok=file_deleted`);
  }

  if (!data.investor) {
    return (
      <AppShell title="Compania" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Compania no encontrada.</div>
      </AppShell>
    );
  }

  const investor = data.investor;
  const contacts = data.contacts;
  const notes = data.comments.map((note) => ({
    id: String(note.id),
    body: note.body,
    created_at: formatDateTime(note.created_at),
    created_by_email: note.created_by_email ?? null
  }));
  const attachments = await listEntityFilesWithUrls("investor", params.id);
  const initials = investor.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");
  const primaryContact = contacts[0] ?? null;
  const lastTouch = business.timeline[0]?.occurredAt ?? formatDateTime(investor.updated_at);

  const defaults = {
    name: investor.name,
    category: investor.category ?? "",
    website: investor.website ?? "",
    strategy: investor.strategy ?? "",
    priority: investor.priority ?? "",
    office: investor.office ?? "",
    company_size: investor.company_size ?? "",
    min_investment: investor.min_investment ?? "",
    max_investment: investor.max_investment ?? "",
    address: investor.address ?? "",
    linkedin: investor.linkedin ?? "",
    portfolio: investor.portfolio ?? "",
    fit: investor.fit ?? "",
    reason: investor.reason ?? "",
    comments: investor.comments ?? ""
  };

  const advancedItems = [
    { label: "Estrategia", value: investor.strategy || "--" },
    { label: "Tipo fondo", value: investor.tipo_fondo || "--" },
    { label: "Mercados", value: investor.mercados || "--" },
    { label: "Web", value: investor.website || "--" },
    { label: "Portfolio", value: investor.portfolio || "--" },
    { label: "LinkedIn", value: investor.linkedin || "--" },
    { label: "Encaje SUMMAX", value: investor.fit || "--" },
    { label: "Tamano", value: investor.company_size || "--" },
    { label: "Inversion minima", value: investor.min_investment || "--" },
    { label: "Inversion maxima", value: investor.max_investment || "--" },
    { label: "Motivo", value: investor.reason || "--", wide: true },
    { label: "Comentarios", value: investor.comments || "--", wide: true }
  ];

  const quickActions = [
    { label: "Correo", icon: "mail" as const, href: primaryContact?.email ? `mailto:${primaryContact.email}` : undefined },
    { label: "LinkedIn", icon: "linkedin" as const, href: investor.linkedin ? investor.linkedin : undefined, external: Boolean(investor.linkedin) },
    { label: "Web", icon: "web" as const, href: investor.website ? investor.website : undefined, external: Boolean(investor.website) },
    { label: "Tarea", icon: "task" as const, href: "/actividades?section=new" },
    { label: "Visión 360", icon: "spark" as const, href: `/dashboard/vision-360/companias/${encodeURIComponent(params.id)}` }
  ];

  return (
    <AppShell title={investor.name} subtitle="Ficha compacta de compania" canViewGlobal={user.can_view_global_dashboard} showHeader={false}>
      <div className="company-record-layout">
        <aside className="company-record-aside stack">
          <section className="company-record-primary card">
            <div className="company-record-topbar">
              <Link href="/investors" className="company-record-back">
                <CrmIcon name="back" className="crm-icon" />
                <span>Compañías</span>
              </Link>
            </div>

            <div className="company-record-hero">
              <div className="company-record-avatar">{initials || "CO"}</div>
              <div className="company-record-copy">
                <h2>{investor.name}</h2>
              </div>
            </div>

            <div className="company-record-actions-grid">
              <CompanyNotesDialog notes={notes} action={addNoteAction} />
              {quickActions.map((action) =>
                action.href ? (
                  action.external ? (
                    <a key={action.label} href={action.href} target="_blank" rel="noreferrer" className="company-record-action-pill">
                      <span className="company-record-action-icon"><CrmIcon name={action.icon} className="crm-icon" /></span>
                      <span>{action.label}</span>
                    </a>
                  ) : (
                    <Link key={action.label} href={action.href} className="company-record-action-pill">
                      <span className="company-record-action-icon"><CrmIcon name={action.icon} className="crm-icon" /></span>
                      <span>{action.label}</span>
                    </Link>
                  )
                ) : (
                  <div key={action.label} className="company-record-action-pill company-record-action-pill-disabled">
                    <span className="company-record-action-icon"><CrmIcon name={action.icon} className="crm-icon" /></span>
                    <span>{action.label}</span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="company-record-info card">
            <div className="company-record-section-head">
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <CrmIcon name="chevron_down" className="crm-icon" />
                <h3>Informacion clave</h3>
              </div>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <CompanyProfileEditDialog action={updateInvestorAction} defaults={defaults} iconOnly />
              </div>
            </div>

            <div className="company-record-info-list">
              <div><span>Propietario del registro de compania</span><strong>Sin propietario</strong></div>
              <div><span>Leads asociados</span><strong>{business.leads.length}</strong></div>
              <div><span>Opportunities asociadas</span><strong>{business.opportunities.length}</strong></div>
              <div><span>Tipo</span><strong>{investor.tipo_fondo || investor.category || "--"}</strong></div>
              <div><span>Ultimo contacto</span><strong>{lastTouch}</strong></div>
            </div>
          </section>
        </aside>

        <CompanyDetailCenter
          defaults={defaults}
          profile={{
            city: investor.office || "--",
            address: investor.address || "--",
            zipCode: "--",
            region: investor.mercados || "--",
            country: "--",
            sector: investor.sector || investor.category || "--"
          }}
          completedDeals={business.opportunities
            .filter((opportunity) => opportunity.resolution === "won")
            .map((opportunity) => ({
              id: opportunity.id,
              name: opportunity.name,
              amount: formatMoney(opportunity.closedAmount),
              closedAt: opportunity.openedAt
            }))}
          advanced={advancedItems}
          action={updateInvestorAction}
        />

        <aside className="company-detail-side stack">
          <details className="company-record-mini-panel" open>
            <summary className="company-record-mini-summary">
              <div className="company-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Contactos ({contacts.length})</span>
              </div>
              <div className="company-record-mini-actions">
                <details className="company-record-mini-menu">
                  <summary className="company-record-mini-action">Agregar</summary>
                  <div className="company-record-mini-menu-list">
                    <Link href={`/contacts/new?investor_id=${encodeURIComponent(params.id)}`} className="company-record-mini-menu-item">Anadir un nuevo contacto</Link>
                    <Link href={`/investors/${encodeURIComponent(params.id)}/contacts/link`} className="company-record-mini-menu-item">Agregar contacto existente</Link>
                  </div>
                </details>
              </div>
            </summary>
            <div className="company-record-mini-body">
              {contacts.length > 0 ? contacts.map((contact) => (
                <Link key={contact.id} href={`/contacts/${encodeURIComponent(contact.id)}`} className="company-record-mini-item">
                  <strong>{contact.full_name}</strong>
                  <span>{contact.email ?? "Sin datos"}</span>
                </Link>
              )) : <p className="muted">Sin contactos asociados.</p>}
            </div>
          </details>

          <details className="company-record-mini-panel" open>
            <summary className="company-record-mini-summary">
              <div className="company-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Leads ({business.leads.length})</span>
              </div>
            </summary>
            <div className="company-record-mini-body">
              {business.leads.length > 0 ? business.leads.map((lead) => (
                <Link key={lead.id} href={`/acuerdos/leads/${encodeURIComponent(lead.id)}`} className="company-record-mini-item">
                  <strong>{lead.name}</strong>
                  <span>{lead.stateName} · {lead.resolution}</span>
                </Link>
              )) : <p className="muted">Sin leads asociados.</p>}
            </div>
          </details>

          <details className="company-record-mini-panel" open>
            <summary className="company-record-mini-summary">
              <div className="company-record-mini-title">
                <CrmIcon name="chevron_down" className="crm-icon" />
                <span>Opportunities ({business.opportunities.length})</span>
              </div>
            </summary>
            <div className="company-record-mini-body">
              {business.opportunities.length > 0 ? business.opportunities.map((opportunity) => (
                <Link key={opportunity.id} href={`/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`} className="company-record-mini-item">
                  <strong>{opportunity.name}</strong>
                  <span>{opportunity.productName} · {opportunity.stateName}</span>
                </Link>
              )) : <p className="muted">Sin opportunities asociadas.</p>}
            </div>
          </details>

          <EntityFilesPanel
            theme="company"
            entityType="investor"
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
