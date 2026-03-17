import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChangePipelineStateForm } from "@/components/change-pipeline-state-form";
import { EditOpportunityForm } from "@/components/edit-opportunity-form";
import { LogPipelineTaskForm } from "@/components/log-pipeline-task-form";
import { requireUser } from "@/lib/auth/session";
import { getLeadById } from "@/lib/db/leads";
import { getOpportunityById, updateOpportunity } from "@/lib/db/opportunities";
import { formatCurrencyRange, getProductFamilyLabel, listProducts } from "@/lib/db/products";
import { changePipelineState, completePipelineTask, listPipelineEvents } from "@/lib/db/pipeline";
import { listAssignableUsers } from "@/lib/db/users";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type StateRow = {
  id: string;
  name: string;
  entity_type: "lead" | "opportunity" | "both";
  previous_state_id: string | null;
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
};

type SiblingOpportunityRow = {
  id: string;
  product_id: string;
  current_state_id: string;
  name: string | null;
  resolution: string;
  updated_at: string;
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

function getEventLabel(eventType: string, stateName: string | null, taskName: string | null) {
  if (eventType === "state_entered") {
    return stateName ? `Estado: ${stateName}` : "Cambio de estado";
  }
  if (eventType === "task_logged") {
    return taskName ? `Tarea: ${taskName}` : "Tarea registrada";
  }
  if (eventType === "won") return "Opportunity ganada";
  if (eventType === "lost") return "Opportunity perdida";
  if (eventType === "discarded") return "Opportunity descartada";
  if (eventType === "converted") return "Creada desde lead";
  return "Nota registrada";
}

function getAllowedManualStates(currentStateId: string, states: StateRow[]) {
  const currentState = states.find((state) => state.id === currentStateId) ?? null;
  if (!currentState) return [];

  return states.filter((state) => {
    if (state.id === currentStateId) return false;
    if (state.entity_type !== "opportunity" && state.entity_type !== "both") return false;
    if (state.name === "Descartado") return true;
    if (state.previous_state_id === currentStateId) return true;
    if (currentState.previous_state_id === state.id) return true;
    return false;
  });
}

export default async function OpportunityDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const opportunity = await getOpportunityById(params.id);

  if (!opportunity) {
    notFound();
  }
  const opportunityRecord = opportunity;

  const db = createSourceCrmServerClient();
  const dim = createDimServerClient();

  const [lead, statesRes, tasksRes, companyRes, contactRes, siblingRes, eventsRes, products, users] = await Promise.all([
    getLeadById(opportunityRecord.lead_id),
    dim.from("state").select("id, name, entity_type, previous_state_id").order("sort_order", { ascending: true }),
    dim
      .from("task")
      .select("id, name, entity_type, state_id, resulting_state_id, task_kind, active")
      .order("sort_order", { ascending: true }),
    db.from("inversion").select("company_id, compania, vertical, web").eq("company_id", opportunityRecord.company_id).maybeSingle(),
    db.from("contactos").select("contact_id, persona_contacto, email, telefono, rol").eq("contact_id", opportunityRecord.contact_id).maybeSingle(),
    db
      .from("opportunities")
      .select("id, product_id, current_state_id, name, resolution, updated_at")
      .eq("lead_id", opportunityRecord.lead_id)
      .neq("id", opportunityRecord.id)
      .order("updated_at", { ascending: false })
      .limit(6),
    listPipelineEvents({ entity_type: "opportunity", opportunity_id: opportunityRecord.id, pageSize: 12 }),
    listProducts(),
    listAssignableUsers()
  ]);

  if (statesRes.error) throw statesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (companyRes.error) throw companyRes.error;
  if (contactRes.error) throw contactRes.error;
  if (siblingRes.error) throw siblingRes.error;

  const states = (statesRes.data ?? []) as StateRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const company = (companyRes.data ?? null) as CompanyRow | null;
  const contact = (contactRes.data ?? null) as ContactRow | null;
  const siblingOpportunities = (siblingRes.data ?? []) as SiblingOpportunityRow[];
  const stateById = new Map(states.map((state) => [state.id, state]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const currentState = stateById.get(opportunity.current_state_id) ?? null;
  const currentTasks = tasks.filter(
    (task) =>
      task.active &&
      task.state_id === opportunityRecord.current_state_id &&
      (task.entity_type === "opportunity" || task.entity_type === "both")
  );
  const product = productById.get(opportunityRecord.product_id) ?? null;
  const manualStates = getAllowedManualStates(opportunityRecord.current_state_id, states);

  async function logOpportunityTaskAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    await completePipelineTask({
      entity_type: "opportunity",
      opportunity_id: opportunityRecord.id,
      task_id: String(formData.get("task_id") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim() || null,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/acuerdos/opportunities/${opportunityRecord.id}`);
    revalidatePath("/acuerdos");
  }

  async function changeOpportunityStateAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    await changePipelineState({
      entity_type: "opportunity",
      opportunity_id: opportunityRecord.id,
      target_state_id: String(formData.get("target_state_id") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim() || null,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/acuerdos/opportunities/${opportunityRecord.id}`);
    revalidatePath("/acuerdos");
  }

  async function updateOpportunityAction(formData: FormData) {
    "use server";
    const ownerUserId = String(formData.get("owner_user_id") ?? "").trim();
    const activeUsers = await listAssignableUsers();
    const owner = activeUsers.find((candidate) => candidate.id === ownerUserId) ?? null;
    const resolution = String(formData.get("resolution") ?? "open").trim() as "open" | "won" | "lost" | "cancelled";
    const nowIso = new Date().toISOString();

    await updateOpportunity({
      id: opportunityRecord.id,
      product_id: String(formData.get("product_id") ?? "").trim() || opportunityRecord.product_id,
      name: String(formData.get("name") ?? "").trim() || undefined,
      owner_user_id: owner?.id ?? null,
      owner_email: owner?.email ?? null,
      estimated_amount: String(formData.get("estimated_amount") ?? "").trim() || null,
      closed_amount: String(formData.get("closed_amount") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      resolution,
      closed_at: resolution === "open" ? null : opportunityRecord.closed_at ?? nowIso
    });

    revalidatePath(`/acuerdos/opportunities/${opportunityRecord.id}`);
    revalidatePath("/acuerdos");
  }

  return (
    <AppShell
      title={opportunityRecord.name ?? product?.name ?? `Opportunity ${shortId(opportunityRecord.id)}`}
      subtitle="Ficha operativa de opportunity"
      canViewGlobal={user.can_view_global_dashboard}
    >
      <div className="stack">
        <section className="card deal-detail-hero">
          <div className="deal-detail-copy">
            <p className="workspace-kicker">Opportunity</p>
            <h3>{opportunityRecord.name ?? product?.name ?? `Opportunity ${shortId(opportunityRecord.id)}`}</h3>
            <p className="muted">
              Esta ficha concentra el seguimiento post-NDA: producto, estado operativo, importes, lead de origen y timeline completo.
            </p>
          </div>
          <div className="deal-detail-badges">
            <span className="deal-state-pill">{currentState?.name ?? "Sin estado"}</span>
            <span className="deal-detail-pill">{opportunityRecord.resolution}</span>
            <Link href="/acuerdos?section=opportunities" className="company-profile-edit-button">
              Volver a opportunities
            </Link>
          </div>
        </section>

        <section className="card stack">
          <div className="deal-record-grid-meta deal-detail-metrics">
            <div>
              <span>Producto</span>
              <strong>{product?.name ?? "--"}</strong>
            </div>
            <div>
              <span>Lead origen</span>
              <strong>{lead?.name ?? company?.compania ?? `Lead ${shortId(opportunityRecord.lead_id)}`}</strong>
            </div>
            <div>
              <span>Owner</span>
              <strong>{opportunityRecord.owner_email ?? "--"}</strong>
            </div>
            <div>
              <span>Estado actual</span>
              <strong>{currentState?.name ?? "--"}</strong>
            </div>
            <div>
              <span>Importe estimado</span>
              <strong>{formatMoney(opportunityRecord.estimated_amount)}</strong>
            </div>
            <div>
              <span>Importe cerrado</span>
              <strong>{formatMoney(opportunityRecord.closed_amount)}</strong>
            </div>
          </div>

          <div className="deal-detail-links">
            <Link href={`/acuerdos/leads/${opportunityRecord.lead_id}`} className="quick-pill quick-pill-ghost">
              Ver lead origen
            </Link>
            <Link href={`/investors/${opportunityRecord.company_id}`} className="quick-pill quick-pill-ghost">
              Ver compania
            </Link>
            <Link href={`/contacts/${opportunityRecord.contact_id}`} className="quick-pill quick-pill-ghost">
              Ver contacto
            </Link>
          </div>

          {opportunityRecord.notes ? (
            <div className="deal-empty-panel">
              <h4>Notas de la opportunity</h4>
              <p className="muted">{opportunityRecord.notes}</p>
            </div>
          ) : null}
        </section>

        <div className="deal-detail-layout">
          <section className="card stack">
            <LogPipelineTaskForm
              title="Registrar tarea"
              subtitle="Las tareas disponibles dependen del estado actual de la opportunity. Si la tarea mueve de fase, el estado se actualiza automaticamente."
              emptyMessage="No hay tareas activas asociadas al estado actual de esta opportunity."
              submitLabel="Registrar tarea"
              tasks={currentTasks.map((task) => ({
                id: task.id,
                name: task.name,
                taskKind: task.task_kind,
                resultingStateName: task.resulting_state_id ? stateById.get(task.resulting_state_id)?.name ?? null : null
              }))}
              action={logOpportunityTaskAction}
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
                <p className="muted">No hay tareas activas asociadas al estado actual de esta opportunity.</p>
              </div>
            )}

            <ChangePipelineStateForm
              title="Cambio manual de estado"
              subtitle="Solo se permiten movimientos adyacentes y el descarte global para mantener la coherencia del embudo."
              emptyMessage="No hay transiciones manuales válidas desde el estado actual."
              submitLabel="Cambiar estado"
              states={manualStates.map((state) => ({ id: state.id, name: state.name }))}
              action={changeOpportunityStateAction}
            />

            <EditOpportunityForm
              defaults={{
                name: opportunityRecord.name ?? "",
                ownerUserId: opportunityRecord.owner_user_id ?? "",
                notes: opportunityRecord.notes ?? "",
                resolution: opportunityRecord.resolution,
                productId: opportunityRecord.product_id,
                estimatedAmount: opportunityRecord.estimated_amount?.toString() ?? "",
                closedAmount: opportunityRecord.closed_amount?.toString() ?? ""
              }}
              users={users}
              products={products}
              action={updateOpportunityAction}
            />
          </section>

          <aside className="stack">
            <section className="card stack">
              <div className="company-record-section-head">
                <div>
                  <h3>Producto asociado</h3>
                  <p className="muted">Contexto de negocio para esta opportunity.</p>
                </div>
              </div>
              <div className="product-card-grid">
                <div>
                  <span>Familia</span>
                  <strong>{product ? getProductFamilyLabel(product.product_family) : "--"}</strong>
                </div>
                <div>
                  <span>Rango</span>
                  <strong>{product ? formatCurrencyRange(product.amount_min, product.amount_max) : "--"}</strong>
                </div>
              </div>
            </section>

            <section className="card stack">
              <div className="company-record-section-head">
                <div>
                  <h3>Contexto comercial</h3>
                  <p className="muted">Compania y contacto asociados a la opportunity.</p>
                </div>
              </div>
              <div className="deal-record-grid-meta">
                <div>
                  <span>Compania</span>
                  <strong>{company?.compania ?? `Compania ${opportunityRecord.company_id}`}</strong>
                </div>
                <div>
                  <span>Vertical</span>
                  <strong>{company?.vertical ?? "--"}</strong>
                </div>
                <div>
                  <span>Contacto</span>
                  <strong>{contact?.persona_contacto ?? `Contacto ${opportunityRecord.contact_id}`}</strong>
                </div>
                <div>
                  <span>Rol</span>
                  <strong>{contact?.rol ?? "--"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{contact?.email ?? "--"}</strong>
                </div>
                <div>
                  <span>Telefono</span>
                  <strong>{contact?.telefono ?? "--"}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="card stack">
          <div className="company-record-section-head">
            <div>
              <h3>Otras opportunities del mismo lead</h3>
              <p className="muted">Sirve para entender si el lead de origen ha derivado en varias lineas de producto.</p>
            </div>
          </div>
          {siblingOpportunities.length > 0 ? (
            <div className="deal-detail-task-list">
              {siblingOpportunities.map((sibling) => {
                const siblingProduct = productById.get(sibling.product_id);
                const siblingState = stateById.get(sibling.current_state_id);
                return (
                  <Link key={sibling.id} href={`/acuerdos/opportunities/${sibling.id}`} className="deal-detail-related-card">
                    <strong>{sibling.name ?? siblingProduct?.name ?? `Opportunity ${shortId(sibling.id)}`}</strong>
                    <span>{siblingProduct?.name ?? "--"}</span>
                    <small>
                      {siblingState?.name ?? "Sin estado"} · {sibling.resolution} · {formatDate(sibling.updated_at)}
                    </small>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="deal-empty-panel">
              <h4>Sin opportunities hermanas</h4>
              <p className="muted">Este lead de origen solo tiene una opportunity registrada por ahora.</p>
            </div>
          )}
        </section>

        <section className="card stack">
          <div className="company-record-section-head">
            <div>
              <h3>Timeline</h3>
              <p className="muted">Historial unificado de cambios de estado y tareas ejecutadas en esta opportunity.</p>
            </div>
          </div>
          {eventsRes.rows.length > 0 ? (
            <div className="timeline-list">
              {eventsRes.rows.map((event) => {
                const stateName = event.state_id ? stateById.get(event.state_id)?.name ?? null : null;
                const taskName = event.task_id ? taskById.get(event.task_id)?.name ?? null : null;
                return (
                  <article key={event.id} className="timeline-item card">
                    <div className="timeline-item-head deal-detail-timeline-head">
                      <div>
                        <strong>{getEventLabel(event.event_type, stateName, taskName)}</strong>
                        <p className="muted">{formatDateTime(event.occurred_at)}</p>
                      </div>
                      <span className="deal-detail-pill">{event.actor_email ?? "Sistema"}</span>
                    </div>
                    {event.notes ? <p className="muted">{event.notes}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="deal-empty-panel">
              <h4>Sin eventos registrados</h4>
              <p className="muted">Esta opportunity todavia no tiene actividad en `fact.pipeline_event`.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
