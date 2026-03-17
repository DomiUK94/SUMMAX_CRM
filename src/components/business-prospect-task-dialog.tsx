"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ProspectTaskEntryForm } from "@/components/prospect-task-entry-form";
import { CrmIcon } from "@/components/ui/crm-icon";

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

export function BusinessProspectTaskDialog(props: {
  title: string;
  subtitle: string;
  contacts: ContactOption[];
  tasks: TaskOption[];
  taskOccurrences: Array<{ contactId: string; taskId: string; occurredAt: string }>;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="quick-pill business-prospect-add-trigger">
          <span className="quick-pill-icon" aria-hidden="true">
            +
          </span>
          <span>Prospecto</span>
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

          <ProspectTaskEntryForm
            title={props.title}
            subtitle={props.subtitle}
            contacts={props.contacts}
            tasks={props.tasks}
            taskOccurrences={props.taskOccurrences}
            action={props.action}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
