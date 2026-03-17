"use client";

import { useMemo, useState } from "react";

type EntityOption = {
  id: string;
  label: string;
  stateId: string;
};

type TaskOption = {
  id: string;
  label: string;
  stateId: string;
};

type Props = {
  title: string;
  subtitle: string;
  entityLabel: string;
  entityName: string;
  entityFieldName: string;
  submitLabel: string;
  entities: EntityOption[];
  tasks: TaskOption[];
  action: (formData: FormData) => Promise<void>;
};

export function TaskQuickEntryForm({
  title,
  subtitle,
  entityLabel,
  entityName,
  entityFieldName,
  submitLabel,
  entities,
  tasks,
  action
}: Props) {
  const [selectedEntityId, setSelectedEntityId] = useState("");

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === selectedEntityId) ?? null,
    [entities, selectedEntityId]
  );

  const filteredTasks = useMemo(() => {
    if (!selectedEntity) return [];
    return tasks.filter((task) => task.stateId === selectedEntity.stateId);
  }, [selectedEntity, tasks]);

  return (
    <form action={action} className="deal-task-form">
      <div className="company-record-section-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
      </div>

      <label className="form-field">
        <span>{entityLabel}</span>
        <select
          name={entityFieldName}
          required
          value={selectedEntityId}
          onChange={(event) => setSelectedEntityId(event.target.value)}
        >
          <option value="">{`Selecciona ${entityName}`}</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Tarea</span>
        <select name="task_id" required defaultValue="" disabled={!selectedEntity}>
          <option value="">
            {selectedEntity ? "Selecciona una tarea" : `Primero elige ${entityName}`}
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

      <div className="deal-convert-actions">
        <button type="submit" disabled={!selectedEntity}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
