"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type HeaderContext,
  type Row,
  type SortingState,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";
import { useUserColumnVisibility } from "@/lib/ui/use-user-column-visibility";

type PipelineColumn = {
  key: string;
  label: string;
  type?: "text" | "link" | "badge" | "date" | "datetime" | "money";
  defaultVisible?: boolean;
};

type PipelineAction = {
  href: string;
  label: string;
  tone?: "ghost" | "danger";
};

type PipelineRow = {
  id: string;
  href?: string;
  values: Record<string, string>;
  actions?: PipelineAction[];
};

type TableRow = PipelineRow;

function parseDateLike(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return Number.NaN;
  const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
}

function parseMoneyLike(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function BusinessPipelineTable({
  activity3dOnly,
  activity3dHrefOn,
  activity3dHrefOff,
  overdueOnly,
  overdueHrefOn,
  overdueHrefOff,
  showTopControls = true,
  topAction,
  rows,
  columns,
  storageKeyPrefix,
  emptyLabel,
  emptyHint
}: {
  activity3dOnly?: boolean;
  activity3dHrefOn?: string;
  activity3dHrefOff?: string;
  overdueOnly: boolean;
  overdueHrefOn: string;
  overdueHrefOff: string;
  showTopControls?: boolean;
  topAction?: React.ReactNode;
  rows: PipelineRow[];
  columns: PipelineColumn[];
  storageKeyPrefix: string;
  emptyLabel: string;
  emptyHint: string;
}) {
  const router = useRouter();
  const columnOrder = columns.map((column) => column.key);
  const columnLabels = Object.fromEntries(columns.map((column) => [column.key, column.label])) as Record<string, string>;
  const defaultColumns = Object.fromEntries(columns.map((column) => [column.key, column.defaultVisible ?? true])) as VisibilityState;
  defaultColumns.actions = true;

  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("business", `${storageKeyPrefix}:columns`, defaultColumns);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const tableColumns: ColumnDef<TableRow>[] = [
    ...columns.map((column) => ({
      accessorKey: column.key,
      id: column.key,
      header: ({ column: tableColumn }: HeaderContext<TableRow, unknown>) => {
        const sortState = tableColumn.getIsSorted();
        const sortLabel = sortState === "asc" ? "↑" : sortState === "desc" ? "↓" : "";
        return (
          <button
            type="button"
            className="business-sort-trigger"
            onClick={() => tableColumn.toggleSorting(sortState === "asc")}
          >
            <span>{column.label}</span>
            <span className="business-sort-indicator" aria-hidden="true">
              {sortLabel}
            </span>
          </button>
        );
      },
      filterFn: (row: Row<TableRow>, columnId: string, filterValue: unknown) => {
        const raw = String(row.original.values[columnId] ?? "").toLowerCase();
        if (Array.isArray(filterValue)) {
          const selected = filterValue.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
          if (selected.length === 0) return true;
          return selected.includes(raw);
        }
        const query = String(filterValue ?? "").trim().toLowerCase();
        if (!query) return true;
        return raw.includes(query);
      },
      cell: ({ row }: { row: { original: TableRow } }) => {
        const value = row.original.values[column.key] ?? "--";
        if (column.type === "link") {
          return row.original.href ? (
            <Link href={row.original.href} className="deal-detail-inline-link">
              {value}
            </Link>
          ) : (
            <strong>{value}</strong>
          );
        }
        if (column.type === "badge") {
          return <span className="deal-state-pill">{value}</span>;
        }
        return value;
      },
      sortingFn: (rowA: Row<TableRow>, rowB: Row<TableRow>, columnId: string) => {
        const valueA = String(rowA.original.values[columnId] ?? "");
        const valueB = String(rowB.original.values[columnId] ?? "");

        if (column.type === "date" || column.type === "datetime") {
          return parseDateLike(valueA) - parseDateLike(valueB);
        }

        if (column.type === "money") {
          return parseMoneyLike(valueA) - parseMoneyLike(valueB);
        }

        return valueA.localeCompare(valueB, "es", { sensitivity: "base", numeric: true });
      }
    })),
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="deal-detail-links">
          {(row.original.actions ?? []).map((action) => (
            <Link
              key={`${row.original.id}:${action.href}:${action.label}`}
              href={action.href}
              className={action.tone === "danger" ? "quick-pill quick-pill-danger" : "quick-pill quick-pill-ghost"}
            >
              {action.label}
            </Link>
          ))}
        </div>
      )
    }
  ];

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { columnVisibility, columnFilters, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const visibleColumnCount = [...columnOrder, "actions"].filter((key) => table.getColumn(key)?.getIsVisible()).length;
  const columnOptions = useMemo(
    () =>
      Object.fromEntries(
        columnOrder.map((key) => [
          key,
          Array.from(new Set(rows.map((row) => String(row.values[key] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))
        ])
      ) as Record<string, string[]>,
    [columnOrder, rows]
  );
  const headerFilters = useMemo(
    () =>
      Object.fromEntries(
        columnOrder.map((key) => {
          const currentColumn = columns.find((column) => column.key === key);
          const currentFilter = table.getColumn(key)?.getFilterValue();

          if (currentColumn?.type === "badge") {
            const selectedValues = Array.isArray(currentFilter) ? currentFilter.map((value) => String(value)) : [];

            return [
              key,
              <DropdownMenu.Root key={`${key}-filter`}>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="business-column-filter business-column-filter-trigger">
                    <span>{selectedValues.length ? `${selectedValues.length} seleccionados` : "Todos"}</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="radix-menu-content business-filter-dropdown" sideOffset={8} align="start">
                    <div className="radix-menu-label">{`Filtrar ${currentColumn.label.toLowerCase()}`}</div>
                    <div className="radix-menu-columns">
                      {columnOptions[key].map((option) => {
                        const checked = selectedValues.includes(option);
                        return (
                          <label key={`${key}:${option}`} className="radix-menu-checkbox-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const nextValues = checked
                                  ? selectedValues.filter((value) => value !== option)
                                  : [...selectedValues, option];
                                table.getColumn(key)?.setFilterValue(nextValues.length ? nextValues : undefined);
                              }}
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="business-filter-clear"
                      onClick={() => table.getColumn(key)?.setFilterValue(undefined)}
                    >
                      Limpiar
                    </button>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ];
          }

          return [
            key,
            <input
              key={`${key}-filter`}
              value={String(currentFilter ?? "")}
              onChange={(event) => table.getColumn(key)?.setFilterValue(event.target.value)}
              className="business-column-filter"
              placeholder="Filtrar..."
            />
          ];
        })
      ),
    [columnOptions, columnOrder, columns, table]
  );

  function toggleColumn(key: string) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleColumnCount === 1) return;
    column.toggleVisibility(!column.getIsVisible());
  }

  return (
    <>
      {showTopControls ? (
        <div className="business-filter-form business-filter-form-inline">
          {activity3dHrefOn && activity3dHrefOff ? (
            <label className="business-overdue-toggle">
              <input
                type="checkbox"
                checked={Boolean(activity3dOnly)}
                onChange={(event) => router.push(event.target.checked ? activity3dHrefOn : activity3dHrefOff)}
              />
              <span>Ultima actividad (+3d)</span>
            </label>
          ) : null}

          <label className="business-overdue-toggle">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => router.push(event.target.checked ? overdueHrefOn : overdueHrefOff)}
            />
            <span>Ultima actividad (+7d)</span>
          </label>

          <div className="business-inline-toolbar">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="entity-toolbar-trigger">
                  <span className="toolbar-button-icon" aria-hidden="true">
                    <CrmIcon name="overview" className="crm-icon" />
                  </span>
                  <span>+ / - Columnas</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="radix-menu-content" sideOffset={10} align="end">
                  <div className="radix-menu-label">Columnas visibles</div>
                  <div className="radix-menu-columns">
                    {[...columnOrder, "actions"].map((key) => (
                      <label key={key} className="radix-menu-checkbox-row">
                        <input type="checkbox" checked={table.getColumn(key)?.getIsVisible() ?? false} onChange={() => toggleColumn(key)} />
                        <span>{columnLabels[key] ?? "Acciones"}</span>
                      </label>
                    ))}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          {topAction ?? null}
        </div>
      ) : (
        <div className="business-inline-toolbar business-inline-toolbar-solo">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="entity-toolbar-trigger">
                <span className="toolbar-button-icon" aria-hidden="true">
                  <CrmIcon name="overview" className="crm-icon" />
                </span>
                <span>+ / - Columnas</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="radix-menu-content" sideOffset={10} align="end">
                <div className="radix-menu-label">Columnas visibles</div>
                <div className="radix-menu-columns">
                  {[...columnOrder, "actions"].map((key) => (
                    <label key={key} className="radix-menu-checkbox-row">
                      <input type="checkbox" checked={table.getColumn(key)?.getIsVisible() ?? false} onChange={() => toggleColumn(key)} />
                      <span>{columnLabels[key] ?? "Acciones"}</span>
                    </label>
                  ))}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}

      <DataTable
        table={table}
        emptyLabel={emptyLabel}
        emptyHint={emptyHint}
        className="companies-table-wrap business-pipeline-table-wrap"
        headerFilters={headerFilters}
      />
    </>
  );
}
