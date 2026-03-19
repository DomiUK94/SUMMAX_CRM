"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CrmIcon } from "@/components/ui/crm-icon";

type ContactEmailDialogProps = {
  email: string;
  title?: string;
  description?: string;
  children: ReactNode;
};

export function ContactEmailDialog({
  email,
  title = "Correo del contacto",
  description = "Mostramos el email directamente sin abrir aplicaciones externas.",
  children
}: ContactEmailDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content contact-email-dialog-content">
          <div className="radix-dialog-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                <CrmIcon name="close" className="crm-icon" />
              </button>
            </Dialog.Close>
          </div>

          <div className="contact-email-dialog-body">
            <span className="contact-email-dialog-label">Email</span>
            <strong className="contact-email-dialog-value">{email}</strong>
          </div>

          <div className="radix-dialog-actions">
            <Dialog.Close asChild>
              <button type="button">Cerrar</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
