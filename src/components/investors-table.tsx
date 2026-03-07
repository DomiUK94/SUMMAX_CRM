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
import type { ListedInvestor } from "@/lib/db/crm";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";

type InvestorColumnKey = "id" | "name" | "category" | "website" | "strategy" | "status_name" | "sector" | "updated_at";
type InvestorsViewMode = "table";
type InvestorsQuickFilter = "all" | "without_web" | "updated_7d";
type ToastTone = "success" | "error" | "info";

const COLUMN_ORDER: InvestorColumnKey[] = ["id", "name", "category", "website", "strategy", "status_name", "sector", "updated_at"];

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
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
  }

  const savedViews = useSavedViews({
    module: "investors",
    currentFilters: { searchApplied, viewMode, quickFilter, columns: columnVisibility },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextView = "table";
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
      showToast("Vista aplicada.", "success");
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
    showToast("CSV exportado correctamente.", "info");
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
        <div className="contact-name-cell">
          <button
            type="button"
            className="contact-name-link"
            onClick={() => setSelected(row.original)}
            aria-label={`Vista rápida de ${row.original.name}`}
          >
            {displayInvestorValue(row.original, "name")}
          </button>
        </div>
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
      {toast ? (
        <div className={`crm-toast crm-toast-${toast.tone}`} role="status" aria-live="polite">
          <span className="crm-toast-dot" aria-hidden="true" />
          <span>{toast.message}</span>
        </div>
      ) : null}

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
            <select value={viewMode} onChange={() => setViewMode("table")}>
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
                      <span>{INVESTOR_LABELS[key]}</span>
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

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de cuentas">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Todas</span>
        </button>
        <button
          className={quickFilter === "without_web" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("without_web")}
        >
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="search" className="crm-icon" /></span><span>Sin web</span> <span className="contacts-badge">{noWebCount}</span>
        </button>
        <button
          className={quickFilter === "updated_7d" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("updated_7d")}
        >
          <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="activity" className="crm-icon" /></span><span>Actualizadas 7 días</span> <span className="contacts-badge">{updated7dCount}</span>
        </button>
      </div>

      <DataTable
        table={table}
        emptyLabel="Sin cuentas."
        emptyHint="Ajusta los filtros o crea una nueva cuenta para empezar a mover el pipeline."
        className="companies-table-wrap"
      />

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => (!open ? setSelected(null) : null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="radix-dialog-overlay" />
          <Dialog.Content className="radix-sheet-content">
            {selected ? (
              <>
                <div className="radix-dialog-head">
                  <div>
                    <Dialog.Title>{selected.name}</Dialog.Title>
                    <Dialog.Description>{selected.category ?? "Sin categoría asignada"}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="radix-dialog-close" aria-label="Cerrar">×</button>
                  </Dialog.Close>
                </div>

                <div className="contact-quick-sheet-meta">
                  <div className="contact-quick-sheet-item">
                    <span>Web</span>
                    <strong>{selected.website ?? "Sin web"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Estrategia</span>
                    <strong>{selected.strategy ?? "Sin estrategia"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Estado</span>
                    <strong>{selected.status_name ?? "Sin estado"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Última actualización</span>
                    <strong>{selected.updated_at ? new Date(selected.updated_at).toLocaleString("es-ES") : "-"}</strong>
                  </div>
                </div>

                <div className="contact-quick-sheet-stack">
                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Sector</p>
                    <p className="contact-quick-sheet-copy">{selected.sector ?? "Sin sector consolidado todavía."}</p>
                  </div>
                </div>

                <div className="radix-dialog-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="quick-pill quick-pill-ghost">Cerrar</button>
                  </Dialog.Close>
                  <Link href={`/investors/${encodeURIComponent(selected.id)}`} className="contacts-add">
                    <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="edit" className="crm-icon" /></span>
                    <span>Abrir ficha completa</span>
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
