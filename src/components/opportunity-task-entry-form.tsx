"use client";

import { useMemo, useState } from "react";
import { TaskOccurredAtField } from "@/components/task-occurred-at-field";

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

type Props = {
  title: string;
  subtitle: string;
  sources: SourceOption[];
  tasks: TaskOption[];
  states: StateOption[];
  products: ProductOption[];
  action: (formData: FormData) => Promise<void>;
};

export function OpportunityTaskEntryForm({ title, subtitle, sources, tasks, states, products, action }: Props) {
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedStateId, setSelectedStateId] = useState(states[0]?.id ?? "");

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources]
  );

  const taskStateId = selectedSource?.mode === "existing_opportunity" ? selectedSource.currentStateId : selectedStateId;
  const filteredTasks = useMemo(() => {
    if (!taskStateId) return [];
    return tasks.filter((task) => task.stateId === taskStateId);
  }, [taskStateId, tasks]);

  return (
    <form action={action} className="deal-task-form prospect-task-form">
      <div className="company-record-section-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
      </div>

      <label className="form-field">
        <span>Origen</span>
        <select
          name="source_id"
          required
          value={selectedSourceId}
          onChange={(event) => {
            setSelectedSourceId(event.target.value);
            setSelectedStateId(states[0]?.id ?? "");
          }}
        >
          <option value="">Selecciona lead u oportunidad</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>

      {selectedSource?.mode === "existing_opportunity" ? (
        <div className="task-empty-state">
          <strong>La tarea se registrara en la oportunidad activa</strong>
          <p className="muted">Esta oportunidad ya existe y la tarea quedara trazada directamente sobre ella.</p>
        </div>
      ) : null}

      {selectedSource?.mode === "convert_lead" ? (
        <div className="task-empty-state">
          <strong>Esta oportunidad se creara desde un lead</strong>
          <p className="muted">Al guardar, el sistema convertira ese lead en oportunidad y registrara la tarea elegida en la nueva oportunidad.</p>
        </div>
      ) : null}

      {selectedSource?.mode === "convert_lead" ? (
        <>
          <label className="form-field">
            <span>Producto</span>
            <select name="product_id" required defaultValue="">
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Estado inicial</span>
            <select name="current_state_id" required value={selectedStateId} onChange={(event) => setSelectedStateId(event.target.value)}>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <label className="form-field">
        <span>Tarea</span>
        <select name="task_id" required defaultValue="" disabled={!selectedSource || filteredTasks.length === 0}>
          <option value="">
            {!selectedSource ? "Primero elige un origen" : filteredTasks.length === 0 ? "No hay tareas para ese estado" : "Selecciona una tarea"}
          </option>
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

      {selectedSource ? <input type="hidden" name="source_mode" value={selectedSource.mode} /> : null}
      {selectedSource?.leadId ? <input type="hidden" name="lead_id" value={selectedSource.leadId} /> : null}
      {selectedSource?.opportunityId ? <input type="hidden" name="opportunity_id" value={selectedSource.opportunityId} /> : null}

      <div className="deal-convert-actions">
        <button type="submit" disabled={!selectedSource || filteredTasks.length === 0}>
          Guardar tarea
        </button>
      </div>
    </form>
  );
}
