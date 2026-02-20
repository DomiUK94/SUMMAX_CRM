"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";

type DealCard = {
  id: number;
  name: string;
  amount: string;
  priority: string;
  contactName: string;
  contactId: number | null;
  closeDate: string;
  createdDate: string;
};

type DealsBoardProps = {
  stages: string[];
  initialByStage: Record<string, DealCard[]>;
  storageKeyPrefix?: string;
};

type DragState = {
  fromStage: string;
  dealId: number;
} | null;

type DealsViewMode = "panel" | "table";
type DealsQuickFilter = "all" | "high_value" | "without_contact" | "close_30d";

type DealColumnKey = "name" | "amount" | "closeDate" | "priority" | "stage" | "contactName" | "companyId" | "createdDate";

const DEAL_LABELS: Record<DealColumnKey, string> = {
  name: "Nombre de Cuenta",
  amount: "Importe Total",
  closeDate: "Fecha estimada de cierre",
  priority: "Prioridad",
  stage: "Estado",
  contactName: "Contacto",
  companyId: "ID compañia",
  createdDate: "Fecha de creación",
};

function formatAmountEur(rawAmount: string): string {
  const raw = String(rawAmount ?? "").trim();
  if (!raw) return "€0";
  if (raw.includes("€")) return raw;

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return `€ ${raw}`;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(parsed);
}

function parseAmountNumber(rawAmount: string): number {
  const raw = String(rawAmount ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moveDeal(
  current: Record<string, DealCard[]>,
  fromStage: string,
  toStage: string,
  dealId: number
): Record<string, DealCard[]> {
  if (fromStage === toStage) return current;

  const source = current[fromStage] ?? [];
  const target = current[toStage] ?? [];
  const moving = source.find((deal) => deal.id === dealId);
  if (!moving) return current;

  return {
    ...current,
    [fromStage]: source.filter((deal) => deal.id !== dealId),
    [toStage]: [...target, moving]
  };
}

function fieldValue(stage: string, card: DealCard, key: DealColumnKey): string {
  switch (key) {
    case "stage":
      return stage;
    case "companyId":
      return String(card.id);
    case "name":
      return card.name;
    case "amount":
      return formatAmountEur(card.amount);
    case "closeDate":
      return card.closeDate;
    case "priority":
      return card.priority;
    case "createdDate":
      return card.createdDate;
    case "contactName":
      return card.contactName;
    default:
      return "";
  }
}

export function DealsBoard({ stages, initialByStage, storageKeyPrefix }: DealsBoardProps) {
  const prefix = storageKeyPrefix ?? "deals";
  const [byStage, setByStage] = useState<Record<string, DealCard[]>>(initialByStage);
  const [dragState, setDragState] = useState<DragState>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedState<DealsViewMode>(`${prefix}:view_mode`, "panel");
  const [showColumnsEditor, setShowColumnsEditor] = useState(false);
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [quickFilter, setQuickFilter] = usePersistedState<DealsQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columns, setColumns] = usePersistedState<Record<DealColumnKey, boolean>>(`${prefix}:columns`, {
    name: true,
    amount: true,
    closeDate: true,
    priority: true,
    stage: true,
    contactName: true,
    companyId: false,
    createdDate: false
  });

  const visibleColumns = (Object.keys(columns) as DealColumnKey[]).filter((k) => columns[k]);
  const savedViews = useSavedViews({
    module: "deals",
    currentFilters: { searchApplied, viewMode, quickFilter, columns },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextView = filters.viewMode === "table" ? "table" : "panel";
      const nextQuick =
        filters.quickFilter === "all" ||
        filters.quickFilter === "high_value" ||
        filters.quickFilter === "without_contact" ||
        filters.quickFilter === "close_30d"
          ? filters.quickFilter
          : "all";
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setViewMode(nextView);
      setQuickFilter(nextQuick);
      setColumns(((filters.columns as Record<DealColumnKey, boolean>) ?? columns));
    }
  });
  const totalDeals = useMemo(
    () => stages.reduce((acc, stage) => acc + (byStage[stage]?.length ?? 0), 0),
    [byStage, stages]
  );

  function toggleColumn(key: DealColumnKey) {
    const visible = visibleColumns.length;
    if (columns[key] && visible === 1) return;
    setColumns((current) => ({ ...current, [key]: !current[key] }));
  }

  function exportCsv() {
    if (!visibleColumns.length) return;

    const rows: Array<Record<DealColumnKey, string>> = [];
    stages.forEach((stage) => {
      (byStage[stage] ?? []).forEach((deal) => {
        rows.push({
          stage,
          companyId: String(deal.id),
          name: deal.name,
          amount: formatAmountEur(deal.amount),
          closeDate: deal.closeDate,
          priority: deal.priority,
          createdDate: deal.createdDate,
          contactName: deal.contactName
        });
      });
    });

    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };
    const csv = [
      visibleColumns.map((c) => DEAL_LABELS[c]).join(","),
      ...rows.map((row) => visibleColumns.map((c) => escape(row[c] ?? "--")).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negocios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const matches = (stage: string, card: DealCard) => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return true;
    return visibleColumns.some((key) => fieldValue(stage, card, key).toLowerCase().includes(q));
  };

  const filteredRows = useMemo(
    () =>
      stages.flatMap((stage) =>
        (byStage[stage] ?? []).filter((card) => matches(stage, card)).map((card) => ({ stage, card }))
      ),
    [stages, byStage, searchApplied, visibleColumns]
  );
  const highValueCount = useMemo(() => filteredRows.filter((r) => parseAmountNumber(r.card.amount) >= 100000).length, [filteredRows]);
  const withoutContactCount = useMemo(() => filteredRows.filter((r) => !r.card.contactId).length, [filteredRows]);
  const close30dCount = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return filteredRows.filter((r) => {
      const parsed = new Date(r.card.closeDate);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed >= now && parsed <= in30;
    }).length;
  }, [filteredRows]);

  const filteredByQuickTab = useMemo(() => {
    if (quickFilter === "high_value") {
      return filteredRows.filter((row) => parseAmountNumber(row.card.amount) >= 100000);
    }
    if (quickFilter === "without_contact") {
      return filteredRows.filter((row) => !row.card.contactId);
    }
    if (quickFilter === "close_30d") {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return filteredRows.filter((row) => {
        const parsed = new Date(row.card.closeDate);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed >= now && parsed <= in30;
      });
    }
    return filteredRows;
  }, [filteredRows, quickFilter]);

  const totalFilteredAmount = useMemo(
    () => filteredByQuickTab.reduce((acc, row) => acc + parseAmountNumber(row.card.amount), 0),
    [filteredByQuickTab]
  );

  return (
    <>
      <div className="entity-toolbar">
        <input
          className="toolbar-search"
          placeholder="Busca info de Negocios (Cualquier columna)"
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
          <select value={viewMode} onChange={(event) => setViewMode(event.target.value as DealsViewMode)}>
            <option value="panel">Panel</option>
            <option value="table">Tabla</option>
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
      <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de negocios">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
          Todos
        </button>
        <button
          className={quickFilter === "high_value" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("high_value")}
        >
          Valor alto <span className="contacts-badge">{highValueCount}</span>
        </button>
        <button
          className={quickFilter === "without_contact" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("without_contact")}
        >
          Sin contacto <span className="contacts-badge">{withoutContactCount}</span>
        </button>
        <button
          className={quickFilter === "close_30d" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("close_30d")}
        >
          Cierre 30 días <span className="contacts-badge">{close30dCount}</span>
        </button>
      </div>

      {showColumnsEditor ? (
        <div className="columns-editor">
          {(Object.keys(columns) as DealColumnKey[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={columns[key]} onChange={() => toggleColumn(key)} />
              {DEAL_LABELS[key]}
            </label>
          ))}
        </div>
      ) : null}

      {viewMode === "panel" ? (
        <div className="deals-board-wrap">
          <div className="deals-board">
            {stages.map((stage) => {
              const cards = filteredByQuickTab.filter((row) => row.stage === stage).map((row) => row.card);
              const isHover = hoverStage === stage;

              return (
                <section
                  key={stage}
                  className="deals-column"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setHoverStage(stage);
                  }}
                  onDragLeave={() => {
                    setHoverStage((current) => (current === stage ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!dragState) return;
                    setByStage((current) => moveDeal(current, dragState.fromStage, stage, dragState.dealId));
                    setDragState(null);
                    setHoverStage(null);
                  }}
                >
                  <header className="deals-column-header">
                    <span>{stage}</span>
                    <span className="deals-column-count">{cards.length}</span>
                  </header>
                  <div className="deals-column-body" style={isHover ? { outline: "2px dashed #94a3b8", outlineOffset: 2 } : undefined}>
                    {cards.map((card) => (
                      <article
                        key={card.id}
                        className="deal-card"
                        draggable
                        onDragStart={() => setDragState({ fromStage: stage, dealId: card.id })}
                        onDragEnd={() => {
                          setDragState(null);
                          setHoverStage(null);
                        }}
                      >
                        {columns.name ? (
                          <Link href={`/investors/${card.id}`} className="deal-card-title">
                            {card.name}
                          </Link>
                        ) : null}
                        {columns.companyId ? <div>ID compañía: {card.id}</div> : null}
                        {columns.amount ? <div>Importe: {formatAmountEur(card.amount)}</div> : null}
                        {columns.closeDate ? <div>Fecha estimada de cierre: {card.closeDate}</div> : null}
                        {columns.priority ? <div>Prioridad: {card.priority}</div> : null}
                        {columns.createdDate ? <div>Fecha de creación: {card.createdDate}</div> : null}
                        {columns.contactName ? (
                          <>
                            <hr />
                            <div>
                              {card.contactId ? (
                                <Link href={`/contacts/${card.contactId}`}>{card.contactName}</Link>
                              ) : (
                                card.contactName
                              )}
                            </div>
                          </>
                        ) : null}
                      </article>
                    ))}
                  </div>
                  <footer className="deals-column-footer">
                    <strong>{cards.length}</strong> | Negocios ({totalDeals} totales)
                  </footer>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="card" style={{ padding: "10px 12px" }}>
            <strong>Importe total (negocios visibles): {formatAmountEur(String(totalFilteredAmount))}</strong>
          </div>
          <div className="contacts-table-wrap">
          <table className="contacts-crm-table">
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column}>{DEAL_LABELS[column]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredByQuickTab.map(({ stage, card }) => (
                <tr key={`${stage}-${card.id}`}>
                  {visibleColumns.map((column) => {
                    if (column === "name") {
                      return (
                        <td key={column}>
                          <Link href={`/investors/${card.id}`}>{card.name}</Link>
                        </td>
                      );
                    }
                    if (column === "contactName") {
                      return (
                        <td key={column}>
                          {card.contactId ? <Link href={`/contacts/${card.contactId}`}>{card.contactName}</Link> : card.contactName}
                        </td>
                      );
                    }
                    return <td key={column}>{fieldValue(stage, card, column) || "--"}</td>;
                  })}
                </tr>
              ))}
              {filteredByQuickTab.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(visibleColumns.length, 1)}>Sin negocios.</td>
                </tr>
              ) : null}
            </tbody>
            {filteredByQuickTab.length > 0 ? (
              <tfoot>
                <tr>
                  {visibleColumns.map((column, index) => {
                    if (column === "amount") {
                      return <td key={column}><strong>{formatAmountEur(String(totalFilteredAmount))}</strong></td>;
                    }
                    if (index === 0) {
                      return <td key={column}><strong>Total</strong></td>;
                    }
                    return <td key={column}>--</td>;
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        </div>
      )}
    </>
  );
}
