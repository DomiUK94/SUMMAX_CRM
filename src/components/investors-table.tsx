"use client";

import { useMemo, useState } from "react";
import type { ListedInvestor } from "@/lib/db/crm";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";

type InvestorColumnKey = "id" | "name" | "category" | "website" | "strategy" | "status_name" | "sector" | "updated_at";
type InvestorsViewMode = "table" | "panel";
type InvestorsQuickFilter = "all" | "without_web" | "updated_7d";

const INVESTOR_LABELS: Record<InvestorColumnKey, string> = {
  id: "ID",
  name: "Nombre cuenta",
  category: "Categoría",
  website: "Web",
  strategy: "Estrategia",
  status_name: "Estado",
  sector: "Sector",
  updated_at: "Última actualización"
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

export function InvestorsTable({ investors, storageKeyPrefix }: { investors: ListedInvestor[]; storageKeyPrefix?: string }) {
  const prefix = storageKeyPrefix ?? "investors";
  const [selected, setSelected] = useState<ListedInvestor | null>(null);
  const [showColumnsEditor, setShowColumnsEditor] = useState(false);
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [viewMode, setViewMode] = usePersistedState<InvestorsViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<InvestorsQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columns, setColumns] = usePersistedState<Record<InvestorColumnKey, boolean>>(`${prefix}:columns`, {
    id: false,
    name: true,
    category: true,
    website: true,
    strategy: false,
    status_name: false,
    sector: false,
    updated_at: true
  });

  const visibleColumns = (Object.keys(columns) as InvestorColumnKey[]).filter((k) => columns[k]);
  const visibleCount = visibleColumns.length;
  const savedViews = useSavedViews({
    module: "investors",
    currentFilters: { searchApplied, viewMode, quickFilter, columns },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextView = filters.viewMode === "panel" ? "panel" : "table";
      const nextQuick =
        filters.quickFilter === "all" || filters.quickFilter === "without_web" || filters.quickFilter === "updated_7d"
          ? filters.quickFilter
          : "all";
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setViewMode(nextView);
      setQuickFilter(nextQuick);
      setColumns(((filters.columns as Record<InvestorColumnKey, boolean>) ?? columns));
    }
  });

  function toggleColumn(key: InvestorColumnKey) {
    if (columns[key] && visibleCount === 1) return;
    setColumns((current) => ({ ...current, [key]: !current[key] }));
  }

  const filteredInvestors = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searched = !q
      ? investors
      : investors.filter((row) => visibleColumns.some((k) => displayInvestorValue(row, k).toLowerCase().includes(q)));

    if (quickFilter === "without_web") {
      return searched.filter((row) => !row.website || !row.website.trim());
    }
    if (quickFilter === "updated_7d") {
      return searched.filter((row) => wasUpdatedInDays(row.updated_at, 7));
    }
    return searched;
  }, [investors, searchApplied, visibleColumns, quickFilter]);

  function exportCsv() {
    if (!visibleColumns.length) return;
    const header = visibleColumns.map((k) => INVESTOR_LABELS[k]).join(",");
    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };

    const rows = filteredInvestors.map((row) => visibleColumns.map((k) => escape(displayInvestorValue(row, k))).join(","));
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

  const noWebCount = investors.filter((row) => !row.website || !row.website.trim()).length;
  const updated7dCount = investors.filter((row) => wasUpdatedInDays(row.updated_at, 7)).length;

  return (
    <>
      <div className="entity-toolbar">
        <input
          className="companies-search toolbar-search"
          placeholder="Busca info de Cuentas (Cualquier columna)"
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
          <select value={viewMode} onChange={(event) => setViewMode(event.target.value as InvestorsViewMode)}>
            <option value="table">Tabla</option>
            <option value="panel">Panel</option>
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

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de cuentas">
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
          Actualizadas 7 días <span className="contacts-badge">{updated7dCount}</span>
        </button>
      </div>

      {showColumnsEditor ? (
        <div className="columns-editor">
          {(Object.keys(columns) as InvestorColumnKey[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={columns[key]} onChange={() => toggleColumn(key)} />
              {INVESTOR_LABELS[key]}
            </label>
          ))}
        </div>
      ) : null}

      {viewMode === "panel" ? (
        <div className="panel-grid">
          {filteredInvestors.map((inv) => (
            <article key={inv.id} className="panel-card">
              <button className="contact-name-link" onClick={() => setSelected(inv)}>
                {inv.name}
              </button>
              <div className="muted">Categoría: {inv.category ?? "--"}</div>
              <div className="muted">Web: {inv.website ?? "--"}</div>
              <div className="muted">Actualizado: {displayInvestorValue(inv, "updated_at")}</div>
            </article>
          ))}
          {filteredInvestors.length === 0 ? <p className="muted">Sin cuentas.</p> : null}
        </div>
      ) : (
        <div className="companies-table-wrap">
          <table className="companies-crm-table">
            <thead>
              <tr>
                {visibleColumns.map((key) => (
                  <th key={key}>{INVESTOR_LABELS[key]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.map((inv) => (
                <tr key={inv.id}>
                  {visibleColumns.map((key) =>
                    key === "name" ? (
                      <td key={key}>
                        <button className="contact-name-link" onClick={() => setSelected(inv)}>
                          {displayInvestorValue(inv, key)}
                        </button>
                      </td>
                    ) : (
                      <td key={key}>{displayInvestorValue(inv, key)}</td>
                    )
                  )}
                </tr>
              ))}
              {filteredInvestors.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(visibleCount, 1)}>Sin cuentas.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              X
            </button>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p><strong>Categoría:</strong> {selected.category ?? "-"}</p>
            <p><strong>Web:</strong> {selected.website ?? "-"}</p>
            <p><strong>Estrategia:</strong> {selected.strategy ?? "-"}</p>
            <p><strong>Última actualización:</strong> {selected.updated_at ? new Date(selected.updated_at).toLocaleString("es-ES") : "-"}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
