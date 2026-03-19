"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import type { ListedContact } from "@/lib/db/crm";
import {
  CONTACT_COLUMN_FILTER_KEYS,
  readContactColumnFiltersFromUrlSearchParams,
  writeContactColumnFiltersToUrlSearchParams,
  type ContactColumnFilterState,
  type ContactColumnKey
} from "@/lib/ui/contact-table-filters";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useUserColumnVisibility } from "@/lib/ui/use-user-column-visibility";
import { ContactEmailDialog } from "@/components/contact-email-dialog";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";

type OwnerOption = { id: string; email: string; full_name?: string | null };
type ToastTone = "success" | "error" | "info";

type ContactsViewMode = "table" | "timeline";
type ContactsQuickFilter = "all" | "needs_action" | "critical";
const DATA_COLUMN_ORDER: ContactColumnKey[] = [...CONTACT_COLUMN_FILTER_KEYS];

const COLUMN_LABELS: Record<ContactColumnKey, string> = {
  id: "ID",
  full_name: "Contacto",
  investor_name: "Compa\u00f1ia",
  is_financier: "Es Financiador",
  is_prescriber: "Es Preescriptor",
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

const FOLLOW_UP_OPTIONS = ["rojo", "ambar", "verde"] as const;

const DEFAULT_COLUMNS: VisibilityState = {
  id: false,
  full_name: true,
  investor_name: true,
  is_financier: true,
  is_prescriber: true,
  owner_email: true,
  owner_user_id: false,
  email: false,
  phone: false,
  role: false,
  other_contact: false,
  linkedin: false,
  comments: false,
  updated_at: false,
  days_without_action: true,
  follow_up_status: true
};

function daysWithoutAction(updatedAt: string | null): number {
  if (!updatedAt) return 999;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function toTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.trim().replace(/[^+\d]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function followUpLevel(updatedAt: string | null): "rojo" | "ambar" | "verde" {
  const days = daysWithoutAction(updatedAt);
  if (days > 14) return "rojo";
  if (days > 7) return "ambar";
  return "verde";
}

function displayValue(contact: ListedContact, key: ContactColumnKey): string {
  if (key === "updated_at") return contact.updated_at ? new Date(contact.updated_at).toLocaleString("es-ES") : "--";
  if (key === "days_without_action") return String(daysWithoutAction(contact.updated_at));
  if (key === "follow_up_status") return followUpLevel(contact.updated_at);
  const raw = contact[key as keyof ListedContact];
  return raw == null || raw === "" ? "--" : String(raw);
}

function fieldSavedMessage(field: "owner_user_id" | "email" | "telefono") {
  if (field === "owner_user_id") return "Propietario actualizado.";
  if (field === "email") return "Email actualizado.";
  return "Telefono actualizado.";
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

export function ContactsTable({
  contacts,
  owners,
  quickCounts,
  storageKeyPrefix
}: {
  contacts: ListedContact[];
  owners: OwnerOption[];
  quickCounts?: { needsActionCount: number; criticalCount: number };
  storageKeyPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefix = storageKeyPrefix ?? "contacts";

  const appliedColumnFilters = useMemo(
    () => readContactColumnFiltersFromUrlSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const [columnFiltersDraft, setColumnFiltersDraft] = useState<ContactColumnFilterState>(appliedColumnFilters);
  const [ownerToAssign, setOwnerToAssign] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [inlineBusyKey, setInlineBusyKey] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedState<ContactsViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<ContactsQuickFilter>(`${prefix}:quick_filter`, "all");
  const { columnVisibility, setColumnVisibility } = useUserColumnVisibility("contacts", `${prefix}:columns`, DEFAULT_COLUMNS);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [quickViewContact, setQuickViewContact] = useState<ListedContact | null>(null);
  const [phonePreviewOpen, setPhonePreviewOpen] = useState(false);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setPhonePreviewOpen(false);
  }, [quickViewContact?.id]);

  useEffect(() => {
    setColumnFiltersDraft(appliedColumnFilters);
  }, [appliedColumnFilters]);

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
  }

  const filteredContacts = useMemo(() => {
    const matchesColumnFilter = (contact: ListedContact, key: ContactColumnKey, rawValue: string) => {
      const value = rawValue.trim().toLowerCase();
      if (!value) return true;
      if (key === "owner_email") return (contact.owner_user_id ?? "") === rawValue;
      if (key === "follow_up_status") return followUpLevel(contact.updated_at) === value;
      return displayValue(contact, key).toLowerCase().includes(value);
    };

    const searched = contacts.filter((contact) =>
      Object.entries(appliedColumnFilters).every(([key, value]) => matchesColumnFilter(contact, key as ContactColumnKey, String(value ?? "")))
    );

    if (quickFilter === "needs_action") return searched.filter((contact) => daysWithoutAction(contact.updated_at) > 7);
    if (quickFilter === "critical") return searched.filter((contact) => daysWithoutAction(contact.updated_at) > 14);
    return searched;
  }, [appliedColumnFilters, contacts, quickFilter]);

  async function assignOwnerBulk() {
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
    if (!ownerToAssign || selectedIds.length === 0 || assigning) return;

    setAssignError(null);
    setAssigning(true);
    try {
      const res = await fetch("/api/contacts/assign-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: selectedIds, ownerUserId: ownerToAssign })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "No se pudo asignar propietario");
      }
      setOwnerToAssign("");
      setRowSelection({});
      setBulkAssignOpen(false);
      showToast("Propietario actualizado en la seleccion.", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      setAssignError(message);
      showToast(message, "error");
    } finally {
      setAssigning(false);
    }
  }

  async function updateInline(contactId: string, field: "owner_user_id" | "email" | "telefono", value: string) {
    const key = `${contactId}:${field}`;
    if (inlineBusyKey) return;
    setInlineBusyKey(key);
    setAssignError(null);
    try {
      const res = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/inline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "No se pudo guardar");
      }
      showToast(fieldSavedMessage(field), "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      setAssignError(message);
      showToast(message, "error");
    } finally {
      setInlineBusyKey(null);
    }
  }

  function exportCsv() {
    const visibleColumns = DATA_COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible());
    if (visibleColumns.length === 0) return;

    const header = visibleColumns.map((key) => COLUMN_LABELS[key]).join(",");
    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };

    const rows = filteredContacts.map((contact) => visibleColumns.map((key) => escape(displayValue(contact, key))).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV exportado correctamente.", "info");
  }

  const columns = useMemo<ColumnDef<ListedContact>[]>(
    () => [
      {
        id: "select",
        enableHiding: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            ref={(input) => {
              if (input) input.indeterminate = table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Seleccionar visibles"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Seleccionar ${row.original.full_name}`}
          />
        )
      },
      {
        accessorKey: "id",
        id: "id",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.id} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => row.original.id,
        sortingFn: (rowA, rowB) => rowA.original.id.localeCompare(rowB.original.id, "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "full_name",
        id: "full_name",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.full_name} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => (
          <div className="contact-name-cell">
            <button
              type="button"
              className="contact-name-link"
              onClick={() => setQuickViewContact(row.original)}
              aria-label={`Vista rapida de ${row.original.full_name}`}
            >
              {displayValue(row.original, "full_name")}
            </button>
          </div>
        ),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "full_name").localeCompare(displayValue(rowB.original, "full_name"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        id: "investor_name",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.investor_name} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "investor_name"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "investor_name").localeCompare(displayValue(rowB.original, "investor_name"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "is_financier",
        id: "is_financier",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.is_financier} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "is_financier"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "is_financier").localeCompare(displayValue(rowB.original, "is_financier"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "is_prescriber",
        id: "is_prescriber",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.is_prescriber} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "is_prescriber"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "is_prescriber").localeCompare(displayValue(rowB.original, "is_prescriber"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "owner_email",
        id: "owner_email",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.owner_email} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => (
          <select
            defaultValue={row.original.owner_user_id ?? ""}
            disabled={inlineBusyKey === `${row.original.id}:owner_user_id`}
            onChange={(event) => updateInline(row.original.id, "owner_user_id", event.target.value)}
          >
            <option value="">Sin propietario</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name?.trim() || owner.email}
              </option>
            ))}
          </select>
        ),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "owner_email").localeCompare(displayValue(rowB.original, "owner_email"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "owner_user_id",
        id: "owner_user_id",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.owner_user_id} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "owner_user_id"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "owner_user_id").localeCompare(displayValue(rowB.original, "owner_user_id"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "email",
        id: "email",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.email} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => (
          <input
            defaultValue={displayValue(row.original, "email") === "--" ? "" : displayValue(row.original, "email")}
            disabled={inlineBusyKey === `${row.original.id}:email`}
            onBlur={(event) => updateInline(row.original.id, "email", event.currentTarget.value)}
          />
        ),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "email").localeCompare(displayValue(rowB.original, "email"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "phone",
        id: "phone",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.phone} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => (
          <input
            defaultValue={displayValue(row.original, "phone") === "--" ? "" : displayValue(row.original, "phone")}
            disabled={inlineBusyKey === `${row.original.id}:telefono`}
            onBlur={(event) => updateInline(row.original.id, "telefono", event.currentTarget.value)}
          />
        ),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "phone").localeCompare(displayValue(rowB.original, "phone"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "role",
        id: "role",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.role} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "role"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "role").localeCompare(displayValue(rowB.original, "role"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "other_contact",
        id: "other_contact",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.other_contact} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "other_contact"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "other_contact").localeCompare(displayValue(rowB.original, "other_contact"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "linkedin",
        id: "linkedin",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.linkedin} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "linkedin"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "linkedin").localeCompare(displayValue(rowB.original, "linkedin"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "comments",
        id: "comments",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.comments} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "comments"),
        sortingFn: (rowA, rowB) => displayValue(rowA.original, "comments").localeCompare(displayValue(rowB.original, "comments"), "es", { numeric: true, sensitivity: "base" })
      },
      {
        accessorKey: "updated_at",
        id: "updated_at",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.updated_at} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => displayValue(row.original, "updated_at"),
        sortingFn: (rowA, rowB) => new Date(rowA.original.updated_at ?? 0).getTime() - new Date(rowB.original.updated_at ?? 0).getTime()
      },
      {
        id: "days_without_action",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.days_without_action} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => `${daysWithoutAction(row.original.updated_at)} d`,
        sortingFn: (rowA, rowB) => daysWithoutAction(rowA.original.updated_at) - daysWithoutAction(rowB.original.updated_at)
      },
      {
        id: "follow_up_status",
        header: ({ column }) => <SortHeader label={COLUMN_LABELS.follow_up_status} sortState={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => {
          const level = followUpLevel(row.original.updated_at);
          return <span className={`contact-followup-badge contact-followup-${level}`}>{level.toUpperCase()}</span>;
        },
        sortingFn: (rowA, rowB) => followUpLevel(rowA.original.updated_at).localeCompare(followUpLevel(rowB.original.updated_at), "es", { sensitivity: "base" })
      }
    ],
    [inlineBusyKey, owners]
  );

  const table = useReactTable({
    data: filteredContacts,
    columns,
    state: {
      columnVisibility,
      rowSelection,
      sorting
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const selectedCount = table.getSelectedRowModel().rows.length;
  const visibleDataColumnCount = DATA_COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;
  const timelineRows = table.getRowModel().rows;
  const needsActionCount = quickCounts?.needsActionCount ?? contacts.filter((contact) => daysWithoutAction(contact.updated_at) > 7).length;
  const criticalCount = quickCounts?.criticalCount ?? contacts.filter((contact) => daysWithoutAction(contact.updated_at) > 14).length;

  function updateColumnFilter(key: ContactColumnKey, value: string) {
    const nextFilters = { ...columnFiltersDraft, [key]: value };
    setColumnFiltersDraft(nextFilters);
    const params = new URLSearchParams(searchParams.toString());
    writeContactColumnFiltersToUrlSearchParams(params, nextFilters);
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }
  function toggleColumn(key: ContactColumnKey) {
    const column = table.getColumn(key);
    if (!column) return;
    if (column.getIsVisible() && visibleDataColumnCount === 1) return;
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
        <div className="entity-toolbar-inline entity-toolbar-inline-full">
          <div className="entity-toolbar-section entity-toolbar-view">
            <span className="entity-toolbar-section-title">Vista</span>
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ContactsViewMode)}>
              <option value="table">Tabla</option>
              <option value="timeline">Timeline</option>
            </select>
          </div>

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
                  {DATA_COLUMN_ORDER.map((key) => (
                    <label key={key} className="radix-menu-checkbox-row">
                      <input type="checkbox" checked={table.getColumn(key)?.getIsVisible() ?? false} onChange={() => toggleColumn(key)} />
                      <span>{COLUMN_LABELS[key]}</span>
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

      <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <div className="smart-tabs-row" role="tablist" aria-label="Filtros rapidos de contactos" style={{ margin: 0, flex: 1 }}>
          <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
            <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Todos</span>
          </button>
          <button className={quickFilter === "needs_action" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("needs_action")}>
            Requieren accion <span className="contacts-badge">{needsActionCount}</span>
          </button>
          <button className={quickFilter === "critical" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("critical")}>
            Criticos +14 dias <span className="contacts-badge">{criticalCount}</span>
          </button>
        </div>

        {(inlineBusyKey || assigning) ? <span className="entity-feedback-chip">Guardando cambios...</span> : null}

        <Dialog.Root open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="bulk-assign-trigger">
              Asignacion multiple
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="radix-dialog-overlay" />
            <Dialog.Content className="radix-dialog-content">
              <div className="radix-dialog-head">
                <div>
                  <Dialog.Title>Asignar propietarios</Dialog.Title>
                  <Dialog.Description>
                    {selectedCount > 0
                      ? `Se aplicara a ${selectedCount} contacto${selectedCount === 1 ? "" : "s"} seleccionados.`
                      : "Selecciona una o mas filas en la tabla para habilitar la asignacion."}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                    <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                      <CrmIcon name="close" className="crm-icon" />
                    </button>
                  </Dialog.Close>
              </div>

              <div className="stack" style={{ gap: 14 }}>
                <label className="stack" style={{ gap: 8 }}>
                  <span>Propietario</span>
                  <select value={ownerToAssign} onChange={(event) => setOwnerToAssign(event.target.value)}>
                    <option value="">Elegir propietario...</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.full_name?.trim() || owner.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="bulk-owner-bar">
                  <span>{selectedCount} seleccionados</span>
                  {assignError ? <span className="bulk-owner-error">{assignError}</span> : null}
                </div>
              </div>

              <div className="radix-dialog-actions">
                <Dialog.Close asChild>
                  <button type="button" className="quick-pill quick-pill-ghost">
                    Cancelar
                  </button>
                </Dialog.Close>
                <button onClick={assignOwnerBulk} disabled={!ownerToAssign || selectedCount === 0 || assigning}>
                  {assigning ? "Asignando..." : "Confirmar asignacion"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {viewMode === "timeline" ? (
        <div className="timeline-list">
          {timelineRows.map((row, index) => (
            <motion.article
              key={row.original.id}
              className="timeline-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.18) }}
            >
              <div className="timeline-item-head">
                <span>{row.original.full_name}</span>
                <span className={`contact-followup-badge contact-followup-${followUpLevel(row.original.updated_at)}`}>
                  {daysWithoutAction(row.original.updated_at)} d
                </span>
              </div>
              <div className="muted">
                {row.original.investor_name ?? "--"} | Propietario: {row.original.owner_email ?? "Sin propietario"}
              </div>
            </motion.article>
          ))}
          {timelineRows.length === 0 ? <p className="muted">Sin contactos.</p> : null}
        </div>
      ) : (
        <>
          <DataTable
            table={table}
            headerFilters={{
              select: null,
              id: <input value={columnFiltersDraft.id ?? ""} onChange={(event) => updateColumnFilter("id", event.target.value)} placeholder="Filtrar" />,
              full_name: <input value={columnFiltersDraft.full_name ?? ""} onChange={(event) => updateColumnFilter("full_name", event.target.value)} placeholder="Filtrar" />,
              investor_name: <input value={columnFiltersDraft.investor_name ?? ""} onChange={(event) => updateColumnFilter("investor_name", event.target.value)} placeholder="Filtrar" />,
              is_financier: <select value={columnFiltersDraft.is_financier ?? ""} onChange={(event) => updateColumnFilter("is_financier", event.target.value)}><option value="">Todos</option><option value="Si">Si</option><option value="No">No</option></select>,
              is_prescriber: <select value={columnFiltersDraft.is_prescriber ?? ""} onChange={(event) => updateColumnFilter("is_prescriber", event.target.value)}><option value="">Todos</option><option value="Si">Si</option><option value="No">No</option></select>,
              owner_email: <select value={columnFiltersDraft.owner_email ?? ""} onChange={(event) => updateColumnFilter("owner_email", event.target.value)}><option value="">Todos</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name?.trim() || owner.email}</option>)}</select>,
              owner_user_id: <input value={columnFiltersDraft.owner_user_id ?? ""} onChange={(event) => updateColumnFilter("owner_user_id", event.target.value)} placeholder="Filtrar" />,
              email: <input value={columnFiltersDraft.email ?? ""} onChange={(event) => updateColumnFilter("email", event.target.value)} placeholder="Filtrar" />,
              phone: <input value={columnFiltersDraft.phone ?? ""} onChange={(event) => updateColumnFilter("phone", event.target.value)} placeholder="Filtrar" />,
              role: <input value={columnFiltersDraft.role ?? ""} onChange={(event) => updateColumnFilter("role", event.target.value)} placeholder="Filtrar" />,
              other_contact: <input value={columnFiltersDraft.other_contact ?? ""} onChange={(event) => updateColumnFilter("other_contact", event.target.value)} placeholder="Filtrar" />,
              linkedin: <input value={columnFiltersDraft.linkedin ?? ""} onChange={(event) => updateColumnFilter("linkedin", event.target.value)} placeholder="Filtrar" />,
              comments: <input value={columnFiltersDraft.comments ?? ""} onChange={(event) => updateColumnFilter("comments", event.target.value)} placeholder="Filtrar" />,
              updated_at: <input value={columnFiltersDraft.updated_at ?? ""} onChange={(event) => updateColumnFilter("updated_at", event.target.value)} placeholder="Filtrar" />,
              days_without_action: <input value={columnFiltersDraft.days_without_action ?? ""} onChange={(event) => updateColumnFilter("days_without_action", event.target.value)} placeholder="Filtrar" />,
              follow_up_status: <select value={columnFiltersDraft.follow_up_status ?? ""} onChange={(event) => updateColumnFilter("follow_up_status", event.target.value)}><option value="">Todos</option>{FOLLOW_UP_OPTIONS.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}</select>
            }}
            emptyLabel="Sin contactos."
            emptyHint="Prueba otro filtro o crea el primer contacto para empezar a trabajar la vista."
            emptyAction={<Link href="/contacts/new" className="contacts-tab"><span className="module-tab-icon" aria-hidden="true"><CrmIcon name="plus" className="crm-icon" /></span><span>Crear contacto</span></Link>}
          />
        </>
      )}

      <Dialog.Root open={Boolean(quickViewContact)} onOpenChange={(open) => (!open ? setQuickViewContact(null) : null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="radix-dialog-overlay" />
          <Dialog.Content className="radix-sheet-content">
            {quickViewContact ? (
              <>
                <div className="radix-dialog-head">
                  <div>
                    <Dialog.Title>{quickViewContact.full_name}</Dialog.Title>
                    <Dialog.Description>{quickViewContact.investor_name ?? "Sin compania asociada"}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                    <CrmIcon name="close" className="crm-icon" />
                  </button>
                  </Dialog.Close>
                </div>

                <div className="contact-quick-sheet-panel">
                  <p className="contact-quick-sheet-label">Como contactar</p>
                  <div className="contact-quick-sheet-contact-row">
                    {quickViewContact.linkedin ? (
                      <a
                        href={quickViewContact.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="contact-quick-sheet-contact-button"
                        aria-label="Abrir LinkedIn"
                      >
                        <CrmIcon name="linkedin" className="crm-icon" />
                      </a>
                    ) : (
                      <span className="contact-quick-sheet-contact-button contact-quick-sheet-contact-button-disabled" aria-hidden="true">
                        <CrmIcon name="linkedin" className="crm-icon" />
                      </span>
                    )}
                    {toTelHref(quickViewContact.phone) ? (
                      <button
                        type="button"
                        className="contact-quick-sheet-contact-button"
                        aria-label="Previsualizar telefono"
                        onClick={() => setPhonePreviewOpen((current) => !current)}
                      >
                        <CrmIcon name="phone" className="crm-icon" />
                      </button>
                    ) : (
                      <span className="contact-quick-sheet-contact-button contact-quick-sheet-contact-button-disabled" aria-hidden="true">
                        <CrmIcon name="phone" className="crm-icon" />
                      </span>
                    )}
                    {quickViewContact.email ? (
                      <ContactEmailDialog
                        email={quickViewContact.email}
                        title="Correo del contacto"
                        description="Mostramos el email directamente para evitar abrir aplicaciones externas."
                      >
                        <button type="button" className="contact-quick-sheet-contact-button" aria-label="Ver email">
                          <CrmIcon name="mail" className="crm-icon" />
                        </button>
                      </ContactEmailDialog>
                    ) : (
                      <span className="contact-quick-sheet-contact-button contact-quick-sheet-contact-button-disabled" aria-hidden="true">
                        <CrmIcon name="mail" className="crm-icon" />
                      </span>
                    )}
                  </div>
                  {phonePreviewOpen && quickViewContact.phone ? (
                    <a href={toTelHref(quickViewContact.phone) ?? "#"} className="contact-quick-sheet-phone-preview">
                      {quickViewContact.phone}
                    </a>
                  ) : (
                    <p className="contact-quick-sheet-muted">LinkedIn, telefono y mail.</p>
                  )}
                </div>

                <div className="contact-quick-sheet-meta">
                  <div className="contact-quick-sheet-item">
                    <span>Propietario</span>
                    <strong>{quickViewContact.owner_email ?? "Sin propietario"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Compañía</span>
                    <strong>{quickViewContact.investor_name ?? "Sin compañía"}</strong>
                  </div>
                </div>

                <div className="contact-quick-sheet-stack">
                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Seguimiento</p>
                    <div className="contact-quick-sheet-status-row">
                      <span className={`contact-followup-badge contact-followup-${followUpLevel(quickViewContact.updated_at)}`}>
                        {followUpLevel(quickViewContact.updated_at).toUpperCase()}
                      </span>
                      <span className="contact-quick-sheet-muted">{daysWithoutAction(quickViewContact.updated_at)} dias sin accion</span>
                    </div>
                  </div>

                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Notas rapidas</p>
                    <p className="contact-quick-sheet-copy">{quickViewContact.comments ?? "Sin comentarios todavia."}</p>
                  </div>
                </div>

                <div className="radix-dialog-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="quick-pill quick-pill-ghost">Cerrar</button>
                  </Dialog.Close>
                  <Link href={`/contacts/${encodeURIComponent(quickViewContact.id)}`} className="contacts-add">
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














