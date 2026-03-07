"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

type InvestorOption = {
  id: string;
  name: string;
};

type DraftInvestor = {
  name: string;
  website: string;
};

export function NewContactForm({
  investors,
  defaultOwnerUserId,
  createContactAction
}: {
  investors: InvestorOption[];
  defaultOwnerUserId: string;
  createContactAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [draftInvestor, setDraftInvestor] = useState<DraftInvestor | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftWebsite, setDraftWebsite] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const investorOptions = useMemo(() => {
    if (!draftInvestor) return investors;
    return [{ id: "__draft_new__", name: draftInvestor.name }, ...investors];
  }, [draftInvestor, investors]);

  function handleInvestorChange(nextValue: string) {
    setSelectedInvestorId(nextValue);
  }

  function handleCreateDraftInvestor() {
    const cleanName = draftName.trim();
    if (!cleanName) {
      setDraftError("Escribe el nombre de la cuenta.");
      return;
    }

    setDraftInvestor({
      name: cleanName,
      website: draftWebsite.trim()
    });
    setSelectedInvestorId("__draft_new__");
    setDialogOpen(false);
    setDraftError(null);
    setDraftName("");
    setDraftWebsite("");
  }

  return (
    <form action={createContactAction} className="contact-new-form card">
      <div className="contact-new-account-row">
        <label className="form-field contact-new-account-select">
          <span>Cuenta existente</span>
          <select name="investor_id" value={selectedInvestorId} onChange={(event) => handleInvestorChange(event.target.value)} required>
            <option value="">Selecciona una cuenta</option>
            {investorOptions.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.id === "__draft_new__" ? `Nueva cuenta: ${inv.name}` : inv.name}
              </option>
            ))}
          </select>
        </label>

        <div className="contact-new-account-action">
          <span className="form-field-label">Nueva cuenta</span>
          <button type="button" className="contact-new-account-button" onClick={() => setDialogOpen(true)}>
            Nueva cuenta
          </button>
        </div>
      </div>

      <div className="contact-new-grid">
        <label className="form-field contact-new-field-wide">
          <span>Nombre del contacto</span>
          <input name="full_name" required placeholder="Nombre y apellidos" />
        </label>

        <label className="form-field">
          <span>Email</span>
          <input name="email" type="email" placeholder="email@empresa.com" />
        </label>

        <label className="form-field">
          <span>Telefono</span>
          <input name="phone" placeholder="+34 ..." />
        </label>
      </div>

      {draftInvestor ? (
        <div className="contact-new-created-account">
          <strong>Cuenta preparada:</strong> {draftInvestor.name}
          {draftInvestor.website ? <span> | {draftInvestor.website}</span> : null}
        </div>
      ) : null}

      {draftInvestor ? <input type="hidden" name="new_investor_name" value={draftInvestor.name} /> : null}
      {draftInvestor ? <input type="hidden" name="new_investor_website" value={draftInvestor.website} /> : null}
      <input type="hidden" name="new_investor_category" value="" />
      <input type="hidden" name="new_investor_strategy" value="" />

      <div className="contact-new-advanced-toggle">
        <button type="button" className="quick-pill quick-pill-ghost" onClick={() => setAdvancedOpen((current) => !current)}>
          {advancedOpen ? "Ocultar avanzado" : "Avanzado"}
        </button>
      </div>

      {advancedOpen ? (
        <div className="contact-new-advanced-panel">
          <div className="contact-new-grid">
            <label className="form-field">
              <span>Rol</span>
              <input name="role" placeholder="Socio, director, analista..." />
            </label>
            <label className="form-field">
              <span>Otro contacto</span>
              <input name="other_contact" placeholder="Dato extra de contacto" />
            </label>
            <label className="form-field contact-new-field-wide">
              <span>LinkedIn</span>
              <input name="linkedin" placeholder="https://linkedin.com/in/..." />
            </label>
            <label className="form-field">
              <span>Estado</span>
              <input name="status_name" placeholder="Nuevo, En progreso..." />
            </label>
            <label className="form-field">
              <span>Propietario</span>
              <select name="assign_owner" defaultValue="yes">
                <option value="yes">Asignarme como propietario</option>
                <option value="no">Sin propietario</option>
              </select>
            </label>
            <label className="form-field contact-new-field-full">
              <span>Comentarios</span>
              <textarea name="comments" rows={5} placeholder="Notas internas..." />
            </label>
          </div>
        </div>
      ) : null}

      <input type="hidden" name="default_owner_user_id" value={defaultOwnerUserId} />

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="submit">Crear contacto</button>
      </div>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="radix-dialog-overlay" />
          <Dialog.Content className="radix-dialog-content">
            <div className="radix-dialog-head">
              <div>
                <Dialog.Title>Nueva cuenta</Dialog.Title>
                <Dialog.Description>Completa solo lo necesario y la cuenta quedara ya seleccionada en el formulario.</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                  x
                </button>
              </Dialog.Close>
            </div>

            <div className="editor-stack">
              <label className="form-field">
                <span>Nombre de la cuenta</span>
                <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Nombre de la compania" />
              </label>
              <label className="form-field">
                <span>Web</span>
                <input value={draftWebsite} onChange={(event) => setDraftWebsite(event.target.value)} placeholder="https://empresa.com" />
              </label>
              {draftError ? <div className="notice notice-error">{draftError}</div> : null}
            </div>

            <div className="radix-dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="quick-pill quick-pill-ghost">Cancelar</button>
              </Dialog.Close>
              <button type="button" onClick={handleCreateDraftInvestor}>Crear cuenta</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </form>
  );
}

