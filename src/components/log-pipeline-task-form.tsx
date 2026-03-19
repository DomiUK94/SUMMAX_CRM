import { TaskOccurredAtField } from "@/components/task-occurred-at-field";

type TaskOption = {
  id: string;
  name: string;
  taskKind: "action" | "feedback";
  resultingStateName: string | null;
};

type Props = {
  title: string;
  subtitle: string;
  emptyMessage: string;
  submitLabel: string;
  tasks: TaskOption[];
  action: (formData: FormData) => Promise<void>;
};

export function LogPipelineTaskForm({
  title,
  subtitle,
  emptyMessage,
  submitLabel,
  tasks,
  action
}: Props) {
  if (tasks.length === 0) {
    return (
      <div className="deal-empty-panel">
        <h4>{title}</h4>
        <p className="muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <form action={action} className="deal-task-form">
      <div className="company-record-section-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
      </div>

      <label className="form-field">
        <span>Tarea</span>
        <select name="task_id" required defaultValue="">
          <option value="">Selecciona una tarea</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name} · {task.taskKind === "action" ? "Accion" : "Feedback"}
              {task.resultingStateName ? ` · ${task.resultingStateName}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field deal-task-form-notes">
        <span>Notas</span>
        <textarea name="notes" rows={4} placeholder="Contexto o resultado de la tarea..." />
      </label>

      <TaskOccurredAtField />

      <div className="deal-convert-actions">
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
