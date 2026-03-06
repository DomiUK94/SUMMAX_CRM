"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
  useReactTable
} from "@tanstack/react-table";
import type { ListedContact } from "@/lib/db/crm";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";
import { DataTable } from "@/components/ui/data-table";
import { CrmIcon } from "@/components/ui/crm-icon";

type OwnerOption = { id: string; email: string; full_name?: string | null };
type ToastTone = "success" | "error" | "info";

type ColumnKey =
  | "id"
  | "full_name"
  | "investor_name"
  | "status_name"
  | "owner_email"
  | "owner_user_id"
  | "email"
  | "phone"
  | "role"
  | "other_contact"
  | "linkedin"
  | "comments"
  | "updated_at"
  | "days_without_action"
  | "follow_up_status";

type ContactsViewMode = "table" | "timeline";
type ContactsQuickFilter = "all" | "needs_action" | "critical";

const DATA_COLUMN_ORDER: ColumnKey[] = [
  "id",
  "full_name",
  "investor_name",
  "status_name",
  "owner_email",
  "owner_user_id",
  "email",
  "phone",
  "role",
  "other_contact",
  "linkedin",
  "comments",
  "updated_at",
  "days_without_action",
  "follow_up_status"
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  id: "ID",
  full_name: "Nombre contacto",
  investor_name: "Nombre compañía",
  status_name: "Prioridad",
  owner_email: "Propietario contacto",
  owner_user_id: "ID propietario",
  email: "Email",
  phone: "Teléfono",
  role: "Rol",
  other_contact: "Otro contacto",
  linkedin: "LinkedIn",
  comments: "Comentarios",
  updated_at: "Última actualización",
  days_without_action: "Días sin acción",
  follow_up_status: "Seguimiento"
};

const STATUS_OPTIONS = [
  "Alta",
  "Media",
  "Baja",
  "Pendiente de contactar",
  "En contacto",
  "NDA en curso",
  "Revision financiera",
  "Interes confirmado",
  "Contrato en curso",
  "Cerrado",
  "Descartado"
];

const DEFAULT_COLUMNS: VisibilityState = {
  id: false,
  full_name: true,
  investor_name: true,
  status_name: true,
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

function followUpLevel(updatedAt: string | null): "rojo" | "ambar" | "verde" {
  const days = daysWithoutAction(updatedAt);
  if (days > 14) return "rojo";
  if (days > 7) return "ambar";
  return "verde";
}

function displayValue(contact: ListedContact, key: ColumnKey): string {
  if (key === "updated_at") return contact.updated_at ? new Date(contact.updated_at).toLocaleString("es-ES") : "--";
  if (key === "days_without_action") return String(daysWithoutAction(contact.updated_at));
  if (key === "follow_up_status") return followUpLevel(contact.updated_at);
  const raw = contact[key as keyof ListedContact];
  return raw == null || raw === "" ? "--" : String(raw);
}

function fieldSavedMessage(field: "owner_user_id" | "prioritario" | "email" | "telefono") {
  if (field === "owner_user_id") return "Propietario actualizado.";
  if (field === "prioritario") return "Prioridad actualizada.";
  if (field === "email") return "Email actualizado.";
  return "Teléfono actualizado.";
}

export function ContactsTable({
  contacts,
  owners,
  storageKeyPrefix
}: {
  contacts: ListedContact[];
  owners: OwnerOption[];
  storageKeyPrefix?: string;
}) {
  const router = useRouter();
  const prefix = storageKeyPrefix ?? "contacts";

  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [ownerToAssign, setOwnerToAssign] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [inlineBusyKey, setInlineBusyKey] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [viewMode, setViewMode] = usePersistedState<ContactsViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<ContactsQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columnVisibility, setColumnVisibility] = usePersistedState<VisibilityState>(`${prefix}:columns`, DEFAULT_COLUMNS);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [quickViewContact, setQuickViewContact] = useState<ListedContact | null>(null);
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
    module: "contacts",
    currentFilters: {
      searchApplied,
      quickFilter,
      viewMode,
      columns: columnVisibility
    },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextQuick =
        filters.quickFilter === "all" || filters.quickFilter === "needs_action" || filters.quickFilter === "critical"
          ? filters.quickFilter
          : "all";
      const nextView = filters.viewMode === "timeline" ? "timeline" : "table";
      const nextColumns = (filters.columns as VisibilityState) ?? DEFAULT_COLUMNS;
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setQuickFilter(nextQuick);
      setViewMode(nextView);
      setColumnVisibility(nextColumns);
      showToast("Vista aplicada.", "success");
    }
  });

  const filteredContacts = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searchableColumns = DATA_COLUMN_ORDER.filter((key) => columnVisibility[key] !== false);
    const searched = !q
      ? contacts
      : contacts.filter((contact) => searchableColumns.some((key) => displayValue(contact, key).toLowerCase().includes(q)));

    if (quickFilter === "needs_action") return searched.filter((contact) => daysWithoutAction(contact.updated_at) > 7);
    if (quickFilter === "critical") return searched.filter((contact) => daysWithoutAction(contact.updated_at) > 14);
    return searched;
  }, [columnVisibility, contacts, quickFilter, searchApplied]);

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
      showToast("Propietario actualizado en la selección.", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      setAssignError(message);
      showToast(message, "error");
    } finally {
      setAssigning(false);
    }
  }

  async function updateInline(contactId: string, field: "owner_user_id" | "prioritario" | "email" | "telefono", value: string) {
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
        header: COLUMN_LABELS.id,
        cell: ({ row }) => row.original.id
      },
      {
        accessorKey: "full_name",
        id: "full_name",
        header: COLUMN_LABELS.full_name,
        cell: ({ row }) => (
          <div className="contact-name-cell">
            <Link className="contact-name-link" href={`/contacts/${encodeURIComponent(row.original.id)}`}>
              {displayValue(row.original, "full_name")}
            </Link>
            <button
              type="button"
              className="contact-preview-trigger"
              onClick={() => setQuickViewContact(row.original)}
              aria-label={`Vista rápida de ${row.original.full_name}`}
            >
              <span className="toolbar-button-icon" aria-hidden="true">
                <CrmIcon name="overview" className="crm-icon" />
              </span>
            </button>
          </div>
        )
      },
      {
        accessorKey: "investor_name",
        id: "investor_name",
        header: COLUMN_LABELS.investor_name,
        cell: ({ row }) => displayValue(row.original, "investor_name")
      },
      {
        accessorKey: "status_name",
        id: "status_name",
        header: COLUMN_LABELS.status_name,
        cell: ({ row }) => (
          <select
            defaultValue={row.original.status_name ?? ""}
            disabled={inlineBusyKey === `${row.original.id}:prioritario`}
            onChange={(event) => updateInline(row.original.id, "prioritario", event.target.value)}
          >
            <option value="">--</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        )
      },
      {
        accessorKey: "owner_email",
        id: "owner_email",
        header: COLUMN_LABELS.owner_email,
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
        )
      },
      {
        accessorKey: "owner_user_id",
        id: "owner_user_id",
        header: COLUMN_LABELS.owner_user_id,
        cell: ({ row }) => displayValue(row.original, "owner_user_id")
      },
      {
        accessorKey: "email",
        id: "email",
        header: COLUMN_LABELS.email,
        cell: ({ row }) => (
          <input
            defaultValue={displayValue(row.original, "email") === "--" ? "" : displayValue(row.original, "email")}
            disabled={inlineBusyKey === `${row.original.id}:email`}
            onBlur={(event) => updateInline(row.original.id, "email", event.currentTarget.value)}
          />
        )
      },
      {
        accessorKey: "phone",
        id: "phone",
        header: COLUMN_LABELS.phone,
        cell: ({ row }) => (
          <input
            defaultValue={displayValue(row.original, "phone") === "--" ? "" : displayValue(row.original, "phone")}
            disabled={inlineBusyKey === `${row.original.id}:telefono`}
            onBlur={(event) => updateInline(row.original.id, "telefono", event.currentTarget.value)}
          />
        )
      },
      {
        accessorKey: "role",
        id: "role",
        header: COLUMN_LABELS.role,
        cell: ({ row }) => displayValue(row.original, "role")
      },
      {
        accessorKey: "other_contact",
        id: "other_contact",
        header: COLUMN_LABELS.other_contact,
        cell: ({ row }) => displayValue(row.original, "other_contact")
      },
      {
        accessorKey: "linkedin",
        id: "linkedin",
        header: COLUMN_LABELS.linkedin,
        cell: ({ row }) => displayValue(row.original, "linkedin")
      },
      {
        accessorKey: "comments",
        id: "comments",
        header: COLUMN_LABELS.comments,
        cell: ({ row }) => displayValue(row.original, "comments")
      },
      {
        accessorKey: "updated_at",
        id: "updated_at",
        header: COLUMN_LABELS.updated_at,
        cell: ({ row }) => displayValue(row.original, "updated_at")
      },
      {
        id: "days_without_action",
        header: COLUMN_LABELS.days_without_action,
        cell: ({ row }) => `${daysWithoutAction(row.original.updated_at)} d`
      },
      {
        id: "follow_up_status",
        header: COLUMN_LABELS.follow_up_status,
        cell: ({ row }) => {
          const level = followUpLevel(row.original.updated_at);
          return <span className={`contact-followup-badge contact-followup-${level}`}>{level.toUpperCase()}</span>;
        }
      }
    ],
    [inlineBusyKey, owners]
  );

  const table = useReactTable({
    data: filteredContacts,
    columns,
    state: {
      columnVisibility,
      rowSelection
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel()
  });

  const selectedCount = table.getSelectedRowModel().rows.length;
  const visibleDataColumnCount = DATA_COLUMN_ORDER.filter((key) => table.getColumn(key)?.getIsVisible()).length;
  const timelineRows = table.getRowModel().rows;
  const needsActionCount = contacts.filter((contact) => daysWithoutAction(contact.updated_at) > 7).length;
  const criticalCount = contacts.filter((contact) => daysWithoutAction(contact.updated_at) > 14).length;

  function toggleColumn(key: ColumnKey) {
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
        <input
          className="contacts-search toolbar-search"
          placeholder="Busca información de contacto en las columnas visibles"
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
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ContactsViewMode)}>
              <option value="table">Tabla</option>
              <option value="timeline">Timeline</option>
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

      <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de contactos" style={{ margin: 0, flex: 1 }}>
          <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
            <span className="smart-tab-icon" aria-hidden="true"><CrmIcon name="overview" className="crm-icon" /></span><span>Todos</span>
          </button>
          <button className={quickFilter === "needs_action" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("needs_action")}>
            Requieren acción <span className="contacts-badge">{needsActionCount}</span>
          </button>
          <button className={quickFilter === "critical" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("critical")}>
            Críticos +14 días <span className="contacts-badge">{criticalCount}</span>
          </button>
        </div>

        {(inlineBusyKey || assigning) ? <span className="entity-feedback-chip">Guardando cambios...</span> : null}

        <Dialog.Root open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="bulk-assign-trigger">
              Asignación múltiple
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
                      ? `Se aplicará a ${selectedCount} contacto${selectedCount === 1 ? "" : "s"} seleccionados.`
                      : "Selecciona una o más filas en la tabla para habilitar la asignación."}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                    ×
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
                  {assigning ? "Asignando..." : "Confirmar asignación"}
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
                <Link className="contact-name-link" href={`/contacts/${encodeURIComponent(row.original.id)}`}>
                  {row.original.full_name}
                </Link>
                <span className={`contact-followup-badge contact-followup-${followUpLevel(row.original.updated_at)}`}>
                  {daysWithoutAction(row.original.updated_at)} d
                </span>
              </div>
              <div className="muted">
                {row.original.investor_name ?? "--"} | Propietario: {row.original.owner_email ?? "Sin propietario"} | Prioridad: {row.original.status_name ?? "--"}
              </div>
            </motion.article>
          ))}
          {timelineRows.length === 0 ? <p className="muted">Sin contactos.</p> : null}
        </div>
      ) : (
        <DataTable
          table={table}
          emptyLabel="Sin contactos."
          emptyHint="Prueba otro filtro o crea el primer contacto para empezar a trabajar la vista."
          emptyAction={<Link href="/contacts/new" className="contacts-tab"><span className="module-tab-icon" aria-hidden="true"><CrmIcon name="plus" className="crm-icon" /></span><span>Crear contacto</span></Link>}
        />
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
                    <Dialog.Description>{quickViewContact.investor_name ?? "Sin compañía asociada"}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                      ×
                    </button>
                  </Dialog.Close>
                </div>

                <div className="contact-quick-sheet-meta">
                  <div className="contact-quick-sheet-item">
                    <span>Email</span>
                    <strong>{quickViewContact.email ?? "Sin email"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Teléfono</span>
                    <strong>{quickViewContact.phone ?? "Sin teléfono"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Propietario</span>
                    <strong>{quickViewContact.owner_email ?? "Sin propietario"}</strong>
                  </div>
                  <div className="contact-quick-sheet-item">
                    <span>Prioridad</span>
                    <strong>{quickViewContact.status_name ?? "Sin prioridad"}</strong>
                  </div>
                </div>

                <div className="contact-quick-sheet-stack">
                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Seguimiento</p>
                    <div className="contact-quick-sheet-status-row">
                      <span className={`contact-followup-badge contact-followup-${followUpLevel(quickViewContact.updated_at)}`}>
                        {followUpLevel(quickViewContact.updated_at).toUpperCase()}
                      </span>
                      <span className="contact-quick-sheet-muted">{daysWithoutAction(quickViewContact.updated_at)} días sin acción</span>
                    </div>
                  </div>

                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Notas rápidas</p>
                    <p className="contact-quick-sheet-copy">{quickViewContact.comments ?? "Sin comentarios todavía."}</p>
                  </div>

                  <div className="contact-quick-sheet-panel">
                    <p className="contact-quick-sheet-label">Canales</p>
                    <div className="contact-quick-sheet-links">
                      {quickViewContact.linkedin ? (
                        <a href={quickViewContact.linkedin} target="_blank" rel="noreferrer" className="quick-pill quick-pill-ghost">
                          LinkedIn
                        </a>
                      ) : null}
                      {quickViewContact.email ? (
                        <a href={`mailto:${quickViewContact.email}`} className="quick-pill quick-pill-ghost">
                          Email
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="radix-dialog-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="quick-pill quick-pill-ghost">Cerrar</button>
                  </Dialog.Close>
                  <Link href={`/contacts/${encodeURIComponent(quickViewContact.id)}`} className="contacts-add">
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
