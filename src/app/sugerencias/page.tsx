import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    view?: string;
    ok?: string;
    error?: string;
  };
};

type SuggestionRow = {
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

type SuggestionEventRow = {
  id: string;
  suggestion_id: string;
  body: string;
  event_type: string;
  created_by_email: string;
  created_at: string;
};

type UserOption = {
  id: string;
  full_name: string | null;
  email: string;
};

const TYPE_OPTIONS = ["sugerencia", "bug", "nota"] as const;
const CLOSED_STATUS = ["resuelta", "descartada"] as const;

type ViewMode = "mine" | "team" | "closed";

function normalizeView(value: string | undefined, isAdmin: boolean): ViewMode {
  if (value === "mine" || value === "team" || value === "closed") {
    if (value === "team" && !isAdmin) return "mine";
    return value;
  }
  return isAdmin ? "team" : "mine";
}

function statusChipClass(status: string | null | undefined): string {
  if (!status) return "crm-chip-status-en_revision";
  return `crm-chip-status-${status}`;
}

function typeLabel(value: string | null | undefined): string {
  if (value === "bug") return "Bug";
  if (value === "nota") return "Nota";
  return "Sugerencia";
}

function userLabel(user: UserOption): string {
  return user.full_name?.trim() || user.email;
}

function withResult(pathname: string, key: "ok" | "error", value: string): string {
  const params = new URLSearchParams();
  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

function splitSuggestionText(rawText: string) {
  const [subjectLine, ...bodyLines] = rawText.split(/\r?\n/);
  return {
    subject: subjectLine.trim() || "Sin asunto",
    body: bodyLines.join(" ").trim()
  };
}

export default async function SugerenciasPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const isAdmin = user.role === "admin";
  const view = normalizeView(searchParams?.view, isAdmin);
  const mineFilter = `created_by_user_id.eq.${user.id},assigned_to_user_id.eq.${user.id}`;

  async function createEntryAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const typeRaw = String(formData.get("suggestion_type") ?? "sugerencia").trim().toLowerCase();
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    const assignedUserIdRaw = String(formData.get("assigned_to_user_id") ?? "").trim();

    const suggestionType = TYPE_OPTIONS.includes(typeRaw as (typeof TYPE_OPTIONS)[number]) ? typeRaw : "sugerencia";

    if (!subject || !body) {
      redirect(withResult("/sugerencias", "error", "missing_fields"));
    }

    let assignedToUserId: string | null = assignedUserIdRaw || null;
    let assignedToEmail: string | null = null;

    if (assignedToUserId) {
      const { data: assignedUser } = await source.from("users").select("id, email").eq("id", assignedToUserId).maybeSingle();
      if (!assignedUser?.id || !assignedUser.email) {
        redirect(withResult("/sugerencias", "error", "invalid_assignee"));
      }
      assignedToEmail = assignedUser.email;
    }

    const created = await source
      .from("suggestions")
      .insert({
        suggestion_text: `${subject}\n\n${body}`,
        suggestion_type: suggestionType,
        status: "abierta",
        created_by_user_id: actor.id,
        created_by_email: actor.email,
        assigned_to_user_id: assignedToUserId,
        assigned_to_email: assignedToEmail,
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (created.error || !created.data) {
      redirect(withResult("/sugerencias", "error", "create_failed"));
    }

    await source.from("suggestion_events").insert({
      suggestion_id: created.data.id,
      event_type: "creacion",
      body: assignedToEmail ? `Entrada creada y asignada a ${assignedToEmail}` : "Entrada creada",
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath("/sugerencias");
    redirect(`/sugerencias/${created.data.id}?ok=created`);
  }

  let query = db
    .from("suggestions")
    .select("id, suggestion_text, suggestion_type, status, created_by_user_id, created_by_email, assigned_to_user_id, assigned_to_email, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (view === "mine") {
    query = query.or(mineFilter).not("status", "in", `(${CLOSED_STATUS.join(",")})`);
  } else if (view === "closed") {
    if (isAdmin) {
      query = query.in("status", [...CLOSED_STATUS]);
    } else {
      query = query.or(mineFilter).in("status", [...CLOSED_STATUS]);
    }
  } else if (!isAdmin) {
    query = query.or(mineFilter).not("status", "in", `(${CLOSED_STATUS.join(",")})`);
  } else {
    query = query.not("status", "in", `(${CLOSED_STATUS.join(",")})`);
  }

  const [{ data: suggestionsData }, { data: usersData }] = await Promise.all([
    query,
    db.from("users").select("id, full_name, email").eq("is_active", true).order("email", { ascending: true })
  ]);

  const suggestions: SuggestionRow[] = suggestionsData ?? [];
  const users: UserOption[] = usersData ?? [];
  const suggestionIds = suggestions.map((item) => item.id);
  const events: SuggestionEventRow[] =
    suggestionIds.length > 0
      ? ((await db.from("suggestion_events").select("id, suggestion_id, body, event_type, created_by_email, created_at").in("suggestion_id", suggestionIds).order("created_at", { ascending: false })).data ?? [])
      : [];

  const eventsBySuggestion = new Map<string, SuggestionEventRow[]>();
  for (const event of events) {
    const group = eventsBySuggestion.get(event.suggestion_id) ?? [];
    group.push(event);
    eventsBySuggestion.set(event.suggestion_id, group);
  }

  const openItems = suggestions.filter((item) => !CLOSED_STATUS.includes(item.status as (typeof CLOSED_STATUS)[number]));
  const closedItems = suggestions.filter((item) => CLOSED_STATUS.includes(item.status as (typeof CLOSED_STATUS)[number]));
  const bugsCount = suggestions.filter((item) => item.suggestion_type === "bug").length;

  return (
    <AppShell title="Sugerencias y bugs" subtitle="Canal interno compacto para notas, bugs y propuestas" canViewGlobal={user.can_view_global_dashboard}>
      <div className="feedback-layout">
        <section className="feedback-main stack">
          <article className="card feedback-hero-card">
            <div className="feedback-hero-top">
              <div>
                <p className="workspace-kicker">Canal interno</p>
                <h2>Bandeja de seguimiento del equipo</h2>
                <p className="muted">Centraliza sugerencias, bugs y notas con responsable, mensajes internos y cambios de estado en una sola vista.</p>
              </div>
              <div className="feedback-view-tabs">
                <Link href="/sugerencias?view=mine" className={view === "mine" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Mis abiertas</Link>
                {isAdmin ? <Link href="/sugerencias?view=team" className={view === "team" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Equipo</Link> : null}
                <Link href="/sugerencias?view=closed" className={view === "closed" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Cerradas</Link>
              </div>
            </div>

            <div className="feedback-metrics-grid">
              <article className="feedback-metric-card">
                <strong>{openItems.length}</strong>
                <span>Abiertas</span>
              </article>
              <article className="feedback-metric-card">
                <strong>{bugsCount}</strong>
                <span>Bugs</span>
              </article>
              <article className="feedback-metric-card">
                <strong>{closedItems.length}</strong>
                <span>Cerradas</span>
              </article>
            </div>
          </article>

          {searchParams?.ok === "created" ? <div className="notice notice-success">Entrada creada.</div> : null}
          {searchParams?.error === "missing_fields" ? <div className="notice notice-error">Completa asunto y mensaje.</div> : null}
          {searchParams?.error === "invalid_assignee" ? <div className="notice notice-error">Responsable no válido.</div> : null}
          {searchParams?.error === "create_failed" ? <div className="notice notice-error">No se pudo crear la entrada.</div> : null}

          <section className="feedback-list stack">
            {suggestions.map((item) => {
              const summary = splitSuggestionText(item.suggestion_text);
              const threadEvents = eventsBySuggestion.get(item.id) ?? [];
              const lastMessage = threadEvents[0];
              const preview = summary.body || summary.subject;

              return (
                <article key={item.id} className="card feedback-item-card">
                  <div className="feedback-item-top">
                    <div className="feedback-item-copy">
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <span className="crm-chip">{typeLabel(item.suggestion_type)}</span>
                        <span className={`crm-chip ${statusChipClass(item.status)}`}>{item.status}</span>
                      </div>
                      <h3>{summary.subject}</h3>
                      <p className="muted">{preview.length > 180 ? `${preview.slice(0, 180)}...` : preview}</p>
                    </div>
                    <div className="feedback-item-meta">
                      <div><span>Creador</span><strong>{item.created_by_email}</strong></div>
                      <div><span>Responsable</span><strong>{item.assigned_to_email ?? "Sin responsable"}</strong></div>
                      <div><span>Actualizada</span><strong>{new Date(item.updated_at).toLocaleString("es-ES")}</strong></div>
                      <div><span>Mensajes</span><strong>{threadEvents.filter((event) => event.event_type !== "creacion").length}</strong></div>
                    </div>
                  </div>

                  {lastMessage ? (
                    <div className="feedback-item-last">
                      <div className="muted">Último movimiento: {lastMessage.created_by_email} | {new Date(lastMessage.created_at).toLocaleString("es-ES")}</div>
                      <p>{lastMessage.body.length > 140 ? `${lastMessage.body.slice(0, 140)}...` : lastMessage.body}</p>
                    </div>
                  ) : null}

                  <div className="feedback-item-actions">
                    <Link href={`/sugerencias/${item.id}`} className="companies-tab">Abrir hilo</Link>
                  </div>
                </article>
              );
            })}

            {suggestions.length === 0 ? <div className="card"><p style={{ margin: 0 }}>No hay entradas en esta vista.</p></div> : null}
          </section>
        </section>

        <aside className="feedback-side stack">
          <article className="card feedback-form-card">
            <div>
              <p className="workspace-kicker">Nueva entrada</p>
              <h3>Crear hilo</h3>
            </div>
            <form action={createEntryAction} className="stack">
              <label className="form-field">
                <span>Tipo</span>
                <select name="suggestion_type" defaultValue="sugerencia">
                  <option value="sugerencia">Sugerencia</option>
                  <option value="bug">Bug</option>
                  <option value="nota">Nota</option>
                </select>
              </label>
              <label className="form-field">
                <span>Asunto</span>
                <input name="subject" placeholder="Ej. Error al guardar una actividad" required />
              </label>
              <label className="form-field">
                <span>Responsable</span>
                <select name="assigned_to_user_id" defaultValue={user.id}>
                  <option value="">Sin responsable</option>
                  {users.map((option) => (
                    <option key={option.id} value={option.id}>{userLabel(option)}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Mensaje inicial</span>
                <textarea name="body" rows={7} placeholder="Explica el contexto o la propuesta..." required />
              </label>
              <button type="submit">Crear hilo</button>
            </form>
          </article>

          <article className="card feedback-form-card">
            <h3>Vista actual</h3>
            <p className="muted">
              {view === "mine"
                ? "Entradas creadas por ti o asignadas a ti."
                : view === "team"
                  ? "Conversaciones abiertas para seguimiento del equipo."
                  : "Entradas resueltas o descartadas."}
            </p>
          </article>
        </aside>
      </div>
    </AppShell>
  );
}
