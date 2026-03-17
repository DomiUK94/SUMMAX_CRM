"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CrmIcon } from "@/components/ui/crm-icon";

type Props = {
  iconOnly?: boolean;
  action: (formData: FormData) => void | Promise<void>;
  defaults: {
    full_name: string;
    email: string;
    phone: string;
    role: string;
    other_contact: string;
    linkedin: string;
    comments: string;
  };
};

export function ContactProfileEditDialog({ action, defaults, iconOnly = false }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className={`company-profile-edit-button${iconOnly ? " company-profile-edit-button-icon-only" : ""}`}>
          <CrmIcon name="edit_record" className="crm-icon" />
          {iconOnly ? null : <span>Modificar datos</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content company-edit-dialog-content">
          <div className="radix-dialog-head">
            <div>
              <Dialog.Title>Modificar datos</Dialog.Title>
              <Dialog.Description>Actualiza los datos principales del contacto sin salir de la ficha.</Dialog.Description>
            </div>
                        <Dialog.Close asChild>
              <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                <CrmIcon name="close" className="crm-icon" />
              </button>
            </Dialog.Close>
          </div>

          <form action={action} className="editor-form-grid editor-form-grid-3 company-detail-form">
            <label className="form-field company-detail-field-span-2">
              <span>Nombre</span>
              <input name="full_name" defaultValue={defaults.full_name} required />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input name="email" defaultValue={defaults.email} />
            </label>
            <label className="form-field">
              <span>{"Tel\u00e9fono"}</span>
              <input name="phone" defaultValue={defaults.phone} />
            </label>
            <label className="form-field">
              <span>Rol</span>
              <input name="role" defaultValue={defaults.role} />
            </label>
            <label className="form-field company-detail-field-span-2">
              <span>Otro contacto</span>
              <input name="other_contact" defaultValue={defaults.other_contact} />
            </label>
            <label className="form-field">
              <span>LinkedIn</span>
              <input name="linkedin" defaultValue={defaults.linkedin} />
            </label>
            <label className="form-field company-detail-field-span-3">
              <span>Comentarios</span>
              <textarea name="comments" rows={5} defaultValue={defaults.comments} />
            </label>
            <div className="radix-dialog-actions company-detail-field-span-3">
              <Dialog.Close asChild>
                <button type="button">Cancelar</button>
              </Dialog.Close>
              <button type="submit" className="button-outline-danger editor-save-button">Guardar cambios</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
