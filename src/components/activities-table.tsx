"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";

type ActivityRow = {
  id: string;
  occurred_at: string | null;
  activity_type: string | null;
  entity_type: string | null;
  title: string | null;
  body: string | null;
  created_by_email: string | null;
};

type ActivityColumnKey = "occurred_at" | "activity_type" | "entity_type" | "title" | "body" | "created_by_email";
type ActivitiesViewMode = "table" | "timeline";
type ActivitiesQuickFilter = "all" | "today" | "last_7d" | "feedback";

const ACTIVITY_LABELS: Record<ActivityColumnKey, string> = {
  occurred_at: "Fecha",
  activity_type: "Tipo",
  entity_type: "Entidad",
  title: "Título",
  body: "Detalle",
  created_by_email: "Usuario"
};

function displayActivityValue(row: ActivityRow, key: ActivityColumnKey): string {
  if (key === "occurred_at") return row.occurred_at ? new Date(row.occurred_at).toLocaleString("es-ES") : "-";
  const raw = row[key];
  return raw == null || raw === "" ? "--" : String(raw);
}

function isToday(value: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isWithinDays(value: string | null, days: number): boolean {
  if (!value) return false;
  const diff = Date.now() - new Date(value).getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

export function ActivitiesTable({ activities, storageKeyPrefix }: { activities: ActivityRow[]; storageKeyPrefix?: string }) {
  const prefix = storageKeyPrefix ?? "activities";
  const [showColumnsEditor, setShowColumnsEditor] = useState(false);
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [viewMode, setViewMode] = usePersistedState<ActivitiesViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<ActivitiesQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columns, setColumns] = usePersistedState<Record<ActivityColumnKey, boolean>>(`${prefix}:columns`, {
    occurred_at: true,
    activity_type: true,
    entity_type: true,
    title: true,
    body: true,
    created_by_email: true
  });
  const visibleColumns = (Object.keys(columns) as ActivityColumnKey[]).filter((k) => columns[k]);
  const visibleCount = visibleColumns.length;
  const savedViews = useSavedViews({
    module: "activities",
    currentFilters: { searchApplied, viewMode, quickFilter, columns },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextView = filters.viewMode === "timeline" ? "timeline" : "table";
      const nextQuick =
        filters.quickFilter === "all" ||
        filters.quickFilter === "today" ||
        filters.quickFilter === "last_7d" ||
        filters.quickFilter === "feedback"
          ? filters.quickFilter
          : "all";
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setViewMode(nextView);
      setQuickFilter(nextQuick);
      setColumns(((filters.columns as Record<ActivityColumnKey, boolean>) ?? columns));
    }
  });

  function toggleColumn(key: ActivityColumnKey) {
    if (columns[key] && visibleCount === 1) return;
    setColumns((current) => ({ ...current, [key]: !current[key] }));
  }

  const filteredActivities = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searched = !q
      ? activities
      : activities.filter((row) => visibleColumns.some((k) => displayActivityValue(row, k).toLowerCase().includes(q)));

    if (quickFilter === "today") return searched.filter((row) => isToday(row.occurred_at));
    if (quickFilter === "last_7d") return searched.filter((row) => isWithinDays(row.occurred_at, 7));
    if (quickFilter === "feedback") return searched.filter((row) => (row.activity_type ?? "").toLowerCase().includes("feedback"));
    return searched;
  }, [activities, searchApplied, visibleColumns, quickFilter]);

  function exportCsv() {
    if (!visibleColumns.length) return;
    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const header = visibleColumns.map((k) => ACTIVITY_LABELS[k]).join(",");
    const rows = filteredActivities.map((row) => visibleColumns.map((k) => escape(displayActivityValue(row, k))).join(","));

    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `actividades-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const todayCount = activities.filter((row) => isToday(row.occurred_at)).length;
  const weekCount = activities.filter((row) => isWithinDays(row.occurred_at, 7)).length;
  const feedbackCount = activities.filter((row) => (row.activity_type ?? "").toLowerCase().includes("feedback")).length;

  return (
    <>
      <div className="entity-toolbar">
        <input
          className="toolbar-search"
          placeholder="Busca info de Actividades (Cualquier columna)"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
        <button onClick={() => setSearchApplied(searchDraft)}>Filtrar</button>
        <div className="entity-toolbar-view">
          <span>Vista:</span>
          <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ActivitiesViewMode)}>
            <option value="table">Tabla</option>
            <option value="timeline">Timeline</option>
          </select>
        </div>
        <div className="entity-toolbar-actions">
          <button onClick={() => setShowColumnsEditor((s) => !s)}>Editar columnas</button>
          <button
            onClick={async () => {
              const name = window.prompt("Nombre de la vista");
              if (!name) return;
              await savedViews.saveCurrent(name);
            }}
          >
            Guardar vista
          </button>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              savedViews.applyView(event.target.value);
              event.currentTarget.value = "";
            }}
          >
            <option value="">{savedViews.loading ? "Cargando vistas..." : "Aplicar vista guardada"}</option>
            {savedViews.views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
          <button onClick={exportCsv}>Exportar</button>
        </div>
      </div>

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de actividades">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
          Todas
        </button>
        <button className={quickFilter === "today" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("today")}>
          Hoy <span className="contacts-badge">{todayCount}</span>
        </button>
        <button className={quickFilter === "last_7d" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("last_7d")}>
          Últimos 7 días <span className="contacts-badge">{weekCount}</span>
        </button>
        <button className={quickFilter === "feedback" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("feedback")}>
          Feedback <span className="contacts-badge">{feedbackCount}</span>
        </button>
      </div>

      {showColumnsEditor ? (
        <div className="columns-editor">
          {(Object.keys(columns) as ActivityColumnKey[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={columns[key]} onChange={() => toggleColumn(key)} />
              {ACTIVITY_LABELS[key]}
            </label>
          ))}
        </div>
      ) : null}

      {viewMode === "timeline" ? (
        <div className="timeline-list">
          {filteredActivities.map((a) => (
            <article key={a.id} className="timeline-item">
              <div className="timeline-item-head">
                <strong>{a.title ?? "(sin título)"}</strong>
                <span className="muted">{displayActivityValue(a, "occurred_at")}</span>
              </div>
              <div className="muted">{a.activity_type ?? "--"} | {a.entity_type ?? "--"} | {a.created_by_email ?? "--"}</div>
              <p style={{ margin: "6px 0 0" }}>{a.body ?? "--"}</p>
            </article>
          ))}
          {filteredActivities.length === 0 ? <p className="muted">Sin actividades registradas.</p> : null}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {visibleColumns.map((key) => (
                <th key={key}>{ACTIVITY_LABELS[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredActivities.map((a) => (
              <tr key={a.id}>
                {visibleColumns.map((key) => (
                  <td key={key}>{displayActivityValue(a, key)}</td>
                ))}
              </tr>
            ))}
            {filteredActivities.length === 0 ? (
              <tr>
                <td colSpan={Math.max(visibleCount, 1)}>Sin actividades registradas.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </>
  );
}
