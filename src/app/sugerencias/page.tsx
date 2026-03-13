import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    view?: string;
    panel?: string;
    ok?: string;
    error?: string;
    filter_type?: string;
    filter_content?: string;
    filter_status?: string;
    filter_latest?: string;
    filter_assignee?: string;
    filter_date?: string;
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
type PanelMode = "tracking" | "new";

function normalizePanel(value: string | undefined): PanelMode {
  return value === "new" ? "new" : "tracking";
}

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
  const panel = normalizePanel(searchParams?.panel);
  const mineFilter = `created_by_user_id.eq.${user.id},assigned_to_user_id.eq.${user.id}`;
  const filterType = String(searchParams?.filter_type ?? "").trim().toLowerCase();
  const filterContent = String(searchParams?.filter_content ?? "").trim().toLowerCase();
  const filterStatus = String(searchParams?.filter_status ?? "").trim().toLowerCase();
  const filterLatest = String(searchParams?.filter_latest ?? "").trim().toLowerCase();
  const filterAssignee = String(searchParams?.filter_assignee ?? "").trim().toLowerCase();
  const filterDate = String(searchParams?.filter_date ?? "").trim();

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
      const message = created.error?.message ?? "create_failed";
      redirect(withResult("/sugerencias", "error", message));
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

  const suggestionTableRows = suggestions.map((item) => {
    const summary = splitSuggestionText(item.suggestion_text);
    const threadEvents = eventsBySuggestion.get(item.id) ?? [];
    const lastMessage = threadEvents[0];
    const preview = summary.body || summary.subject;
    const latestStatus = lastMessage?.body ?? item.status ?? "-";
    const latestStatusAt = lastMessage?.created_at ?? item.updated_at;
    const typeText = typeLabel(item.suggestion_type);
    const statusText = item.status ?? "-";
    const assigneeText = item.assigned_to_email ?? "Sin responsable";

    return {
      item,
      preview,
      latestStatus,
      latestStatusAt,
      typeText,
      statusText,
      assigneeText
    };
  });

  const filteredSuggestionRows = suggestionTableRows.filter((row) => {
    const matchesType = !filterType || row.typeText.toLowerCase().includes(filterType);
    const matchesContent = !filterContent || row.preview.toLowerCase().includes(filterContent);
    const matchesStatus = !filterStatus || row.statusText.toLowerCase().includes(filterStatus);
    const matchesLatest = !filterLatest || row.latestStatus.toLowerCase().includes(filterLatest);
    const matchesAssignee = !filterAssignee || row.assigneeText.toLowerCase().includes(filterAssignee);
    const matchesDate = !filterDate || (row.latestStatusAt ? row.latestStatusAt.slice(0, 10) === filterDate : false);
    return matchesType && matchesContent && matchesStatus && matchesLatest && matchesAssignee && matchesDate;
  });

  const openItems = suggestions.filter((item) => !CLOSED_STATUS.includes(item.status as (typeof CLOSED_STATUS)[number]));
  const closedItems = suggestions.filter((item) => CLOSED_STATUS.includes(item.status as (typeof CLOSED_STATUS)[number]));
  const bugsCount = suggestions.filter((item) => item.suggestion_type === "bug").length;

  return (
    <AppShell title="Sugerencias y bugs" subtitle="Canal interno compacto para notas, bugs y propuestas" canViewGlobal={user.can_view_global_dashboard}>
      <div className="feedback-layout feedback-layout-single">
        <section className="feedback-main stack">
          <div className="feedback-top-actions">
            <Link href="/sugerencias?panel=tracking" className={panel === "tracking" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>
              Seguimiento de tickets existentes
            </Link>
            <Link href="/sugerencias?panel=new" className={panel === "new" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>
              Añadir nuevo ticket
            </Link>
          </div>

          {searchParams?.ok === "created" ? <div className="notice notice-success">Entrada creada.</div> : null}
          {searchParams?.error === "missing_fields" ? <div className="notice notice-error">Completa asunto y mensaje.</div> : null}
          {searchParams?.error === "invalid_assignee" ? <div className="notice notice-error">Responsable no valido.</div> : null}
          {searchParams?.error && searchParams.error !== "missing_fields" && searchParams.error !== "invalid_assignee" ? (
            <div className="notice notice-error">Error al crear: {decodeURIComponent(searchParams.error)}</div>
          ) : null}

          {panel === "tracking" ? (
            <>
              <article className="card feedback-toolbar-card">
                <div className="feedback-toolbar-row">
                  <h3>Tickets existentes</h3>
                  <div className="feedback-view-tabs">
                    <Link href="/sugerencias?panel=tracking&view=mine" className={view === "mine" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Mis abiertas</Link>
                    {isAdmin ? <Link href="/sugerencias?panel=tracking&view=team" className={view === "team" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Equipo</Link> : null}
                    <Link href="/sugerencias?panel=tracking&view=closed" className={view === "closed" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Cerradas</Link>
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

              <form method="get" className="table-shell contacts-table-wrap">
                <input type="hidden" name="panel" value="tracking" />
                <input type="hidden" name="view" value={view} />
                <table className="contacts-crm-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Contenido</th>
                      <th>Estado</th>
                      <th>Ultimo estado</th>
                      <th>Responsable</th>
                      <th>Fecha ultimo estado</th>
                      <th>Informacion</th>
                    </tr>
                    <tr className="table-filter-row">
                      <th><input name="filter_type" defaultValue={searchParams?.filter_type ?? ""} placeholder="Filtrar" /></th>
                      <th><input name="filter_content" defaultValue={searchParams?.filter_content ?? ""} placeholder="Filtrar" /></th>
                      <th><input name="filter_status" defaultValue={searchParams?.filter_status ?? ""} placeholder="Filtrar" /></th>
                      <th><input name="filter_latest" defaultValue={searchParams?.filter_latest ?? ""} placeholder="Filtrar" /></th>
                      <th><input name="filter_assignee" defaultValue={searchParams?.filter_assignee ?? ""} placeholder="Filtrar" /></th>
                      <th><input type="date" name="filter_date" defaultValue={searchParams?.filter_date ?? ""} /></th>
                      <th>
                        <div className="table-filter-actions-inline">
                          <button type="submit">Filtrar</button>
                          <Link href={`/sugerencias?panel=tracking&view=${view}`} className="quick-pill quick-pill-ghost">Limpiar</Link>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuggestionRows.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="table-empty-state">
                            <strong>No hay entradas en esta vista.</strong>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSuggestionRows.map((row) => (
                        <tr key={row.item.id}>
                          <td>{row.typeText}</td>
                          <td>{row.preview.length > 140 ? `${row.preview.slice(0, 140)}...` : row.preview}</td>
                          <td><span className={`crm-chip ${statusChipClass(row.item.status)}`}>{row.statusText}</span></td>
                          <td>{row.latestStatus.length > 90 ? `${row.latestStatus.slice(0, 90)}...` : row.latestStatus}</td>
                          <td>{row.assigneeText}</td>
                          <td>{row.latestStatusAt ? new Date(row.latestStatusAt).toLocaleString("es-ES") : "-"}</td>
                          <td><Link href={`/sugerencias/${row.item.id}`} className="companies-tab">Más</Link></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </form>
            </>
          ) : (
            <section className="card feedback-form-card feedback-form-card-wide">
              <div>
                <p className="workspace-kicker">Nueva entrada</p>
                <h3>Añadir nuevo ticket</h3>
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
            </section>
          )}
        </section>
      </div>
    </AppShell>
  );
}


