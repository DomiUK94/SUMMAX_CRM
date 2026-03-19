"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import type { ListedInvestor } from "@/lib/db/crm";
import {
  INVESTOR_COLUMN_FILTER_KEYS,
  readInvestorColumnFiltersFromUrlSearchParams,
  writeInvestorColumnFiltersToUrlSearchParams,
  type InvestorColumnFilterState,
  type InvestorColumnKey
} from "@/lib/ui/investor-table-filters";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useUserColumnVisibility } from "@/lib/ui/use-user-column-visibility";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";

type InvestorsViewMode = "table";
type InvestorsQuickFilter = "all" | "without_web" | "updated_7d";
type ToastTone = "success" | "error" | "info";

const COLUMN_ORDER: InvestorColumnKey[] = [...INVESTOR_COLUMN_FILTER_KEYS];

const INVESTOR_LABELS: Record<InvestorColumnKey, string> = {
  id: "ID",
  name: "Nombre compañia",
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

function SortHeader({
  label,
  sortState,
  onClick
}: {
  label: string;
  sortState: false | "asc" | "desc";
  onClick: () => void;
}) {
  const arrow = sortState === "asc" ? "↑" : sortState === "desc" ? "↓" : "";
  return (
    <button type="button" className="business-sort-trigger" onClick={onClick}>
      <span>{label}</span>
      <span className="business-sort-indicator" aria-hidden="true">
        {arrow}
      </span>
    </button>
  );
}

export function InvestorsTable({
  investors,
  quickCounts,
  storageKeyPrefix
}: {
  investors: ListedInvestor[];
  quickCounts?: { withoutWebCount: number; updated7dCount: number };
  storageKeyPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefix = storageKeyPrefix ?? "investors";
  const appliedColumnFilters = useMemo(
    () => readInvestorColumnFiltersFromUrlSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const currentSearch = searchParams.get("q")?.trim() ?? "";
  const [selected, setSelected] = useState<ListedInvestor | null>(null);
  const [searchDraft, setSearchDraft] = useState(currentSearch);
  const [columnFiltersDraft, setColumnFiltersDraft] = useState<InvestorColumnFilterState>(appliedColumnFilters);
  const [viewMode, setViewMode] = usePersistedState<InvestorsViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<InvestorsQuickFilter>(`${prefix}:quick_filter`, "all");
  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("investors", `${prefix}:columns`, DEFAULT_COLUMNS);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setSearchDraft(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    setColumnFiltersDraft(appliedColumnFilters);
  }, [appliedColumnFilters]);

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
  }

  const filteredInvestors = useMemo(() => {
    if (quickFilter === "without_web") return investors.filter((row) => !hasWebsite(row.website));
    if (quickFilter === "updated_7d") return investors.filter((row) => wasUpdatedInDays(row.updated_at, 7));
    return investors;
  }, [investors, quickFilter]);

  function replaceWithParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function applySearch() {
    replaceWithParams((params) => {
      const value = searchDraft.trim();
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      params.set("page", "1");
    });
  }

  function updateColumnFilter(key: InvestorColumnKey, value: string) {
    const nextFilters = { ...columnFiltersDraft, [key]: value };
    setColumnFiltersDraft(nextFilters);
    replaceWithParams((params) => {
      writeInvestorColumnFiltersToUrlSearchParams(params, nextFilters);
      params.set("page", "1");
    });
  }

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
    a.download = `companias-${new Date().toISOString().slice(0, 10)}.csv`;
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
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.id} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => row.original.id,
      sortingFn: (rowA, rowB) => rowA.original.id.localeCompare(rowB.original.id, "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "name",
      id: "name",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.name} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
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
      ),
      sortingFn: (rowA, rowB) => displayInvestorValue(rowA.original, "name").localeCompare(displayInvestorValue(rowB.original, "name"), "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "category",
      id: "category",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.category} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => displayInvestorValue(row.original, "category"),
      sortingFn: (rowA, rowB) => displayInvestorValue(rowA.original, "category").localeCompare(displayInvestorValue(rowB.original, "category"), "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "website",
      id: "website",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.website} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => displayInvestorValue(row.original, "website"),
      sortingFn: (rowA, rowB) => displayInvestorValue(rowA.original, "website").localeCompare(displayInvestorValue(rowB.original, "website"), "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "strategy",
      id: "strategy",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.strategy} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => displayInvestorValue(row.original, "strategy"),
      sortingFn: (rowA, rowB) => displayInvestorValue(rowA.original, "strategy").localeCompare(displayInvestorValue(rowB.original, "strategy"), "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "status_name",
      id: "status_name",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.status_name} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => displayInvestorValue(row.original, "status_name"),
      sortingFn: (rowA, rowB) => displayInvestorValue(rowA.original, "status_name").localeCompare(displayInvestorValue(rowB.original, "status_name"), "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "sector",
      id: "sector",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.sector} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => displayInvestorValue(row.original, "sector"),
      sortingFn: (rowA, rowB) => displayInvestorValue(rowA.original, "sector").localeCompare(displayInvestorValue(rowB.original, "sector"), "es", { numeric: true, sensitivity: "base" })
    },
    {
      accessorKey: "updated_at",
      id: "updated_at",
      header: ({ column }) => <SortHeader label={INVESTOR_LABELS.updated_at} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => displayInvestorValue(row.original, "updated_at"),
      sortingFn: (rowA, rowB) => new Date(rowA.original.updated_at ?? 0).getTime() - new Date(rowB.original.updated_at ?? 0).getTime()
    }
  ], []);

  const table = useReactTable({
    data: filteredInvestors,
    columns,
    state: { columnVisibility, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const visibleColumnCount = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;
  const noWebCount = quickCounts?.withoutWebCount ?? investors.filter((row) => !hasWebsite(row.website)).length;
  const updated7dCount = quickCounts?.updated7dCount ?? investors.filter((row) => wasUpdatedInDays(row.updated_at, 7)).length;

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
          placeholder="Buscar compañia o dato visible"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applySearch();
            }
          }}
        />
        <button onClick={applySearch}>Aplicar</button>
        <div className="entity-toolbar-inline">
          <div className="entity-toolbar-section entity-toolbar-view">
            <span className="entity-toolbar-section-title">Vista</span>
            <select value={viewMode} onChange={() => setViewMode("table")}>
              <option value="table">Tabla</option>
            </select>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="entity-toolbar-trigger">
                <span className="toolbar-button-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>+ / - Columnas</span>
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
        emptyLabel="Sin compañias."
        emptyHint="Ajusta los filtros o crea una nueva compañia para empezar a mover el pipeline."
        className="companies-table-wrap"
        headerFilters={{
          id: <input value={columnFiltersDraft.id ?? ""} onChange={(event) => updateColumnFilter("id", event.target.value)} placeholder="Filtrar" />,
          name: <input value={columnFiltersDraft.name ?? ""} onChange={(event) => updateColumnFilter("name", event.target.value)} placeholder="Filtrar" />,
          category: <input value={columnFiltersDraft.category ?? ""} onChange={(event) => updateColumnFilter("category", event.target.value)} placeholder="Filtrar" />,
          website: <input value={columnFiltersDraft.website ?? ""} onChange={(event) => updateColumnFilter("website", event.target.value)} placeholder="Filtrar" />,
          strategy: <input value={columnFiltersDraft.strategy ?? ""} onChange={(event) => updateColumnFilter("strategy", event.target.value)} placeholder="Filtrar" />,
          status_name: <input value={columnFiltersDraft.status_name ?? ""} onChange={(event) => updateColumnFilter("status_name", event.target.value)} placeholder="Filtrar" />,
          sector: <input value={columnFiltersDraft.sector ?? ""} onChange={(event) => updateColumnFilter("sector", event.target.value)} placeholder="Filtrar" />,
          updated_at: <input value={columnFiltersDraft.updated_at ?? ""} onChange={(event) => updateColumnFilter("updated_at", event.target.value)} placeholder="AAAA-MM-DD" />
        }}
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
                    <button type="button" className="radix-dialog-close" aria-label="Cerrar"><CrmIcon name="close" className="crm-icon" /></button>
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
                    <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="report" className="crm-icon" /></span>
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



