import { getBusinessContextForContact, getBusinessContextForInvestor, type BusinessTimelineItem } from "@/lib/db/business";
import { getContactById, getInvestorById } from "@/lib/db/crm";
import { formatFileSize, listEntityFilesWithUrls, type EntityFileView } from "@/lib/db/entity-files";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type TagLinkRow = {
  tags: {
    id?: string;
    name?: string;
    color?: string;
  } | null;
};

type AuditRow = {
  id: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  action: string | null;
  changed_by_email: string | null;
  changed_at: string;
};

type EntityNoteRow = {
  id: string;
  body: string;
  created_by_email: string | null;
  created_at: string;
};

type ContactFollowUpRow = {
  contact_id: number;
  persona_contacto: string | null;
  owner_email: string | null;
  proxima_accion: string | null;
  fecha_objetivo: string | null;
  updated_at: string | null;
};

export type Dashboard360Summary = {
  title: string;
  subtitle: string;
  ownerLabel: string;
  relationLabel: string | null;
  relationHref: string | null;
  lastActivityLabel: string;
  statusLabel: string;
  metrics: Array<{ label: string; value: string }>;
};

export type Dashboard360KnowledgeItem = {
  label: string;
  value: string;
  href?: string;
};

export type Dashboard360PipelineItem = {
  id: string;
  title: string;
  kind: "lead" | "opportunity";
  href: string;
  status: string;
  owner: string;
  detail: string;
  priority: number;
};

export type Dashboard360TimelineItem = {
  id: string;
  title: string;
  body: string;
  occurredAt: string;
  occurredAtRaw: string;
  source: "pipeline" | "note" | "audit";
  href?: string;
};

export type Dashboard360DecisionItem = {
  id: string;
  title: string;
  body: string;
  occurredAt: string;
  occurredAtRaw: string;
  href?: string;
};

export type Dashboard360NextAction = {
  title: string;
  detail: string;
  dueLabel: string;
  href: string;
  ctaLabel: string;
  status: "focus" | "scheduled" | "missing";
};

export type Dashboard360ResponsibleItem = {
  label: string;
  value: string;
};

export type Dashboard360RelationshipItem = {
  id: string;
  title: string;
  meta: string;
  href?: string;
};

export type Contact360DashboardData = {
  summary: Dashboard360Summary;
  knowledge: Dashboard360KnowledgeItem[];
  pipeline: Dashboard360PipelineItem[];
  timeline: Dashboard360TimelineItem[];
  decisions: Dashboard360DecisionItem[];
  documents: EntityFileView[];
  nextAction: Dashboard360NextAction;
  responsibles: Dashboard360ResponsibleItem[];
  relationships: Dashboard360RelationshipItem[];
  tags: string[];
};

export type Investor360DashboardData = {
  summary: Dashboard360Summary;
  knowledge: Dashboard360KnowledgeItem[];
  pipeline: Dashboard360PipelineItem[];
  timeline: Dashboard360TimelineItem[];
  decisions: Dashboard360DecisionItem[];
  documents: EntityFileView[];
  nextAction: Dashboard360NextAction;
  responsibles: Dashboard360ResponsibleItem[];
  relationships: Dashboard360RelationshipItem[];
};

export type Dashboard360ContactListItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
};

export type Dashboard360InvestorListItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleString("es-ES");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("es-ES");
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function sortByOccurredAtDesc<T extends { occurredAtRaw: string }>(rows: T[]) {
  return rows.sort((left, right) => new Date(right.occurredAtRaw).getTime() - new Date(left.occurredAtRaw).getTime());
}

function uniqueLabels(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function uniqueJoin(values: Array<string | null | undefined>, fallback = "--") {
  const labels = uniqueLabels(values);
  return labels.length > 0 ? labels.join(", ") : fallback;
}

function buildPipelineItems(params: {
  leads: Awaited<ReturnType<typeof getBusinessContextForContact>>["leads"];
  opportunities: Awaited<ReturnType<typeof getBusinessContextForContact>>["opportunities"];
}) {
  const leadItems: Dashboard360PipelineItem[] = params.leads.map((lead) => ({
    id: `lead:${lead.id}`,
    title: lead.name,
    kind: "lead",
    href: `/acuerdos/leads/${encodeURIComponent(lead.id)}`,
    status: `${lead.stateName} · ${lead.resolution}`,
    owner: lead.ownerEmail,
    detail: `Abierto ${lead.openedAt}`,
    priority: lead.resolution === "open" ? 1 : 3
  }));

  const opportunityItems: Dashboard360PipelineItem[] = params.opportunities.map((opportunity) => ({
    id: `opportunity:${opportunity.id}`,
    title: opportunity.name,
    kind: "opportunity",
    href: `/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`,
    status: `${opportunity.stateName} · ${opportunity.resolution}`,
    owner: opportunity.ownerEmail,
    detail: `${opportunity.productName} · ${formatCurrency(opportunity.closedAmount ?? opportunity.estimatedAmount)}`,
    priority: opportunity.resolution === "open" ? 0 : 2
  }));

  return [...opportunityItems, ...leadItems].sort((left, right) => left.priority - right.priority);
}

function mapBusinessTimeline(rows: BusinessTimelineItem[]): Dashboard360TimelineItem[] {
  return rows.map((row) => ({
    id: `pipeline:${row.id}`,
    title: row.title,
    body: `${row.type} · ${row.body}`,
    occurredAt: row.occurredAt,
    occurredAtRaw: row.occurredAtRaw,
    source: "pipeline",
    href: row.href
  }));
}

function auditFieldLabel(field: string | null | undefined) {
  switch (field) {
    case "owner_user_id":
    case "owner_email":
      return "Responsable actualizado";
    case "attachments":
      return "Documentación actualizada";
    case "profile":
      return "Perfil actualizado";
    case "company_id":
      return "Relación con compañía actualizada";
    case "nota":
      return "Nota interna añadida";
    case "comentarios":
      return "Comentarios actualizados";
    default:
      return field ? `Cambio en ${field}` : "Cambio registrado";
  }
}

function mapAuditTimeline(rows: AuditRow[], href?: string): Dashboard360TimelineItem[] {
  return rows.map((row) => {
    const bodyParts = [];
    if (row.changed_by_email) bodyParts.push(row.changed_by_email);
    if (row.old_value && row.new_value) {
      bodyParts.push(`De ${row.old_value} a ${row.new_value}`);
    } else if (row.new_value) {
      bodyParts.push(row.new_value);
    } else if (row.old_value) {
      bodyParts.push(`Antes: ${row.old_value}`);
    }

    return {
      id: `audit:${row.id}`,
      title: auditFieldLabel(row.field),
      body: bodyParts.join(" · ") || row.action || "--",
      occurredAt: formatDateTime(row.changed_at),
      occurredAtRaw: row.changed_at,
      source: "audit" as const,
      href
    };
  });
}

function mapNoteTimeline(rows: EntityNoteRow[], sourceLabel: string, href?: string): Dashboard360TimelineItem[] {
  return rows.map((row) => ({
    id: `note:${row.id}`,
    title: sourceLabel,
    body: `${row.created_by_email ?? "CRM"} · ${row.body}`,
    occurredAt: formatDateTime(row.created_at),
    occurredAtRaw: row.created_at,
    source: "note" as const,
    href
  }));
}

function decisionFromTimeline(row: Dashboard360TimelineItem): Dashboard360DecisionItem | null {
  if (row.source === "pipeline") {
    const normalized = row.title.toLowerCase();
    if (
      normalized.includes("estado:") ||
      normalized.includes("conversión") ||
      normalized.includes("ganada") ||
      normalized.includes("perdida") ||
      normalized.includes("descartado")
    ) {
      return {
        id: `decision:${row.id}`,
        title: row.title,
        body: row.body,
        occurredAt: row.occurredAt,
        occurredAtRaw: row.occurredAtRaw,
        href: row.href
      };
    }
  }

  if (row.source === "audit") {
    return {
      id: `decision:${row.id}`,
      title: row.title,
      body: row.body,
      occurredAt: row.occurredAt,
      occurredAtRaw: row.occurredAtRaw,
      href: row.href
    };
  }

  return null;
}

async function listEntityNotes(entityType: "contact" | "investor", entityId: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("entity_notes")
    .select("id, body, created_by_email, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (result.error) {
    return [] as EntityNoteRow[];
  }

  return (result.data ?? []) as EntityNoteRow[];
}

async function listAuditRows(entityType: "contact" | "investor", entityId: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("audit_log")
    .select("id, field, old_value, new_value, action, changed_by_email, changed_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("changed_at", { ascending: false })
    .limit(18);

  if (result.error) throw result.error;
  return (result.data ?? []) as AuditRow[];
}

async function listTags(entityType: "contact" | "investor", entityId: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("entity_tags")
    .select("tag_id, tags(id, name, color)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (result.error) return [];
  return ((result.data ?? []) as TagLinkRow[])
    .map((row) => row.tags?.name ?? "")
    .filter(Boolean);
}

function deriveContactNextAction(params: {
  contactHref: string;
  activityHref: string;
  openOpportunity: Dashboard360PipelineItem | null;
  openLead: Dashboard360PipelineItem | null;
  nextStep: string | null | undefined;
  dueDate: string | null | undefined;
}) {
  if (params.openOpportunity) {
    return {
      title: params.openOpportunity.title,
      detail: `Opportunity abierta · ${params.openOpportunity.status}`,
      dueLabel: "Gestionar desde la ficha operativa",
      href: params.openOpportunity.href,
      ctaLabel: "Abrir opportunity",
      status: "focus"
    } satisfies Dashboard360NextAction;
  }

  if (params.openLead) {
    return {
      title: params.openLead.title,
      detail: `Lead abierto · ${params.openLead.status}`,
      dueLabel: "Gestionar desde la ficha operativa",
      href: params.openLead.href,
      ctaLabel: "Abrir lead",
      status: "focus"
    } satisfies Dashboard360NextAction;
  }

  if (params.nextStep) {
    return {
      title: params.nextStep,
      detail: "Seguimiento definido a nivel de contacto",
      dueLabel: params.dueDate ? `Fecha objetivo: ${formatDate(params.dueDate)}` : "Sin fecha objetivo",
      href: params.contactHref,
      ctaLabel: "Abrir contacto",
      status: params.dueDate ? "scheduled" : "focus"
    } satisfies Dashboard360NextAction;
  }

  return {
    title: "Sin siguiente paso definido",
    detail: "No hay negocio abierto ni seguimiento manual definido para este contacto.",
    dueLabel: "Conviene registrar una nueva tarea o documentar el próximo movimiento.",
    href: params.activityHref,
    ctaLabel: "Registrar tarea",
    status: "missing"
  } satisfies Dashboard360NextAction;
}

function deriveInvestorNextAction(params: {
  companyHref: string;
  activityHref: string;
  pipeline: Dashboard360PipelineItem[];
  followUps: ContactFollowUpRow[];
}) {
  const openOpportunity = params.pipeline.find((item) => item.kind === "opportunity" && item.status.toLowerCase().includes("open")) ?? null;
  const openLead = params.pipeline.find((item) => item.kind === "lead" && item.status.toLowerCase().includes("open")) ?? null;

  if (openOpportunity) {
    return {
      title: openOpportunity.title,
      detail: `Opportunity prioritaria · ${openOpportunity.status}`,
      dueLabel: "Gestionar desde la ficha operativa",
      href: openOpportunity.href,
      ctaLabel: "Abrir opportunity",
      status: "focus"
    } satisfies Dashboard360NextAction;
  }

  if (openLead) {
    return {
      title: openLead.title,
      detail: `Lead prioritario · ${openLead.status}`,
      dueLabel: "Gestionar desde la ficha operativa",
      href: openLead.href,
      ctaLabel: "Abrir lead",
      status: "focus"
    } satisfies Dashboard360NextAction;
  }

  const bestContact = [...params.followUps]
    .filter((row) => row.proxima_accion)
    .sort((left, right) => {
      const leftDate = left.fecha_objetivo ? new Date(left.fecha_objetivo).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.fecha_objetivo ? new Date(right.fecha_objetivo).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    })[0];

  if (bestContact?.proxima_accion) {
    return {
      title: bestContact.proxima_accion,
      detail: `Seguimiento definido en contacto · ${bestContact.persona_contacto ?? `Contacto ${bestContact.contact_id}`}`,
      dueLabel: bestContact.fecha_objetivo ? `Fecha objetivo: ${formatDate(bestContact.fecha_objetivo)}` : "Sin fecha objetivo",
      href: `/contacts/${encodeURIComponent(String(bestContact.contact_id))}`,
      ctaLabel: "Abrir contacto",
      status: bestContact.fecha_objetivo ? "scheduled" : "focus"
    } satisfies Dashboard360NextAction;
  }

  return {
    title: "Sin siguiente paso definido",
    detail: "No hay negocio abierto ni seguimiento manual claro en los contactos asociados.",
    dueLabel: "Conviene registrar una tarea o documentar el próximo movimiento.",
    href: params.activityHref,
    ctaLabel: "Registrar tarea",
    status: "missing"
  } satisfies Dashboard360NextAction;
}

async function listInvestorContactFollowUps(companyId: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("contactos")
    .select("contact_id, persona_contacto, owner_email, proxima_accion, fecha_objetivo, updated_at")
    .eq("company_id", Number(companyId))
    .order("updated_at", { ascending: false })
    .limit(40);

  if (result.error) {
    return [] as ContactFollowUpRow[];
  }

  return (result.data ?? []) as ContactFollowUpRow[];
}

export async function getContact360DashboardData(contactId: string): Promise<Contact360DashboardData | null> {
  const [contactData, business, files, auditRows, tags, entityNotes] = await Promise.all([
    getContactById(contactId),
    getBusinessContextForContact(contactId),
    listEntityFilesWithUrls("contact", contactId),
    listAuditRows("contact", contactId),
    listTags("contact", contactId),
    listEntityNotes("contact", contactId)
  ]);

  if (!contactData.contact) return null;

  const contact = contactData.contact;
  const pipeline = buildPipelineItems({ leads: business.leads, opportunities: business.opportunities });
  const openOpportunity = pipeline.find((item) => item.kind === "opportunity" && item.status.toLowerCase().includes("open")) ?? null;
  const openLead = pipeline.find((item) => item.kind === "lead" && item.status.toLowerCase().includes("open")) ?? null;
  const pseudoNotes = contactData.comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    created_by_email: comment.created_by_email,
    created_at: comment.created_at
  }));

  const timeline = sortByOccurredAtDesc([
    ...mapBusinessTimeline(business.timeline),
    ...mapNoteTimeline(pseudoNotes, "Nota de contacto", `/contacts/${encodeURIComponent(contactId)}?tab=activities`),
    ...mapNoteTimeline(entityNotes, "Nota estructural", `/contacts/${encodeURIComponent(contactId)}?tab=activities`),
    ...mapAuditTimeline(auditRows, `/contacts/${encodeURIComponent(contactId)}`)
  ]).slice(0, 24);

  const decisions = sortByOccurredAtDesc(
    timeline
      .map((item) => decisionFromTimeline(item))
      .filter((item): item is Dashboard360DecisionItem => Boolean(item))
  ).slice(0, 10);

  const relationships = contact.investor_name
    ? [{
        id: String(contact.investor_id ?? "company"),
        title: contact.investor_name,
        meta: contact.role ?? "Compañía vinculada",
        href: contact.investor_id ? `/dashboard/vision-360/companias/${encodeURIComponent(contact.investor_id)}` : undefined
      }]
    : [];

  const responsibles: Dashboard360ResponsibleItem[] = [
    { label: "Owner del contacto", value: contact.owner_email ?? "Sin propietario" },
    { label: "Owners de negocio", value: uniqueJoin([...business.leads.map((lead) => lead.ownerEmail), ...business.opportunities.map((item) => item.ownerEmail)], "Sin negocio asignado") },
    { label: "Etiquetas", value: tags.length > 0 ? tags.join(", ") : "Sin etiquetas" }
  ];

  return {
    summary: {
      title: contact.full_name,
      subtitle: `${contact.role ?? "Contacto"} · Visión ejecutiva`,
      ownerLabel: contact.owner_email ?? "Sin propietario",
      relationLabel: contact.investor_name ?? null,
      relationHref: contact.investor_id ? `/dashboard/vision-360/companias/${encodeURIComponent(contact.investor_id)}` : null,
      lastActivityLabel: timeline[0]?.occurredAt ?? formatDateTime(contact.updated_at),
      statusLabel: openOpportunity ? "Opportunity activa" : openLead ? "Lead activo" : "Seguimiento de contacto",
      metrics: [
        { label: "Leads", value: String(business.leads.length) },
        { label: "Opportunities", value: String(business.opportunities.length) },
        { label: "Documentos", value: String(files.length) }
      ]
    },
    knowledge: [
      { label: "Correo", value: contact.email ?? "--" },
      { label: "Teléfono", value: contact.phone ?? "--" },
      { label: "LinkedIn", value: contact.linkedin ?? "--", href: contact.linkedin ?? undefined },
      { label: "Rol", value: contact.role ?? "--" },
      { label: "Otro contacto", value: contact.other_contact ?? "--" },
      { label: "Compañía", value: contact.investor_name ?? "--", href: contact.investor_id ? `/investors/${encodeURIComponent(contact.investor_id)}` : undefined },
      { label: "Prescriptor", value: "is_prescriber" in contact ? contact.is_prescriber : "No" },
      { label: "Financiador", value: "is_financier" in contact ? contact.is_financier : "No" },
      { label: "Comentarios estructurales", value: contact.comments ?? "--" }
    ],
    pipeline,
    timeline,
    decisions,
    documents: files,
    nextAction: deriveContactNextAction({
      contactHref: `/contacts/${encodeURIComponent(contactId)}`,
      activityHref: `/actividades?section=new&contact_id=${encodeURIComponent(contactId)}`,
      openOpportunity,
      openLead,
      nextStep: contact.next_step,
      dueDate: contact.due_date
    }),
    responsibles,
    relationships,
    tags
  };
}

export async function getInvestor360DashboardData(companyId: string): Promise<Investor360DashboardData | null> {
  const [investorData, business, files, auditRows, tags, entityNotes, followUps] = await Promise.all([
    getInvestorById(companyId),
    getBusinessContextForInvestor(companyId),
    listEntityFilesWithUrls("investor", companyId),
    listAuditRows("investor", companyId),
    listTags("investor", companyId),
    listEntityNotes("investor", companyId),
    listInvestorContactFollowUps(companyId)
  ]);

  if (!investorData.investor) return null;

  const investor = investorData.investor;
  const pipeline = buildPipelineItems({ leads: business.leads, opportunities: business.opportunities });
  const pseudoNotes = investorData.comments.map((comment) => ({
    id: String(comment.id),
    body: comment.body,
    created_by_email: comment.created_by_email,
    created_at: comment.created_at
  }));

  const timeline = sortByOccurredAtDesc([
    ...mapBusinessTimeline(business.timeline),
    ...mapNoteTimeline(pseudoNotes, "Comentario de compañía", `/investors/${encodeURIComponent(companyId)}`),
    ...mapNoteTimeline(entityNotes, "Nota estructural", `/investors/${encodeURIComponent(companyId)}`),
    ...mapAuditTimeline(auditRows, `/investors/${encodeURIComponent(companyId)}`)
  ]).slice(0, 24);

  const decisions = sortByOccurredAtDesc(
    timeline
      .map((item) => decisionFromTimeline(item))
      .filter((item): item is Dashboard360DecisionItem => Boolean(item))
  ).slice(0, 10);

  const relationships = investorData.contacts.map((contact) => ({
    id: contact.id,
    title: contact.full_name,
    meta: contact.email ?? "Sin email",
    href: `/dashboard/vision-360/contactos/${encodeURIComponent(contact.id)}`
  }));

  const businessOwners = uniqueLabels([...business.leads.map((lead) => lead.ownerEmail), ...business.opportunities.map((item) => item.ownerEmail)]);
  const contactOwners = uniqueLabels(followUps.map((row) => row.owner_email));
  const primaryOwner = businessOwners[0] ?? contactOwners[0] ?? "Sin responsable principal";

  return {
    summary: {
      title: investor.name,
      subtitle: `${investor.tipo_fondo || investor.category || "Compañía"} · Visión ejecutiva`,
      ownerLabel: primaryOwner,
      relationLabel: relationships.length > 0 ? `${relationships.length} contactos vinculados` : "Sin contactos vinculados",
      relationHref: relationships[0]?.href ?? null,
      lastActivityLabel: timeline[0]?.occurredAt ?? formatDateTime(investor.updated_at),
      statusLabel: pipeline.some((item) => item.status.toLowerCase().includes("open")) ? "Pipeline activo" : "Cuenta en seguimiento",
      metrics: [
        { label: "Contactos", value: String(relationships.length) },
        { label: "Negocios", value: String(pipeline.length) },
        { label: "Documentos", value: String(files.length) }
      ]
    },
    knowledge: [
      { label: "Categoría", value: investor.category ?? "--" },
      { label: "Tipo de fondo", value: investor.tipo_fondo || "--" },
      { label: "Sector", value: investor.sector || "--" },
      { label: "Web", value: investor.website || "--", href: investor.website || undefined },
      { label: "LinkedIn", value: investor.linkedin || "--", href: investor.linkedin || undefined },
      { label: "Estrategia", value: investor.strategy || "--" },
      { label: "Mercados", value: investor.mercados || "--" },
      { label: "Encaje SUMMAX", value: investor.fit || "--" },
      { label: "Comentarios estructurales", value: investor.comments || "--" }
    ],
    pipeline,
    timeline,
    decisions,
    documents: files,
    nextAction: deriveInvestorNextAction({
      companyHref: `/investors/${encodeURIComponent(companyId)}`,
      activityHref: "/actividades?section=new",
      pipeline,
      followUps
    }),
    responsibles: [
      { label: "Responsable principal", value: primaryOwner },
      { label: "Owners de negocio", value: businessOwners.length > 0 ? businessOwners.join(", ") : "Sin negocio asignado" },
      { label: "Owners de contactos", value: contactOwners.length > 0 ? contactOwners.join(", ") : "Sin contactos asignados" },
      { label: "Etiquetas", value: tags.length > 0 ? tags.join(", ") : "Sin etiquetas" }
    ],
    relationships
  };
}

export async function listVision360Contacts(query: string) {
  const db = createSourceCrmServerClient();
  let request = db
    .from("contactos")
    .select("contact_id, persona_contacto, compania, email, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);

  const trimmed = query.trim();
  if (trimmed.length >= 2) {
    const pattern = `%${trimmed}%`;
    request = request.or(`persona_contacto.ilike.${pattern},compania.ilike.${pattern},email.ilike.${pattern}`);
  }

  const result = await request;
  if (result.error) throw result.error;

  return (result.data ?? []).map((row) => ({
    id: String(row.contact_id),
    title: row.persona_contacto ?? `Contacto ${row.contact_id}`,
    subtitle: [row.compania ?? "Sin compañía", row.email ?? "Sin email"].join(" · "),
    href: `/dashboard/vision-360/contactos/${encodeURIComponent(String(row.contact_id))}`,
    updatedAt: formatDateTime(row.updated_at)
  })) satisfies Dashboard360ContactListItem[];
}

export async function listVision360Investors(query: string) {
  const db = createSourceCrmServerClient();
  let request = db
    .from("inversion")
    .select("company_id, compania, vertical, web, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);

  const trimmed = query.trim();
  if (trimmed.length >= 2) {
    const pattern = `%${trimmed}%`;
    request = request.or(`compania.ilike.${pattern},vertical.ilike.${pattern},web.ilike.${pattern}`);
  }

  const result = await request;
  if (result.error) throw result.error;

  return (result.data ?? []).map((row) => ({
    id: String(row.company_id),
    title: row.compania ?? `Compañía ${row.company_id}`,
    subtitle: [row.vertical ?? "Sin categoría", row.web ?? "Sin web"].join(" · "),
    href: `/dashboard/vision-360/companias/${encodeURIComponent(String(row.company_id))}`,
    updatedAt: formatDateTime(row.updated_at)
  })) satisfies Dashboard360InvestorListItem[];
}

export function formatDashboard360DocumentMeta(file: EntityFileView) {
  return `${formatFileSize(file.size_bytes)} · ${file.uploaded_by_email ?? "Sin autor"} · ${formatDateTime(file.created_at)}`;
}
