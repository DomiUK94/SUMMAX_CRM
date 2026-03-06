import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type Params = {
  params: {
    id: string;
  };
};

const STATUS_OPTIONS = ["abierta", "en_revision", "planificada", "en_progreso", "resuelta", "descartada"] as const;
const CLOSED_STATUS = ["resuelta", "descartada"];

function parseLegacyMetadata(rawText: string) {
  const priorityMatch = rawText.match(/\[Prioridad:\s*([^\]]+)\]/i);
  const impactMatch = rawText.match(/\[Impacto:\s*([^\]]+)\]/i);
  const cleanText = rawText
    .replace(/\[Modulo:[^\]]+\]\s*/gi, "")
    .replace(/\[Prioridad:[^\]]+\]\s*/gi, "")
    .replace(/\[Impacto:[^\]]+\]\s*/gi, "")
    .trim();
  return {
    priority: priorityMatch?.[1]?.trim() ?? "--",
    impact: impactMatch?.[1]?.trim() ?? "--",
    body: cleanText
  };
}

function eventBadgeClass(eventType: string): string {
  if (eventType === "bug") return "contact-followup-rojo";
  if (eventType === "feedback") return "contact-followup-ambar";
  if (eventType === "cambio_estado") return "contact-followup-verde";
  return "contact-followup-verde";
}

function statusChipClass(status: string | null | undefined): string {
  if (!status) return "crm-chip-status-en_revision";
  return `crm-chip-status-${status}`;
}

function priorityChipClass(priority: string | null | undefined): string {
  if (!priority) return "crm-chip-priority-media";
  return `crm-chip-priority-${priority}`;
}

function impactChipClass(impact: string | null | undefined): string {
  if (!impact) return "crm-chip-impact-equipo";
  return `crm-chip-impact-${impact}`;
}

export default async function SugerenciaDetailPage({ params }: Params) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const suggestionId = params.id;

  async function addEventAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const eventType = String(formData.get("event_type") ?? "nota").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    const normalizedEventType = eventType === "feedback" || eventType === "bug" ? eventType : "nota";
    await source.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: normalizedEventType,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    await source.from("suggestions").update({ updated_at: new Date().toISOString() }).eq("id", suggestionId);

    revalidatePath(`/sugerencias/${suggestionId}`);
    revalidatePath("/sugerencias");
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const status = String(formData.get("status") ?? "").trim();
    const reason = String(formData.get("status_reason") ?? "").trim();
    if (!STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) return;
    const currentRes = await source.from("suggestions").select("status").eq("id", suggestionId).maybeSingle();
    const currentStatus = currentRes.data?.status ?? "";
    const isReopen = CLOSED_STATUS.includes(currentStatus) && !CLOSED_STATUS.includes(status);
    if (isReopen && !reason) return;

    const updateRes = await source
      .from("suggestions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", suggestionId);
    if (updateRes.error) return;

    await source.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: "cambio_estado",
      body: isReopen
        ? `Entrada reabierta a: ${status}. Motivo obligatorio: ${reason}`
        : reason
          ? `Estado actualizado a: ${status}. Motivo: ${reason}`
          : `Estado actualizado a: ${status}`,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath(`/sugerencias/${suggestionId}`);
    revalidatePath("/sugerencias");
  }

  const [{ data: suggestion }, { data: events }] = await Promise.all([
    db
      .from("suggestions")
      .select("id, suggestion_text, suggestion_type, priority_level, impact_scope, status, created_by_user_id, created_by_email, created_at, updated_at")
      .eq("id", suggestionId)
      .maybeSingle(),
    db
      .from("suggestion_events")
      .select("id, event_type, body, created_by_user_id, created_by_email, created_at")
      .eq("suggestion_id", suggestionId)
      .order("created_at", { ascending: false })
      .limit(600)
  ]);

  if (!suggestion) {
    return (
      <AppShell title="Sugerencias, Bugs y Notas" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Entrada no encontrada.</div>
      </AppShell>
    );
  }

  const participantIds = Array.from(new Set((events ?? []).map((e) => e.created_by_user_id).filter((id): id is string => Boolean(id))));
  const { data: participants } = participantIds.length
    ? await db.from("users").select("id, full_name, email").in("id", participantIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };
  const nameById = new Map((participants ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]));
  const ownerDisplayName = nameById.get(suggestion.created_by_user_id) ?? suggestion.created_by_email;
  const legacyMeta = parseLegacyMetadata(suggestion.suggestion_text);
  const priority = suggestion.priority_level ?? legacyMeta.priority;
  const impact = suggestion.impact_scope ?? legacyMeta.impact;
  const firstEventAt = events && events.length > 0 ? new Date(events[events.length - 1].created_at) : new Date(suggestion.created_at);
  const lastEventAt = events && events.length > 0 ? new Date(events[0].created_at) : new Date(suggestion.updated_at);
  const openDays = Math.max(0, Math.floor((Date.now() - new Date(suggestion.created_at).getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <AppShell title="Sugerencias, Bugs y Notas" subtitle="Detalle y trazabilidad completa" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Resumen de entrada</h3>
            <Link href="/sugerencias" className="contacts-tab">
              Volver
            </Link>
          </div>
          <div className="stats-grid">
            <div className="card">
              <strong>{suggestion.suggestion_type ?? "sugerencia"}</strong>
              <div className="muted">Tipo</div>
            </div>
            <div className="card">
              <strong>
                <span className={`crm-chip ${statusChipClass(suggestion.status)}`}>{suggestion.status}</span>
              </strong>
              <div className="muted">Estado</div>
            </div>
            <div className="card">
              <strong>{openDays}</strong>
              <div className="muted">Dias abierta</div>
            </div>
            <div className="card">
              <strong>{events?.length ?? 0}</strong>
              <div className="muted">Eventos de historial</div>
            </div>
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            <p><strong>Usuario:</strong> {ownerDisplayName}</p>
            <p><strong>Prioridad:</strong> <span className={`crm-chip ${priorityChipClass(priority)}`}>{priority}</span></p>
            <p><strong>Impacto:</strong> <span className={`crm-chip ${impactChipClass(impact)}`}>{impact}</span></p>
            <p><strong>Creada:</strong> {new Date(suggestion.created_at).toLocaleString("es-ES")}</p>
            <p><strong>Primera actividad:</strong> {firstEventAt.toLocaleString("es-ES")}</p>
            <p><strong>Última actividad:</strong> {lastEventAt.toLocaleString("es-ES")}</p>
            <p><strong>Descripción:</strong> {legacyMeta.body}</p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Acciones rapidas</h3>
          <div className="row" style={{ justifyContent: "start", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <form action={updateStatusAction} className="stack" style={{ minWidth: 320, maxWidth: 460 }}>
              <label>
                Estado
                <select name="status" defaultValue={suggestion.status} aria-label="Estado de la sugerencia">
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <input
                name="status_reason"
                placeholder="Motivo del cambio (obligatorio si reabres)"
                aria-label="Motivo del cambio de estado"
              />
              <button type="submit" aria-label="Actualizar estado de la sugerencia">Actualizar estado</button>
            </form>

            <form action={addEventAction} className="stack" style={{ minWidth: 320, maxWidth: 520, flex: 1 }}>
              <label>
                Tipo de comentario
                <select name="event_type" defaultValue="nota" aria-label="Tipo de comentario para historial">
                  <option value="nota">nota</option>
                  <option value="feedback">feedback</option>
                  <option value="bug">bug</option>
                </select>
              </label>
              <textarea name="body" rows={4} placeholder="Describe avance, validacion, bug o siguiente paso..." aria-label="Contenido del comentario para historial" required />
              <button type="submit" aria-label="Añadir comentario al historial">A?adir al historial</button>
            </form>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Historial</h3>
          <div className="suggestion-history">
            {(events ?? []).map((e) => {
              const isOwner = Boolean(suggestion.created_by_user_id) && e.created_by_user_id === suggestion.created_by_user_id;
              return (
                <article key={e.id} className={`suggestion-bubble ${isOwner ? "suggestion-bubble-owner" : "suggestion-bubble-other"}`}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div className="muted">
                      {(e.created_by_user_id ? nameById.get(e.created_by_user_id) : null) ?? e.created_by_email} |{" "}
                      {new Date(e.created_at).toLocaleString("es-ES")}
                    </div>
                    <span className={`contact-followup-badge ${eventBadgeClass(e.event_type)}`}>{e.event_type.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: "8px 0 0" }}>{e.body}</p>
                </article>
              );
            })}
            {(events ?? []).length === 0 ? <p className="muted">Sin historial todav?a.</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}


