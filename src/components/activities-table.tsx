"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  getCoreRowModel,
  type ColumnDef,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";
import { DataTable } from "@/components/ui/data-table";

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

const COLUMN_ORDER: ActivityColumnKey[] = ["occurred_at", "activity_type", "entity_type", "title", "body", "created_by_email"];
const ACTIVITY_LABELS: Record<ActivityColumnKey, string> = {
  occurred_at: "Fecha",
  activity_type: "Tipo",
  entity_type: "Entidad",
  title: "T\u00edtulo",
  body: "Detalle",
  created_by_email: "Usuario"
};
const DEFAULT_COLUMNS: VisibilityState = {
  occurred_at: true,
  activity_type: true,
  entity_type: true,
  title: true,
  body: true,
  created_by_email: true
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
  const [selectedViewId, setSelectedViewId] = useState("");
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [viewMode, setViewMode] = usePersistedState<ActivitiesViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<ActivitiesQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columnVisibility, setColumnVisibility] = usePersistedState<VisibilityState>(`${prefix}:columns`, DEFAULT_COLUMNS);

  const savedViews = useSavedViews({
    module: "activities",
    currentFilters: { searchApplied, viewMode, quickFilter, columns: columnVisibility },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextView = filters.viewMode === "timeline" ? "timeline" : "table";
      const nextQuick =
        filters.quickFilter === "all" || filters.quickFilter === "today" || filters.quickFilter === "last_7d" || filters.quickFilter === "feedback"
          ? filters.quickFilter
          : "all";
      const nextColumns = (filters.columns as VisibilityState) ?? DEFAULT_COLUMNS;
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setViewMode(nextView);
      setQuickFilter(nextQuick);
      setColumnVisibility(nextColumns);
    }
  });

  const filteredActivities = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searchableColumns = COLUMN_ORDER.filter((key) => columnVisibility[key] !== false);
    const searched = !q
      ? activities
      : activities.filter((row) => searchableColumns.some((key) => displayActivityValue(row, key).toLowerCase().includes(q)));

    if (quickFilter === "today") return searched.filter((row) => isToday(row.occurred_at));
    if (quickFilter === "last_7d") return searched.filter((row) => isWithinDays(row.occurred_at, 7));
    if (quickFilter === "feedback") return searched.filter((row) => (row.activity_type ?? "").toLowerCase().includes("feedback"));
    return searched;
  }, [activities, columnVisibility, quickFilter, searchApplied]);

  function exportCsv() {
    const visibleColumns = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible());
    if (!visibleColumns.length) return;
    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };

    const header = visibleColumns.map((key) => ACTIVITY_LABELS[key]).join(",");
    const rows = filteredActivities.map((row) => visibleColumns.map((key) => escape(displayActivityValue(row, key))).join(","));
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

  const columns = useMemo<ColumnDef<ActivityRow>[]>(() => [
    { id: "occurred_at", header: ACTIVITY_LABELS.occurred_at, cell: ({ row }) => displayActivityValue(row.original, "occurred_at") },
    { id: "activity_type", header: ACTIVITY_LABELS.activity_type, cell: ({ row }) => displayActivityValue(row.original, "activity_type") },
    { id: "entity_type", header: ACTIVITY_LABELS.entity_type, cell: ({ row }) => displayActivityValue(row.original, "entity_type") },
    { id: "title", header: ACTIVITY_LABELS.title, cell: ({ row }) => displayActivityValue(row.original, "title") },
    { id: "body", header: ACTIVITY_LABELS.body, cell: ({ row }) => displayActivityValue(row.original, "body") },
    { id: "created_by_email", header: ACTIVITY_LABELS.created_by_email, cell: ({ row }) => displayActivityValue(row.original, "created_by_email") }
  ], []);

  const table = useReactTable({
    data: filteredActivities,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel()
  });

  const visibleColumnCount = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;
  const todayCount = activities.filter((row) => isToday(row.occurred_at)).length;
  const weekCount = activities.filter((row) => isWithinDays(row.occurred_at, 7)).length;
  const feedbackCount = activities.filter((row) => (row.activity_type ?? "").toLowerCase().includes("feedback")).length;

  function toggleColumn(key: ActivityColumnKey) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleColumnCount === 1) return;
    column.toggleVisibility(!column.getIsVisible());
  }

  return (
    <>
      <div className="entity-toolbar">
        <input
          className="toolbar-search"
          placeholder="Buscar actividad o dato visible"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
        <button onClick={() => setSearchApplied(searchDraft)}>Aplicar</button>
        <div className="entity-toolbar-inline">
          <div className="entity-toolbar-section entity-toolbar-view">
            <span className="entity-toolbar-section-title">Vista</span>
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ActivitiesViewMode)}>
              <option value="table">Tabla</option>
              <option value="timeline">Timeline</option>
            </select>
            <select
              value={selectedViewId}
              onChange={(event) => {
                const id = event.target.value;
                setSelectedViewId(id);
                if (!id) return;
                savedViews.applyView(id);
              }}
            >
              <option value="">{savedViews.loading ? "Cargando vistas..." : "Vistas guardadas"}</option>
              {savedViews.views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          </div>
          <details className="entity-toolbar-menu">
            <summary aria-label="M\u00e1s acciones de vista">Men\u00fa</summary>
            <div className="entity-toolbar-menu-panel">
              <div className="columns-editor" style={{ marginBottom: 0 }}>
                {COLUMN_ORDER.map((key) => (
                  <label key={key}>
                    <input type="checkbox" checked={table.getColumn(key)?.getIsVisible() ?? false} onChange={() => toggleColumn(key)} />
                    {ACTIVITY_LABELS[key]}
                  </label>
                ))}
              </div>
              <button onClick={async () => {
                const name = window.prompt("Nombre de la vista");
                if (!name) return;
                await savedViews.saveCurrent(name);
              }}>
                Guardar vista
              </button>
              <button disabled={!selectedViewId} onClick={async () => {
                if (!selectedViewId) return;
                await savedViews.deleteView(selectedViewId);
                setSelectedViewId("");
              }}>
                Eliminar vista
              </button>
              <button onClick={exportCsv}>Exportar</button>
            </div>
          </details>
        </div>
      </div>

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros r\u00e1pidos de actividades">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>Todas</button>
        <button className={quickFilter === "today" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("today")}>Hoy <span className="contacts-badge">{todayCount}</span></button>
        <button className={quickFilter === "last_7d" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("last_7d")}>\u00daltimos 7 d\u00edas <span className="contacts-badge">{weekCount}</span></button>
        <button className={quickFilter === "feedback" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("feedback")}>Feedback <span className="contacts-badge">{feedbackCount}</span></button>
      </div>

      {viewMode === "timeline" ? (
        <div className="timeline-list">
          {filteredActivities.map((activity, index) => (
            <motion.article key={activity.id} className="timeline-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.18) }}>
              <div className="timeline-item-head">
                <strong>{activity.title ?? "(sin t\u00edtulo)"}</strong>
                <span className="muted">{displayActivityValue(activity, "occurred_at")}</span>
              </div>
              <div className="muted">{activity.activity_type ?? "--"} | {activity.entity_type ?? "--"} | {activity.created_by_email ?? "--"}</div>
              <p style={{ margin: "6px 0 0" }}>{activity.body ?? "--"}</p>
            </motion.article>
          ))}
          {filteredActivities.length === 0 ? <p className="muted">Sin actividades registradas.</p> : null}
        </div>
      ) : (
        <DataTable
          table={table}
          emptyLabel="Sin actividades registradas."
          emptyHint="Cuando se registren llamadas, reuniones o feedback aparecer\u00e1n aqu\u00ed con su contexto."
        />
      )}
    </>
  );
}
