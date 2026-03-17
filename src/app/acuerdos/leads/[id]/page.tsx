import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChangePipelineStateForm } from "@/components/change-pipeline-state-form";
import { EditLeadForm } from "@/components/edit-lead-form";
import { LogPipelineTaskForm } from "@/components/log-pipeline-task-form";
import { requireUser } from "@/lib/auth/session";
import { getLeadById, updateLead } from "@/lib/db/leads";
import { listProducts } from "@/lib/db/products";
import { changePipelineState, completePipelineTask, listPipelineEvents } from "@/lib/db/pipeline";
import { listAssignableUsers } from "@/lib/db/users";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type StateRow = {
  id: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  previous_state_id: string | null;
  is_terminal: boolean;
  is_conversion_state: boolean;
};

type TaskRow = {
  id: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  state_id: string;
  resulting_state_id: string | null;
  task_kind: "action" | "feedback";
  active: boolean;
};

type CompanyRow = {
  company_id: number;
  compania: string | null;
  vertical: string | null;
  web: string | null;
};

type ContactRow = {
  contact_id: number;
  persona_contacto: string | null;
  email: string | null;
  telefono: string | null;
  rol: string | null;
  linkedin: string | null;
};

type OpportunityRow = {
  id: string;
  product_id: string;
  current_state_id: string;
  name: string | null;
  owner_email: string | null;
  opened_at: string;
  resolution: string;
  estimated_amount: number | null;
  closed_amount: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("es-ES");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });
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

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getEventLabel(
  eventType: string,
  stateName: string | null,
  taskName: string | null,
  productName: string | null
) {
  if (eventType === "state_entered") {
    return stateName ? `Estado: ${stateName}` : "Cambio de estado";
  }
  if (eventType === "task_logged") {
    return taskName ? `Tarea: ${taskName}` : "Tarea registrada";
  }
  if (eventType === "converted") {
    return productName ? `Convertido en opportunity de ${productName}` : "Convertido en opportunity";
  }
  if (eventType === "won") return "Opportunity ganada";
  if (eventType === "lost") return "Opportunity perdida";
  if (eventType === "discarded") return "Lead descartado";
  return "Nota registrada";
}

function getAllowedManualStates(currentStateId: string, states: StateRow[]) {
  const currentState = states.find((state) => state.id === currentStateId) ?? null;
  if (!currentState) return [];

  return states.filter((state) => {
    if (state.id === currentStateId) return false;
    if (state.entity_type !== "lead" && state.entity_type !== "both") return false;
    if (state.name === "Descartado") return true;
    if (state.previous_state_id === currentStateId) return true;
    if (currentState.previous_state_id === state.id) return true;
    return false;
  });
}

export default async function LeadDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const lead = await getLeadById(params.id);

  if (!lead) {
    notFound();
  }
  const leadRecord = lead;

  const db = createSourceCrmServerClient();
  const dim = createDimServerClient();

  const [statesRes, tasksRes, companyRes, contactRes, opportunitiesRes, eventsRes, products, users] = await Promise.all([
    dim
      .from("state")
      .select("id, name, entity_type, previous_state_id, is_terminal, is_conversion_state")
      .order("sort_order", { ascending: true }),
    dim
      .from("task")
      .select("id, name, entity_type, state_id, resulting_state_id, task_kind, active")
      .order("sort_order", { ascending: true }),
    db.from("inversion").select("company_id, compania, vertical, web").eq("company_id", leadRecord.company_id).maybeSingle(),
    db
      .from("contactos")
      .select("contact_id, persona_contacto, email, telefono, rol, linkedin")
      .eq("contact_id", leadRecord.contact_id)
      .maybeSingle(),
    db
      .from("opportunities")
      .select("id, product_id, current_state_id, name, owner_email, opened_at, resolution, estimated_amount, closed_amount")
      .eq("lead_id", leadRecord.id)
      .order("updated_at", { ascending: false }),
    listPipelineEvents({ entity_type: "lead", lead_id: leadRecord.id, pageSize: 12 }),
    listProducts(),
    listAssignableUsers()
  ]);

  if (statesRes.error) throw statesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (companyRes.error) throw companyRes.error;
  if (contactRes.error) throw contactRes.error;
  if (opportunitiesRes.error) throw opportunitiesRes.error;

  const states = (statesRes.data ?? []) as StateRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const company = (companyRes.data ?? null) as CompanyRow | null;
  const contact = (contactRes.data ?? null) as ContactRow | null;
  const relatedOpportunities = (opportunitiesRes.data ?? []) as OpportunityRow[];

  const stateById = new Map(states.map((state) => [state.id, state]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const currentState = stateById.get(leadRecord.current_state_id) ?? null;
  const currentTasks = tasks.filter(
    (task) => task.active && task.state_id === leadRecord.current_state_id && (task.entity_type === "lead" || task.entity_type === "both")
  );
  const manualStates = getAllowedManualStates(leadRecord.current_state_id, states);

  async function logLeadTaskAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    await completePipelineTask({
      entity_type: "lead",
      lead_id: leadRecord.id,
      task_id: String(formData.get("task_id") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim() || null,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/acuerdos/leads/${leadRecord.id}`);
    revalidatePath("/acuerdos");
  }

  async function changeLeadStateAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    await changePipelineState({
      entity_type: "lead",
      lead_id: leadRecord.id,
      target_state_id: String(formData.get("target_state_id") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim() || null,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/acuerdos/leads/${leadRecord.id}`);
    revalidatePath("/acuerdos");
  }

  async function updateLeadAction(formData: FormData) {
    "use server";
    const ownerUserId = String(formData.get("owner_user_id") ?? "").trim();
    const activeUsers = await listAssignableUsers();
    const owner = activeUsers.find((candidate) => candidate.id === ownerUserId) ?? null;
    const resolution = String(formData.get("resolution") ?? "open").trim() as "open" | "converted" | "discarded" | "closed";
    const nowIso = new Date().toISOString();

    await updateLead({
      id: leadRecord.id,
      name: String(formData.get("name") ?? "").trim() || undefined,
      owner_user_id: owner?.id ?? null,
      owner_email: owner?.email ?? null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      resolution,
      converted_at: resolution === "converted" ? leadRecord.converted_at ?? nowIso : null,
      closed_at: resolution === "discarded" || resolution === "closed" ? leadRecord.closed_at ?? nowIso : null
    });

    revalidatePath(`/acuerdos/leads/${leadRecord.id}`);
    revalidatePath("/acuerdos");
  }

  return (
    <AppShell title={leadRecord.name ?? company?.compania ?? `Lead ${shortId(leadRecord.id)}`} subtitle="Ficha operativa de lead" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <section className="card deal-detail-hero">
          <div className="deal-detail-copy">
            <p className="workspace-kicker">Lead</p>
            <h3>{leadRecord.name ?? company?.compania ?? `Lead ${shortId(leadRecord.id)}`}</h3>
            <p className="muted">
              El lead vive hasta superar el NDA. Desde aqui puedes revisar su contexto comercial, las tareas disponibles y las opportunities ya derivadas.
            </p>
          </div>
          <div className="deal-detail-badges">
            <span className="deal-state-pill">{currentState?.name ?? "Sin estado"}</span>
            <span className="deal-detail-pill">{leadRecord.resolution}</span>
            <Link href="/acuerdos?section=leads" className="company-profile-edit-button">
              Volver a leads
            </Link>
          </div>
        </section>

        <section className="card stack">
          <div className="deal-record-grid-meta deal-detail-metrics">
            <div>
              <span>Compania</span>
              <strong>{company?.compania ?? `Compania ${leadRecord.company_id}`}</strong>
            </div>
            <div>
              <span>Contacto</span>
              <strong>{contact?.persona_contacto ?? `Contacto ${leadRecord.contact_id}`}</strong>
            </div>
            <div>
              <span>Owner</span>
              <strong>{leadRecord.owner_email ?? "--"}</strong>
            </div>
            <div>
              <span>Estado actual</span>
              <strong>{currentState?.name ?? "--"}</strong>
            </div>
            <div>
              <span>Abierto</span>
              <strong>{formatDate(leadRecord.opened_at)}</strong>
            </div>
            <div>
              <span>Convertido</span>
              <strong>{formatDate(leadRecord.converted_at)}</strong>
            </div>
          </div>

          <div className="deal-detail-links">
            <Link href={`/investors/${leadRecord.company_id}`} className="quick-pill quick-pill-ghost">
              Ver compania
            </Link>
            <Link href={`/contacts/${leadRecord.contact_id}`} className="quick-pill quick-pill-ghost">
              Ver contacto
            </Link>
          </div>

          {leadRecord.notes ? (
            <div className="deal-empty-panel">
              <h4>Notas del lead</h4>
              <p className="muted">{leadRecord.notes}</p>
            </div>
          ) : null}
        </section>

        <div className="deal-detail-layout">
          <section className="card stack">
            <LogPipelineTaskForm
              title="Registrar tarea"
              subtitle="Elige una tarea valida para el estado actual del lead. Si la tarea cambia el estado, la transicion se aplica automaticamente."
              emptyMessage="No hay tareas activas asociadas al estado actual de este lead."
              submitLabel="Registrar tarea"
              tasks={currentTasks.map((task) => ({
                id: task.id,
                name: task.name,
                taskKind: task.task_kind,
                resultingStateName: task.resulting_state_id ? stateById.get(task.resulting_state_id)?.name ?? null : null
              }))}
              action={logLeadTaskAction}
            />

            {currentTasks.length > 0 ? (
              <div className="deal-detail-task-list">
                {currentTasks.map((task) => {
                  const resultingState = task.resulting_state_id ? stateById.get(task.resulting_state_id) : null;
                  return (
                    <article key={task.id} className="deal-detail-task-card">
                      <div>
                        <strong>{task.name}</strong>
                        <p className="muted">{task.task_kind === "action" ? "Accion" : "Feedback"}</p>
                      </div>
                      <small>{resultingState ? `Lleva a ${resultingState.name}` : "No cambia el estado"}</small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="deal-empty-panel">
                <h4>Sin tareas definidas</h4>
                <p className="muted">No hay tareas activas asociadas al estado actual de este lead.</p>
              </div>
            )}

            <ChangePipelineStateForm
              title="Cambio manual de estado"
              subtitle="Solo se permiten pasos adyacentes y el descarte global para no romper el pipeline."
              emptyMessage="No hay transiciones manuales válidas desde el estado actual."
              submitLabel="Cambiar estado"
              states={manualStates.map((state) => ({ id: state.id, name: state.name }))}
              action={changeLeadStateAction}
            />

            <EditLeadForm
              defaults={{
                name: leadRecord.name ?? "",
                ownerUserId: leadRecord.owner_user_id ?? "",
                notes: leadRecord.notes ?? "",
                resolution: leadRecord.resolution
              }}
              users={users}
              action={updateLeadAction}
            />
          </section>

          <aside className="stack">
            <section className="card stack">
              <div className="company-record-section-head">
                <div>
                  <h3>Contexto de compania</h3>
                  <p className="muted">Datos base para entender el origen del lead.</p>
                </div>
              </div>
              <div className="deal-record-grid-meta">
                <div>
                  <span>Vertical</span>
                  <strong>{company?.vertical ?? "--"}</strong>
                </div>
                <div>
                  <span>Web</span>
                  <strong>{company?.web ?? "--"}</strong>
                </div>
              </div>
            </section>

            <section className="card stack">
              <div className="company-record-section-head">
                <div>
                  <h3>Contacto principal</h3>
                  <p className="muted">Persona asociada a este lead.</p>
                </div>
              </div>
              <div className="deal-record-grid-meta">
                <div>
                  <span>Email</span>
                  <strong>{contact?.email ?? "--"}</strong>
                </div>
                <div>
                  <span>Telefono</span>
                  <strong>{contact?.telefono ?? "--"}</strong>
                </div>
                <div>
                  <span>Rol</span>
                  <strong>{contact?.rol ?? "--"}</strong>
                </div>
                <div>
                  <span>LinkedIn</span>
                  <strong>{contact?.linkedin ?? "--"}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="card stack">
          <div className="company-record-section-head">
            <div>
              <h3>Opportunities derivadas</h3>
              <p className="muted">Un lead puede originar una o varias opportunities y aqui queda clara la trazabilidad.</p>
            </div>
            <Link href={`/acuerdos/opportunities/new?lead_id=${encodeURIComponent(leadRecord.id)}`} className="company-profile-edit-button">
              Nueva opportunity
            </Link>
          </div>
          {relatedOpportunities.length > 0 ? (
            <div className="deal-record-grid">
              {relatedOpportunities.map((opportunity) => {
                const opportunityState = stateById.get(opportunity.current_state_id);
                const product = productById.get(opportunity.product_id);
                return (
                  <article key={opportunity.id} className="deal-record-card">
                    <div className="deal-record-head">
                      <div>
                        <Link href={`/acuerdos/opportunities/${opportunity.id}`} className="deal-detail-inline-link">
                          {opportunity.name ?? product?.name ?? `Opportunity ${shortId(opportunity.id)}`}
                        </Link>
                        <p className="muted">{product?.name ?? "--"}</p>
                      </div>
                      <span className="deal-state-pill">{opportunityState?.name ?? "Sin estado"}</span>
                    </div>
                    <div className="deal-record-grid-meta">
                      <div>
                        <span>Owner</span>
                        <strong>{opportunity.owner_email ?? "--"}</strong>
                      </div>
                      <div>
                        <span>Resolucion</span>
                        <strong>{opportunity.resolution}</strong>
                      </div>
                      <div>
                        <span>Importe estimado</span>
                        <strong>{formatMoney(opportunity.estimated_amount)}</strong>
                      </div>
                      <div>
                        <span>Importe cerrado</span>
                        <strong>{formatMoney(opportunity.closed_amount)}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="deal-empty-panel">
              <h4>Sin opportunities derivadas</h4>
              <p className="muted">Todavia no se ha convertido este lead en una opportunity activa.</p>
            </div>
          )}
        </section>

        <section className="card stack">
          <div className="company-record-section-head">
            <div>
              <h3>Timeline</h3>
              <p className="muted">Historial unificado de cambios de estado, notas y conversiones del lead.</p>
            </div>
          </div>
          {eventsRes.rows.length > 0 ? (
            <div className="timeline-list">
              {eventsRes.rows.map((event) => {
                const stateName = event.state_id ? stateById.get(event.state_id)?.name ?? null : null;
                const taskName = event.task_id ? taskById.get(event.task_id)?.name ?? null : null;
                const metadataOpportunityId = readMetadataString(event.metadata, "opportunity_id");
                const metadataProductId = event.product_id ?? readMetadataString(event.metadata, "product_id");
                const metadataProductName = metadataProductId ? productById.get(metadataProductId)?.name ?? null : null;
                return (
                  <article key={event.id} className="timeline-item card">
                    <div className="timeline-item-head deal-detail-timeline-head">
                      <div>
                        <strong>{getEventLabel(event.event_type, stateName, taskName, metadataProductName)}</strong>
                        <p className="muted">{formatDateTime(event.occurred_at)}</p>
                      </div>
                      <span className="deal-detail-pill">{event.actor_email ?? "Sistema"}</span>
                    </div>
                    {event.notes ? <p className="muted">{event.notes}</p> : null}
                    {metadataOpportunityId ? (
                      <div className="deal-detail-links">
                        <Link href={`/acuerdos/opportunities/${metadataOpportunityId}`} className="quick-pill quick-pill-ghost">
                          Abrir opportunity generada
                        </Link>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="deal-empty-panel">
              <h4>Sin eventos registrados</h4>
              <p className="muted">Este lead todavia no tiene actividad en `fact.pipeline_event`.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
