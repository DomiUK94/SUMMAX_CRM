import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProspectTaskEntryForm } from "@/components/prospect-task-entry-form";
import { TaskContactHistoryTable } from "@/components/task-contact-history-table";
import { requireUser } from "@/lib/auth/session";
import { completePipelineTask } from "@/lib/db/pipeline";
import {
  convertProspectToLead,
  createProspect,
  getOpenProspectByContact,
  listProspectsPage,
  reopenProspect,
  syncProspectStatusFromTasks,
  type ProspectRecord
} from "@/lib/db/prospects";
import { createProspectTask, listRecentProspectTasks, type ProspectTaskRecord } from "@/lib/db/prospect-tasks";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createFactServerClient } from "@/lib/supabase/fact";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type ActivitySection = "pending" | "new" | "by_contact" | "by_entity";

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

type StateRow = {
  id: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  sort_order: number;
};

type EventRow = {
  id: string;
  entity_type: "lead" | "opportunity";
  lead_id: string | null;
  opportunity_id: string | null;
  contact_id: number;
  task_id: string | null;
  event_type: string;
  occurred_at: string;
};

type LeadRow = {
  id: string;
  name: string | null;
  contact_id: number;
  current_state_id: string;
  owner_email: string | null;
  resolution: string;
  updated_at: string;
};

type OpportunityRow = {
  id: string;
  name: string | null;
  contact_id: number;
  current_state_id: string;
  owner_email: string | null;
  resolution: string;
  updated_at: string;
};

type ContactRow = {
  contact_id: number;
  company_id: number;
  persona_contacto: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
};

type CompanyRow = {
  company_id: number;
  compania: string | null;
};

type PendingEntry = {
  kind: "action" | "feedback";
  entityType: "prospect" | "lead" | "opportunity";
  entityId: string;
  title: string;
  stateName: string;
  contactName: string;
  ownerEmail: string;
  taskNames: string[];
  href: string;
};

const PROSPECT_TASK_NAMES = new Set(["Contactar", "Contactado", "2ndo contacto"]);
const CONTACT_PROGRESS_TASK_NAMES = new Set(["Contactado", "2ndo contacto"]);

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-ES");
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function isOpenResolution(resolution: string) {
  return resolution === "open";
}

function summarizeNames(values: string[], limit = 3) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return "--";
  if (unique.length <= limit) return unique.join(", ");
  return `${unique.slice(0, limit).join(", ")} y ${unique.length - limit} mas`;
}

function getNextProspectTaskName(latestTaskName: string | null) {
  if (!latestTaskName) return "Contactar";
  const normalized = latestTaskName.trim().toLowerCase();
  if (normalized === "contactar") return "Contactado";
  if (normalized === "contactado") return "2ndo contacto";
  if (normalized === "2ndo contacto") return null;
  return "Contactar";
}

function normalizeSection(value: string | undefined): ActivitySection {
  if (value === "new" || value === "by_contact" || value === "by_entity") return value;
  return "pending";
}

function buildSectionHref(section: ActivitySection, extras: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams();
  search.set("section", section);
  for (const [key, value] of Object.entries(extras)) {
    if (value) search.set(key, value);
  }
  return `/actividades?${search.toString()}`;
}

export async function ActivitiesWorkspace(props: {
  searchParams?: {
    section?: string;
    contact_id?: string;
    history_contact_id?: string;
    created_task_name?: string;
    created_contact_name?: string;
  };
}) {
  const user = await requireUser();
  const activeSection = normalizeSection(props.searchParams?.section);
  const initialContactId = String(props.searchParams?.contact_id ?? "").trim();
  const createdTaskName = String(props.searchParams?.created_task_name ?? "").trim();
  const createdContactName = String(props.searchParams?.created_contact_name ?? "").trim();
  const historyContactId = Number(String(props.searchParams?.history_contact_id ?? "").trim());
  const dim = createDimServerClient();
  const fact = createFactServerClient();
  const source = createSourceCrmServerClient();

  const [tasksRes, statesRes, eventsRes, leadsRes, opportunitiesRes, contactsRes, companiesRes, recentProspectTasks, openProspectsRes, closedProspectsRes] =
    await Promise.all([
      dim
        .from("task")
        .select("id, name, entity_type, state_id, resulting_state_id, task_kind, sort_order, active")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      dim.from("state").select("id, name, entity_type, sort_order").eq("active", true).order("sort_order", { ascending: true }),
      fact
        .from("pipeline_event")
        .select("id, entity_type, lead_id, opportunity_id, contact_id, task_id, event_type, occurred_at")
        .not("task_id", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(180),
      source
        .from("leads")
        .select("id, name, contact_id, current_state_id, owner_email, resolution, updated_at")
        .eq("resolution", "open")
        .order("updated_at", { ascending: false })
        .limit(160),
      source
        .from("opportunities")
        .select("id, name, contact_id, current_state_id, owner_email, resolution, updated_at")
        .eq("resolution", "open")
        .order("updated_at", { ascending: false })
        .limit(160),
      source
        .from("contactos")
        .select("contact_id, company_id, persona_contacto, owner_user_id, owner_email")
        .order("updated_at", { ascending: false })
        .limit(260),
      source.from("inversion").select("company_id, compania").order("updated_at", { ascending: false }).limit(260),
      listRecentProspectTasks(180),
      listProspectsPage({ page: 1, pageSize: 220, resolution: "open" }),
      listProspectsPage({ page: 1, pageSize: 220, resolution: "not_interested" })
    ]);

  if (tasksRes.error) throw tasksRes.error;
  if (statesRes.error) throw statesRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (leadsRes.error) throw leadsRes.error;
  if (opportunitiesRes.error) throw opportunitiesRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const states = (statesRes.data ?? []) as StateRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const leads = (leadsRes.data ?? []) as LeadRow[];
  const opportunities = (opportunitiesRes.data ?? []) as OpportunityRow[];
  const contacts = (contactsRes.data ?? []) as ContactRow[];
  const companies = (companiesRes.data ?? []) as CompanyRow[];
  const prospectHistory = recentProspectTasks as ProspectTaskRecord[];
  const openProspects = openProspectsRes.rows as ProspectRecord[];
  const closedProspects = closedProspectsRes.rows as ProspectRecord[];

  const stateById = new Map(states.map((state) => [state.id, state]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const contactNameById = new Map(contacts.map((contact) => [contact.contact_id, contact.persona_contacto ?? `Contacto ${contact.contact_id}`]));
  const companyNameById = new Map(companies.map((company) => [company.company_id, company.compania ?? `Compania ${company.company_id}`]));
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const openProspectByContactId = new Map(openProspects.map((prospect) => [prospect.contact_id, prospect]));
  const latestClosedProspectByContactId = new Map<number, ProspectRecord>();

  for (const prospect of closedProspects) {
    if (!latestClosedProspectByContactId.has(prospect.contact_id)) {
      latestClosedProspectByContactId.set(prospect.contact_id, prospect);
    }
  }

  const openLeadByContactId = new Map(leads.map((lead) => [lead.contact_id, lead]));
  const openOpportunityByContactId = new Map(opportunities.map((opportunity) => [opportunity.contact_id, opportunity]));

  const tasksByStateId = tasks.reduce((map, task) => {
    const bucket = map.get(task.state_id) ?? [];
    bucket.push(task);
    map.set(task.state_id, bucket);
    return map;
  }, new Map<string, TaskRow[]>());

  const latestProspectTaskByProspectId = prospectHistory.reduce((map, task) => {
    if (!task.prospect_id) return map;
    const current = map.get(task.prospect_id);
    if (!current || new Date(task.occurred_at).getTime() > new Date(current.occurred_at).getTime()) {
      map.set(task.prospect_id, task);
    }
    return map;
  }, new Map<string, ProspectTaskRecord>());

  const pendingEntries: PendingEntry[] = [
    ...openProspects
      .filter((prospect) => isOpenResolution(prospect.resolution))
      .flatMap((prospect) => {
        const latestTask = latestProspectTaskByProspectId.get(prospect.id) ?? null;
        const nextTaskName = getNextProspectTaskName(latestTask?.task_name ?? null);
        if (!nextTaskName) return [];
        return [{
          kind: "action" as const,
          entityType: "prospect" as const,
          entityId: prospect.id,
          title: `Prospecto ${contactNameById.get(prospect.contact_id) ?? `Contacto ${prospect.contact_id}`}`,
          stateName: prospect.status === "en_contacto" ? "En contacto" : "Contactar",
          contactName: contactNameById.get(prospect.contact_id) ?? `Contacto ${prospect.contact_id}`,
          ownerEmail: prospect.owner_email ?? "Sin owner",
          taskNames: [nextTaskName],
          href: buildSectionHref("new", { contact_id: String(prospect.contact_id) })
        }];
      }),
    ...leads.filter((lead) => isOpenResolution(lead.resolution)).flatMap((lead) => {
      const grouped = new Map<"action" | "feedback", string[]>();
      for (const task of tasksByStateId.get(lead.current_state_id) ?? []) {
        if (task.entity_type !== "lead" && task.entity_type !== "both") continue;
        const bucket = grouped.get(task.task_kind) ?? [];
        bucket.push(task.name);
        grouped.set(task.task_kind, bucket);
      }
      return Array.from(grouped.entries()).map(([kind, taskNames]) => ({
        kind,
        entityType: "lead" as const,
        entityId: lead.id,
        title: lead.name ?? `Lead ${shortId(lead.id)}`,
        stateName: stateById.get(lead.current_state_id)?.name ?? "Sin estado",
        contactName: contactNameById.get(lead.contact_id) ?? `Contacto ${lead.contact_id}`,
        ownerEmail: lead.owner_email ?? "Sin owner",
        taskNames,
        href: `/acuerdos/leads/${encodeURIComponent(lead.id)}`
      }));
    }),
    ...opportunities.filter((opportunity) => isOpenResolution(opportunity.resolution)).flatMap((opportunity) => {
      const grouped = new Map<"action" | "feedback", string[]>();
      for (const task of tasksByStateId.get(opportunity.current_state_id) ?? []) {
        if (task.entity_type !== "opportunity" && task.entity_type !== "both") continue;
        const bucket = grouped.get(task.task_kind) ?? [];
        bucket.push(task.name);
        grouped.set(task.task_kind, bucket);
      }
      return Array.from(grouped.entries()).map(([kind, taskNames]) => ({
        kind,
        entityType: "opportunity" as const,
        entityId: opportunity.id,
        title: opportunity.name ?? `Oportunidad ${shortId(opportunity.id)}`,
        stateName: stateById.get(opportunity.current_state_id)?.name ?? "Sin estado",
        contactName: contactNameById.get(opportunity.contact_id) ?? `Contacto ${opportunity.contact_id}`,
        ownerEmail: opportunity.owner_email ?? "Sin owner",
        taskNames,
        href: `/acuerdos/opportunities/${encodeURIComponent(opportunity.id)}`
      }));
    })
  ];

  const prospectTaskOptions = tasks
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
  const taskOccurrences = Array.from(
    [...prospectHistory, ...events].reduce((map, item) => {
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

  async function logProspectTaskAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const actionDim = createDimServerClient();
    const actionSource = createSourceCrmServerClient();
    const contactId = Number(String(formData.get("contact_id") ?? "").trim());
    const taskId = String(formData.get("task_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const reactivationMode = String(formData.get("reactivation_mode") ?? "").trim();
    const latestClosedProspectId = String(formData.get("latest_closed_prospect_id") ?? "").trim();

    const [contactRes, taskRes, openLeadRes, openOpportunityRes] = await Promise.all([
      actionSource.from("contactos").select("contact_id, company_id, persona_contacto, owner_user_id, owner_email").eq("contact_id", contactId).maybeSingle(),
      actionDim.from("task").select("id, name, state_id").eq("id", taskId).maybeSingle(),
      actionSource.from("leads").select("id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle(),
      actionSource.from("opportunities").select("id").eq("contact_id", contactId).eq("resolution", "open").limit(1).maybeSingle()
    ]);

    if (contactRes.error) throw contactRes.error;
    if (taskRes.error) throw taskRes.error;
    if (openLeadRes.error) throw openLeadRes.error;
    if (openOpportunityRes.error) throw openOpportunityRes.error;
    if (!contactRes.data) throw new Error("Contacto no encontrado");
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
        actor_user_id: actor.id,
        actor_email: actor.email,
        notes
      });
      await completePipelineTask({
        entity_type: "lead",
        lead_id: converted.lead.id,
        task_id: task.id,
        notes,
        actor_user_id: actor.id,
        actor_email: actor.email
      });
    }

    revalidatePath("/actividades");
    revalidatePath("/contacts");
    revalidatePath("/investors");
    revalidatePath("/acuerdos");
    redirect(
      buildSectionHref("new", {
        contact_id: String(contact.contact_id),
        created_task_name: task.name,
        created_contact_name: contact.persona_contacto ?? `Contacto ${contact.contact_id}`
      })
    );
  }

  const contactHistoryAll = Array.from(
    [...prospectHistory, ...events].reduce((map, item) => {
      const taskName = "task_name" in item ? item.task_name : item.task_id ? taskById.get(item.task_id)?.name ?? "Tarea" : "Tarea";
      const entityName =
        "task_name" in item
          ? "Prospecto"
          : item.entity_type === "lead"
            ? leadById.get(item.lead_id ?? "")?.name ?? `Lead ${shortId(item.lead_id ?? "")}`
            : opportunityById.get(item.opportunity_id ?? "")?.name ?? `Oportunidad ${shortId(item.opportunity_id ?? "")}`;
      const current = map.get(item.contact_id) ?? {
        contactId: item.contact_id,
        count: 0,
        lastAt: item.occurred_at,
        latestTaskName: taskName,
        taskNames: [] as string[],
        entityNames: [] as string[]
      };
      current.count += 1;
      if (new Date(item.occurred_at).getTime() > new Date(current.lastAt).getTime()) {
        current.lastAt = item.occurred_at;
        current.latestTaskName = taskName;
      }
      current.taskNames.push(taskName);
      current.entityNames.push(entityName);
      map.set(item.contact_id, current);
      return map;
    }, new Map<number, { contactId: number; count: number; lastAt: string; latestTaskName: string; taskNames: string[]; entityNames: string[] }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  const contactHistoryDetailsById = [...prospectHistory, ...events].reduce((map, item) => {
    const taskName = "task_name" in item ? item.task_name : item.task_id ? taskById.get(item.task_id)?.name ?? "Tarea" : "Tarea";
    const entityName =
      "task_name" in item
        ? "Prospecto"
        : item.entity_type === "lead"
          ? leadById.get(item.lead_id ?? "")?.name ?? `Lead ${shortId(item.lead_id ?? "")}`
          : opportunityById.get(item.opportunity_id ?? "")?.name ?? `Oportunidad ${shortId(item.opportunity_id ?? "")}`;
    const stage =
      "task_name" in item
        ? "prospect"
        : item.entity_type === "lead"
          ? "lead"
          : item.event_type === "won"
            ? "closed_deal"
            : "opportunity";
    const current = map.get(item.contact_id) ?? [];
    current.push({
      id: "task_name" in item ? `prospect:${item.id}` : `${item.entity_type}:${item.id}`,
      occurredAt: item.occurred_at,
      taskName,
      entityName,
      stage
    });
    map.set(item.contact_id, current);
    return map;
  }, new Map<number, Array<{ id: string; occurredAt: string; taskName: string; entityName: string; stage: "prospect" | "lead" | "opportunity" | "closed_deal" }>>());

  const entityHistory = Array.from(
    events.reduce((map, event) => {
      const entityId = event.entity_type === "lead" ? event.lead_id ?? "" : event.opportunity_id ?? "";
      const key = `${event.entity_type}:${entityId}`;
      const current = map.get(key) ?? {
        key,
        entityType: event.entity_type,
        entityId,
        entityName:
          event.entity_type === "lead"
            ? leadById.get(entityId)?.name ?? `Lead ${shortId(entityId)}`
            : opportunityById.get(entityId)?.name ?? `Oportunidad ${shortId(entityId)}`,
        count: 0,
        lastAt: event.occurred_at,
        taskNames: [] as string[],
        contactId: event.contact_id
      };
      current.count += 1;
      if (new Date(event.occurred_at).getTime() > new Date(current.lastAt).getTime()) current.lastAt = event.occurred_at;
      current.taskNames.push(event.task_id ? taskById.get(event.task_id)?.name ?? "Tarea" : "Tarea");
      map.set(key, current);
      return map;
    }, new Map<string, { key: string; entityType: "lead" | "opportunity"; entityId: string; entityName: string; count: number; lastAt: string; taskNames: string[]; contactId: number }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .slice(0, 14);

  const pendingActionEntries = pendingEntries.filter((entry) => entry.kind === "action");
  const pendingFeedbackEntries = pendingEntries.filter((entry) => entry.kind === "feedback");
  const selectedHistory = Number.isFinite(historyContactId) && historyContactId > 0 ? contactHistoryAll.find((group) => group.contactId === historyContactId) ?? null : null;
  const contactHistory = selectedHistory ? contactHistoryAll : contactHistoryAll.slice(0, 12);
  const contactHistoryRows = contactHistory.map((group) => ({
    contactId: group.contactId,
    contactName: contactNameById.get(group.contactId) ?? `Contacto ${group.contactId}`,
    count: group.count,
    lastAt: formatDateTime(group.lastAt),
    taskNames: group.latestTaskName,
    entityNames: summarizeNames(group.entityNames, 2),
    historyHref: buildSectionHref("by_contact", { history_contact_id: String(group.contactId) })
  }));
  const selectedHistoryDetails = selectedHistory
    ? (contactHistoryDetailsById.get(selectedHistory.contactId) ?? []).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    : [];

  return (
    <AppShell title="Tareas" subtitle="Seguimiento simple de prospectos, leads y oportunidades" canViewGlobal={user.can_view_global_dashboard}>
      <div className="companies-shell stack">
        {createdTaskName && createdContactName ? (
          <Link
            href={buildSectionHref("by_contact", { history_contact_id: String(initialContactId || historyContactId || "") })}
            className="crm-toast crm-toast-success task-toast-link"
          >
            <span className="crm-toast-dot" aria-hidden="true" />
            <span>{`Tarea ${createdTaskName} creada para contacto ${createdContactName}`}</span>
          </Link>
        ) : null}

        <section className="task-hero card">
          <div>
            <p className="workspace-kicker">Tareas del pipeline</p>
            <h3>Prospecto, Lead y Oportunidad en una vista operativa</h3>
            <p className="muted">Desde aqui puedes lanzar tareas sobre prospectos, leads y oportunidades, y revisar rapido que esta pendiente y que ya se ha hecho.</p>
          </div>
        </section>

        <div className="smart-tabs-row" role="tablist" aria-label="Secciones de tareas">
          <Link href={buildSectionHref("pending")} className={activeSection === "pending" ? "smart-tab smart-tab-active" : "smart-tab"}>Tareas pendientes</Link>
          <Link href={buildSectionHref("new", initialContactId ? { contact_id: initialContactId } : {})} className={activeSection === "new" ? "smart-tab smart-tab-active" : "smart-tab"}>Nueva tarea</Link>
          <Link href={buildSectionHref("by_contact")} className={activeSection === "by_contact" ? "smart-tab smart-tab-active" : "smart-tab"}>Tareas por contacto</Link>
        </div>

        {activeSection === "pending" ? (
          <section className="card stack">
            <div className="company-record-section-head">
              <div>
                <h3>Tareas pendientes</h3>
                <p className="muted">Vista operativa de tareas pendientes por estado actual, separadas entre accion y feedback.</p>
              </div>
            </div>

            <article className="stack">
              <div className="task-catalog-head"><strong>Tareas pendientes que requieren Accion</strong><span>{pendingActionEntries.length}</span></div>
              <div className="task-catalog-grid">
                {pendingActionEntries.map((entry) => (
                  <Link key={`${entry.kind}:${entry.entityType}:${entry.entityId}`} href={entry.href} className="deal-detail-related-card">
                    <strong>{entry.title}</strong>
                    <span>{entry.entityType === "prospect" ? "Prospecto" : entry.entityType === "lead" ? "Lead" : "Oportunidad"} · {entry.stateName}</span>
                    <small>{entry.contactName} · {entry.ownerEmail}</small>
                    <small>Acciones: {summarizeNames(entry.taskNames, 3)}</small>
                  </Link>
                ))}
                {pendingActionEntries.length === 0 ? <div className="task-empty-state"><strong>Sin tareas pendientes de accion</strong><p className="muted">No hay prospectos, leads ni oportunidades abiertas con acciones pendientes detectadas.</p></div> : null}
              </div>
            </article>

            <article className="stack">
              <div className="task-catalog-head"><strong>Tareas pendientes de feedback</strong><span>{pendingFeedbackEntries.length}</span></div>
              <div className="task-catalog-grid">
                {pendingFeedbackEntries.map((entry) => (
                  <Link key={`${entry.kind}:${entry.entityType}:${entry.entityId}`} href={entry.href} className="deal-detail-related-card">
                    <strong>{entry.title}</strong>
                    <span>{entry.entityType === "lead" ? "Lead" : "Oportunidad"} · {entry.stateName}</span>
                    <small>{entry.contactName} · {entry.ownerEmail}</small>
                    <small>Feedback: {summarizeNames(entry.taskNames, 3)}</small>
                  </Link>
                ))}
                {pendingFeedbackEntries.length === 0 ? <div className="task-empty-state"><strong>Sin tareas pendientes de feedback</strong><p className="muted">No hay leads ni oportunidades abiertas con feedback pendiente detectado.</p></div> : null}
              </div>
            </article>
          </section>
        ) : null}

        {activeSection === "new" ? (
          <section className="deal-detail-layout activities-new-layout">
            <article className="card stack">
              <ProspectTaskEntryForm
                title="Nueva tarea"
                subtitle="La nueva tarea se registra desde el contacto. Si ya existe un lead u oportunidad abierta, usa esa ficha para continuar."
                contacts={contacts.map((contact) => {
                  const openProspect = openProspectByContactId.get(contact.contact_id) ?? null;
                  const closedProspect = latestClosedProspectByContactId.get(contact.contact_id) ?? null;
                  const openLead = openLeadByContactId.get(contact.contact_id) ?? null;
                  const openOpportunity = openOpportunityByContactId.get(contact.contact_id) ?? null;
                  const companyName = companyNameById.get(contact.company_id) ?? `Compania ${contact.company_id}`;
                  const statusLabel = openOpportunity ? "Oportunidad abierta" : openLead ? "Lead abierto" : openProspect ? "Prospecto abierto" : closedProspect ? "Prospecto cerrado" : "Sin pipeline activo";
                  return {
                    id: String(contact.contact_id),
                    label: `${contact.persona_contacto ?? `Contacto ${contact.contact_id}`} · ${companyName} · ${statusLabel}`,
                    openProspectId: openProspect?.id ?? null,
                    latestClosedProspectId: closedProspect?.id ?? null,
                    hasClosedProspect: Boolean(closedProspect),
                    blockedEntityType: openOpportunity ? "opportunity" : openLead ? "lead" : null,
                    blockedEntityId: openOpportunity?.id ?? openLead?.id ?? null
                  };
                })}
                tasks={prospectTaskOptions}
                taskOccurrences={taskOccurrences}
                action={logProspectTaskAction}
                initialContactId={initialContactId || undefined}
              />
            </article>
          </section>
        ) : null}

        {activeSection === "by_contact" ? (
          <section className="card stack">
            <div className="company-record-section-head">
              <div>
                <h3>{selectedHistory ? `Historial de tareas de ${contactNameById.get(selectedHistory.contactId) ?? `Contacto ${selectedHistory.contactId}`}` : "Tareas hechas por contacto"}</h3>
                <p className="muted">
                  {selectedHistory
                    ? "Detalle de tareas registradas para este contacto en prospectos, leads y oportunidades."
                    : "Resumen de actividad agrupado por contacto, incluyendo prospectos, leads y oportunidades."}
                </p>
              </div>
              {selectedHistory ? (
                <div className="deal-detail-links">
                  <Link href={buildSectionHref("by_contact")} className="quick-pill quick-pill-ghost">Ver todos</Link>
                </div>
              ) : null}
            </div>
            {selectedHistory ? (
              <div className="task-history-pipeline">
                <div className="task-history-pipeline-head">
                  <span>Fecha</span>
                  <span>Prospecto</span>
                  <span>Lead</span>
                  <span>Oportunidad</span>
                  <span>Negocio cerrado</span>
                </div>
                {selectedHistoryDetails.map((item) => (
                  <article key={item.id} className="task-history-pipeline-row">
                    <span className="task-history-pipeline-date">{formatDateTime(item.occurredAt)}</span>
                    <div className={`task-history-pipeline-step task-history-pipeline-step-${item.stage}`}>
                      <strong>{item.stage === "opportunity" || item.stage === "closed_deal" ? `${item.entityName} · ${item.taskName}` : item.taskName}</strong>
                      <small>{item.entityName}</small>
                    </div>
                  </article>
                ))}
                {selectedHistoryDetails.length === 0 ? <div className="task-empty-state"><strong>Sin historial</strong><p className="muted">Este contacto aun no tiene tareas registradas.</p></div> : null}
              </div>
            ) : (
            <TaskContactHistoryTable rows={contactHistoryRows} />
            )}
          </section>
        ) : null}

        {activeSection === "by_entity" ? (
          <section className="card stack">
            <div className="company-record-section-head">
              <div>
                <h3>Tareas hechas por Lead / Oportunidad</h3>
                <p className="muted">Resumen de actividad agrupado por entidad comercial.</p>
              </div>
            </div>
            <div className="task-history-list">
              {entityHistory.map((group) => (
                <article key={group.key} className="task-history-item">
                  <div className="task-history-head"><strong>{group.entityName}</strong><span>{formatDateTime(group.lastAt)}</span></div>
                  <div className="task-history-meta">
                    <span className="task-context-pill">{group.entityType === "lead" ? "Lead" : "Oportunidad"}</span>
                    <span>{contactNameById.get(group.contactId) ?? `Contacto ${group.contactId}`}</span>
                    <span>{group.count} tareas</span>
                  </div>
                  <p>{summarizeNames(group.taskNames, 4)}</p>
                  <div className="deal-detail-links">
                    <Link href={group.entityType === "lead" ? `/acuerdos/leads/${encodeURIComponent(group.entityId)}` : `/acuerdos/opportunities/${encodeURIComponent(group.entityId)}`} className="quick-pill quick-pill-ghost">Abrir ficha</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
