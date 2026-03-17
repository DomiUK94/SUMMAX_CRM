import type { OpportunityResolution } from "@/lib/db/opportunities";
import type { ProductRecord } from "@/lib/db/products";
import type { AssignableUser } from "@/lib/db/users";

type Props = {
  defaults: {
    name: string;
    ownerUserId: string;
    notes: string;
    resolution: OpportunityResolution;
    productId: string;
    estimatedAmount: string;
    closedAmount: string;
  };
  users: AssignableUser[];
  products: ProductRecord[];
  action: (formData: FormData) => Promise<void>;
};

export function EditOpportunityForm({ defaults, users, products, action }: Props) {
  return (
    <form action={action} className="deal-task-form">
      <div className="company-record-section-head">
        <div>
          <h3>Editar opportunity</h3>
          <p className="muted">Actualiza owner, producto, importes, notas y resolución administrativa.</p>
        </div>
      </div>

      <label className="form-field">
        <span>Nombre</span>
        <input name="name" defaultValue={defaults.name} placeholder="Nombre de la opportunity" />
      </label>

      <label className="form-field">
        <span>Producto</span>
        <select name="product_id" defaultValue={defaults.productId}>
          {products.filter((product) => product.active).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
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
        <span>Importe estimado</span>
        <input name="estimated_amount" defaultValue={defaults.estimatedAmount} placeholder="Ej. 250000" />
      </label>

      <label className="form-field">
        <span>Importe cerrado</span>
        <input name="closed_amount" defaultValue={defaults.closedAmount} placeholder="Ej. 200000" />
      </label>

      <label className="form-field">
        <span>Resolución</span>
        <select name="resolution" defaultValue={defaults.resolution}>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>

      <label className="form-field deal-task-form-notes">
        <span>Notas</span>
        <textarea name="notes" rows={5} defaultValue={defaults.notes} placeholder="Notas internas de la opportunity..." />
      </label>

      <div className="deal-convert-actions">
        <button type="submit">Guardar opportunity</button>
      </div>
    </form>
  );
}
