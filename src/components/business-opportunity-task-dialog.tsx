"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { OpportunityTaskEntryForm } from "@/components/opportunity-task-entry-form";
import { CrmIcon } from "@/components/ui/crm-icon";

type SourceOption = {
  id: string;
  label: string;
  mode: "existing_opportunity" | "convert_lead";
  leadId: string;
  opportunityId: string | null;
  currentStateId: string;
};

type TaskOption = {
  id: string;
  label: string;
  stateId: string;
};

type StateOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
};

export function BusinessOpportunityTaskDialog(props: {
  title: string;
  subtitle: string;
  sources: SourceOption[];
  tasks: TaskOption[];
  states: StateOption[];
  products: ProductOption[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="quick-pill business-prospect-add-trigger">
          <span className="quick-pill-icon" aria-hidden="true">
            +
          </span>
          <span>Oportunidad</span>
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

          <OpportunityTaskEntryForm
            title={props.title}
            subtitle={props.subtitle}
            sources={props.sources}
            tasks={props.tasks}
            states={props.states}
            products={props.products}
            action={props.action}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
