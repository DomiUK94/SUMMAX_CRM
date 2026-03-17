"use client";

import { useMemo, useState } from "react";

type CompanyOption = {
  id: string;
  name: string;
};

type ContactOption = {
  id: string;
  name: string;
  companyId: string;
};

type StateOption = {
  id: string;
  name: string;
};

type Props = {
  companies: CompanyOption[];
  contacts: ContactOption[];
  states: StateOption[];
  defaultOwnerUserId: string;
  createLeadAction: (formData: FormData) => Promise<void>;
};

export function NewLeadForm({
  companies,
  contacts,
  states,
  defaultOwnerUserId,
  createLeadAction
}: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => !selectedCompanyId || contact.companyId === selectedCompanyId),
    [contacts, selectedCompanyId]
  );

  return (
    <form action={createLeadAction} className="contact-new-form card">
      <div className="contact-new-grid">
        <label className="form-field">
          <span>Compañía</span>
          <select
            name="company_id"
            value={selectedCompanyId}
            onChange={(event) => {
              setSelectedCompanyId(event.target.value);
              setSelectedContactId("");
            }}
            required
          >
            <option value="">Selecciona una compañía</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Contacto</span>
          <select
            name="contact_id"
            value={selectedContactId}
            onChange={(event) => setSelectedContactId(event.target.value)}
            required
          >
            <option value="">Selecciona un contacto</option>
            {filteredContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field contact-new-field-wide">
          <span>Nombre del lead</span>
          <input name="name" placeholder="Ej. Lead franquicia Q2" />
        </label>

        <label className="form-field">
          <span>Estado inicial</span>
          <select name="current_state_id" required defaultValue={states[0]?.id ?? ""}>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Propietario</span>
          <select name="assign_owner" defaultValue="yes">
            <option value="yes">Asignarme como propietario</option>
            <option value="no">Sin propietario</option>
          </select>
        </label>

        <label className="form-field contact-new-field-full">
          <span>Notas</span>
          <textarea name="notes" rows={5} placeholder="Contexto inicial del lead..." />
        </label>
      </div>

      <input type="hidden" name="default_owner_user_id" value={defaultOwnerUserId} />

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="submit">Crear lead</button>
      </div>
    </form>
  );
}
