import type { LeadResolution } from "@/lib/db/leads";
import type { AssignableUser } from "@/lib/db/users";

type Props = {
  defaults: {
    name: string;
    ownerUserId: string;
    notes: string;
    resolution: LeadResolution;
  };
  users: AssignableUser[];
  action: (formData: FormData) => Promise<void>;
};

export function EditLeadForm({ defaults, users, action }: Props) {
  return (
    <form action={action} className="deal-task-form">
      <div className="company-record-section-head">
        <div>
          <h3>Editar lead</h3>
          <p className="muted">Actualiza owner, nombre, notas o resolución administrativa del lead.</p>
        </div>
      </div>

      <label className="form-field">
        <span>Nombre</span>
        <input name="name" defaultValue={defaults.name} placeholder="Nombre del lead" />
      </label>

      <label className="form-field">
        <span>Owner</span>
        <select name="owner_user_id" defaultValue={defaults.ownerUserId}>
          <option value="">Sin propietario</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Resolución</span>
        <select name="resolution" defaultValue={defaults.resolution}>
          <option value="open">Open</option>
          <option value="converted">Converted</option>
          <option value="discarded">Discarded</option>
          <option value="closed">Closed</option>
        </select>
      </label>

      <label className="form-field deal-task-form-notes">
        <span>Notas</span>
        <textarea name="notes" rows={5} defaultValue={defaults.notes} placeholder="Notas internas del lead..." />
      </label>

      <div className="deal-convert-actions">
        <button type="submit">Guardar lead</button>
      </div>
    </form>
  );
}
