"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  type ColumnDef,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";

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
type ToastTone = "success" | "error" | "info";

type DealTableRow = {
  rowId: string;
  stage: string;
  card: DealCard;
};

const COLUMN_ORDER: DealColumnKey[] = ["name", "amount", "closeDate", "priority", "stage", "contactName", "companyId", "createdDate"];

const DEAL_LABELS: Record<DealColumnKey, string> = {
  name: "Nombre de cuenta",
  amount: "Importe total",
  closeDate: "Fecha estimada de cierre",
  priority: "Prioridad",
  stage: "Estado",
  contactName: "Contacto",
  companyId: "ID compañía",
  createdDate: "Fecha de creación"
};

const DEFAULT_COLUMNS: VisibilityState = {
  name: true,
  amount: true,
  closeDate: true,
  priority: true,
  stage: true,
  contactName: true,
  companyId: false,
  createdDate: false
};

function formatAmountEur(rawAmount: string): string {
  const raw = String(rawAmount ?? "").trim();
  if (!raw) return "EUR 0";
  if (raw.includes("EUR") || raw.includes("\u20ac")) return raw;

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return `EUR ${raw}`;
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

function moveDeal(current: Record<string, DealCard[]>, fromStage: string, toStage: string, dealId: number): Record<string, DealCard[]> {
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
  const [selectedViewId, setSelectedViewId] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<{ stage: string; card: DealCard } | null>(null);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const [viewMode, setViewMode] = usePersistedState<DealsViewMode>(`${prefix}:view_mode`, "panel");
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [quickFilter, setQuickFilter] = usePersistedState<DealsQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columnVisibility, setColumnVisibility] = usePersistedState<VisibilityState>(`${prefix}:columns`, DEFAULT_COLUMNS);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
  }

  const savedViews = useSavedViews({
    module: "deals",
    currentFilters: { searchApplied, viewMode, quickFilter, columns: columnVisibility },
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
      const nextColumns = (filters.columns as VisibilityState) ?? DEFAULT_COLUMNS;
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setViewMode(nextView);
      setQuickFilter(nextQuick);
      setColumnVisibility(nextColumns);
      showToast("Vista aplicada.", "success");
    }
  });

  const totalDeals = useMemo(() => stages.reduce((acc, stage) => acc + (byStage[stage]?.length ?? 0), 0), [byStage, stages]);

  const filteredRows = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searchableColumns = COLUMN_ORDER.filter((key) => columnVisibility[key] !== false);

    return stages.flatMap((stage) =>
      (byStage[stage] ?? [])
        .filter((card) => !q || searchableColumns.some((key) => fieldValue(stage, card, key).toLowerCase().includes(q)))
        .map((card) => ({ rowId: `${stage}-${card.id}`, stage, card }))
    );
  }, [byStage, columnVisibility, searchApplied, stages]);

  const filteredByQuickTab = useMemo(() => {
    if (quickFilter === "high_value") return filteredRows.filter((row) => parseAmountNumber(row.card.amount) >= 100000);
    if (quickFilter === "without_contact") return filteredRows.filter((row) => !row.card.contactId);
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

  const highValueCount = useMemo(() => filteredRows.filter((row) => parseAmountNumber(row.card.amount) >= 100000).length, [filteredRows]);
  const withoutContactCount = useMemo(() => filteredRows.filter((row) => !row.card.contactId).length, [filteredRows]);
  const close30dCount = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return filteredRows.filter((row) => {
      const parsed = new Date(row.card.closeDate);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed >= now && parsed <= in30;
    }).length;
  }, [filteredRows]);

  const columns = useMemo<ColumnDef<DealTableRow>[]>(() => [
    {
      id: "name",
      header: DEAL_LABELS.name,
      cell: ({ row }) => (
        <div className="contact-name-cell">
          <button className="contact-name-link" onClick={() => setSelectedDeal({ stage: row.original.stage, card: row.original.card })}>
            {row.original.card.name}
          </button>
          <button
            type="button"
            className="contact-preview-trigger"
            onClick={() => setSelectedDeal({ stage: row.original.stage, card: row.original.card })}
            aria-label={`Vista rápida de ${row.original.card.name}`}
          >
            <span className="toolbar-button-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span>
          </button>
        </div>
      )
    },
    {
      id: "amount",
      header: DEAL_LABELS.amount,
      cell: ({ row }) => formatAmountEur(row.original.card.amount)
    },
    {
      id: "closeDate",
      header: DEAL_LABELS.closeDate,
      cell: ({ row }) => row.original.card.closeDate || "--"
    },
    {
      id: "priority",
      header: DEAL_LABELS.priority,
      cell: ({ row }) => row.original.card.priority || "--"
    },
    {
      id: "stage",
      header: DEAL_LABELS.stage,
      cell: ({ row }) => row.original.stage
    },
    {
      id: "contactName",
      header: DEAL_LABELS.contactName,
      cell: ({ row }) =>
        row.original.card.contactId ? (
          <Link href={`/contacts/${row.original.card.contactId}`} className="contact-name-link">
            {row.original.card.contactName}
          </Link>
        ) : (
          row.original.card.contactName
        )
    },
    {
      id: "companyId",
      header: DEAL_LABELS.companyId,
      cell: ({ row }) => row.original.card.id
    },
    {
      id: "createdDate",
      header: DEAL_LABELS.createdDate,
      cell: ({ row }) => row.original.card.createdDate || "--"
    }
  ], []);

  const table = useReactTable({
    data: filteredByQuickTab,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.rowId,
    getCoreRowModel: getCoreRowModel()
  });

  function exportCsv() {
    const visibleColumns = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible());
    if (!visibleColumns.length) return;

    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };

    const csv = [
      visibleColumns.map((column) => DEAL_LABELS[column]).join(","),
      ...filteredByQuickTab.map((row) => visibleColumns.map((column) => escape(fieldValue(row.stage, row.card, column) || "--")).join(","))
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
    showToast("CSV exportado correctamente.", "info");
  }

  const visibleColumnCount = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;

  function toggleColumn(key: DealColumnKey) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleColumnCount === 1) return;
    column.toggleVisibility(!column.getIsVisible());
  }

  return (
    <>
      {toast ? (
        <div className={`crm-toast crm-toast-${toast.tone}`} role="status" aria-live="polite">
          <span className="crm-toast-dot" aria-hidden="true" />
          <span>{toast.message}</span>
        </div>
      ) : null}

      <div className="entity-toolbar">
        <input
          className="toolbar-search"
          placeholder="Buscar negocio o dato visible"
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
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as DealsViewMode)}>
              <option value="panel">Panel</option>
              <option value="table">Tabla</option>
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

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="entity-toolbar-trigger">
                <span className="toolbar-button-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Acciones</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="radix-menu-content" sideOffset={10} align="end">
                <div className="radix-menu-label">Columnas visibles</div>
                <div className="radix-menu-columns">
                  {COLUMN_ORDER.map((key) => (
                    <label key={key} className="radix-menu-checkbox-row">
                      <input type="checkbox" checked={table.getColumn(key)?.getIsVisible() ?? false} onChange={() => toggleColumn(key)} />
                      <span>{DEAL_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
                <DropdownMenu.Separator className="radix-menu-separator" />
                <DropdownMenu.Item
                  className="radix-menu-item"
                  onSelect={async (event) => {
                    event.preventDefault();
                    const name = window.prompt("Nombre de la vista");
                    if (!name) return;
                    await savedViews.saveCurrent(name);
                    showToast("Vista guardada.", "success");
                  }}
                >
                  Guardar vista
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="radix-menu-item"
                  disabled={!selectedViewId}
                  onSelect={async (event) => {
                    event.preventDefault();
                    if (!selectedViewId) return;
                    await savedViews.deleteView(selectedViewId);
                    setSelectedViewId("");
                    showToast("Vista eliminada.", "info");
                  }}
                >
                  Eliminar vista
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="radix-menu-item"
                  onSelect={(event) => {
                    event.preventDefault();
                    exportCsv();
                  }}
                >
                  Exportar CSV
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de negocios">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Todos</span>
        </button>
        <button
          className={quickFilter === "high_value" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("high_value")}
        >
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="report" className="crm-icon" /></span><span>Valor alto</span> <span className="contacts-badge">{highValueCount}</span>
        </button>
        <button
          className={quickFilter === "without_contact" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("without_contact")}
        >
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="contacts" className="crm-icon" /></span><span>Sin contacto</span> <span className="contacts-badge">{withoutContactCount}</span>
        </button>
        <button
          className={quickFilter === "close_30d" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("close_30d")}
        >
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="activity" className="crm-icon" /></span><span>Cierre 30 días</span> <span className="contacts-badge">{close30dCount}</span>
        </button>
      </div>

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
                    showToast(`Negocio movido a ${stage}.`, "info");
                  }}
                >
                  <header className="deals-column-header">
                    <span>{stage}</span>
                    <span className="deals-column-count">{cards.length}</span>
                  </header>
                  <div className="deals-column-body" style={isHover ? { outline: "2px dashed #94a3b8", outlineOffset: 2 } : undefined}>
                    {cards.map((card, index) => (
                      <motion.article
                        key={card.id}
                        className="deal-card"
                        draggable
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.18) }}
                        onDragStart={() => setDragState({ fromStage: stage, dealId: card.id })}
                        onDragEnd={() => {
                          setDragState(null);
                          setHoverStage(null);
                        }}
                      >
                        {table.getColumn("name")?.getIsVisible() ? (
                          <button className="deal-card-title deal-card-title-button" onClick={() => setSelectedDeal({ stage, card })}>
                            {card.name}
                          </button>
                        ) : null}
                        {table.getColumn("companyId")?.getIsVisible() ? <div>ID compañía: {card.id}</div> : null}
                        {table.getColumn("amount")?.getIsVisible() ? <div>Importe: {formatAmountEur(card.amount)}</div> : null}
                        {table.getColumn("closeDate")?.getIsVisible() ? <div>Fecha estimada de cierre: {card.closeDate}</div> : null}
                        {table.getColumn("priority")?.getIsVisible() ? <div>Prioridad: {card.priority}</div> : null}
                        {table.getColumn("createdDate")?.getIsVisible() ? <div>Fecha de creación: {card.createdDate}</div> : null}
                        {table.getColumn("contactName")?.getIsVisible() ? (
                          <>
                            <hr />
                            <div>
                              {card.contactId ? <Link href={`/contacts/${card.contactId}`}>{card.contactName}</Link> : card.contactName}
                            </div>
                          </>
                        ) : null}
                      </motion.article>
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
          <DataTable table={table} emptyLabel="Sin negocios." emptyHint="Todavía no hay negocios visibles con los filtros actuales." />
        </div>
      )}

      <Dialog.Root open={Boolean(selectedDeal)} onOpenChange={(open) => (!open ? setSelectedDeal(null) : null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="radix-dialog-overlay" />
          <Dialog.Content className="radix-sheet-content">
            {selectedDeal ? (
              <>
                <div className="radix-dialog-head">
                  <div>
                    <Dialog.Title>{selectedDeal.card.name}</Dialog.Title>
                    <Dialog.Description>{selectedDeal.stage}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="radix-dialog-close" aria-label="Cerrar">×</button>
                  </Dialog.Close>
                </div>

                <div className="contact-quick-sheet-meta">
                  <div className="contact-quick-sheet-item">
                    <span>Importe</span>
                    <strong>{formatAmountEur(selectedDeal.card.amount)}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Prioridad</span>
                    <strong>{selectedDeal.card.priority || "-"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Cierre estimado</span>
                    <strong>{selectedDeal.card.closeDate || "-"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Creación</span>
                    <strong>{selectedDeal.card.createdDate || "-"}</strong>
                  </div>
                </div>

                <div className="contact-quick-sheet-stack">
                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Contacto asociado</p>
                    <p className="contact-quick-sheet-copy">{selectedDeal.card.contactName || "Sin contacto asociado todavía."}</p>
                  </div>
                </div>

                <div className="radix-dialog-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="quick-pill quick-pill-ghost">Cerrar</button>
                  </Dialog.Close>
                  <Link href={`/investors/${selectedDeal.card.id}`} className="contacts-add">
                    <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="edit" className="crm-icon" /></span>
                    <span>Abrir cuenta</span>
                  </Link>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
