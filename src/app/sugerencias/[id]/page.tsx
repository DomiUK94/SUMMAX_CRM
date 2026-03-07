import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type Params = {
  params: {
    id: string;
  };
  searchParams?: {
    ok?: string;
    error?: string;
  };
};

type SuggestionDetailRow = {
  id: string;
  suggestion_text: string;
  suggestion_type: string | null;
  status: string | null;
  created_by_user_id: string;
  created_by_email: string;
  assigned_to_user_id: string | null;
  assigned_to_email: string | null;
  created_at: string;
  updated_at: string;
};

type SuggestionEventDetailRow = {
  id: string;
  event_type: string;
  body: string;
  created_by_user_id: string | null;
  created_by_email: string;
  created_at: string;
};

type ParticipantRow = {
  id: string;
  full_name: string | null;
  email: string;
};

const STATUS_OPTIONS = ["abierta", "en_revision", "en_progreso", "resuelta", "descartada"] as const;
const CLOSED_STATUS = ["resuelta", "descartada"] as const;

function statusChipClass(status: string | null | undefined): string {
  if (!status) return "crm-chip-status-en_revision";
  return `crm-chip-status-${status}`;
}

function typeLabel(value: string | null | undefined): string {
  if (value === "bug") return "Bug";
  if (value === "nota") return "Nota";
  return "Sugerencia";
}

function userLabel(user: ParticipantRow): string {
  return user.full_name?.trim() || user.email;
}

function splitSuggestionText(rawText: string) {
  const [subjectLine, ...bodyLines] = rawText.split(/\r?\n/);
  return {
    subject: subjectLine.trim() || "Sin asunto",
    body: bodyLines.join("\n").trim()
  };
}

export default async function SugerenciaDetailPage({ params, searchParams }: Params) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const suggestionId = params.id;

  async function addMessageAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const body = String(formData.get("body") ?? "").trim();

    if (!body) {
      redirect(`/sugerencias/${suggestionId}?error=empty_message`);
    }

    await source.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: "nota",
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    await source.from("suggestions").update({ updated_at: new Date().toISOString() }).eq("id", suggestionId);

    revalidatePath(`/sugerencias/${suggestionId}`);
    revalidatePath("/sugerencias");
    redirect(`/sugerencias/${suggestionId}?ok=message_sent`);
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const nextStatusRaw = String(formData.get("status") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!STATUS_OPTIONS.includes(nextStatusRaw as (typeof STATUS_OPTIONS)[number])) {
      redirect(`/sugerencias/${suggestionId}?error=invalid_status`);
    }

    const currentRes = await source.from("suggestions").select("status").eq("id", suggestionId).maybeSingle();
    const currentStatus = currentRes.data?.status ?? "";
    const isReopen =
      CLOSED_STATUS.includes(currentStatus as (typeof CLOSED_STATUS)[number]) &&
      !CLOSED_STATUS.includes(nextStatusRaw as (typeof CLOSED_STATUS)[number]);

    if (isReopen && !note) {
      redirect(`/sugerencias/${suggestionId}?error=reopen_requires_note`);
    }

    await source
      .from("suggestions")
      .update({
        status: nextStatusRaw,
        updated_at: new Date().toISOString()
      })
      .eq("id", suggestionId);

    await source.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: "cambio_estado",
      body: note ? `Estado cambiado a ${nextStatusRaw}. Nota: ${note}` : `Estado cambiado a ${nextStatusRaw}`,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath(`/sugerencias/${suggestionId}`);
    revalidatePath("/sugerencias");
    redirect(`/sugerencias/${suggestionId}?ok=status_updated`);
  }

  async function assignOwnerAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const assignedUserIdRaw = String(formData.get("assigned_to_user_id") ?? "").trim();

    let assignedToUserId: string | null = assignedUserIdRaw || null;
    let assignedToEmail: string | null = null;

    if (assignedToUserId) {
      const { data: assignedUser } = await source.from("users").select("id, email").eq("id", assignedToUserId).maybeSingle();
      if (!assignedUser?.id || !assignedUser.email) {
        redirect(`/sugerencias/${suggestionId}?error=invalid_assignee`);
      }
      assignedToEmail = assignedUser.email;
    }

    await source
      .from("suggestions")
      .update({
        assigned_to_user_id: assignedToUserId,
        assigned_to_email: assignedToEmail,
        updated_at: new Date().toISOString()
      })
      .eq("id", suggestionId);

    await source.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: "nota",
      body: assignedToEmail ? `Responsable asignado a ${assignedToEmail}` : "Responsable eliminado",
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath(`/sugerencias/${suggestionId}`);
    revalidatePath("/sugerencias");
    redirect(`/sugerencias/${suggestionId}?ok=assignee_updated`);
  }

  const suggestionResponse = await db
    .from("suggestions")
    .select("id, suggestion_text, suggestion_type, status, created_by_user_id, created_by_email, assigned_to_user_id, assigned_to_email, created_at, updated_at")
    .eq("id", suggestionId)
    .maybeSingle();
  const suggestion = suggestionResponse.data as SuggestionDetailRow | null;

  const eventsResponse = await db
    .from("suggestion_events")
    .select("id, event_type, body, created_by_user_id, created_by_email, created_at")
    .eq("suggestion_id", suggestionId)
    .order("created_at", { ascending: true })
    .limit(400);
  const events: SuggestionEventDetailRow[] = eventsResponse.data ?? [];

  if (!suggestion) {
    return (
      <AppShell title="Sugerencias y bugs" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Entrada no encontrada.</div>
      </AppShell>
    );
  }

  const participantIds = Array.from(
    new Set(
      [suggestion.created_by_user_id, suggestion.assigned_to_user_id, ...events.map((event) => event.created_by_user_id)].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
  const participants: ParticipantRow[] = participantIds.length
    ? (await db.from("users").select("id, full_name, email").in("id", participantIds)).data ?? []
    : [];
  const assignableUsers: ParticipantRow[] = (await db.from("users").select("id, full_name, email").eq("is_active", true)).data ?? [];

  const nameById = new Map(participants.map((person) => [person.id, userLabel(person)]));
  const starter = splitSuggestionText(suggestion.suggestion_text);
  const ownerName = nameById.get(suggestion.created_by_user_id) ?? suggestion.created_by_email;
  const assigneeName = suggestion.assigned_to_user_id
    ? nameById.get(suggestion.assigned_to_user_id) ?? suggestion.assigned_to_email ?? "Sin responsable"
    : "Sin responsable";
  const messageCount = events.filter((event) => event.event_type === "nota").length;

  return (
    <AppShell
      title="Sugerencias y bugs"
      subtitle="Hilo interno de seguimiento"
      canViewGlobal={user.can_view_global_dashboard}
    >
      <div className="stack">
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 420px" }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span className="crm-chip">{typeLabel(suggestion.suggestion_type)}</span>
                <span className={`crm-chip ${statusChipClass(suggestion.status)}`}>{suggestion.status}</span>
              </div>
              <h2 style={{ margin: "0 0 8px" }}>{starter.subject}</h2>
              <p className="muted" style={{ margin: "0 0 6px" }}>
                Abierto por {ownerName} | {new Date(suggestion.created_at).toLocaleString("es-ES")}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Responsable: {assigneeName}
              </p>
            </div>
            <Link href="/sugerencias" className="contacts-tab">
              Volver a la bandeja
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="stats-grid">
            <div className="card">
              <strong>{messageCount}</strong>
              <div className="muted">Mensajes internos</div>
            </div>
            <div className="card">
              <strong>{events.filter((event) => event.event_type === "cambio_estado").length}</strong>
              <div className="muted">Cambios de estado</div>
            </div>
            <div className="card">
              <strong>{new Date(suggestion.updated_at).toLocaleString("es-ES")}</strong>
              <div className="muted">Ultima actividad</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 480px", minWidth: 320 }}>
              <h3 style={{ marginTop: 0 }}>Conversacion</h3>
              <div className="suggestion-history">
                <article className="suggestion-bubble suggestion-bubble-owner">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div className="muted">
                      {ownerName} | {new Date(suggestion.created_at).toLocaleString("es-ES")}
                    </div>
                    <span className="contact-followup-badge contact-followup-verde">INICIO</span>
                  </div>
                  <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{starter.body || "Sin descripcion adicional."}</p>
                </article>

                {events.map((event) => {
                  const isOwnMessage = event.created_by_user_id === user.id;
                  const authorName =
                    (event.created_by_user_id ? nameById.get(event.created_by_user_id) : null) ?? event.created_by_email;
                  const badge = event.event_type === "cambio_estado" ? "ESTADO" : event.event_type === "creacion" ? "ALTA" : "MENSAJE";

                  return (
                    <article
                      key={event.id}
                      className={`suggestion-bubble ${isOwnMessage ? "suggestion-bubble-owner" : "suggestion-bubble-other"}`}
                    >
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div className="muted">
                          {authorName} | {new Date(event.created_at).toLocaleString("es-ES")}
                        </div>
                        <span className="contact-followup-badge contact-followup-ambar">{badge}</span>
                      </div>
                      <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{event.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: "1 1 320px", minWidth: 320 }} className="stack">
              <form action={addMessageAction} className="card stack" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Nuevo mensaje</h3>
                <textarea
                  name="body"
                  rows={7}
                  placeholder="Escribe aqui el mensaje interno..."
                  aria-label="Mensaje interno"
                  required
                />
                <button type="submit">Enviar mensaje</button>
                {searchParams?.ok === "message_sent" ? <p className="crm-inline-success">Mensaje enviado.</p> : null}
                {searchParams?.error === "empty_message" ? <p className="crm-inline-error">Escribe un mensaje.</p> : null}
              </form>

              <form action={assignOwnerAction} className="card stack" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Responsable</h3>
                <label>
                  Asignar a
                  <select name="assigned_to_user_id" defaultValue={suggestion.assigned_to_user_id ?? ""} aria-label="Asignar responsable">
                    <option value="">Sin responsable</option>
                    {assignableUsers.map((option) => (
                      <option key={option.id} value={option.id}>
                        {userLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Guardar responsable</button>
                {searchParams?.ok === "assignee_updated" ? <p className="crm-inline-success">Responsable actualizado.</p> : null}
                {searchParams?.error === "invalid_assignee" ? <p className="crm-inline-error">Responsable no valido.</p> : null}
              </form>

              <form action={updateStatusAction} className="card stack" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Estado</h3>
                <label>
                  Cambiar estado
                  <select name="status" defaultValue={suggestion.status ?? "abierta"} aria-label="Cambiar estado">
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nota del cambio
                  <textarea
                    name="note"
                    rows={4}
                    placeholder="Opcional, salvo si reabres una entrada cerrada"
                    aria-label="Nota del cambio de estado"
                  />
                </label>
                <button type="submit">Guardar estado</button>
                {searchParams?.ok === "status_updated" ? <p className="crm-inline-success">Estado actualizado.</p> : null}
                {searchParams?.error === "invalid_status" ? <p className="crm-inline-error">Estado no valido.</p> : null}
                {searchParams?.error === "reopen_requires_note" ? (
                  <p className="crm-inline-error">Para reabrir una entrada cerrada hace falta una nota.</p>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
