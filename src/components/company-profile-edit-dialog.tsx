"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CrmIcon } from "@/components/ui/crm-icon";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  defaults: {
    name: string;
    category: string;
    website: string;
    strategy: string;
    priority: string;
    office: string;
    company_size: string;
    min_investment: string;
    max_investment: string;
    address: string;
    linkedin: string;
    portfolio: string;
    fit: string;
    reason: string;
    comments: string;
  };
};

export function CompanyProfileEditDialog({ action, defaults }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="company-profile-edit-button"><CrmIcon name="edit_record" className="crm-icon" /><span>Modificar datos</span></button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content company-edit-dialog-content">
          <div className="radix-dialog-head">
            <div>
              <Dialog.Title>Modificar datos</Dialog.Title>
              <Dialog.Description>Actualiza los datos principales de la compañia sin salir de la ficha.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="radix-dialog-close" aria-label="Cerrar">×</button>
            </Dialog.Close>
          </div>

          <form action={action} className="editor-form-grid editor-form-grid-3 company-detail-form">
            <label className="form-field">
              <span>Nombre</span>
              <input name="name" defaultValue={defaults.name} required />
            </label>
            <label className="form-field">
              <span>{"Categor\u00eda"}</span>
              <input name="category" defaultValue={defaults.category} />
            </label>
            <label className="form-field">
              <span>Web</span>
              <input name="website" defaultValue={defaults.website} />
            </label>
            <label className="form-field">
              <span>Estrategia</span>
              <input name="strategy" defaultValue={defaults.strategy} />
            </label>
            <label className="form-field">
              <span>Prioridad</span>
              <input name="priority" defaultValue={defaults.priority} />
            </label>
            <label className="form-field">
              <span>Sede</span>
              <input name="office" defaultValue={defaults.office} />
            </label>
            <label className="form-field">
              <span>Tamaño</span>
              <input name="company_size" defaultValue={defaults.company_size} />
            </label>
            <label className="form-field">
              <span>Inv. mínima</span>
              <input name="min_investment" defaultValue={defaults.min_investment} />
            </label>
            <label className="form-field">
              <span>Inv. máxima</span>
              <input name="max_investment" defaultValue={defaults.max_investment} />
            </label>
            <label className="form-field company-detail-field-span-2">
              <span>Dirección</span>
              <input name="address" defaultValue={defaults.address} />
            </label>
            <label className="form-field">
              <span>LinkedIn</span>
              <input name="linkedin" defaultValue={defaults.linkedin} />
            </label>
            <label className="form-field">
              <span>Portfolio</span>
              <input name="portfolio" defaultValue={defaults.portfolio} />
            </label>
            <label className="form-field">
              <span>Encaje SUMMAX</span>
              <input name="fit" defaultValue={defaults.fit} />
            </label>
            <label className="form-field company-detail-field-span-2">
              <span>Motivo</span>
              <input name="reason" defaultValue={defaults.reason} />
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
