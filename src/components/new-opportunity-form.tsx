import type { ProductRecord } from "@/lib/db/products";
import type { AssignableUser } from "@/lib/db/users";

type LeadOption = {
  id: string;
  name: string;
  companyName: string;
  contactName: string;
};

type StateOption = {
  id: string;
  name: string;
};

type Props = {
  leads: LeadOption[];
  products: ProductRecord[];
  states: StateOption[];
  users: AssignableUser[];
  defaultOwnerUserId: string;
  defaultLeadId?: string;
  createOpportunityAction: (formData: FormData) => Promise<void>;
};

export function NewOpportunityForm({
  leads,
  products,
  states,
  users,
  defaultOwnerUserId,
  defaultLeadId,
  createOpportunityAction
}: Props) {
  return (
    <form action={createOpportunityAction} className="contact-new-form card">
      <div className="contact-new-grid">
        <label className="form-field contact-new-field-wide">
          <span>Lead origen</span>
          <select name="lead_id" required defaultValue={defaultLeadId ?? ""}>
            <option value="">Selecciona un lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name} · {lead.companyName} · {lead.contactName}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Producto</span>
          <select name="product_id" required defaultValue="">
            <option value="">Selecciona un producto</option>
            {products.filter((product) => product.active).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Estado inicial</span>
          <select name="current_state_id" required defaultValue={states[0]?.id ?? ""}>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field contact-new-field-wide">
          <span>Nombre</span>
          <input name="name" placeholder="Ej. Franquicia Iberia 2026" />
        </label>

        <label className="form-field">
          <span>Owner</span>
          <select name="owner_user_id" defaultValue={defaultOwnerUserId}>
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
          <input name="estimated_amount" placeholder="Ej. 250000" />
        </label>

        <label className="form-field">
          <span>Importe cerrado</span>
          <input name="closed_amount" placeholder="Opcional" />
        </label>

        <label className="form-field contact-new-field-full">
          <span>Notas</span>
          <textarea name="notes" rows={5} placeholder="Contexto inicial de la opportunity..." />
        </label>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="submit">Crear opportunity</button>
      </div>
    </form>
  );
}
