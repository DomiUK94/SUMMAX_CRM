"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  getCoreRowModel,
  type ColumnDef,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import type { ListedInvestor } from "@/lib/db/crm";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";
import { DataTable } from "@/components/ui/data-table";

type InvestorColumnKey = "id" | "name" | "category" | "website" | "strategy" | "status_name" | "sector" | "updated_at";
type InvestorsViewMode = "table" | "panel";
type InvestorsQuickFilter = "all" | "without_web" | "updated_7d";

const COLUMN_ORDER: InvestorColumnKey[] = ["id", "name", "category", "website", "strategy", "status_name", "sector", "updated_at"];

const INVESTOR_LABELS: Record<InvestorColumnKey, string> = {
  id: "ID",
  name: "Nombre cuenta",
  category: "Categor\u00eda",
  website: "Web",
  strategy: "Estrategia",
  status_name: "Estado",
  sector: "Sector",
  updated_at: "\u00daltima actualizaci\u00f3n"
};

const DEFAULT_COLUMNS: VisibilityState = {
  id: false,
  name: true,
  category: true,
  website: true,
  strategy: false,
  status_name: false,
  sector: false,
  updated_at: true
};

function displayInvestorValue(row: ListedInvestor, key: InvestorColumnKey): string {
  if (key === "updated_at") return row.updated_at ? new Date(row.updated_at).toLocaleString("es-ES") : "--";
  const raw = row[key as keyof ListedInvestor];
  return raw == null || raw === "" ? "--" : String(raw);
}

function wasUpdatedInDays(updatedAt: string | null, days: number): boolean {
  if (!updatedAt) return false;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

function hasWebsite(value: string | null): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (["-", "--", "n/a", "na", "sin web", "no web", "none", "null"].includes(normalized)) return false;
  return true;
}

export function InvestorsTable({ investors, storageKeyPrefix }: { investors: ListedInvestor[]; storageKeyPrefix?: string }) {
  const prefix = storageKeyPrefix ?? "investors";
  const [selected, setSelected] = useState<ListedInvestor | null>(null);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [viewMode, setViewMode] = usePersistedState<InvestorsViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<InvestorsQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columnVisibility, setColumnVisibility] = usePersistedState<VisibilityState>(`${prefix}:columns`, DEFAULT_COLUMNS);

  const savedViews = useSavedViews({
    module: "investors",
    currentFilters: { searchApplied, viewMode, quickFilter, columns: columnVisibility },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextView = filters.viewMode === "panel" ? "panel" : "table";
      const nextQuick =
        filters.quickFilter === "all" || filters.quickFilter === "without_web" || filters.quickFilter === "updated_7d"
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

  const filteredInvestors = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searchableColumns = COLUMN_ORDER.filter((key) => columnVisibility[key] !== false);
    const searched = !q
      ? investors
      : investors.filter((row) => searchableColumns.some((key) => displayInvestorValue(row, key).toLowerCase().includes(q)));

    if (quickFilter === "without_web") return searched.filter((row) => !hasWebsite(row.website));
    if (quickFilter === "updated_7d") return searched.filter((row) => wasUpdatedInDays(row.updated_at, 7));
    return searched;
  }, [columnVisibility, investors, quickFilter, searchApplied]);

  function exportCsv() {
    const visibleColumns = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible());
    if (!visibleColumns.length) return;

    const header = visibleColumns.map((key) => INVESTOR_LABELS[key]).join(",");
    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };

    const rows = filteredInvestors.map((row) => visibleColumns.map((key) => escape(displayInvestorValue(row, key))).join(","));
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuentas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<ListedInvestor>[]>(() => [
    {
      accessorKey: "id",
      id: "id",
      header: INVESTOR_LABELS.id,
      cell: ({ row }) => row.original.id
    },
    {
      accessorKey: "name",
      id: "name",
      header: INVESTOR_LABELS.name,
      cell: ({ row }) => (
        <button className="contact-name-link" onClick={() => setSelected(row.original)}>
          {displayInvestorValue(row.original, "name")}
        </button>
      )
    },
    {
      accessorKey: "category",
      id: "category",
      header: INVESTOR_LABELS.category,
      cell: ({ row }) => displayInvestorValue(row.original, "category")
    },
    {
      accessorKey: "website",
      id: "website",
      header: INVESTOR_LABELS.website,
      cell: ({ row }) => displayInvestorValue(row.original, "website")
    },
    {
      accessorKey: "strategy",
      id: "strategy",
      header: INVESTOR_LABELS.strategy,
      cell: ({ row }) => displayInvestorValue(row.original, "strategy")
    },
    {
      accessorKey: "status_name",
      id: "status_name",
      header: INVESTOR_LABELS.status_name,
      cell: ({ row }) => displayInvestorValue(row.original, "status_name")
    },
    {
      accessorKey: "sector",
      id: "sector",
      header: INVESTOR_LABELS.sector,
      cell: ({ row }) => displayInvestorValue(row.original, "sector")
    },
    {
      accessorKey: "updated_at",
      id: "updated_at",
      header: INVESTOR_LABELS.updated_at,
      cell: ({ row }) => displayInvestorValue(row.original, "updated_at")
    }
  ], []);

  const table = useReactTable({
    data: filteredInvestors,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel()
  });

  const visibleColumnCount = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;
  const noWebCount = investors.filter((row) => !hasWebsite(row.website)).length;
  const updated7dCount = investors.filter((row) => wasUpdatedInDays(row.updated_at, 7)).length;

  function toggleColumn(key: InvestorColumnKey) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleColumnCount === 1) return;
    column.toggleVisibility(!column.getIsVisible());
  }

  return (
    <>
      <div className="entity-toolbar">
        <input
          className="companies-search toolbar-search"
          placeholder="Buscar cuenta o dato visible"
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
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as InvestorsViewMode)}>
              <option value="table">Tabla</option>
              <option value="panel">Panel</option>
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
                    {INVESTOR_LABELS[key]}
                  </label>
                ))}
              </div>
              <button
                onClick={async () => {
                  const name = window.prompt("Nombre de la vista");
                  if (!name) return;
                  await savedViews.saveCurrent(name);
                }}
              >
                Guardar vista
              </button>
              <button
                disabled={!selectedViewId}
                onClick={async () => {
                  if (!selectedViewId) return;
                  await savedViews.deleteView(selectedViewId);
                  setSelectedViewId("");
                }}
              >
                Eliminar vista
              </button>
              <button onClick={exportCsv}>Exportar</button>
            </div>
          </details>
        </div>
      </div>

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros r\u00e1pidos de cuentas">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
          Todas
        </button>
        <button
          className={quickFilter === "without_web" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("without_web")}
        >
          Sin web <span className="contacts-badge">{noWebCount}</span>
        </button>
        <button
          className={quickFilter === "updated_7d" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("updated_7d")}
        >
          Actualizadas 7 d\u00edas <span className="contacts-badge">{updated7dCount}</span>
        </button>
      </div>

      {viewMode === "panel" ? (
        <div className="panel-grid">
          {filteredInvestors.map((inv, index) => (
            <motion.article
              key={inv.id}
              className="panel-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.18) }}
            >
              {table.getColumn("name")?.getIsVisible() ? (
                <button className="contact-name-link" onClick={() => setSelected(inv)}>
                  {displayInvestorValue(inv, "name")}
                </button>
              ) : null}
              {COLUMN_ORDER.filter((key) => key !== "name" && table.getColumn(key)?.getIsVisible()).map((key) => (
                <div key={key} className="muted">
                  {INVESTOR_LABELS[key]}: {displayInvestorValue(inv, key)}
                </div>
              ))}
            </motion.article>
          ))}
          {filteredInvestors.length === 0 ? <p className="muted">Sin cuentas.</p> : null}
        </div>
      ) : (
        <DataTable
          table={table}
          emptyLabel="Sin cuentas."
          emptyHint="Ajusta los filtros o crea una nueva cuenta para empezar a mover el pipeline."
          className="companies-table-wrap"
        />
      )}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              X
            </button>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p><strong>Categor\u00eda:</strong> {selected.category ?? "-"}</p>
            <p><strong>Web:</strong> {selected.website ?? "-"}</p>
            <p><strong>Estrategia:</strong> {selected.strategy ?? "-"}</p>
            <p><strong>\u00daltima actualizaci\u00f3n:</strong> {selected.updated_at ? new Date(selected.updated_at).toLocaleString("es-ES") : "-"}</p>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
