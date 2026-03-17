type StateOption = {
  id: string;
  name: string;
};

type Props = {
  title: string;
  subtitle: string;
  emptyMessage: string;
  submitLabel: string;
  states: StateOption[];
  action: (formData: FormData) => Promise<void>;
};

export function ChangePipelineStateForm({
  title,
  subtitle,
  emptyMessage,
  submitLabel,
  states,
  action
}: Props) {
  if (states.length === 0) {
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
        <span>Estado destino</span>
        <select name="target_state_id" required defaultValue="">
          <option value="">Selecciona un estado</option>
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field deal-task-form-notes">
        <span>Motivo</span>
        <textarea name="notes" rows={4} placeholder="Explica el motivo del cambio manual..." />
      </label>

      <div className="deal-convert-actions">
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
