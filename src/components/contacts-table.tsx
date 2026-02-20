"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListedContact } from "@/lib/db/crm";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { useSavedViews } from "@/lib/ui/use-saved-views";

type OwnerOption = { id: string; email: string; full_name?: string | null };

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

  const [showColumnsEditor, setShowColumnsEditor] = useState(false);
  const [searchDraft, setSearchDraft] = usePersistedState(`${prefix}:search_draft`, "");
  const [searchApplied, setSearchApplied] = usePersistedState(`${prefix}:search_applied`, "");
  const [ownerToAssign, setOwnerToAssign] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [inlineBusyKey, setInlineBusyKey] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedState<ContactsViewMode>(`${prefix}:view_mode`, "table");
  const [quickFilter, setQuickFilter] = usePersistedState<ContactsQuickFilter>(`${prefix}:quick_filter`, "all");
  const [columns, setColumns] = usePersistedState<Record<ColumnKey, boolean>>(`${prefix}:columns`, {
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
  });

  const visibleColumns = (Object.keys(columns) as ColumnKey[]).filter((key) => columns[key]);
  const visibleCount = visibleColumns.length;

  const savedViews = useSavedViews({
    module: "contacts",
    currentFilters: {
      searchApplied,
      quickFilter,
      viewMode,
      columns
    },
    onApply: (filters) => {
      const nextSearch = typeof filters.searchApplied === "string" ? filters.searchApplied : "";
      const nextQuick =
        filters.quickFilter === "all" || filters.quickFilter === "needs_action" || filters.quickFilter === "critical"
          ? filters.quickFilter
          : "all";
      const nextView = filters.viewMode === "timeline" ? "timeline" : "table";
      const nextColumns = (filters.columns as Record<ColumnKey, boolean>) ?? columns;
      setSearchDraft(nextSearch);
      setSearchApplied(nextSearch);
      setQuickFilter(nextQuick);
      setViewMode(nextView);
      setColumns(nextColumns);
    }
  });

  function toggleColumn(key: ColumnKey) {
    if (columns[key] && visibleCount === 1) return;
    setColumns((current) => ({ ...current, [key]: !current[key] }));
  }

  const filteredContacts = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    const searched = !q
      ? contacts
      : contacts.filter((contact) => visibleColumns.some((key) => displayValue(contact, key).toLowerCase().includes(q)));

    if (quickFilter === "needs_action") {
      return searched.filter((contact) => daysWithoutAction(contact.updated_at) > 7);
    }
    if (quickFilter === "critical") {
      return searched.filter((contact) => daysWithoutAction(contact.updated_at) > 14);
    }
    return searched;
  }, [contacts, searchApplied, visibleColumns, quickFilter]);

  const allVisibleIds = filteredContacts.map((c) => c.id);
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !allVisibleIds.includes(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...allVisibleIds])));
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function assignOwnerBulk() {
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
        throw new Error(payload?.error ?? "No se pudo asignar owner");
      }
      setSelectedIds([]);
      setOwnerToAssign("");
      router.refresh();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Error inesperado");
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
      router.refresh();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setInlineBusyKey(null);
    }
  }

  function exportCsv() {
    if (visibleColumns.length === 0) return;
    const header = visibleColumns.map((k) => COLUMN_LABELS[k]).join(",");
    const escape = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };

    const rows = filteredContacts.map((contact) => visibleColumns.map((k) => escape(displayValue(contact, k))).join(","));
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
  }

  const needsActionCount = contacts.filter((c) => daysWithoutAction(c.updated_at) > 7).length;
  const criticalCount = contacts.filter((c) => daysWithoutAction(c.updated_at) > 14).length;

  return (
    <>
      <div className="entity-toolbar">
        <input
          className="contacts-search toolbar-search"
          placeholder="Busca información de Contacto (Cualquier columna)"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
        <button onClick={() => setSearchApplied(searchDraft)}>Filtrar</button>
        <div className="entity-toolbar-view">
          <span>Vista:</span>
          <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ContactsViewMode)}>
            <option value="table">Tabla</option>
            <option value="timeline">Timeline</option>
          </select>
        </div>
        <div className="entity-toolbar-actions">
          <button onClick={() => setShowColumnsEditor((s) => !s)}>Editar columnas</button>
          <button
            onClick={async () => {
              const name = window.prompt("Nombre de la vista");
              if (!name) return;
              await savedViews.saveCurrent(name);
            }}
          >
            Guardar vista
          </button>
          <select
            defaultValue=""
            onChange={(event) => {
              const id = event.target.value;
              if (!id) return;
              savedViews.applyView(id);
              event.currentTarget.value = "";
            }}
          >
            <option value="">{savedViews.loading ? "Cargando vistas..." : "Aplicar vista guardada"}</option>
            {savedViews.views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              const id = window.prompt("ID de vista a eliminar");
              if (!id) return;
              await savedViews.deleteView(id.trim());
            }}
          >
            Eliminar vista
          </button>
          <button onClick={exportCsv}>Exportar</button>
        </div>
      </div>

      <div className="smart-tabs-row" role="tablist" aria-label="Filtros rápidos de contactos">
        <button className={quickFilter === "all" ? "smart-tab smart-tab-active" : "smart-tab"} onClick={() => setQuickFilter("all")}>
          Todos
        </button>
        <button
          className={quickFilter === "needs_action" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("needs_action")}
        >
          Requieren acción <span className="contacts-badge">{needsActionCount}</span>
        </button>
        <button
          className={quickFilter === "critical" ? "smart-tab smart-tab-active" : "smart-tab"}
          onClick={() => setQuickFilter("critical")}
        >
          Críticos +14 días <span className="contacts-badge">{criticalCount}</span>
        </button>
      </div>

      <div className="bulk-owner-bar">
        <span>{selectedIds.length} seleccionados</span>
        <select value={ownerToAssign} onChange={(event) => setOwnerToAssign(event.target.value)}>
          <option value="">Asignar owner...</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.full_name?.trim() || owner.email}
            </option>
          ))}
        </select>
        <button onClick={assignOwnerBulk} disabled={!ownerToAssign || selectedIds.length === 0 || assigning}>
          {assigning ? "Asignando..." : "Asignar seleccionados"}
        </button>
        {assignError ? <span className="bulk-owner-error">{assignError}</span> : null}
      </div>

      {showColumnsEditor ? (
        <div className="columns-editor">
          {(Object.keys(columns) as ColumnKey[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={columns[key]} onChange={() => toggleColumn(key)} />
              {COLUMN_LABELS[key]}
            </label>
          ))}
        </div>
      ) : null}

      {viewMode === "timeline" ? (
        <div className="timeline-list">
          {filteredContacts.map((c) => (
            <article key={c.id} className="timeline-item">
              <div className="timeline-item-head">
                <Link className="contact-name-link" href={`/contacts/${encodeURIComponent(c.id)}`}>
                  {c.full_name}
                </Link>
                <span className={`contact-followup-badge contact-followup-${followUpLevel(c.updated_at)}`}>
                  {daysWithoutAction(c.updated_at)} d
                </span>
              </div>
              <div className="muted">
                {c.investor_name ?? "--"} | Owner: {c.owner_email ?? "Sin owner"} | Prioridad: {c.status_name ?? "--"}
              </div>
            </article>
          ))}
          {filteredContacts.length === 0 ? <p className="muted">Sin contactos.</p> : null}
        </div>
      ) : (
        <div className="contacts-table-wrap">
          <table className="contacts-crm-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Seleccionar visibles" />
                </th>
                {visibleColumns.map((key) => (
                  <th key={key}>{COLUMN_LABELS[key]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Seleccionar ${c.full_name}`}
                    />
                  </td>
                  {visibleColumns.map((key) => {
                    if (key === "full_name") {
                      return (
                        <td key={key}>
                          <Link className="contact-name-link" href={`/contacts/${encodeURIComponent(c.id)}`}>
                            {displayValue(c, key)}
                          </Link>
                        </td>
                      );
                    }
                    if (key === "follow_up_status") {
                      const level = followUpLevel(c.updated_at);
                      return (
                        <td key={key}>
                          <span className={`contact-followup-badge contact-followup-${level}`}>{level.toUpperCase()}</span>
                        </td>
                      );
                    }
                    if (key === "days_without_action") {
                      return <td key={key}>{displayValue(c, key)} d</td>;
                    }
                    if (key === "owner_email") {
                      return (
                        <td key={key}>
                          <select
                            defaultValue={c.owner_user_id ?? ""}
                            disabled={inlineBusyKey === `${c.id}:owner_user_id`}
                            onChange={(event) => updateInline(c.id, "owner_user_id", event.target.value)}
                          >
                            <option value="">Sin owner</option>
                            {owners.map((owner) => (
                              <option key={owner.id} value={owner.id}>
                                {owner.full_name?.trim() || owner.email}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }
                    if (key === "status_name") {
                      return (
                        <td key={key}>
                          <select
                            defaultValue={c.status_name ?? ""}
                            disabled={inlineBusyKey === `${c.id}:prioritario`}
                            onChange={(event) => updateInline(c.id, "prioritario", event.target.value)}
                          >
                            <option value="">--</option>
                            <option value="Alta">Alta</option>
                            <option value="Media">Media</option>
                            <option value="Baja">Baja</option>
                            <option value="Pendiente de contactar">Pendiente de contactar</option>
                            <option value="En contacto">En contacto</option>
                            <option value="NDA en curso">NDA en curso</option>
                            <option value="Revision financiera">Revision financiera</option>
                            <option value="Interes confirmado">Interes confirmado</option>
                            <option value="Contrato en curso">Contrato en curso</option>
                            <option value="Cerrado">Cerrado</option>
                            <option value="Descartado">Descartado</option>
                          </select>
                        </td>
                      );
                    }
                    if (key === "email" || key === "phone") {
                      const field = key === "email" ? "email" : "telefono";
                      return (
                        <td key={key}>
                          <input
                            defaultValue={displayValue(c, key) === "--" ? "" : displayValue(c, key)}
                            disabled={inlineBusyKey === `${c.id}:${field}`}
                            onBlur={(event) => updateInline(c.id, field, event.currentTarget.value)}
                          />
                        </td>
                      );
                    }
                    return <td key={key}>{displayValue(c, key)}</td>;
                  })}
                </tr>
              ))}
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(visibleCount + 1, 2)}>Sin contactos.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
