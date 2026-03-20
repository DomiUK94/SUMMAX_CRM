import { createDimServerClient } from "@/lib/supabase/dim";
import { createFactServerClient } from "@/lib/supabase/fact";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type LeadRow = {
  id: string;
  company_id: number;
  contact_id: number;
  current_state_id: string;
  name: string | null;
  owner_email: string | null;
  opened_at: string;
  resolution: string;
};

type OpportunityRow = {
  id: string;
  lead_id: string;
  company_id: number;
  contact_id: number;
  product_id: string;
  current_state_id: string;
  name: string | null;
  owner_email: string | null;
  opened_at: string;
  resolution: string;
  estimated_amount: number | null;
  closed_amount: number | null;
};

type StateRow = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
};

type PipelineEventRow = {
  id: string;
  entity_type: "lead" | "opportunity";
  lead_id: string | null;
  opportunity_id: string | null;
  contact_id: number;
  company_id: number;
  product_id: string | null;
  state_id: string | null;
  task_id: string | null;
  event_type: string;
  occurred_at: string;
  actor_email: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

type TaskRow = {
  id: string;
  name: string;
};

export type BusinessLead = {
  id: string;
  name: string;
  stateName: string;
  resolution: string;
  ownerEmail: string;
  openedAt: string;
};

export type BusinessOpportunity = {
  id: string;
  leadId: string;
  name: string;
  productName: string;
  stateName: string;
  resolution: string;
  ownerEmail: string;
  openedAt: string;
  estimatedAmount: number | null;
  closedAmount: number | null;
};

export type BusinessTimelineItem = {
  id: string;
  title: string;
  type: string;
  occurredAt: string;
  occurredAtRaw: string;
  body: string;
  href: string;
  eventType: string;
};

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatEventTitle(params: {
  eventType: string;
  entityType: "lead" | "opportunity";
  stateName: string | null;
  taskName: string | null;
  productName: string | null;
}) {
  if (params.eventType === "task_logged") {
    if (params.taskName) return params.taskName;
    return params.entityType === "lead" ? "Tarea de lead" : "Tarea de opportunity";
  }
  if (params.eventType === "state_entered") {
    return params.stateName ? `Estado: ${params.stateName}` : "Cambio de estado";
  }
  if (params.eventType === "converted") {
    return params.productName ? `Conversión a ${params.productName}` : "Conversión a opportunity";
  }
  if (params.eventType === "won") return "Opportunity ganada";
  if (params.eventType === "lost") return "Opportunity perdida";
  if (params.eventType === "discarded") return "Descartado";
  return "Evento comercial";
}

async function loadSharedLookups() {
  const dim = createDimServerClient();
  const [statesRes, productsRes, tasksRes] = await Promise.all([
    dim.from("state").select("id, name"),
    dim.from("product").select("id, name"),
    dim.from("task").select("id, name")
  ]);

  if (statesRes.error) throw statesRes.error;
  if (productsRes.error) throw productsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  return {
    stateById: new Map(((statesRes.data ?? []) as StateRow[]).map((row) => [row.id, row.name])),
    productById: new Map(((productsRes.data ?? []) as ProductRow[]).map((row) => [row.id, row.name])),
    taskById: new Map(((tasksRes.data ?? []) as TaskRow[]).map((row) => [row.id, row.name]))
  };
}

function mapTimelineItems(rows: PipelineEventRow[], lookups: Awaited<ReturnType<typeof loadSharedLookups>>) {
  return rows.map((row) => {
    const stateName = row.state_id ? lookups.stateById.get(row.state_id) ?? null : null;
    const taskName = row.task_id ? lookups.taskById.get(row.task_id) ?? null : null;
    const productIdFromMetadata = typeof row.metadata?.product_id === "string" ? row.metadata.product_id : null;
    const productName = row.product_id
      ? lookups.productById.get(row.product_id) ?? null
      : productIdFromMetadata
        ? lookups.productById.get(productIdFromMetadata) ?? null
        : null;

    return {
      id: row.id,
      title: formatEventTitle({
        eventType: row.event_type,
        entityType: row.entity_type,
        stateName,
        taskName,
        productName
      }),
      type: row.entity_type === "lead" ? "Lead" : "Opportunity",
      occurredAt: new Date(row.occurred_at).toLocaleString("es-ES"),
      occurredAtRaw: row.occurred_at,
      body: row.notes ?? row.actor_email ?? "--",
      href:
        row.entity_type === "lead"
          ? `/acuerdos/leads/${encodeURIComponent(String(row.lead_id ?? ""))}`
          : `/acuerdos/opportunities/${encodeURIComponent(String(row.opportunity_id ?? ""))}`,
      eventType: row.event_type
    } satisfies BusinessTimelineItem;
  });
}

export async function getBusinessContextForContact(contactId: string) {
  const source = createSourceCrmServerClient();
  const fact = createFactServerClient();
  const lookups = await loadSharedLookups();

  const [leadsRes, opportunitiesRes, eventsRes] = await Promise.all([
    source
      .from("leads")
      .select("id, company_id, contact_id, current_state_id, name, owner_email, opened_at, resolution")
      .eq("contact_id", Number(contactId))
      .order("updated_at", { ascending: false }),
    source
      .from("opportunities")
      .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_email, opened_at, resolution, estimated_amount, closed_amount")
      .eq("contact_id", Number(contactId))
      .order("updated_at", { ascending: false }),
    fact
      .from("pipeline_event")
      .select("id, entity_type, lead_id, opportunity_id, contact_id, company_id, product_id, state_id, task_id, event_type, occurred_at, actor_email, notes, metadata")
      .eq("contact_id", Number(contactId))
      .order("occurred_at", { ascending: false })
      .limit(12)
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (opportunitiesRes.error) throw opportunitiesRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const leads = ((leadsRes.data ?? []) as LeadRow[]).map((row) => ({
    id: row.id,
    name: row.name ?? `Lead ${shortId(row.id)}`,
    stateName: lookups.stateById.get(row.current_state_id) ?? "--",
    resolution: row.resolution,
    ownerEmail: row.owner_email ?? "Sin propietario",
    openedAt: new Date(row.opened_at).toLocaleDateString("es-ES")
  })) satisfies BusinessLead[];

  const opportunities = ((opportunitiesRes.data ?? []) as OpportunityRow[]).map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    name: row.name ?? `${lookups.productById.get(row.product_id) ?? "Opportunity"} ${shortId(row.id)}`,
    productName: lookups.productById.get(row.product_id) ?? "--",
    stateName: lookups.stateById.get(row.current_state_id) ?? "--",
    resolution: row.resolution,
    ownerEmail: row.owner_email ?? "Sin propietario",
    openedAt: new Date(row.opened_at).toLocaleDateString("es-ES"),
    estimatedAmount: row.estimated_amount,
    closedAmount: row.closed_amount
  })) satisfies BusinessOpportunity[];

  const timeline = mapTimelineItems((eventsRes.data ?? []) as PipelineEventRow[], lookups);

  return { leads, opportunities, timeline };
}

export async function getBusinessContextForInvestor(companyId: string) {
  const source = createSourceCrmServerClient();
  const fact = createFactServerClient();
  const lookups = await loadSharedLookups();

  const [leadsRes, opportunitiesRes, eventsRes] = await Promise.all([
    source
      .from("leads")
      .select("id, company_id, contact_id, current_state_id, name, owner_email, opened_at, resolution")
      .eq("company_id", Number(companyId))
      .order("updated_at", { ascending: false }),
    source
      .from("opportunities")
      .select("id, lead_id, company_id, contact_id, product_id, current_state_id, name, owner_email, opened_at, resolution, estimated_amount, closed_amount")
      .eq("company_id", Number(companyId))
      .order("updated_at", { ascending: false }),
    fact
      .from("pipeline_event")
      .select("id, entity_type, lead_id, opportunity_id, contact_id, company_id, product_id, state_id, task_id, event_type, occurred_at, actor_email, notes, metadata")
      .eq("company_id", Number(companyId))
      .order("occurred_at", { ascending: false })
      .limit(12)
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (opportunitiesRes.error) throw opportunitiesRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const leads = ((leadsRes.data ?? []) as LeadRow[]).map((row) => ({
    id: row.id,
    name: row.name ?? `Lead ${shortId(row.id)}`,
    stateName: lookups.stateById.get(row.current_state_id) ?? "--",
    resolution: row.resolution,
    ownerEmail: row.owner_email ?? "Sin propietario",
    openedAt: new Date(row.opened_at).toLocaleDateString("es-ES")
  })) satisfies BusinessLead[];

  const opportunities = ((opportunitiesRes.data ?? []) as OpportunityRow[]).map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    name: row.name ?? `${lookups.productById.get(row.product_id) ?? "Opportunity"} ${shortId(row.id)}`,
    productName: lookups.productById.get(row.product_id) ?? "--",
    stateName: lookups.stateById.get(row.current_state_id) ?? "--",
    resolution: row.resolution,
    ownerEmail: row.owner_email ?? "Sin propietario",
    openedAt: new Date(row.opened_at).toLocaleDateString("es-ES"),
    estimatedAmount: row.estimated_amount,
    closedAmount: row.closed_amount
  })) satisfies BusinessOpportunity[];

  const timeline = mapTimelineItems((eventsRes.data ?? []) as PipelineEventRow[], lookups);

  return { leads, opportunities, timeline };
}
