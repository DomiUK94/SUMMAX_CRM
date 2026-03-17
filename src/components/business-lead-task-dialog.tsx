"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LeadTaskEntryForm } from "@/components/lead-task-entry-form";
import { CrmIcon } from "@/components/ui/crm-icon";

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

export function BusinessLeadTaskDialog(props: {
  title: string;
  subtitle: string;
  contacts: ContactOption[];
  tasks: TaskOption[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="quick-pill business-prospect-add-trigger">
          <span className="quick-pill-icon" aria-hidden="true">
            +
          </span>
          <span>Lead</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="radix-dialog-overlay" />
        <Dialog.Content className="radix-dialog-content business-prospect-task-dialog-content">
          <div className="radix-dialog-head">
            <div>
              <Dialog.Title>{props.title}</Dialog.Title>
              <Dialog.Description>{props.subtitle}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                <CrmIcon name="close" className="crm-icon" />
              </button>
            </Dialog.Close>
          </div>

          <LeadTaskEntryForm
            title={props.title}
            subtitle={props.subtitle}
            contacts={props.contacts}
            tasks={props.tasks}
            action={props.action}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
