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
import { CONTACT_COLUMN_FILTER_KEYS, type ContactColumnFilterState, type ContactColumnKey } from "@/lib/ui/contact-table-filters";

type OwnerOption = { id: string; email: string; full_name?: string | null };

type EditableContactRow = {
  id: string;
  investor_name: string | null;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  other_contact: string;
  linkedin: string;
  comments: string;
  is_financier: "Si" | "No";
  is_prescriber: "Si" | "No";
  owner_user_id: string;
  owner_email: string | null;
  updated_at: string | null;
};

const EDITABLE_COLUMN_ORDER: ContactColumnKey[] = [
  "id",
  "full_name",
  "investor_name",
  "is_financier",
  "is_prescriber",
  "owner_email",
  "email",
  "phone",
  "role",
  "other_contact",
  "linkedin",
  "comments",
  "updated_at"
];

const COLUMN_LABELS: Record<ContactColumnKey, string> = {
  id: "ID",
  full_name: "Contacto",
  investor_name: "Compania",
  is_financier: "Es financiador",
  is_prescriber: "Es preescriptor",
  owner_email: "Propietario contacto",
  owner_user_id: "ID propietario",
  email: "Email",
  phone: "Telefono",
  role: "Rol",
  other_contact: "Otro contacto",
  linkedin: "LinkedIn",
  comments: "Comentarios",
  updated_at: "Ultima actualizacion",
  days_without_action: "Dias sin accion",
  follow_up_status: "Seguimiento"
};

const DEFAULT_COLUMNS: VisibilityState = {
  id: false,
  full_name: true,
  investor_name: true,
  is_financier: true,
  is_prescriber: true,
  owner_email: true,
  email: true,
  phone: true,
  role: true,
  other_contact: false,
  linkedin: false,
  comments: true,
  updated_at: false
};

function formatDateTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("es-ES");
}

function normalizeString(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function displayValue(row: EditableContactRow, key: ContactColumnKey) {
  if (key === "updated_at") return formatDateTime(row.updated_at);
  return String(row[key as keyof EditableContactRow] ?? "");
}

export function ManageContactsTable({
  contacts,
  owners,
  returnTo
}: {
  contacts: EditableContactRow[];
  owners: OwnerOption[];
  returnTo: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableContactRow[]>(contacts);
  const [columnFilters, setColumnFilters] = useState<ContactColumnFilterState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("contacts", "contacts:manage:columns", DEFAULT_COLUMNS);

  function updateRow(contactId: string, field: keyof EditableContactRow, value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== contactId) return row;
        if (field === "owner_user_id") {
          const owner = owners.find((entry) => entry.id === value) ?? null;
          return {
            ...row,
            owner_user_id: value,
            owner_email: owner?.email ?? null
          };
        }
        return { ...row, [field]: value };
      })
    );
  }

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, value]) => String(value ?? "").trim());
    if (activeFilters.length === 0) return rows;

    return rows.filter((row) =>
      activeFilters.every(([key, rawValue]) => {
        const value = String(rawValue ?? "").trim();
        if (!value) return true;
        if (key === "owner_email") return row.owner_user_id === value;
        return normalizeString(displayValue(row, key as ContactColumnKey)).includes(normalizeString(value));
      })
    );
  }, [columnFilters, rows]);

  const columns = useMemo<ColumnDef<EditableContactRow>[]>(
    () => [
      {
        accessorKey: "id",
        id: "id",
        header: "ID",
        cell: ({ row }) => row.original.id
      },
      {
        accessorKey: "full_name",
        id: "full_name",
        header: "Contacto",
        cell: ({ row }) => (
          <input value={row.original.full_name} onChange={(event) => updateRow(row.original.id, "full_name", event.target.value)} />
        ),
        sortingFn: (rowA, rowB) => rowA.original.full_name.localeCompare(rowB.original.full_name, "es", { sensitivity: "base", numeric: true })
      },
      {
        accessorKey: "investor_name",
        id: "investor_name",
        header: "Compania",
        cell: ({ row }) => row.original.investor_name ?? "--"
      },
      {
        accessorKey: "is_financier",
        id: "is_financier",
        header: "Es financiador",
        cell: ({ row }) => (
          <select value={row.original.is_financier} onChange={(event) => updateRow(row.original.id, "is_financier", event.target.value)}>
            <option value="No">No</option>
            <option value="Si">Si</option>
          </select>
        )
      },
      {
        accessorKey: "is_prescriber",
        id: "is_prescriber",
        header: "Es preescriptor",
        cell: ({ row }) => (
          <select value={row.original.is_prescriber} onChange={(event) => updateRow(row.original.id, "is_prescriber", event.target.value)}>
            <option value="No">No</option>
            <option value="Si">Si</option>
          </select>
        )
      },
      {
        accessorKey: "owner_email",
        id: "owner_email",
        header: "Propietario contacto",
        cell: ({ row }) => (
          <select value={row.original.owner_user_id} onChange={(event) => updateRow(row.original.id, "owner_user_id", event.target.value)}>
            <option value="">Sin propietario</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name?.trim() || owner.email}
              </option>
            ))}
          </select>
        )
      },
      {
        accessorKey: "email",
        id: "email",
        header: "Email",
        cell: ({ row }) => <input value={row.original.email} onChange={(event) => updateRow(row.original.id, "email", event.target.value)} />
      },
      {
        accessorKey: "phone",
        id: "phone",
        header: "Telefono",
        cell: ({ row }) => <input value={row.original.phone} onChange={(event) => updateRow(row.original.id, "phone", event.target.value)} />
      },
      {
        accessorKey: "role",
        id: "role",
        header: "Rol",
        cell: ({ row }) => <input value={row.original.role} onChange={(event) => updateRow(row.original.id, "role", event.target.value)} />
      },
      {
        accessorKey: "other_contact",
        id: "other_contact",
        header: "Otro contacto",
        cell: ({ row }) => (
          <input value={row.original.other_contact} onChange={(event) => updateRow(row.original.id, "other_contact", event.target.value)} />
        )
      },
      {
        accessorKey: "linkedin",
        id: "linkedin",
        header: "LinkedIn",
        cell: ({ row }) => <input value={row.original.linkedin} onChange={(event) => updateRow(row.original.id, "linkedin", event.target.value)} />
      },
      {
        accessorKey: "comments",
        id: "comments",
        header: "Comentarios",
        cell: ({ row }) => <textarea rows={2} value={row.original.comments} onChange={(event) => updateRow(row.original.id, "comments", event.target.value)} />
      },
      {
        accessorKey: "updated_at",
        id: "updated_at",
        header: "Ultima actualizacion",
        cell: ({ row }) => formatDateTime(row.original.updated_at)
      }
    ],
    [owners, rows]
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

  const visibleColumnCount = EDITABLE_COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;

  function toggleColumn(key: ContactColumnKey) {
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
      const response = await fetch("/api/contacts/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: rows.map((row) => ({
            contact_id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            role: row.role,
            other_contact: row.other_contact,
            linkedin: row.linkedin,
            comments: row.comments,
            is_financier: row.is_financier === "Si",
            is_prescriber: row.is_prescriber === "Si",
            owner_user_id: row.owner_user_id || null
          }))
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudieron aplicar los cambios");
      }
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
        <div className="entity-toolbar-inline entity-toolbar-inline-full">
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
                  {EDITABLE_COLUMN_ORDER.map((key) => (
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
        className="contacts-table-wrap"
        emptyLabel="Sin contactos seleccionados."
        emptyHint="Vuelve a Contactos y marca al menos una fila para usar la modificación múltiple."
        emptyAction={
          <Link href={returnTo} className="contacts-tab">
            Volver
          </Link>
        }
        headerFilters={{
          id: <input value={columnFilters.id ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, id: event.target.value }))} placeholder="Filtrar" />,
          full_name: <input value={columnFilters.full_name ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, full_name: event.target.value }))} placeholder="Filtrar" />,
          investor_name: <input value={columnFilters.investor_name ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, investor_name: event.target.value }))} placeholder="Filtrar" />,
          is_financier: <select value={columnFilters.is_financier ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, is_financier: event.target.value }))}><option value="">Todos</option><option value="Si">Si</option><option value="No">No</option></select>,
          is_prescriber: <select value={columnFilters.is_prescriber ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, is_prescriber: event.target.value }))}><option value="">Todos</option><option value="Si">Si</option><option value="No">No</option></select>,
          owner_email: <select value={columnFilters.owner_email ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, owner_email: event.target.value }))}><option value="">Todos</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name?.trim() || owner.email}</option>)}</select>,
          email: <input value={columnFilters.email ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, email: event.target.value }))} placeholder="Filtrar" />,
          phone: <input value={columnFilters.phone ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, phone: event.target.value }))} placeholder="Filtrar" />,
          role: <input value={columnFilters.role ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, role: event.target.value }))} placeholder="Filtrar" />,
          other_contact: <input value={columnFilters.other_contact ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, other_contact: event.target.value }))} placeholder="Filtrar" />,
          linkedin: <input value={columnFilters.linkedin ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, linkedin: event.target.value }))} placeholder="Filtrar" />,
          comments: <input value={columnFilters.comments ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, comments: event.target.value }))} placeholder="Filtrar" />,
          updated_at: <input value={columnFilters.updated_at ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, updated_at: event.target.value }))} placeholder="Filtrar" />
        }}
      />

      <div className="form-actions-bar-manage-contacts">
        <Link href={returnTo} className="button-outline-success">
          Volver sin guardar
        </Link>
        <div className="table-filter-actions-center">
          {error ? <div className="notice notice-error">{error}</div> : null}
        </div>
        <button type="button" className="editor-save-button" onClick={applyChanges} disabled={saving || rows.length === 0}>
          {saving ? "Aplicando..." : "Aplicar"}
        </button>
      </div>
    </div>
  );
}
