"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";
import { useUserColumnVisibility } from "@/lib/ui/use-user-column-visibility";
import { INVESTOR_COLUMN_FILTER_KEYS, type InvestorColumnFilterState, type InvestorColumnKey } from "@/lib/ui/investor-table-filters";

type EditableInvestorRow = {
  id: string;
  name: string;
  category: string;
  website: string;
  strategy: string;
  status_name: string;
  sector: string;
  updated_at: string | null;
};

const COLUMN_ORDER: InvestorColumnKey[] = [...INVESTOR_COLUMN_FILTER_KEYS];

const COLUMN_LABELS: Record<InvestorColumnKey, string> = {
  id: "ID",
  name: "Nombre compania",
  category: "Categoria",
  website: "Web",
  strategy: "Estrategia",
  status_name: "Estado",
  sector: "Sector",
  updated_at: "Ultima actualizacion"
};

const DEFAULT_COLUMNS: VisibilityState = {
  id: false,
  name: true,
  category: true,
  website: true,
  strategy: true,
  status_name: false,
  sector: false,
  updated_at: true
};

function formatDateTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("es-ES");
}

function normalizeString(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function displayValue(row: EditableInvestorRow, key: InvestorColumnKey) {
  if (key === "updated_at") return formatDateTime(row.updated_at);
  return String(row[key as keyof EditableInvestorRow] ?? "");
}

export function ManageInvestorsTable({
  investors,
  returnTo
}: {
  investors: EditableInvestorRow[];
  returnTo: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableInvestorRow[]>(investors);
  const [columnFilters, setColumnFilters] = useState<InvestorColumnFilterState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("investors", "investors:manage:columns", DEFAULT_COLUMNS);

  function updateRow(investorId: string, field: keyof EditableInvestorRow, value: string) {
    setRows((current) => current.map((row) => (row.id === investorId ? { ...row, [field]: value } : row)));
  }

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, value]) => String(value ?? "").trim());
    if (activeFilters.length === 0) return rows;

    return rows.filter((row) =>
      activeFilters.every(([key, rawValue]) =>
        normalizeString(displayValue(row, key as InvestorColumnKey)).includes(normalizeString(rawValue))
      )
    );
  }, [columnFilters, rows]);

  const columns = useMemo<ColumnDef<EditableInvestorRow>[]>(
    () => [
      { accessorKey: "id", id: "id", header: "ID", cell: ({ row }) => row.original.id },
      {
        accessorKey: "name",
        id: "name",
        header: "Nombre compania",
        cell: ({ row }) => <input value={row.original.name} onChange={(event) => updateRow(row.original.id, "name", event.target.value)} />
      },
      {
        accessorKey: "category",
        id: "category",
        header: "Categoria",
        cell: ({ row }) => <input value={row.original.category} onChange={(event) => updateRow(row.original.id, "category", event.target.value)} />
      },
      {
        accessorKey: "website",
        id: "website",
        header: "Web",
        cell: ({ row }) => <input value={row.original.website} onChange={(event) => updateRow(row.original.id, "website", event.target.value)} />
      },
      {
        accessorKey: "strategy",
        id: "strategy",
        header: "Estrategia",
        cell: ({ row }) => <input value={row.original.strategy} onChange={(event) => updateRow(row.original.id, "strategy", event.target.value)} />
      },
      {
        accessorKey: "status_name",
        id: "status_name",
        header: "Estado",
        cell: ({ row }) => row.original.status_name || "--"
      },
      {
        accessorKey: "sector",
        id: "sector",
        header: "Sector",
        cell: ({ row }) => row.original.sector || "--"
      },
      {
        accessorKey: "updated_at",
        id: "updated_at",
        header: "Ultima actualizacion",
        cell: ({ row }) => formatDateTime(row.original.updated_at)
      }
    ],
    []
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { columnVisibility, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const visibleColumnCount = COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;

  function toggleColumn(key: InvestorColumnKey) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleColumnCount === 1) return;
    column.toggleVisibility(!column.getIsVisible());
  }

  async function applyChanges() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/investors/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investors: rows.map((row) => ({
            investor_id: row.id,
            name: row.name,
            category: row.category,
            website: row.website,
            strategy: row.strategy,
            status_name: row.status_name,
            sector: row.sector
          }))
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "No se pudieron aplicar los cambios");
      router.push(returnTo);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudieron aplicar los cambios");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="entity-toolbar">
        <div className="entity-toolbar-inline entity-toolbar-inline-full" style={{ justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="entity-toolbar-trigger contacts-columns-trigger">
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
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <Link href={returnTo} className="button-outline-success">
              Volver a companias
            </Link>
            <button type="button" className="editor-save-button" onClick={applyChanges} disabled={saving || rows.length === 0}>
              {saving ? "Aplicando..." : "Aplicar"}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}

      <DataTable
        table={table}
        className="companies-table-wrap"
        emptyLabel="Sin companias en la vista actual."
        emptyHint="Ajusta los filtros o vuelve a Companias para cambiar la vista de modificacion multiple."
        emptyAction={<Link href={returnTo} className="companies-tab">Volver</Link>}
        headerFilters={{
          id: <input value={columnFilters.id ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, id: event.target.value }))} placeholder="Filtrar" />,
          name: <input value={columnFilters.name ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, name: event.target.value }))} placeholder="Filtrar" />,
          category: <input value={columnFilters.category ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, category: event.target.value }))} placeholder="Filtrar" />,
          website: <input value={columnFilters.website ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, website: event.target.value }))} placeholder="Filtrar" />,
          strategy: <input value={columnFilters.strategy ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, strategy: event.target.value }))} placeholder="Filtrar" />,
          status_name: <input value={columnFilters.status_name ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, status_name: event.target.value }))} placeholder="Filtrar" />,
          sector: <input value={columnFilters.sector ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, sector: event.target.value }))} placeholder="Filtrar" />,
          updated_at: <input value={columnFilters.updated_at ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, updated_at: event.target.value }))} placeholder="Filtrar" />
        }}
      />
    </div>
  );
}
