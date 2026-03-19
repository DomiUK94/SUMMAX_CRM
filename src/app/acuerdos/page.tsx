import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessGuideButton } from "@/components/business-guide-button";
import { BusinessLeadTaskDialog } from "@/components/business-lead-task-dialog";
import { BusinessOpportunityTaskDialog } from "@/components/business-opportunity-task-dialog";
import { BusinessPipelineTable } from "@/components/business-pipeline-table";
import { BusinessProspectTaskDialog } from "@/components/business-prospect-task-dialog";
import { requireUser } from "@/lib/auth/session";
import { toIsoFromDateTimeLocalInput } from "@/lib/datetime";
import { completePipelineTask } from "@/lib/db/pipeline";
import { createLead } from "@/lib/db/leads";
import { convertLeadToOpportunity, logStateEvent } from "@/lib/db/pipeline";
import { listLeadsPage, type LeadResolution } from "@/lib/db/leads";
import { listOpportunitiesPage, type OpportunityResolution } from "@/lib/db/opportunities";
import {
  convertProspectToLead,
  createProspect,
  getOpenProspectByContact,
  listProspectsPage,
  reopenProspect,
  syncProspectStatusFromTasks,
  type ProspectRecord
} from "@/lib/db/prospects";
import { createProspectTask, listRecentProspectTasks } from "@/lib/db/prospect-tasks";
import { createFactServerClient } from "@/lib/supabase/fact";
import { listProducts } from "@/lib/db/products";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { listAssignableUsers } from "@/lib/db/users";

type BusinessSection = "overview" | "prospects" | "leads" | "opportunities" | "closed_deals";

type SearchParams = {
  section?: string;
  view?: string;
  q?: string;
  owner?: string;
  state?: string;
  product?: string;
  resolution?: string;
  activity3d?: string;
  overdue?: string;
};

type StateRow = {
  id: string;
  code: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  is_terminal: boolean;
  is_conversion_state: boolean;
  sort_order: number;
};

type SimpleCompany = {
  company_id: number;
  compania: string | null;
};

type SimpleContact = {
  contact_id: number;
  persona_contacto: string | null;
};

type TaskRow = {
  id: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  state_id: string;
  resulting_state_id: string | null;
  task_kind: "action" | "feedback";
  sort_order: number;
  active: boolean;
};

type EventRow = {
  id: string;
  entity_type: "lead" | "opportunity";
  lead_id: string | null;
  opportunity_id: string | null;
  contact_id: number;
  task_id: string | null;
  occurred_at: string;
};

type ContactOptionRow = {
  contact_id: number;
  company_id: number;
  persona_contacto: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  es_preescriptor: boolean | null;
};

const PROSPECT_TASK_NAMES = new Set(["Contactar", "Contactado", "2ndo contacto"]);
const CONTACT_PROGRESS_TASK_NAMES = new Set(["Contactado", "2ndo contacto"]);

function normalizeSection(value: string | undefined): BusinessSection {
  if (value === "prospects" || value === "leads" || value === "opportunities" || value === "closed_deals") return value;
  return "overview";
}

function normalizeOverdue(value: string | undefined) {
  return value === "1";
}

function isInactiveForDays(updatedAt: string, days: number) {
  return Date.now() - new Date(updatedAt).getTime() > days * 24 * 60 * 60 * 1000;
}

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("es-ES");
}

function formatDateTime(value: string | null) {
  if (!value) return "--";
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

function shortId(value: string) {
  return value.slice(0, 8);
}

function resolutionOptionsFor(section: BusinessSection) {
  if (section === "leads") {
    return [
      { value: "", label: "Todas" },
      { value: "open", label: "Open" },
      { value: "converted", label: "Converted" },
      { value: "discarded", label: "Discarded" },
      { value: "closed", label: "Closed" }
    ] satisfies Array<{ value: LeadResolution | ""; label: string }>;
  }

  return [
    { value: "", label: "Todas" },
    { value: "open", label: "Open" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
    { value: "cancelled", label: "Cancelled" }
  ] satisfies Array<{ value: OpportunityResolution | ""; label: string }>;
}

function buildHref(params: {
  section: BusinessSection;
  q?: string;
  owner?: string;
  state?: string;
  product?: string;
  resolution?: string;
  activity3d?: boolean;
  overdue?: boolean;
}) {
  const search = new URLSearchParams();
  search.set("section", params.section);
  if (params.q) search.set("q", params.q);
  if (params.owner) search.set("owner", params.owner);
  if (params.state) search.set("state", params.state);
  if (params.product) search.set("product", params.product);
  if (params.resolution) search.set("resolution", params.resolution);
  if (params.activity3d) search.set("activity3d", "1");
  if (params.overdue) search.set("overdue", "1");
  return `/acuerdos?${search.toString()}`;
}

function renderPipelineSection(params: {
  title: string;
  headerAction?: React.ReactNode;
  table: React.ReactNode;
}) {
  return (
    <section className="card stack">
      <div className="deal-detail-timeline-head">
        <div>
          <h3>{params.title}</h3>
        </div>
        {params.headerAction ?? null}
      </div>

      {params.table}
    </section>
  );
}

async function listStates() {
  const dim = createDimServerClient();
  const result = await dim
    .from("state")
    .select("id, code, name, entity_type, is_terminal, is_conversion_state, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (result.error) throw result.error;
  return (result.data ?? []) as StateRow[];
}

async function countTable(table: "contactos" | "leads" | "opportunities") {
  const db = createSourceCrmServerClient();
  const idColumn = table === "contactos" ? "contact_id" : "id";
  let query = db.from(table).select(idColumn, { count: "exact", head: true });
  if (table === "contactos") {
    query = query.eq("es_preescriptor", true);
  }
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function loadCompanyMap(companyIds: number[]) {
  if (companyIds.length === 0) return new Map<number, string>();
  const db = createSourceCrmServerClient();
  const result = await db.from("inversion").select("company_id, compania").in("company_id", companyIds);
  if (result.error) throw result.error;
  return new Map((result.data as SimpleCompany[]).map((row) => [row.company_id, row.compania ?? `Compania ${row.company_id}`]));
}

async function loadContactMap(contactIds: number[]) {
  if (contactIds.length === 0) return new Map<number, string>();
  const db = createSourceCrmServerClient();
  const result = await db.from("contactos").select("contact_id, persona_contacto").in("contact_id", contactIds);
  if (result.error) throw result.error;
  return new Map(
    (result.data as SimpleContact[]).map((row) => [row.contact_id, row.persona_contacto ?? `Contacto ${row.contact_id}`])
  );
}

async function loadLeadNameMap(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, string>();
  const db = createSourceCrmServerClient();
  const result = await db.from("leads").select("id, name").in("id", leadIds);
  if (result.error) throw result.error;
  return new Map((result.data ?? []).map((row) => [String(row.id), String(row.name ?? `Lead ${shortId(String(row.id))}`)]));
}

export default async function AcuerdosPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser();
  const activeSection = normalizeSection(searchParams?.section);
  const q = String(searchParams?.q ?? "").trim();
  const owner = String(searchParams?.owner ?? "").trim();
  const state = String(searchParams?.state ?? "").trim();
  const product = String(searchParams?.product ?? "").trim();
  const resolution = String(searchParams?.resolution ?? "").trim();
  const activity3dOnly = normalizeOverdue(searchParams?.activity3d);
  const overdueOnly = normalizeOverdue(searchParams?.overdue);

  const [
    openProspectsResult,
    openLeadCountResult,
    openOpportunityCountResult,
    closedDealsCountResult,
    products,
    states,
    owners,
    totalContactsCount,
    tasksRes,
    eventsRes,
    contactsRes,
    companiesRes,
    recentProspectTasks,
    closedProspectsRes,
    openLeadRowsRes,
    openOpportunityRowsRes,
    wonOpportunityRowsRes,
    allProspectContactIdsRes,
    allLeadContactIdsRes,
    allOpportunityContactIdsRes
  ] = await Promise.all([
    listProspectsPage({ page: 1, pageSize: 220, resolution: "open" }),
    listLeadsPage({ page: 1, pageSize: 1, resolution: "open" }),
    listOpportunitiesPage({ page: 1, pageSize: 1, resolution: "open" }),
    listOpportunitiesPage({ page: 1, pageSize: 1, resolution: "won" }),
    listProducts(),
    listStates(),
    listAssignableUsers(),
    countTable("contactos"),
    createDimServerClient().from("task").select("id, name, entity_type, state_id, resulting_state_id, task_kind, sort_order, active").eq("active", true).order("sort_order", { ascending: true }),
    createFactServerClient()
      .from("pipeline_event")
      .select("id, entity_type, lead_id, opportunity_id, contact_id, task_id, occurred_at")
      .not("task_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(180),
    createSourceCrmServerClient()
      .from("contactos")
      .select("contact_id, company_id, persona_contacto, owner_user_id, owner_email, es_preescriptor")
      .eq("es_preescriptor", true)
      .order("updated_at", { ascending: false })
      .limit(260),
    createSourceCrmServerClient().from("inversion").select("company_id, compania").order("updated_at", { ascending: false }).limit(260),
    listRecentProspectTasks(180),
    listProspectsPage({ page: 1, pageSize: 220, resolution: "not_interested" }),
    listLeadsPage({ page: 1, pageSize: 160, resolution: "open" }),
    listOpportunitiesPage({ page: 1, pageSize: 160, resolution: "open" }),
    listOpportunitiesPage({ page: 1, pageSize: 160, resolution: "won" }),
    createSourceCrmServerClient().from("prospects").select("contact_id"),
    createSourceCrmServerClient().from("leads").select("contact_id"),
    createSourceCrmServerClient().from("opportunities").select("contact_id")
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (companiesRes.error) throw companiesRes.error;
  if (allProspectContactIdsRes.error) throw allProspectContactIdsRes.error;
  if (allLeadContactIdsRes.error) throw allLeadContactIdsRes.error;
  if (allOpportunityContactIdsRes.error) throw allOpportunityContactIdsRes.error;

  const [leadResult, opportunityResult] = await Promise.all([
    listLeadsPage({
      page: 1,
      pageSize: 120,
      q,
      stateId: activeSection === "leads" && state ? state : undefined,
      ownerUserId: activeSection === "leads" && owner ? owner : undefined,
      resolution: activeSection === "leads" && resolution ? (resolution as LeadResolution) : undefined
    }),
    listOpportunitiesPage({
      page: 1,
      pageSize: 120,
      q,
      stateId: activeSection === "opportunities" && state ? state : undefined,
      ownerUserId: activeSection === "opportunities" && owner ? owner : undefined,
      resolution: activeSection === "opportunities" && resolution ? (resolution as OpportunityResolution) : undefined,
      productId: activeSection === "opportunities" && product ? product : undefined
    })
  ]);

  const openProspects = (openProspectsResult.rows ?? []) as ProspectRecord[];
  const closedProspects = (closedProspectsRes.rows ?? []) as ProspectRecord[];
  const leads = leadResult.rows.filter((row) => {
    if (activity3dOnly && !isInactiveForDays(row.updated_at, 3)) return false;
    if (overdueOnly && !isInactiveForDays(row.updated_at, 7)) return false;
    return true;
  });
  const opportunities = opportunityResult.rows.filter((row) => {
    if (activity3dOnly && !isInactiveForDays(row.updated_at, 3)) return false;
    if (overdueOnly && !isInactiveForDays(row.updated_at, 7)) return false;
    return true;
  });
  const allOpenLeads = openLeadRowsRes.rows;
  const allOpenOpportunities = openOpportunityRowsRes.rows;
  const wonOpportunities = wonOpportunityRowsRes.rows.filter((row) => (row.closed_amount ?? 0) > 0);
  const allTasks = (tasksRes.data ?? []) as TaskRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const contactOptionsRows = ((contactsRes.data ?? []) as ContactOptionRow[]).filter((contact) => Boolean(contact.es_preescriptor));
  const recentTaskHistory = recentProspectTasks;

  const companyIds = Array.from(
    new Set([
      ...openProspects.map((row) => row.company_id),
      ...leads.map((row) => row.company_id),
      ...opportunities.map((row) => row.company_id)
    ])
  );
  const contactIds = Array.from(
    new Set([
      ...openProspects.map((row) => row.contact_id),
      ...leads.map((row) => row.contact_id),
      ...opportunities.map((row) => row.contact_id)
    ])
  );
  const leadIds = Array.from(new Set(opportunities.map((row) => row.lead_id)));

  const [companyById, contactById, leadNameById] = await Promise.all([
    loadCompanyMap(companyIds),
    loadContactMap(contactIds),
    loadLeadNameMap(leadIds)
  ]);

  const stateById = new Map(states.map((row) => [row.id, row]));
  const taskById = new Map(allTasks.map((task) => [task.id, task]));
  const productById = new Map(products.map((row) => [row.id, row]));
  const contactStatusCompanyById = new Map(((companiesRes.data ?? []) as SimpleCompany[]).map((row) => [row.company_id, row.compania ?? `Compania ${row.company_id}`]));
  const activeProducts = products.filter((productRow) => productRow.active);
  const filteredOpenProspects = openProspects.filter((row) => {
    if (owner && row.owner_user_id !== owner) return false;
    if (activity3dOnly && !isInactiveForDays(row.updated_at, 3)) return false;
    if (overdueOnly && !isInactiveForDays(row.updated_at, 7)) return false;
    const haystack = [
      contactById.get(row.contact_id) ?? "",
      companyById.get(row.company_id) ?? "",
      row.owner_email ?? "",
      row.notes ?? "",
      row.status
    ]
      .join(" ")
      .toLowerCase();
    return !q || haystack.includes(q.toLowerCase());
  });

  const openProspectCount = openProspectsResult.totalCount;
  const leadCount = openLeadCountResult.totalCount;
  const opportunityCount = openOpportunityCountResult.totalCount;
  const closedDealsCount = wonOpportunities.length;
  const contactsAlreadyInPipeline = new Set<number>([
    ...((allProspectContactIdsRes.data ?? []).map((row) => Number(row.contact_id))),
    ...((allLeadContactIdsRes.data ?? []).map((row) => Number(row.contact_id))),
    ...((allOpportunityContactIdsRes.data ?? []).map((row) => Number(row.contact_id)))
  ]);
  const contactsCount = Math.max(0, totalContactsCount - contactsAlreadyInPipeline.size);
  const filteredOpenProspectCount = filteredOpenProspects.length;
  const filteredLeadCount = leads.length;
  const filteredOpportunityCount = opportunities.length;
  const filteredProspects = filteredOpenProspects.filter((row) => (state ? row.status === state : true));
  const openProspectByContactId = new Map(openProspects.map((prospect) => [prospect.contact_id, prospect]));
  const latestClosedProspectByContactId = new Map<number, ProspectRecord>();
  for (const prospect of closedProspects) {
    if (!latestClosedProspectByContactId.has(prospect.contact_id)) {
      latestClosedProspectByContactId.set(prospect.contact_id, prospect);
    }
  }
  const openLeadByContactId = new Map(allOpenLeads.map((lead) => [lead.contact_id, lead]));
  const openOpportunityByContactId = new Map(allOpenOpportunities.map((opportunity) => [opportunity.contact_id, opportunity]));

  const prospectTaskOptions = allTasks
    .filter((task) => {
      if (task.entity_type !== "lead" && task.entity_type !== "both") return false;
      const resultingState = task.resulting_state_id ? stateById.get(task.resulting_state_id) ?? null : null;
      return resultingState?.entity_type !== "opportunity";
    })
    .map((task) => {
      const stateName = stateById.get(task.state_id)?.name ?? "--";
      const nextStateName = task.resulting_state_id ? stateById.get(task.resulting_state_id)?.name ?? stateName : stateName;
      return {
        id: task.id,
        label: `${task.name} · ${stateName}${nextStateName !== stateName ? ` -> ${nextStateName}` : ""}`,
        isConversionTask: !PROSPECT_TASK_NAMES.has(task.name)
      };
    });

  const prospectTaskOccurrences = Array.from(
    [...recentTaskHistory, ...events].reduce((map, item) => {
      const taskId = item.task_id;
      if (!taskId) return map;
      const key = `${item.contact_id}:${taskId}`;
      const current = map.get(key);
      if (!current || new Date(item.occurred_at).getTime() > new Date(current.occurredAt).getTime()) {
        map.set(key, { contactId: String(item.contact_id), taskId, occurredAt: item.occurred_at });
      }
      return map;
    }, new Map<string, { contactId: string; taskId: string; occurredAt: string }>())
  ).map(([, value]) => value);

  const latestProspectActivityByProspectId = new Map<string, string>();
  for (const task of recentTaskHistory) {
    if (!task.prospect_id || latestProspectActivityByProspectId.has(task.prospect_id)) continue;
    latestProspectActivityByProspectId.set(task.prospect_id, task.task_name);
  }

  const latestLeadActivityByLeadId = new Map<string, string>();
  const latestOpportunityActivityByOpportunityId = new Map<string, string>();
  for (const event of events) {
    if (!event.task_id) continue;
    const taskName = taskById.get(event.task_id)?.name ?? "Sin actividad";
    if (event.lead_id && !latestLeadActivityByLeadId.has(event.lead_id)) {
      latestLeadActivityByLeadId.set(event.lead_id, taskName);
    }
    if (event.opportunity_id && !latestOpportunityActivityByOpportunityId.has(event.opportunity_id)) {
      latestOpportunityActivityByOpportunityId.set(event.opportunity_id, taskName);
    }
  }

  const prospectTaskContacts: Array<{
    id: string;
    label: string;
    openProspectId: string | null;
    latestClosedProspectId: string | null;
    hasClosedProspect: boolean;
    blockedEntityType: "lead" | "opportunity" | null;
    blockedEntityId: string | null;
  }> = contactOptionsRows.map((contact) => {
    const companyName = contactStatusCompanyById.get(contact.company_id) ?? `Compania ${contact.company_id}`;
    const openProspect = openProspectByContactId.get(contact.contact_id) ?? null;
    const closedProspect = latestClosedProspectByContactId.get(contact.contact_id) ?? null;
    const openLead = openLeadByContactId.get(contact.contact_id) ?? null;
    const openOpportunity = openOpportunityByContactId.get(contact.contact_id) ?? null;
    const statusLabel = openOpportunity
      ? "Oportunidad abierta"
      : openLead
        ? "Lead abierto"
        : openProspect
          ? "Prospecto abierto"
          : closedProspect
            ? "Prospecto cerrado"
            : "Sin pipeline activo";

    return {
      id: String(contact.contact_id),
      label: `${contact.persona_contacto ?? `Contacto ${contact.contact_id}`} · ${companyName} · ${statusLabel}`,
      openProspectId: openProspect?.id ?? null,
      latestClosedProspectId: closedProspect?.id ?? null,
      hasClosedProspect: Boolean(closedProspect),
      blockedEntityType: openOpportunity ? "opportunity" : openLead ? "lead" : null,
      blockedEntityId: openOpportunity?.id ?? openLead?.id ?? null
    };
  });

  const leadTaskOptions = allTasks
    .filter((task) => task.entity_type === "lead" || task.entity_type === "both")
    .map((task) => {
      const stateName = stateById.get(task.state_id)?.name ?? "--";
      const nextStateName = task.resulting_state_id ? stateById.get(task.resulting_state_id)?.name ?? stateName : stateName;
      return {
        id: task.id,
        label: `${task.name} · ${stateName}${nextStateName !== stateName ? ` -> ${nextStateName}` : ""}`,
        stateId: task.state_id
      };
    });

  const leadTaskContacts: Array<{
    id: string;
    label: string;
    openLeadId: string | null;
    openLeadStateId: string | null;
    openProspectId: string | null;
    blockedOpportunityId: string | null;
  }> = contactOptionsRows.map((contact) => {
    const companyName = contactStatusCompanyById.get(contact.company_id) ?? `Compania ${contact.company_id}`;
    const openProspect = openProspectByContactId.get(contact.contact_id) ?? null;
    const openLead = openLeadByContactId.get(contact.contact_id) ?? null;
    const openOpportunity = openOpportunityByContactId.get(contact.contact_id) ?? null;
    const statusLabel = openOpportunity
      ? "Oportunidad abierta"
      : openLead
        ? "Lead abierto"
        : openProspect
          ? "Prospecto abierto"
          : "Sin pipeline activo";

    return {
      id: String(contact.contact_id),
      label: `${contact.persona_contacto ?? `Contacto ${contact.contact_id}`} · ${companyName} · ${statusLabel}`,
      openLeadId: openLead?.id ?? null,
      openLeadStateId: openLead?.current_state_id ?? null,
      openProspectId: openProspect?.id ?? null,
      blockedOpportunityId: openOpportunity?.id ?? null
    };
  });

  const opportunityTaskOptions = allTasks
    .filter((task) => task.entity_type === "opportunity" || task.entity_type === "both")
    .map((task) => {
      const stateName = stateById.get(task.state_id)?.name ?? "--";
      const nextStateName = task.resulting_state_id ? stateById.get(task.resulting_state_id)?.name ?? stateName : stateName;
      return {
        id: task.id,
        label: `${task.name} · ${stateName}${nextStateName !== stateName ? ` -> ${nextStateName}` : ""}`,
        stateId: task.state_id
      };
    });

  const opportunityStateOptions = states
    .filter((row) => row.entity_type === "opportunity" || row.entity_type === "both")
    .map((row) => ({ id: row.id, name: row.name }));

  const convertibleLeadIds = new Set(
    allOpenLeads
      .filter((lead) => {
        const currentState = stateById.get(lead.current_state_id);
        return Boolean(currentState?.is_conversion_state) && !openOpportunityByContactId.has(lead.contact_id);
      })
      .map((lead) => lead.id)
  );

  const opportunityTaskSources: Array<{
    id: string;
    label: string;
    mode: "existing_opportunity" | "convert_lead";
    leadId: string;
    opportunityId: string | null;
    currentStateId: string;
  }> = [
    ...allOpenOpportunities.map((opportunity) => ({
      id: `opportunity:${opportunity.id}`,
      label: `${opportunity.name ?? productById.get(opportunity.product_id)?.name ?? `Oportunidad ${shortId(opportunity.id)}`} · ${
        companyById.get(opportunity.company_id) ?? `Compania ${opportunity.company_id}`
      } · ${contactById.get(opportunity.contact_id) ?? `Contacto ${opportunity.contact_id}`}`,
      mode: "existing_opportunity" as const,
      leadId: opportunity.lead_id,
      opportunityId: opportunity.id,
      currentStateId: opportunity.current_state_id
    })),
    ...allOpenLeads
      .filter((lead) => convertibleLeadIds.has(lead.id))
      .map((lead) => ({
        id: `lead:${lead.id}`,
        label: `${lead.name ?? `Lead ${shortId(lead.id)}`} · ${companyById.get(lead.company_id) ?? `Compania ${lead.company_id}`} · ${
          contactById.get(lead.contact_id) ?? `Contacto ${lead.contact_id}`
        }`,
        mode: "convert_lead" as const,
        leadId: lead.id,
        opportunityId: null,
        currentStateId: lead.current_state_id
      }))
  ];

  async function logProspectTaskFromBusinessAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const actionDim = createDimServerClient();
    const actionSource = createSourceCrmServerClient();
    const contactId = Number(String(formData.get("contact_id") ?? "").trim());
    const taskId = String(formData.get("task_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const occurredAt = toIsoFromDateTimeLocalInput(formData.get("occurred_at"));
    const reactivationMode = String(formData.get("reactivation_mode") ?? "").trim();
    const latestClosedProspectId = String(formData.get("latest_closed_prospect_id") ?? "").trim();

    const [contactRes, taskRes, openLeadRes, openOpportunityRes] = await Promise.all([
      actionSource.from("contactos").select("contact_id, company_id, persona_contacto, owner_user_id, owner_email, es_preescriptor").eq("contact_id", contactId).maybeSingle(),
      actionDim.from("task").select("id, name, state_id").eq("id", taskId).maybeSingle(),
      actionSource.from("leads").select("id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle(),
      actionSource.from("opportunities").select("id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle()
    ]);

    if (contactRes.error) throw contactRes.error;
    if (taskRes.error) throw taskRes.error;
    if (openLeadRes.error) throw openLeadRes.error;
    if (openOpportunityRes.error) throw openOpportunityRes.error;
    if (!contactRes.data) throw new Error("Contacto no encontrado");
    if (!contactRes.data.es_preescriptor) throw new Error("Solo los contactos preescriptores pueden entrar en Negocios");
    if (!taskRes.data) throw new Error("Tarea no encontrada");
    if (openLeadRes.data?.id) throw new Error("Este contacto ya tiene un lead abierto");
    if (openOpportunityRes.data?.id) throw new Error("Este contacto ya tiene una oportunidad abierta");

    const contact = contactRes.data;
    const task = taskRes.data;
    let prospect = await getOpenProspectByContact(contact.contact_id);

    if (!prospect) {
      if (latestClosedProspectId && reactivationMode === "reopen") {
        prospect = await reopenProspect({ prospect_id: latestClosedProspectId });
      } else {
        prospect = await createProspect({
          company_id: contact.company_id,
          contact_id: contact.contact_id,
          owner_user_id: contact.owner_user_id ?? actor.id,
          owner_email: contact.owner_email ?? actor.email,
          created_by_user_id: actor.id,
          created_by_email: actor.email,
          notes
        });
      }
    }

    if (PROSPECT_TASK_NAMES.has(task.name)) {
      await createProspectTask({
        prospect_id: prospect.id,
        company_id: contact.company_id,
        contact_id: contact.contact_id,
        task_id: task.id,
        task_name: task.name,
        occurred_at: occurredAt,
        notes,
        actor_user_id: actor.id,
        actor_email: actor.email
      });
      if (CONTACT_PROGRESS_TASK_NAMES.has(task.name)) {
        await syncProspectStatusFromTasks(prospect.id);
      }
    } else {
      const converted = await convertProspectToLead({
        prospect_id: prospect.id,
        current_state_id: String(task.state_id),
        opened_at: occurredAt,
        actor_user_id: actor.id,
        actor_email: actor.email,
        notes
      });
      await completePipelineTask({
        entity_type: "lead",
        lead_id: converted.lead.id,
        task_id: task.id,
        occurred_at: occurredAt,
        notes,
        actor_user_id: actor.id,
        actor_email: actor.email
      });
    }

    revalidatePath("/actividades");
    revalidatePath("/contacts");
    revalidatePath("/investors");
    revalidatePath("/acuerdos");
    redirect(buildHref({ section: "prospects", overdue: overdueOnly }));
  }

  async function logLeadTaskFromBusinessAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const actionDim = createDimServerClient();
    const actionSource = createSourceCrmServerClient();
    const contactId = Number(String(formData.get("contact_id") ?? "").trim());
    const taskId = String(formData.get("task_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const occurredAt = toIsoFromDateTimeLocalInput(formData.get("occurred_at"));

    const [contactRes, taskRes, openProspectRes, openLeadRes, openOpportunityRes] = await Promise.all([
      actionSource.from("contactos").select("contact_id, company_id, persona_contacto, owner_user_id, owner_email, es_preescriptor").eq("contact_id", contactId).maybeSingle(),
      actionDim.from("task").select("id, name, state_id").eq("id", taskId).maybeSingle(),
      actionSource.from("prospects").select("id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle(),
      actionSource.from("leads").select("id, current_state_id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle(),
      actionSource.from("opportunities").select("id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle()
    ]);

    if (contactRes.error) throw contactRes.error;
    if (taskRes.error) throw taskRes.error;
    if (openProspectRes.error) throw openProspectRes.error;
    if (openLeadRes.error) throw openLeadRes.error;
    if (openOpportunityRes.error) throw openOpportunityRes.error;
    if (!contactRes.data) throw new Error("Contacto no encontrado");
    if (!contactRes.data.es_preescriptor) throw new Error("Solo los contactos preescriptores pueden entrar en Negocios");
    if (!taskRes.data) throw new Error("Tarea no encontrada");
    if (openOpportunityRes.data?.id) throw new Error("Este contacto ya tiene una oportunidad abierta");

    const contact = contactRes.data;
    const task = taskRes.data;
    let leadId = "";

    if (openLeadRes.data?.id) {
      leadId = String(openLeadRes.data.id);
    } else if (openProspectRes.data?.id) {
      const converted = await convertProspectToLead({
        prospect_id: openProspectRes.data.id,
        current_state_id: String(task.state_id),
        opened_at: occurredAt,
        actor_user_id: actor.id,
        actor_email: actor.email,
        notes
      });
      leadId = converted.lead.id;
    } else {
      const lead = await createLead({
        company_id: contact.company_id,
        contact_id: contact.contact_id,
        current_state_id: String(task.state_id),
        owner_user_id: contact.owner_user_id ?? actor.id,
        owner_email: contact.owner_email ?? actor.email,
        created_by_user_id: actor.id,
        created_by_email: actor.email,
        opened_at: occurredAt ?? new Date().toISOString(),
        notes: notes ?? undefined
      });

      await logStateEvent({
        entity_type: "lead",
        lead_id: lead.id,
        company_id: lead.company_id,
        contact_id: lead.contact_id,
        state_id: lead.current_state_id,
        occurred_at: occurredAt,
        actor_user_id: actor.id,
        actor_email: actor.email,
        notes: "Lead creado desde Negocios"
      });

      leadId = lead.id;
    }

    await completePipelineTask({
      entity_type: "lead",
      lead_id: leadId,
      task_id: task.id,
      occurred_at: occurredAt,
      notes,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath("/actividades");
    revalidatePath("/contacts");
    revalidatePath("/investors");
    revalidatePath("/acuerdos");
    redirect(buildHref({ section: "leads", overdue: overdueOnly }));
  }

  async function logOpportunityTaskFromBusinessAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const sourceMode = String(formData.get("source_mode") ?? "").trim();
    const opportunityId = String(formData.get("opportunity_id") ?? "").trim();
    const leadId = String(formData.get("lead_id") ?? "").trim();
    const taskId = String(formData.get("task_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const occurredAt = toIsoFromDateTimeLocalInput(formData.get("occurred_at"));

    let targetOpportunityId = opportunityId;

    if (sourceMode === "convert_lead") {
      const productId = String(formData.get("product_id") ?? "").trim();
      const currentStateId = String(formData.get("current_state_id") ?? "").trim();
      const converted = await convertLeadToOpportunity({
        lead_id: leadId,
        product_id: productId,
        opportunity_state_id: currentStateId,
        occurred_at: occurredAt,
        actor_user_id: actor.id,
        actor_email: actor.email,
        notes
      });
      targetOpportunityId = converted.opportunity.id;
    }

    if (!targetOpportunityId) {
      throw new Error("Oportunidad no encontrada");
    }

    await completePipelineTask({
      entity_type: "opportunity",
      opportunity_id: targetOpportunityId,
      task_id: taskId,
      occurred_at: occurredAt,
      notes,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath("/actividades");
    revalidatePath("/contacts");
    revalidatePath("/investors");
    revalidatePath("/acuerdos");
    redirect(buildHref({ section: "opportunities", overdue: overdueOnly }));
  }

  const prospectTableRows = filteredProspects.map((prospect) => ({
    id: prospect.id,
    href: `/contacts/${encodeURIComponent(String(prospect.contact_id))}`,
    values: {
      contact_name: contactById.get(prospect.contact_id) ?? `Contacto ${prospect.contact_id}`,
      company_name: companyById.get(prospect.company_id) ?? `Compania ${prospect.company_id}`,
      owner_email: prospect.owner_email ?? "Sin owner",
      status: prospect.status === "en_contacto" ? "En contacto" : "Contactar",
      latest_activity: latestProspectActivityByProspectId.get(prospect.id) ?? "Sin actividad",
      opened_at: formatDate(prospect.opened_at),
      updated_at: formatDateTime(prospect.updated_at),
      overdue: isInactiveForDays(prospect.updated_at, 7) ? "Si" : "No"
    },
    actions: [
      { href: `/contacts/${encodeURIComponent(String(prospect.contact_id))}`, label: "Abrir contacto" },
      { href: `/actividades?section=new&contact_id=${encodeURIComponent(String(prospect.contact_id))}`, label: "Nueva tarea" }
    ]
  }));

  const leadTableRows = leads.map((lead) => ({
    id: lead.id,
    href: `/acuerdos/leads/${encodeURIComponent(lead.id)}`,
    values: {
      name: lead.name ?? companyById.get(lead.company_id) ?? `Lead ${shortId(lead.id)}`,
      company_name: companyById.get(lead.company_id) ?? `Compania ${lead.company_id}`,
      contact_name: contactById.get(lead.contact_id) ?? `Contacto ${lead.contact_id}`,
      owner_email: lead.owner_email ?? "Sin owner",
      state_name: stateById.get(lead.current_state_id)?.name ?? "Sin estado",
      latest_activity: latestLeadActivityByLeadId.get(lead.id) ?? "Sin actividad",
      resolution: lead.resolution,
      opened_at: formatDate(lead.opened_at),
      updated_at: formatDateTime(lead.updated_at),
      overdue: isInactiveForDays(lead.updated_at, 7) ? "Si" : "No"
    },
    actions: [{ href: `/acuerdos/leads/${encodeURIComponent(lead.id)}`, label: "Abrir ficha" }]
  }));

  const opportunityTableRows = opportunities.map((opportunity) => ({
    id: opportunity.id,
    href: `/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`,
    values: {
      name: opportunity.name ?? productById.get(opportunity.product_id)?.name ?? `Opportunity ${shortId(opportunity.id)}`,
      company_name: companyById.get(opportunity.company_id) ?? `Compania ${opportunity.company_id}`,
      lead_name: leadNameById.get(opportunity.lead_id) ?? `Lead ${shortId(opportunity.lead_id)}`,
      product_name: productById.get(opportunity.product_id)?.name ?? "--",
      owner_email: opportunity.owner_email ?? "Sin owner",
      state_name: stateById.get(opportunity.current_state_id)?.name ?? "Sin estado",
      latest_activity: latestOpportunityActivityByOpportunityId.get(opportunity.id) ?? "Sin actividad",
      resolution: opportunity.resolution,
      estimated_amount: formatMoney(opportunity.estimated_amount),
      updated_at: formatDateTime(opportunity.updated_at)
    },
    actions: [{ href: `/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`, label: "Abrir ficha" }]
  }));

  const closedDealsTableRows = wonOpportunities.map((opportunity) => ({
    id: opportunity.id,
    href: `/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`,
    values: {
      name: opportunity.name ?? productById.get(opportunity.product_id)?.name ?? `Opportunity ${shortId(opportunity.id)}`,
      company_name: companyById.get(opportunity.company_id) ?? `Compania ${opportunity.company_id}`,
      lead_name: leadNameById.get(opportunity.lead_id) ?? `Lead ${shortId(opportunity.lead_id)}`,
      product_name: productById.get(opportunity.product_id)?.name ?? "--",
      owner_email: opportunity.owner_email ?? "Sin owner",
      closed_amount: formatMoney(opportunity.closed_amount),
      closed_at: formatDate(opportunity.closed_at),
      updated_at: formatDateTime(opportunity.updated_at)
    },
    actions: [{ href: `/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`, label: "Abrir ficha" }]
  }));

  return (
    <AppShell
      title="Negocios"
      subtitle="Pipeline Comercial"
      canViewGlobal={user.can_view_global_dashboard}
      headerActions={<BusinessGuideButton />}
    >
      <div className="stack">
        <div className="smart-tabs-row" role="tablist" aria-label="Secciones de negocios">
          <Link href={buildHref({ section: "overview" })} className={activeSection === "overview" ? "smart-tab smart-tab-active" : "smart-tab"}>
            Vista principal
          </Link>
          <Link href={buildHref({ section: "prospects" })} className={activeSection === "prospects" ? "smart-tab smart-tab-active" : "smart-tab"}>
            Prospectos <span className="contacts-badge">{openProspectCount}</span>
          </Link>
          <Link href={buildHref({ section: "leads" })} className={activeSection === "leads" ? "smart-tab smart-tab-active" : "smart-tab"}>
            Leads <span className="contacts-badge">{leadCount}</span>
          </Link>
          <Link href={buildHref({ section: "opportunities" })} className={activeSection === "opportunities" ? "smart-tab smart-tab-active" : "smart-tab"}>
            Oportunidades <span className="contacts-badge">{opportunityCount}</span>
          </Link>
          <Link href={buildHref({ section: "closed_deals" })} className={activeSection === "closed_deals" ? "smart-tab smart-tab-active" : "smart-tab"}>
            Negocios cerrados <span className="contacts-badge">{closedDealsCount}</span>
          </Link>
        </div>

        {activeSection === "overview" ? (
          <>
            <section className="deal-hub-hero card">
              <div className="deal-hub-hero-copy">
                <p className="workspace-kicker">Pipeline comercial</p>
                <h3>Vista principal</h3>
                <p className="muted">{"Contactos -> Prospectos -> Leads -> Oportunidades -> Negocios cerrados."}</p>
              </div>
              <div className="deal-hub-badges">
                <span className="deal-hub-badge">Pipeline principal</span>
              </div>
            </section>

            <section className="business-pipeline-hero-flow">
              <Link href="/contacts" className="business-pipeline-hero-card card">
                <span>Contactos sin contactar</span>
                <strong>{contactsCount}</strong>
              </Link>
              <span className="business-pipeline-hero-arrow" aria-hidden="true">
                -&gt;
              </span>
              <Link href={buildHref({ section: "prospects" })} className="business-pipeline-hero-card card">
                <span>Prospectos</span>
                <strong>{openProspectCount}</strong>
              </Link>
              <span className="business-pipeline-hero-arrow" aria-hidden="true">
                -&gt;
              </span>
              <Link href={buildHref({ section: "leads" })} className="business-pipeline-hero-card card">
                <span>Leads</span>
                <strong>{leadCount}</strong>
              </Link>
              <span className="business-pipeline-hero-arrow" aria-hidden="true">
                -&gt;
              </span>
              <Link href={buildHref({ section: "opportunities" })} className="business-pipeline-hero-card card">
                <span>Oportunidades</span>
                <strong>{opportunityCount}</strong>
              </Link>
              <span className="business-pipeline-hero-arrow" aria-hidden="true">
                -&gt;
              </span>
              <Link href={buildHref({ section: "closed_deals" })} className="business-pipeline-hero-card card">
                <span>Negocios cerrados</span>
                <strong>{closedDealsCount}</strong>
              </Link>
            </section>

          </>
        ) : null}

        {activeSection === "prospects"
          ? renderPipelineSection({
              title: "Prospectos",
              table: (
                <BusinessPipelineTable
                  storageKeyPrefix="business-prospects"
                  activity3dOnly={activity3dOnly}
                  activity3dHrefOn={buildHref({ section: "prospects", activity3d: true, overdue: overdueOnly })}
                  activity3dHrefOff={buildHref({ section: "prospects", overdue: overdueOnly })}
                  overdueOnly={overdueOnly}
                  overdueHrefOn={buildHref({ section: "prospects", activity3d: activity3dOnly, overdue: true })}
                  overdueHrefOff={buildHref({ section: "prospects", activity3d: activity3dOnly })}
                  topAction={
                    <BusinessProspectTaskDialog
                      title="Nueva tarea de prospecto"
                      subtitle="Registra una tarea del pipeline de prospecto desde esta vista."
                      contacts={prospectTaskContacts}
                      tasks={prospectTaskOptions}
                      taskOccurrences={prospectTaskOccurrences}
                      action={logProspectTaskFromBusinessAction}
                    />
                  }
                  rows={prospectTableRows}
                  columns={[
                    { key: "contact_name", label: "Contacto", type: "link" },
                    { key: "company_name", label: "Compania" },
                    { key: "owner_email", label: "Owner" },
                    { key: "status", label: "Estado", type: "badge" },
                    { key: "latest_activity", label: "Ultima actividad", type: "badge" },
                    { key: "opened_at", label: "Apertura", type: "date", defaultVisible: false },
                    { key: "updated_at", label: "Ultima actualizacion", type: "datetime" },
                    { key: "overdue", label: "Vencido", defaultVisible: false }
                  ]}
                  emptyLabel="Sin prospectos para este filtro."
                  emptyHint="Prueba otro owner, estado o termino de busqueda."
                />
              )
            })
          : null}

        {activeSection === "leads"
          ? renderPipelineSection({
              title: "Leads",
              table: (
                <BusinessPipelineTable
                  storageKeyPrefix="business-leads"
                  activity3dOnly={activity3dOnly}
                  activity3dHrefOn={buildHref({ section: "leads", activity3d: true, overdue: overdueOnly })}
                  activity3dHrefOff={buildHref({ section: "leads", overdue: overdueOnly })}
                  overdueOnly={overdueOnly}
                  overdueHrefOn={buildHref({ section: "leads", activity3d: activity3dOnly, overdue: true })}
                  overdueHrefOff={buildHref({ section: "leads", activity3d: activity3dOnly })}
                  topAction={
                    <BusinessLeadTaskDialog
                      title="Nueva tarea de lead"
                      subtitle="Registra una tarea de lead. Si el contacto no esta en prospecto, el sistema saltara directo a lead."
                      contacts={leadTaskContacts}
                      tasks={leadTaskOptions}
                      action={logLeadTaskFromBusinessAction}
                    />
                  }
                  rows={leadTableRows}
                  columns={[
                    { key: "name", label: "Lead", type: "link" },
                    { key: "company_name", label: "Compania" },
                    { key: "contact_name", label: "Contacto" },
                    { key: "owner_email", label: "Owner" },
                    { key: "state_name", label: "Estado", type: "badge" },
                    { key: "latest_activity", label: "Ultima actividad", type: "badge" },
                    { key: "resolution", label: "Resolucion" },
                    { key: "opened_at", label: "Apertura", type: "date", defaultVisible: false },
                    { key: "updated_at", label: "Ultimo movimiento", type: "datetime" },
                    { key: "overdue", label: "Vencido", defaultVisible: false }
                  ]}
                  emptyLabel="Sin leads para este filtro."
                  emptyHint="Prueba otro owner, estado o resolucion."
                />
              )
            })
          : null}

        {activeSection === "opportunities"
          ? renderPipelineSection({
              title: "Oportunidades",
              table: (
                <BusinessPipelineTable
                  storageKeyPrefix="business-opportunities"
                  activity3dOnly={activity3dOnly}
                  activity3dHrefOn={buildHref({ section: "opportunities", activity3d: true, overdue: overdueOnly })}
                  activity3dHrefOff={buildHref({ section: "opportunities", overdue: overdueOnly })}
                  overdueOnly={overdueOnly}
                  overdueHrefOn={buildHref({ section: "opportunities", activity3d: activity3dOnly, overdue: true })}
                  overdueHrefOff={buildHref({ section: "opportunities", activity3d: activity3dOnly })}
                  topAction={
                    <BusinessOpportunityTaskDialog
                      title="Nueva tarea de oportunidad"
                      subtitle="La oportunidad debe venir de un lead. Si todavia no existe, el sistema la creara desde ese lead y registrara la tarea."
                      sources={opportunityTaskSources}
                      tasks={opportunityTaskOptions}
                      states={opportunityStateOptions}
                      products={activeProducts.map((product) => ({ id: product.id, name: product.name }))}
                      action={logOpportunityTaskFromBusinessAction}
                    />
                  }
                  rows={opportunityTableRows}
                  columns={[
                    { key: "name", label: "Oportunidad", type: "link" },
                    { key: "company_name", label: "Compania" },
                    { key: "lead_name", label: "Lead origen" },
                    { key: "product_name", label: "Producto" },
                    { key: "owner_email", label: "Owner" },
                    { key: "state_name", label: "Estado", type: "badge" },
                    { key: "latest_activity", label: "Ultima actividad", type: "badge" },
                    { key: "resolution", label: "Resolucion" },
                    { key: "estimated_amount", label: "Estimado", type: "money", defaultVisible: false },
                    { key: "updated_at", label: "Ultimo movimiento", type: "datetime" }
                  ]}
                  emptyLabel="Sin oportunidades para este filtro."
                  emptyHint="Prueba otro owner, estado, producto o resolucion."
                />
              )
            })
          : null}

        {activeSection === "closed_deals"
          ? renderPipelineSection({
              title: "Negocios cerrados",
              table: (
                <BusinessPipelineTable
                  storageKeyPrefix="business-closed-deals"
                  overdueOnly={false}
                  overdueHrefOn={buildHref({ section: "closed_deals" })}
                  overdueHrefOff={buildHref({ section: "closed_deals" })}
                  showTopControls={false}
                  rows={closedDealsTableRows}
                  columns={[
                    { key: "name", label: "Oportunidad", type: "link" },
                    { key: "company_name", label: "Compania" },
                    { key: "lead_name", label: "Lead origen" },
                    { key: "product_name", label: "Producto" },
                    { key: "owner_email", label: "Owner" },
                    { key: "closed_amount", label: "Importe ingresado", type: "money" },
                    { key: "closed_at", label: "Fecha cierre", type: "date" },
                    { key: "updated_at", label: "Ultima actualizacion", type: "datetime", defaultVisible: false }
                  ]}
                  emptyLabel="Sin negocios cerrados con dinero ingresado."
                  emptyHint="Esta vista solo muestra oportunidades ganadas con importe cerrado informado."
                />
              )
            })
          : null}

      </div>
    </AppShell>
  );
}
