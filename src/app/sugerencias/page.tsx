import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    ok?: string;
    error?: string;
    tab?: string;
    mine_type?: string;
    status?: string;
    type?: string;
    q?: string;
    sort_by?: string;
    sort_dir?: string;
    template?: string;
  };
};

const STATUS_OPTIONS = ["abierta", "en_revision", "planificada", "en_progreso", "resuelta", "descartada"] as const;
const TYPE_OPTIONS = ["sugerencia", "bug", "nota"] as const;
const PRIORITY_OPTIONS = ["baja", "media", "alta", "critica"] as const;
const IMPACT_OPTIONS = ["local", "equipo", "global"] as const;

type SuggestionsTab = "mine" | "mine_closed" | "all";
type MineTypeFilter = "all" | "sugerencia" | "bug" | "nota";
type StatusFilter = "all" | (typeof STATUS_OPTIONS)[number];
type TypeFilter = "all" | (typeof TYPE_OPTIONS)[number];
type SortBy = "priority" | "updated_at";
type SortDir = "asc" | "desc";
type TemplateKey = "none" | "mejora" | "bug" | "nota";

const CLOSED_STATUS = ["resuelta", "descartada"];

function normalizeTab(value: string | undefined): SuggestionsTab {
  if (value === "mine" || value === "mine_closed" || value === "all") return value;
  return "mine";
}

function normalizeMineType(value: string | undefined): MineTypeFilter {
  if (value === "all" || value === "sugerencia" || value === "bug" || value === "nota") return value;
  return "all";
}

function normalizeStatus(value: string | undefined): StatusFilter {
  if (!value || value === "all") return "all";
  return STATUS_OPTIONS.includes(value as (typeof STATUS_OPTIONS)[number]) ? (value as StatusFilter) : "all";
}

function normalizeType(value: string | undefined): TypeFilter {
  if (!value || value === "all") return "all";
  return TYPE_OPTIONS.includes(value as (typeof TYPE_OPTIONS)[number]) ? (value as TypeFilter) : "all";
}

function normalizeSortBy(value: string | undefined): SortBy {
  if (value === "priority" || value === "updated_at") return value;
  return "priority";
}

function normalizeSortDir(value: string | undefined): SortDir {
  if (value === "asc" || value === "desc") return value;
  return "desc";
}

function normalizeTemplate(value: string | undefined): TemplateKey {
  if (value === "mejora" || value === "bug" || value === "nota") return value;
  return "none";
}

function hrefWithFilters(params: {
  tab: SuggestionsTab;
  mineType: MineTypeFilter;
  status: StatusFilter;
  type: TypeFilter;
  q: string;
  sortBy: SortBy;
  sortDir: SortDir;
}) {
  const url = new URLSearchParams();
  url.set("tab", params.tab);
  url.set("mine_type", params.mineType);
  url.set("status", params.status);
  url.set("type", params.type);
  url.set("sort_by", params.sortBy);
  url.set("sort_dir", params.sortDir);
  if (params.q.trim()) url.set("q", params.q.trim());
  return `/sugerencias?${url.toString()}`;
}

function cleanSuggestionText(rawText: string) {
  return rawText
    .replace(/\[Modulo:[^\]]+\]\s*/gi, "")
    .replace(/\[Prioridad:[^\]]+\]\s*/gi, "")
    .replace(/\[Impacto:[^\]]+\]\s*/gi, "")
    .trim();
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

function withResult(pathnameWithQuery: string, key: "ok" | "error", value: string): string {
  const [basePath, rawQuery = ""] = pathnameWithQuery.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set(key, value);
  return `${basePath}?${params.toString()}`;
}

function withTemplate(pathnameWithQuery: string, template: TemplateKey): string {
  const [basePath, rawQuery = ""] = pathnameWithQuery.split("?");
  const params = new URLSearchParams(rawQuery);
  if (template === "none") {
    params.delete("template");
  } else {
    params.set("template", template);
  }
  return `${basePath}?${params.toString()}`;
}

function templateDefaults(template: TemplateKey): {
  type: "sugerencia" | "bug" | "nota";
  priority: "baja" | "media" | "alta" | "critica";
  impact: "local" | "equipo" | "global";
  text: string;
} {
  if (template === "bug") {
    return {
      type: "bug",
      priority: "alta",
      impact: "equipo",
      text: "Contexto:\nPasos para reproducir:\nResultado esperado:\nResultado actual:\nEntorno (navegador/dispositivo):\n"
    };
  }
  if (template === "nota") {
    return {
      type: "nota",
      priority: "media",
      impact: "local",
      text: "Contexto:\nObservacion:\nSiguiente paso sugerido:\n"
    };
  }
  if (template === "mejora") {
    return {
      type: "sugerencia",
      priority: "media",
      impact: "equipo",
      text: "Problema actual:\nMejora propuesta:\nBeneficio esperado:\n"
    };
  }
  return {
    type: "sugerencia",
    priority: "media",
    impact: "equipo",
    text: ""
  };
}

export default async function SugerenciasPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const isAdmin = user.role === "admin";
  const activeTab = normalizeTab(searchParams?.tab);
  const mineType = normalizeMineType(searchParams?.mine_type);
  const statusFilter = normalizeStatus(searchParams?.status);
  const typeFilter = normalizeType(searchParams?.type);
  const sortBy = normalizeSortBy(searchParams?.sort_by);
  const sortDir = normalizeSortDir(searchParams?.sort_dir);
  const selectedTemplate = normalizeTemplate(searchParams?.template);
  const formDefaults = templateDefaults(selectedTemplate);
  const q = String(searchParams?.q ?? "").trim();

  async function createSuggestionAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();

    const text = String(formData.get("suggestion_text") ?? "").trim();
    const suggestionTypeRaw = String(formData.get("suggestion_type") ?? "sugerencia").trim().toLowerCase();
    const priorityRaw = String(formData.get("priority_level") ?? "media").trim().toLowerCase();
    const impactRaw = String(formData.get("impact_scope") ?? "equipo").trim().toLowerCase();

    const suggestionType = TYPE_OPTIONS.includes(suggestionTypeRaw as (typeof TYPE_OPTIONS)[number]) ? suggestionTypeRaw : "sugerencia";
    const priorityLevel = PRIORITY_OPTIONS.includes(priorityRaw as (typeof PRIORITY_OPTIONS)[number]) ? priorityRaw : "media";
    const impactScope = IMPACT_OPTIONS.includes(impactRaw as (typeof IMPACT_OPTIONS)[number]) ? impactRaw : "equipo";

    if (!text) {
      redirect("/sugerencias?error=entrada_vacia");
    }

    const created = await source
      .from("suggestions")
      .insert({
        suggestion_text: text,
        suggestion_type: suggestionType,
        priority_level: priorityLevel,
        impact_scope: impactScope,
        status: "abierta",
        created_by_user_id: actor.id,
        created_by_email: actor.email,
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (created.error || !created.data) {
      redirect(`/sugerencias?error=${encodeURIComponent(created.error?.message ?? "create_failed")}`);
    }

    await source.from("suggestion_events").insert({
      suggestion_id: created.data.id,
      event_type: "creaciÃ³n",
      body: "Entrada creada",
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath("/sugerencias");
    redirect("/sugerencias?ok=created");
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const suggestionId = String(formData.get("suggestion_id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const statusReason = String(formData.get("status_reason") ?? "").trim();
    if (!suggestionId || !STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) return;
    const currentRes = await source.from("suggestions").select("status").eq("id", suggestionId).maybeSingle();
    const currentStatus = currentRes.data?.status ?? "";
    const isReopen = CLOSED_STATUS.includes(currentStatus) && !CLOSED_STATUS.includes(status);
    if (isReopen && !statusReason) {
      redirect("/sugerencias?error=reabrir_requiere_motivo");
    }

    const updated = await source
      .from("suggestions")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", suggestionId);
    if (updated.error) return;

    await source.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: "cambio_estado",
      body: isReopen
        ? `Entrada reabierta a: ${status}. Motivo obligatorio: ${statusReason}`
        : statusReason
          ? `Estado actualizado a: ${status}. Motivo: ${statusReason}`
          : `Estado actualizado a: ${status}`,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath("/sugerencias");
  }

  async function batchAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const source = createSourceCrmServerClient();
    const returnToRaw = String(formData.get("return_to") ?? "/sugerencias");
    const returnTo = returnToRaw.startsWith("/sugerencias") ? returnToRaw : "/sugerencias";

    if (actor.role !== "admin") {
      redirect(withResult(returnTo, "error", "batch_forbidden"));
    }

    const suggestionIds = Array.from(
      new Set(
        formData
          .getAll("suggestion_ids")
          .map((id) => String(id).trim())
          .filter(Boolean)
      )
    );
    if (suggestionIds.length === 0) {
      redirect(withResult(returnTo, "error", "batch_empty_selection"));
    }

    const action = String(formData.get("batch_action") ?? "close").trim();
    const nowIso = new Date().toISOString();

    if (action === "close" || action === "status") {
      const targetStatusRaw = action === "close" ? "resuelta" : String(formData.get("batch_status") ?? "").trim();
      if (!STATUS_OPTIONS.includes(targetStatusRaw as (typeof STATUS_OPTIONS)[number])) {
        redirect(withResult(returnTo, "error", "batch_invalid_status"));
      }

      const updateRes = await source
        .from("suggestions")
        .update({ status: targetStatusRaw, updated_at: nowIso })
        .in("id", suggestionIds);
      if (updateRes.error) {
        redirect(withResult(returnTo, "error", "batch_update_failed"));
      }

      const eventsPayload = suggestionIds.map((suggestionId) => ({
        suggestion_id: suggestionId,
        event_type: "cambio_estado",
        body: `Cambio en lote: estado actualizado a ${targetStatusRaw}`,
        created_by_user_id: actor.id,
        created_by_email: actor.email
      }));
      await source.from("suggestion_events").insert(eventsPayload);

      revalidatePath("/sugerencias");
      redirect(withResult(returnTo, "ok", "batch_status_updated"));
    }

    if (action === "tag") {
      const rawTag = String(formData.get("batch_tag") ?? "").trim().toLowerCase();
      const normalizedTag = rawTag.replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 40);
      if (!normalizedTag) {
        redirect(withResult(returnTo, "error", "batch_invalid_tag"));
      }

      const selectedRes = await source.from("suggestions").select("id, tags").in("id", suggestionIds);
      if (selectedRes.error || !selectedRes.data) {
        redirect(withResult(returnTo, "error", "batch_load_failed"));
      }

      for (const row of selectedRes.data) {
        const currentTags = Array.isArray(row.tags) ? row.tags : [];
        const nextTags = Array.from(new Set([...currentTags, normalizedTag]));
        const upRes = await source.from("suggestions").update({ tags: nextTags, updated_at: nowIso }).eq("id", row.id);
        if (upRes.error) {
          redirect(withResult(returnTo, "error", "batch_tag_failed"));
        }
      }

      const tagEventsPayload = suggestionIds.map((suggestionId) => ({
        suggestion_id: suggestionId,
        event_type: "nota",
        body: `Etiqueta aÃ±adida en lote: ${normalizedTag}`,
        created_by_user_id: actor.id,
        created_by_email: actor.email
      }));
      await source.from("suggestion_events").insert(tagEventsPayload);

      revalidatePath("/sugerencias");
      redirect(withResult(returnTo, "ok", "batch_tag_added"));
    }

    redirect(withResult(returnTo, "error", "batch_invalid_action"));
  }

  let suggestionsQuery = db
    .from("suggestions")
    .select("id, suggestion_text, suggestion_type, priority_level, impact_scope, tags, status, created_by_email, created_by_user_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (activeTab === "mine") {
    suggestionsQuery = suggestionsQuery.eq("created_by_user_id", user.id).not("status", "in", `(${CLOSED_STATUS.join(",")})`);
  } else if (activeTab === "mine_closed") {
    suggestionsQuery = suggestionsQuery.eq("created_by_user_id", user.id).in("status", CLOSED_STATUS);
  }

  if ((activeTab === "mine" || activeTab === "mine_closed") && mineType !== "all") {
    suggestionsQuery = suggestionsQuery.eq("suggestion_type", mineType);
  }
  if (statusFilter !== "all") suggestionsQuery = suggestionsQuery.eq("status", statusFilter);
  if (typeFilter !== "all") suggestionsQuery = suggestionsQuery.eq("suggestion_type", typeFilter);
  if (q) suggestionsQuery = suggestionsQuery.ilike("suggestion_text", `%${q}%`);

  const [{ data: suggestionsRaw }, adminsRes] =
    await Promise.all([
      suggestionsQuery,
      db.from("users").select("id").eq("role", "admin").eq("is_active", true)
    ]);

  const priorityRank: Record<string, number> = { baja: 1, media: 2, alta: 3, critica: 4 };
  const ts = (value: string | null | undefined) => new Date(value ?? "").getTime() || 0;
  const pr = (value: string | null | undefined) => priorityRank[value ?? ""] ?? 0;
  const suggestions = [...(suggestionsRaw ?? [])].sort((a, b) => {
    if (sortBy === "priority") {
      const byPriority = pr(a.priority_level) - pr(b.priority_level);
      if (byPriority !== 0) return sortDir === "asc" ? byPriority : -byPriority;
      return ts(b.updated_at) - ts(a.updated_at);
    }

    const byUpdated = ts(a.updated_at) - ts(b.updated_at);
    if (byUpdated !== 0) return sortDir === "asc" ? byUpdated : -byUpdated;
    return pr(b.priority_level) - pr(a.priority_level);
  });

  const adminIds = new Set((adminsRes.data ?? []).map((a) => a.id));
  const suggestionIds = (suggestions ?? []).map((s) => s.id);
  const eventsRes =
    suggestionIds.length > 0
      ? await db
          .from("suggestion_events")
          .select("id, suggestion_id, event_type, created_by_user_id, created_at")
          .in("suggestion_id", suggestionIds)
          .order("created_at", { ascending: false })
      : { data: [] as Array<{ id: string; suggestion_id: string; event_type: string; created_by_user_id: string; created_at: string }> };
  const events = eventsRes.data ?? [];

  const eventsBySuggestion = new Map<string, typeof events>();
  events.forEach((ev) => {
    const arr = eventsBySuggestion.get(ev.suggestion_id) ?? [];
    arr.push(ev);
    eventsBySuggestion.set(ev.suggestion_id, arr);
  });

  let respondedCount = 0;
  let pendingCount = 0;
  let totalFirstResponseHours = 0;
  let ageOver7dOpen = 0;

  (suggestions ?? []).forEach((s) => {
    const list = eventsBySuggestion.get(s.id) ?? [];
    const createdAtMs = new Date(s.created_at).getTime();
    const firstAdminResponse = list
      .filter((ev) => adminIds.has(ev.created_by_user_id) && ev.event_type !== "creaciÃ³n")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

    if (firstAdminResponse) {
      respondedCount += 1;
      const hours = (new Date(firstAdminResponse.created_at).getTime() - createdAtMs) / (1000 * 60 * 60);
      if (Number.isFinite(hours) && hours >= 0) totalFirstResponseHours += hours;
    } else {
      pendingCount += 1;
    }

    if (!CLOSED_STATUS.includes(s.status)) {
      const daysOpen = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);
      if (daysOpen >= 7) ageOver7dOpen += 1;
    }
  });

  const avgFirstResponseHours = respondedCount > 0 ? totalFirstResponseHours / respondedCount : 0;

  const typeCountsVisible = {
    sugerencia: (suggestions ?? []).filter((s) => s.suggestion_type === "sugerencia").length,
    bug: (suggestions ?? []).filter((s) => s.suggestion_type === "bug").length,
    nota: (suggestions ?? []).filter((s) => s.suggestion_type === "nota").length
  };
  const statusCountsVisible = {
    abierta: (suggestions ?? []).filter((s) => s.status === "abierta").length,
    en_progreso: (suggestions ?? []).filter((s) => s.status === "en_progreso").length,
    resuelta: (suggestions ?? []).filter((s) => s.status === "resuelta").length
  };

  const sortIndicator = (column: SortBy) => (sortBy === column ? (sortDir === "desc" ? "â†“" : "â†‘") : "â†•");
  const sortHref = (column: SortBy) =>
    hrefWithFilters({
      tab: activeTab,
      mineType,
      status: statusFilter,
      type: typeFilter,
      q,
      sortBy: column,
      sortDir: sortBy === column && sortDir === "desc" ? "asc" : "desc"
    });
  const baseFiltersHref = hrefWithFilters({
    tab: activeTab,
    mineType,
    status: statusFilter,
    type: typeFilter,
    q,
      sortBy,
      sortDir
    });
  function customViewHref(view: "mine_sug_closed" | "all_sug" | "mine_note_closed" | "all_note" | "mine_bug_closed" | "all_bug"): string {
    if (view === "mine_sug_closed") {
      return hrefWithFilters({ tab: "mine_closed", mineType: "sugerencia", status: "all", type: "all", q, sortBy, sortDir });
    }
    if (view === "all_sug") {
      return hrefWithFilters({ tab: "all", mineType: "all", status: "all", type: "sugerencia", q, sortBy, sortDir });
    }
    if (view === "mine_note_closed") {
      return hrefWithFilters({ tab: "mine_closed", mineType: "nota", status: "all", type: "all", q, sortBy, sortDir });
    }
    if (view === "all_note") {
      return hrefWithFilters({ tab: "all", mineType: "all", status: "all", type: "nota", q, sortBy, sortDir });
    }
    if (view === "mine_bug_closed") {
      return hrefWithFilters({ tab: "mine_closed", mineType: "bug", status: "all", type: "all", q, sortBy, sortDir });
    }
    return hrefWithFilters({ tab: "all", mineType: "all", status: "all", type: "bug", q, sortBy, sortDir });
  }
  function currentCustomViewLabel(): string {
    if (activeTab === "mine_closed" && mineType === "sugerencia") return "Mis Sugerencias cerradas";
    if (activeTab === "all" && typeFilter === "sugerencia") return "Todas las Sugerencias";
    if (activeTab === "mine_closed" && mineType === "nota") return "Mis Notas cerradas";
    if (activeTab === "all" && typeFilter === "nota") return "Todas las Notas";
    if (activeTab === "mine_closed" && mineType === "bug") return "Mis Bugs cerrados";
    if (activeTab === "all" && typeFilter === "bug") return "Todos los Bugs";
    return "Vista Personalizada";
  }

  return (
    <AppShell title="Sugerencias, Bugs y Notas" subtitle="Mejoras, incidencias y notas con una superficie mas cuidada" canViewGlobal={user.can_view_global_dashboard}>
      <div className="editor-shell">
        <section className="card editor-hero editor-hero-warm">
          <div>
            <p className="workspace-kicker">Producto</p>
            <h2>Ideas, incidencias y notas en una sola bandeja</h2>
            <p className="muted">La gestion de sugerencias comparte ahora la misma jerarquia visual que el resto del CRM: alta clara, filtros ordenados y seguimiento sin sensacion de backoffice duro.</p>
          </div>
          <div className="stats-grid">
            <div className="card">
              <strong>{(suggestions ?? []).length}</strong>
              <div className="muted">Entradas visibles</div>
            </div>
            <div className="card">
              <strong>{statusCountsVisible.abierta}</strong>
              <div className="muted">Abiertas</div>
            </div>
            <div className="card">
              <strong>{statusCountsVisible.en_progreso}</strong>
              <div className="muted">En progreso</div>
            </div>
            <div className="card">
              <strong>{statusCountsVisible.resuelta}</strong>
              <div className="muted">Resueltas</div>
            </div>
            <div className="card">
              <strong>{typeCountsVisible.bug}</strong>
              <div className="muted">Bugs visibles</div>
            </div>
            <div className="card">
              <strong>{avgFirstResponseHours.toFixed(1)} h</strong>
              <div className="muted">Media 1a respuesta</div>
            </div>
            <div className="card">
              <strong>{pendingCount}</strong>
              <div className="muted">Sin respuesta admin</div>
            </div>
            <div className="card">
              <strong>{ageOver7dOpen}</strong>
              <div className="muted">Abiertas +7 dias</div>
            </div>
          </div>
        </section>

        {searchParams?.ok === "created" ? <div className="notice notice-success">Entrada creada correctamente.</div> : null}
        {searchParams?.ok === "batch_status_updated" ? <div className="notice notice-success">Lote aplicado: estado actualizado.</div> : null}
        {searchParams?.ok === "batch_tag_added" ? <div className="notice notice-success">Lote aplicado: etiqueta anadida.</div> : null}
        {searchParams?.error ? <div className="notice notice-error">Error: {searchParams.error}</div> : null}

        <section className="card editor-card">
          <div className="table-card-head">
            <div>
              <p className="workspace-kicker">Nueva entrada</p>
              <h3>Registrar mejora, bug o nota</h3>
            </div>
          </div>
          <div className="contacts-top-tabs">
            <Link href={withTemplate(baseFiltersHref, "mejora")} className={selectedTemplate === "mejora" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Plantilla mejora</Link>
            <Link href={withTemplate(baseFiltersHref, "bug")} className={selectedTemplate === "bug" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Plantilla bug</Link>
            <Link href={withTemplate(baseFiltersHref, "nota")} className={selectedTemplate === "nota" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Plantilla nota</Link>
            <Link href={withTemplate(baseFiltersHref, "none")} className={selectedTemplate === "none" ? "contacts-tab contacts-tab-active" : "contacts-tab"}>Sin plantilla</Link>
          </div>
          <form action={createSuggestionAction} className="editor-stack" style={{ maxWidth: 920 }}>
            <div className="editor-form-grid editor-form-grid-3">
              <label className="form-field">
                <span>Tipo</span>
                <select name="suggestion_type" defaultValue={formDefaults.type}>
                  <option value="sugerencia">Sugerencia</option>
                  <option value="bug">Bug</option>
                  <option value="nota">Nota</option>
                </select>
              </label>
              <label className="form-field">
                <span>Prioridad</span>
                <select name="priority_level" defaultValue={formDefaults.priority}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Impacto</span>
                <select name="impact_scope" defaultValue={formDefaults.impact}>
                  {IMPACT_OPTIONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea name="suggestion_text" rows={5} placeholder="Describe la mejora, incidencia o nota con el mayor contexto posible" defaultValue={formDefaults.text} required />
            <div className="form-actions-bar form-actions-bar-start">
              <button type="submit">Anadir entrada</button>
            </div>
          </form>
        </section>

        <section className="card editor-card">
          <div style={{ marginBottom: 10 }}>
            <details className="entity-toolbar-menu">
              <summary aria-label="Abrir vista personalizada">{currentCustomViewLabel()} ▼</summary>
              <div className="entity-toolbar-menu-panel">
                <Link href={customViewHref("mine_sug_closed")} className="contacts-tab">Mis sugerencias cerradas</Link>
                <Link href={customViewHref("all_sug")} className="contacts-tab">Todas las sugerencias</Link>
                <Link href={customViewHref("mine_note_closed")} className="contacts-tab">Mis notas cerradas</Link>
                <Link href={customViewHref("all_note")} className="contacts-tab">Todas las notas</Link>
                <Link href={customViewHref("mine_bug_closed")} className="contacts-tab">Mis bugs cerrados</Link>
                <Link href={customViewHref("all_bug")} className="contacts-tab">Todos los bugs</Link>
              </div>
            </details>
          </div>

          <form method="get" className="entity-toolbar form-toolbar-surface" style={{ marginBottom: 10 }}>
            <input type="hidden" name="tab" value={activeTab} />
            <input type="hidden" name="mine_type" value={mineType} />
            <input type="hidden" name="sort_by" value={sortBy} />
            <input type="hidden" name="sort_dir" value={sortDir} />
            <input className="toolbar-search" name="q" defaultValue={q} placeholder="Buscar por contenido o contexto" aria-label="Buscar por contenido" />
            <label className="form-field">
              <span>Estado</span>
              <select name="status" defaultValue={statusFilter}>
                <option value="all">Todos</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Tipo</span>
              <select name="type" defaultValue={typeFilter}>
                <option value="all">Todos</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Aplicar</button>
            <Link href={hrefWithFilters({ tab: activeTab, mineType, status: "all", type: "all", q: "", sortBy, sortDir })} className="contacts-tab">Limpiar</Link>
          </form>

          <div className="table-card-head"><div><p className="workspace-kicker">Seguimiento</p><h3>Listado y seguimiento</h3></div></div>

          {isAdmin ? (
            <form id="batch-form" action={batchAction} className="entity-toolbar form-toolbar-surface" style={{ marginBottom: 10 }}>
              <input type="hidden" name="return_to" value={hrefWithFilters({ tab: activeTab, mineType, status: statusFilter, type: typeFilter, q, sortBy, sortDir })} />
              <label className="form-field">
                <span>Accion en lote</span>
                <select name="batch_action" defaultValue="close">
                  <option value="close">Cerrar (resuelta)</option>
                  <option value="status">Cambiar estado</option>
                  <option value="tag">Etiquetar</option>
                </select>
              </label>
              <label className="form-field">
                <span>Estado destino</span>
                <select name="batch_status" defaultValue="en_progreso">
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Etiqueta</span>
                <input name="batch_tag" placeholder="ej: ux, urgente, backend" />
              </label>
              <button type="submit">Aplicar a seleccion</button>
              <span className="muted">Solo admin. Selecciona filas en la primera columna.</span>
            </form>
          ) : null}

          <StaticTable
            columns={isAdmin
              ? ["Sel", "Usuario", "Tipo", "Prioridad", "Impacto", "Etiquetas", "Entrada", "Estado", "Ultima actividad", "Historial"]
              : ["Usuario", "Tipo", "Prioridad", "Impacto", "Etiquetas", "Entrada", "Estado", "Ultima actividad", "Historial"]}
            rows={(suggestions ?? []).map((s) => {
              const cleanText = cleanSuggestionText(s.suggestion_text);
              const latestEvent = (eventsBySuggestion.get(s.id) ?? [])[0];
              const cells = [
                s.created_by_email,
                s.suggestion_type ?? "sugerencia",
                <span className={`crm-chip ${priorityChipClass(s.priority_level)}`}>{s.priority_level ?? "--"}</span>,
                <span className={`crm-chip ${impactChipClass(s.impact_scope)}`}>{s.impact_scope ?? "--"}</span>,
                Array.isArray(s.tags) && s.tags.length > 0 ? s.tags.join(", ") : "--",
                <Link href={`/sugerencias/${encodeURIComponent(s.id)}`}>{cleanText.length > 130 ? `${cleanText.slice(0, 130)}...` : cleanText}</Link>,
                <div className="stack" style={{ gap: 6 }}>
                  <span className={`crm-chip ${statusChipClass(s.status)}`}>{s.status}</span>
                  <form action={updateStatusAction} className="inline-form-grid">
                    <input type="hidden" name="suggestion_id" value={s.id} />
                    <select name="status" defaultValue={s.status}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input name="status_reason" placeholder="Motivo si reabres" />
                    <button type="submit">Guardar</button>
                  </form>
                </div>,
                latestEvent ? new Date(latestEvent.created_at).toLocaleString("es-ES") : new Date(s.updated_at).toLocaleString("es-ES"),
                <Link href={`/sugerencias/${encodeURIComponent(s.id)}`} className="contacts-tab">Ver historial</Link>
              ];
              return isAdmin
                ? [<input form="batch-form" type="checkbox" name="suggestion_ids" value={s.id} aria-label={`Seleccionar ${s.id}`} />, ...cells]
                : cells;
            })}
            emptyLabel="No hay resultados para los filtros actuales."
            emptyHint="Ajusta la vista, cambia filtros o registra una nueva entrada para empezar a trabajar sobre ella."
          />
        </section>
      </div>
    </AppShell>
  );
}
