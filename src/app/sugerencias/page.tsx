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
      ? ((
          await db
            .from("suggestion_events")
            .select("id, suggestion_id, body, event_type, created_by_email, created_at")
            .in("suggestion_id", suggestionIds)
            .order("created_at", { ascending: false })
        ).data ?? [])
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
    <AppShell
      title="Sugerencias y bugs"
      subtitle="Una bandeja simple para sugerencias, bugs, notas, responsable y mensajes internos"
      canViewGlobal={user.can_view_global_dashboard}
    >
      <div className="stack">
        <section className="card">
          <div className="row" style={{ alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <p className="workspace-kicker">Canal interno</p>
              <h2 style={{ marginTop: 0 }}>Abre una entrada, asigna responsable y sigue la conversacion</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                Cada entrada puede ser una sugerencia, un bug o una nota. Ahora tambien puedes dejar un responsable
                desde el alta y reasignarlo dentro del hilo.
              </p>
            </div>
            <div className="stats-grid" style={{ flex: "1 1 320px" }}>
              <div className="card">
                <strong>{openItems.length}</strong>
                <div className="muted">Abiertas</div>
              </div>
              <div className="card">
                <strong>{bugsCount}</strong>
                <div className="muted">Bugs visibles</div>
              </div>
              <div className="card">
                <strong>{closedItems.length}</strong>
                <div className="muted">Cerradas</div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row" style={{ alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
            <form action={createEntryAction} className="stack" style={{ flex: "1 1 380px", minWidth: 320 }}>
              <h3 style={{ marginTop: 0 }}>Nueva entrada</h3>
              <label>
                Tipo
                <select name="suggestion_type" defaultValue="sugerencia" aria-label="Tipo de entrada">
                  <option value="sugerencia">Sugerencia</option>
                  <option value="bug">Bug</option>
                  <option value="nota">Nota</option>
                </select>
              </label>
              <label>
                Asunto
                <input name="subject" placeholder="Ej. Error al guardar una actividad" aria-label="Asunto" required />
              </label>
              <label>
                Responsable
                <select name="assigned_to_user_id" defaultValue={user.id} aria-label="Responsable inicial">
                  <option value="">Sin responsable</option>
                  {users.map((option) => (
                    <option key={option.id} value={option.id}>
                      {userLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mensaje inicial
                <textarea
                  name="body"
                  rows={6}
                  placeholder="Explica que pasa, que propones o que nota quieres dejar..."
                  aria-label="Mensaje inicial"
                  required
                />
              </label>
              <button type="submit">Crear hilo</button>
            </form>

            <div style={{ flex: "1 1 320px", minWidth: 320 }}>
              <h3 style={{ marginTop: 0 }}>Vistas</h3>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Link href="/sugerencias?view=mine" className={view === "mine" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>
                  Mis abiertas
                </Link>
                {isAdmin ? (
                  <Link href="/sugerencias?view=team" className={view === "team" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>
                    Bandeja equipo
                  </Link>
                ) : null}
                <Link href="/sugerencias?view=closed" className={view === "closed" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>
                  Cerradas
                </Link>
              </div>
              <p className="muted" style={{ marginBottom: 0 }}>
                {view === "mine"
                  ? "Entradas creadas por ti o asignadas a ti."
                  : view === "team"
                    ? "Conversaciones abiertas para seguimiento del equipo."
                    : "Entradas resueltas o descartadas."}
              </p>
              {searchParams?.ok === "created" ? <p className="crm-inline-success">Entrada creada.</p> : null}
              {searchParams?.error === "missing_fields" ? <p className="crm-inline-error">Completa asunto y mensaje.</p> : null}
              {searchParams?.error === "invalid_assignee" ? <p className="crm-inline-error">Responsable no valido.</p> : null}
              {searchParams?.error === "create_failed" ? <p className="crm-inline-error">No se pudo crear la entrada.</p> : null}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>
              {view === "mine" ? "Mis conversaciones" : view === "team" ? "Bandeja del equipo" : "Conversaciones cerradas"}
            </h3>
            <span className="muted">{suggestions.length} entradas</span>
          </div>

          <div className="stack" style={{ marginTop: 16 }}>
            {suggestions.map((item) => {
              const [subjectLine, ...bodyLines] = item.suggestion_text.split(/\r?\n/);
              const threadEvents = eventsBySuggestion.get(item.id) ?? [];
              const lastMessage = threadEvents[0];
              const previewSource = bodyLines.join(" ").trim() || subjectLine.trim();

              return (
                <article key={item.id} className="card" style={{ padding: 18 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 420px" }}>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="crm-chip">{typeLabel(item.suggestion_type)}</span>
                        <span className={`crm-chip ${statusChipClass(item.status)}`}>{item.status}</span>
                      </div>
                      <h4 style={{ margin: "0 0 8px" }}>{subjectLine.trim() || "Sin asunto"}</h4>
                      <p className="muted" style={{ margin: "0 0 8px" }}>
                        {previewSource.length > 180 ? `${previewSource.slice(0, 180)}...` : previewSource}
                      </p>
                      <p className="muted" style={{ margin: 0 }}>
                        Responsable: {item.assigned_to_email ?? "Sin responsable"}
                      </p>
                    </div>
                    <div style={{ minWidth: 220 }}>
                      <p style={{ margin: "0 0 8px" }}>
                        <strong>Creador:</strong> {item.created_by_email}
                      </p>
                      <p style={{ margin: "0 0 8px" }}>
                        <strong>Actualizada:</strong> {new Date(item.updated_at).toLocaleString("es-ES")}
                      </p>
                      <p style={{ margin: "0 0 12px" }}>
                        <strong>Mensajes:</strong> {threadEvents.filter((event) => event.event_type !== "creacion").length}
                      </p>
                      <Link href={`/sugerencias/${item.id}`} className="contacts-tab">
                        Abrir hilo
                      </Link>
                    </div>
                  </div>

                  {lastMessage ? (
                    <div className="card" style={{ marginTop: 14, padding: 14 }}>
                      <p className="muted" style={{ margin: 0 }}>
                        Ultimo movimiento: {lastMessage.created_by_email} | {new Date(lastMessage.created_at).toLocaleString("es-ES")}
                      </p>
                      <p style={{ margin: "6px 0 0" }}>
                        {lastMessage.body.length > 140 ? `${lastMessage.body.slice(0, 140)}...` : lastMessage.body}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}

            {suggestions.length === 0 ? (
              <div className="card">
                <p style={{ margin: 0 }}>No hay entradas en esta vista.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
