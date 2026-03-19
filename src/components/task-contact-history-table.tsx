"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";
import { useUserColumnVisibility } from "@/lib/ui/use-user-column-visibility";

type ContactHistoryColumnKey = "contact_name" | "count" | "last_at" | "task_names" | "entity_names" | "actions";

type ContactHistoryRow = {
  contactId: number;
  contactName: string;
  count: number;
  lastAt: string;
  taskNames: string;
  entityNames: string;
  historyHref: string;
};

const COLUMN_ORDER: ContactHistoryColumnKey[] = ["contact_name", "count", "last_at", "task_names", "entity_names", "actions"];

const COLUMN_LABELS: Record<ContactHistoryColumnKey, string> = {
  contact_name: "Contacto",
  count: "Tareas",
  last_at: "Ultima tarea",
  task_names: "Ultima tarea",
  entity_names: "Estado contacto",
  actions: "Acciones"
};

const DEFAULT_COLUMNS: VisibilityState = {
  contact_name: true,
  count: true,
  last_at: true,
  task_names: true,
  entity_names: true,
  actions: true
};

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

export function TaskContactHistoryTable({
  rows,
  storageKeyPrefix
}: {
  rows: ContactHistoryRow[];
  storageKeyPrefix?: string;
}) {
  const prefix = storageKeyPrefix ?? "task-contact-history";
  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("business", `${prefix}:columns`, DEFAULT_COLUMNS);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<ContactHistoryRow>[] = [
    {
      accessorKey: "contact_name",
      id: "contact_name",
      header: ({ column }) => <SortHeader label={COLUMN_LABELS.contact_name} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => <strong>{row.original.contactName}</strong>,
      filterFn: (row, columnId, filterValue) => row.original.contactName.toLowerCase().includes(String(filterValue ?? "").trim().toLowerCase()),
      sortingFn: (rowA, rowB) => rowA.original.contactName.localeCompare(rowB.original.contactName, "es", { sensitivity: "base", numeric: true })
    },
    {
      accessorKey: "count",
      id: "count",
      header: ({ column }) => <SortHeader label={COLUMN_LABELS.count} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => row.original.count,
      filterFn: (row, columnId, filterValue) => String(row.original.count).toLowerCase().includes(String(filterValue ?? "").trim().toLowerCase()),
      sortingFn: (rowA, rowB) => rowA.original.count - rowB.original.count
    },
    {
      accessorKey: "last_at",
      id: "last_at",
      header: ({ column }) => <SortHeader label={COLUMN_LABELS.last_at} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => row.original.lastAt,
      filterFn: (row, columnId, filterValue) => row.original.lastAt.toLowerCase().includes(String(filterValue ?? "").trim().toLowerCase()),
      sortingFn: (rowA, rowB) => rowA.original.lastAt.localeCompare(rowB.original.lastAt, "es", { sensitivity: "base", numeric: true })
    },
    {
      accessorKey: "task_names",
      id: "task_names",
      header: ({ column }) => <SortHeader label={COLUMN_LABELS.task_names} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => row.original.taskNames,
      filterFn: (row, columnId, filterValue) => row.original.taskNames.toLowerCase().includes(String(filterValue ?? "").trim().toLowerCase()),
      sortingFn: (rowA, rowB) => rowA.original.taskNames.localeCompare(rowB.original.taskNames, "es", { sensitivity: "base", numeric: true })
    },
    {
      accessorKey: "entity_names",
      id: "entity_names",
      header: ({ column }) => <SortHeader label={COLUMN_LABELS.entity_names} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => row.original.entityNames,
      filterFn: (row, columnId, filterValue) => row.original.entityNames.toLowerCase().includes(String(filterValue ?? "").trim().toLowerCase()),
      sortingFn: (rowA, rowB) => rowA.original.entityNames.localeCompare(rowB.original.entityNames, "es", { sensitivity: "base", numeric: true })
    },
    {
      id: "actions",
      header: COLUMN_LABELS.actions,
      cell: ({ row }) => (
        <Link href={row.original.historyHref} className="quick-pill quick-pill-ghost">
          Ver historial
        </Link>
      )
    }
  ];

  const table = useReactTable({
    data: rows,
    columns,
    state: { columnVisibility, columnFilters, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const headerFilters = useMemo(
    () => ({
      contact_name: <input value={String(table.getColumn("contact_name")?.getFilterValue() ?? "")} onChange={(event) => table.getColumn("contact_name")?.setFilterValue(event.target.value)} className="business-column-filter" placeholder="Filtrar..." />,
      count: <input value={String(table.getColumn("count")?.getFilterValue() ?? "")} onChange={(event) => table.getColumn("count")?.setFilterValue(event.target.value)} className="business-column-filter" placeholder="Filtrar..." />,
      last_at: <input value={String(table.getColumn("last_at")?.getFilterValue() ?? "")} onChange={(event) => table.getColumn("last_at")?.setFilterValue(event.target.value)} className="business-column-filter" placeholder="Filtrar..." />,
      task_names: <input value={String(table.getColumn("task_names")?.getFilterValue() ?? "")} onChange={(event) => table.getColumn("task_names")?.setFilterValue(event.target.value)} className="business-column-filter" placeholder="Filtrar..." />,
      entity_names: <input value={String(table.getColumn("entity_names")?.getFilterValue() ?? "")} onChange={(event) => table.getColumn("entity_names")?.setFilterValue(event.target.value)} className="business-column-filter" placeholder="Filtrar..." />
    }),
    [table]
  );

  const visibleColumnCount = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;

  function toggleColumn(key: ContactHistoryColumnKey) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleColumnCount === 1) return;
    column.toggleVisibility(!column.getIsVisible());
  }

  return (
    <>
      <div className="entity-toolbar">
        <div className="entity-toolbar-inline">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="entity-toolbar-trigger task-history-columns-trigger">
                <span>+ / - Columnas</span>
                <span className="toolbar-button-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="radix-menu-content" sideOffset={10} align="end">
                <div className="radix-menu-label">Columnas visibles</div>
                <div className="radix-menu-columns">
                  {COLUMN_ORDER.map((key) => (
                    <label key={key} className="radix-menu-checkbox-row">
                      <input type="checkbox" checked={table.getColumn(key)?.getIsVisible() ?? false} onChange={() => toggleColumn(key)} />
                      <span>{COLUMN_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <DataTable
        table={table}
        emptyLabel="Sin tareas por contacto."
        emptyHint="No hay historial disponible para los filtros actuales."
        className="task-contact-history-table-wrap"
        headerFilters={headerFilters}
      />
    </>
  );
}
