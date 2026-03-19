"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TaskOccurredAtField } from "@/components/task-occurred-at-field";

type ContactOption = {
  id: string;
  label: string;
  openLeadId: string | null;
  openLeadStateId: string | null;
  openProspectId: string | null;
  blockedOpportunityId: string | null;
};

type TaskOption = {
  id: string;
  label: string;
  stateId: string;
};

type Props = {
  title: string;
  subtitle: string;
  contacts: ContactOption[];
  tasks: TaskOption[];
  action: (formData: FormData) => Promise<void>;
};

export function LeadTaskEntryForm({ title, subtitle, contacts, tasks, action }: Props) {
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");

  function normalizeSearch(value: string) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const filteredContacts = useMemo(() => {
    const normalizedQuery = normalizeSearch(contactFilter);
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) => normalizeSearch(contact.label).includes(normalizedQuery));
  }, [contactFilter, contacts]);

  const filteredTasks = useMemo(() => {
    if (!selectedContact) return [];
    if (selectedContact.openLeadStateId) {
      return tasks.filter((task) => task.stateId === selectedContact.openLeadStateId);
    }
    return tasks;
  }, [selectedContact, tasks]);

  const blockedOpportunityHref = selectedContact?.blockedOpportunityId
    ? `/acuerdos/opportunities/${encodeURIComponent(selectedContact.blockedOpportunityId)}`
    : null;

  function handleContactSelect(contact: ContactOption) {
    setSelectedContactId(contact.id);
    setSelectedTaskId("");
    setContactFilter("");
    setIsContactMenuOpen(false);
  }

  return (
    <form action={action} className="deal-task-form prospect-task-form">
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
            <span className="prospect-contact-trigger-icon">▼</span>
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

      {selectedContact?.openLeadId ? <input type="hidden" name="lead_id" value={selectedContact.openLeadId} /> : null}
      {selectedContact?.openProspectId ? <input type="hidden" name="prospect_id" value={selectedContact.openProspectId} /> : null}

      {selectedContact?.blockedOpportunityId && blockedOpportunityHref ? (
        <div className="task-empty-state">
          <strong>Este contacto ya esta en Oportunidad</strong>
          <p className="muted">La siguiente tarea debe registrarse dentro de la oportunidad activa.</p>
          <div className="deal-detail-links">
            <Link href={blockedOpportunityHref} className="quick-pill quick-pill-ghost">
              Abrir Oportunidad
            </Link>
          </div>
        </div>
      ) : null}

      {selectedContact && !selectedContact.openLeadId && !selectedContact.blockedOpportunityId ? (
        <div className="task-empty-state">
          <strong>{selectedContact.openProspectId ? "Este prospecto saltara a lead" : "Este contacto saltara directo a lead"}</strong>
          <p className="muted">
            {selectedContact.openProspectId
              ? "Al guardar, el sistema convertira el prospecto en lead y registrara la tarea elegida en ese lead."
              : "Al guardar, el sistema creara un lead directamente desde este contacto y registrara la tarea elegida en ese lead."}
          </p>
        </div>
      ) : null}

      <label className="form-field">
        <span>Tarea</span>
        <select
          name="task_id"
          required
          value={selectedTaskId}
          onChange={(event) => setSelectedTaskId(event.target.value)}
          disabled={!selectedContact || Boolean(selectedContact?.blockedOpportunityId)}
        >
          <option value="">{selectedContact ? "Selecciona una tarea" : "Primero elige un contacto"}</option>
          {filteredTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field deal-task-form-notes">
        <span>Notas</span>
        <textarea name="notes" rows={4} placeholder="Contexto o resultado de la tarea..." />
      </label>

      <TaskOccurredAtField />

      <div className="deal-convert-actions">
        <button type="submit" disabled={!selectedContact || Boolean(selectedContact?.blockedOpportunityId) || !selectedTaskId}>
          Guardar tarea
        </button>
      </div>
    </form>
  );
}
