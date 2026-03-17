"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { getCoreRowModel, type ColumnDef, type VisibilityState, useReactTable } from "@tanstack/react-table";
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
  entity_names: "Entidades",
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

export function TaskContactHistoryTable({
  rows,
  storageKeyPrefix
}: {
  rows: ContactHistoryRow[];
  storageKeyPrefix?: string;
}) {
  const prefix = storageKeyPrefix ?? "task-contact-history";
  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("business", `${prefix}:columns`, DEFAULT_COLUMNS);

  const columns: ColumnDef<ContactHistoryRow>[] = [
    {
      accessorKey: "contact_name",
      id: "contact_name",
      header: COLUMN_LABELS.contact_name,
      cell: ({ row }) => <strong>{row.original.contactName}</strong>
    },
    {
      accessorKey: "count",
      id: "count",
      header: COLUMN_LABELS.count,
      cell: ({ row }) => row.original.count
    },
    {
      accessorKey: "last_at",
      id: "last_at",
      header: COLUMN_LABELS.last_at,
      cell: ({ row }) => row.original.lastAt
    },
    {
      accessorKey: "task_names",
      id: "task_names",
      header: COLUMN_LABELS.task_names,
      cell: ({ row }) => row.original.taskNames
    },
    {
      accessorKey: "entity_names",
      id: "entity_names",
      header: COLUMN_LABELS.entity_names,
      cell: ({ row }) => row.original.entityNames
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
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel()
  });

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
              <button type="button" className="entity-toolbar-trigger">
                <span className="toolbar-button-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span>
                <span>+ / - Columnas</span>
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
      />
    </>
  );
}
