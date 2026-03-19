"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TaskOccurredAtField } from "@/components/task-occurred-at-field";

type ContactOption = {
  id: string;
  label: string;
  openProspectId: string | null;
  latestClosedProspectId: string | null;
  hasClosedProspect: boolean;
  blockedEntityType: "lead" | "opportunity" | null;
  blockedEntityId: string | null;
};

type TaskOption = {
  id: string;
  label: string;
  isConversionTask: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  contacts: ContactOption[];
  tasks: TaskOption[];
  taskOccurrences: Array<{ contactId: string; taskId: string; occurredAt: string }>;
  action: (formData: FormData) => Promise<void>;
  initialContactId?: string;
};

export function ProspectTaskEntryForm({ title, subtitle, contacts, tasks, taskOccurrences, action, initialContactId }: Props) {
  const [selectedContactId, setSelectedContactId] = useState(initialContactId ?? "");
  const [contactFilter, setContactFilter] = useState("");
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [reactivationMode, setReactivationMode] = useState<"new" | "reopen" | "">("");

  function normalizeSearch(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [selectedTaskId, tasks]);
  const filteredContacts = useMemo(() => {
    const normalizedQuery = normalizeSearch(contactFilter);
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) => normalizeSearch(contact.label).includes(normalizedQuery));
  }, [contactFilter, contacts]);
  const latestTaskOccurrence = useMemo(() => {
    if (!selectedContactId || !selectedTaskId) return null;
    return (
      taskOccurrences.find((item) => item.contactId === selectedContactId && item.taskId === selectedTaskId) ?? null
    );
  }, [selectedContactId, selectedTaskId, taskOccurrences]);

  const needsReactivationChoice = Boolean(
    selectedContact && !selectedContact.openProspectId && selectedContact.hasClosedProspect && !selectedContact.blockedEntityType
  );
  const isBlocked = Boolean(selectedContact?.blockedEntityType);
  const blockedHref =
    selectedContact?.blockedEntityType && selectedContact.blockedEntityId
      ? selectedContact.blockedEntityType === "lead"
        ? `/acuerdos/leads/${encodeURIComponent(selectedContact.blockedEntityId)}`
        : `/acuerdos/opportunities/${encodeURIComponent(selectedContact.blockedEntityId)}`
      : null;

  function handleContactSelect(contact: ContactOption) {
    setSelectedContactId(contact.id);
    setSelectedTaskId("");
    setReactivationMode("");
    setContactFilter("");
    setIsContactMenuOpen(false);
  }

  return (
    <form
      action={action}
      className="deal-task-form prospect-task-form"
      onSubmit={(event) => {
        if (selectedTask?.isConversionTask) {
          const ok = window.confirm("Esta tarea convertira el prospecto en lead. Quieres continuar?");
          if (!ok) {
            event.preventDefault();
            return;
          }
        }
      }}
    >
      <div className="company-record-section-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
      </div>

      <label className="form-field">
        <span>Contacto</span>
        <div className="prospect-contact-combobox prospect-contact-combobox-stack">
          <button
            type="button"
            className="prospect-contact-trigger"
            aria-label={isContactMenuOpen ? "Cerrar contactos" : "Abrir contactos"}
            aria-expanded={isContactMenuOpen}
            onClick={() => {
              setContactFilter("");
              setIsContactMenuOpen((current) => !current);
            }}
          >
            <span className={selectedContact ? "" : "prospect-contact-trigger-placeholder"}>
              {selectedContact?.label ?? "Selecciona un contacto"}
            </span>
            <span className="prospect-contact-trigger-icon">▾</span>
          </button>
          {isContactMenuOpen ? (
            <div className="prospect-contact-picker">
              <div className="prospect-contact-picker-head">
                <strong>Contactos</strong>
                <span>{filteredContacts.length}</span>
              </div>
              <input
                type="text"
                className="prospect-contact-filter"
                value={contactFilter}
                onChange={(event) => setContactFilter(event.target.value)}
                placeholder="Filtrar por contacto, compania o estado"
                autoComplete="off"
              />
              {filteredContacts.length > 0 ? (
                <select
                  className="prospect-contact-select"
                  size={Math.min(8, filteredContacts.length)}
                  value={selectedContactId}
                  onChange={(event) => {
                    const nextContact = filteredContacts.find((contact) => contact.id === event.target.value);
                    if (nextContact) handleContactSelect(nextContact);
                  }}
                >
                  {filteredContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="task-empty-state">
                  <strong>Sin coincidencias</strong>
                  <p className="muted">Prueba con otro nombre, compania o estado del pipeline.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <input type="hidden" name="contact_id" value={selectedContactId} required />
      </label>

      {selectedContact ? (
        <input type="hidden" name="latest_closed_prospect_id" value={selectedContact.latestClosedProspectId ?? ""} />
      ) : null}
      {selectedContact?.openProspectId ? <input type="hidden" name="prospect_id" value={selectedContact.openProspectId} /> : null}

      {isBlocked && blockedHref ? (
        <div className="task-empty-state">
          <strong>Este contacto ya esta en {selectedContact?.blockedEntityType === "lead" ? "Lead" : "Oportunidad"}</strong>
          <p className="muted">Registra la siguiente tarea en la entidad activa para no duplicar pipeline.</p>
          <div className="deal-detail-links">
            <Link href={blockedHref} className="quick-pill quick-pill-ghost">
              Abrir {selectedContact?.blockedEntityType === "lead" ? "Lead" : "Oportunidad"}
            </Link>
          </div>
        </div>
      ) : null}

      {needsReactivationChoice ? (
        <div className="task-empty-state">
          <strong>Este contacto ya tuvo un prospecto cerrado</strong>
          <p className="muted">Elige si quieres abrir un nuevo ciclo o reactivar el ultimo prospecto cerrado.</p>
          <div className="deal-detail-links">
            <label className="quick-pill quick-pill-ghost">
              <input
                type="radio"
                name="reactivation_mode"
                value="new"
                checked={reactivationMode === "new"}
                onChange={() => setReactivationMode("new")}
              />
              <span>Nuevo prospecto</span>
            </label>
            <label className="quick-pill quick-pill-ghost">
              <input
                type="radio"
                name="reactivation_mode"
                value="reopen"
                checked={reactivationMode === "reopen"}
                onChange={() => setReactivationMode("reopen")}
              />
              <span>Reabrir ultimo</span>
            </label>
          </div>
        </div>
      ) : null}

      {!needsReactivationChoice ? <input type="hidden" name="reactivation_mode" value="new" /> : null}

      <label className="form-field">
        <span>Tarea</span>
        <select
          name="task_id"
          required
          value={selectedTaskId}
          onChange={(event) => setSelectedTaskId(event.target.value)}
          disabled={!selectedContact || isBlocked}
        >
          <option value="">{selectedContact ? "Selecciona una tarea" : "Primero elige un contacto"}</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.label}
            </option>
          ))}
        </select>
      </label>

      {latestTaskOccurrence ? (
        <div className="task-info-strip">
          <strong>Esta tarea ya se ha efectuado antes</strong>
          <button
            type="button"
            className="task-info-button"
            title={`Tarea efectuada en ${new Date(latestTaskOccurrence.occurredAt).toLocaleString("es-ES")}`}
            aria-label={`Tarea efectuada en ${new Date(latestTaskOccurrence.occurredAt).toLocaleString("es-ES")}`}
          >
            i
          </button>
        </div>
      ) : null}

      {selectedTask?.isConversionTask ? (
        <div className="task-empty-state">
          <strong>Esta tarea convertira el prospecto en lead</strong>
          <p className="muted">Al guardar, el sistema cerrara el prospecto como convertido, creara un lead nuevo y registrara esta tarea en ese lead.</p>
        </div>
      ) : null}

      <label className="form-field deal-task-form-notes">
        <span>Notas</span>
        <textarea name="notes" rows={4} placeholder="Contexto o resultado de la tarea..." />
      </label>

      <TaskOccurredAtField />

      <div className="deal-convert-actions">
        <button type="submit" disabled={!selectedContact || isBlocked || !selectedTaskId || (needsReactivationChoice && !reactivationMode)}>
          Guardar tarea
        </button>
      </div>
    </form>
  );
}
