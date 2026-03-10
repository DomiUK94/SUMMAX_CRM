"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CrmIcon } from "@/components/ui/crm-icon";

type NoteItem = {
  id: string;
  body: string;
  created_at: string;
  created_by_email: string | null;
};

type Props = {
  notes: NoteItem[];
  action: (formData: FormData) => void | Promise<void>;
};

export function CompanyNotesDialog({ notes, action }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="company-record-action-pill company-record-action-button">
          <span className="company-record-action-icon"><CrmIcon name="report" className="crm-icon" /></span>
          <span>Nota</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content company-edit-dialog-content">
          <div className="radix-dialog-head">
            <div>
              <Dialog.Title>Notas</Dialog.Title>
              <Dialog.Description>Añade tantas notas como necesites para esta compañia.</Dialog.Description>
            </div>
                        <Dialog.Close asChild>
              <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                <CrmIcon name="close" className="crm-icon" />
              </button>
            </Dialog.Close>
          </div>

          <form action={action} className="stack">
            <textarea name="body" rows={5} placeholder="Escribe una nota interna..." required />
            <div className="radix-dialog-actions">
              <Dialog.Close asChild>
                <button type="button">Cancelar</button>
              </Dialog.Close>
              <button type="submit" className="button-outline-danger editor-save-button">Guardar nota</button>
            </div>
          </form>

          <div className="company-note-list stack">
            {notes.map((note) => (
              <div key={note.id} className="company-note-item">
                <div className="muted">{note.created_by_email ?? "sourcecrm"} | {note.created_at}</div>
                <p>{note.body}</p>
              </div>
            ))}
            {notes.length === 0 ? <p className="muted">Sin notas todavía.</p> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
