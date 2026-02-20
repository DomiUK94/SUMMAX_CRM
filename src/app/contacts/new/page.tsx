import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createContact, listInvestors } from "@/lib/db/crm";

export default async function NewContactPage() {
  const user = await requireUser();
  const investors = await listInvestors();

  async function createContactAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    const investorId = String(formData.get("investor_id") ?? "").trim();
    const fullName = String(formData.get("full_name") ?? "").trim();
    if (!investorId || !fullName) return;

    const assignOwner = String(formData.get("assign_owner") ?? "yes") === "yes";
    await createContact({
      investor_id: investorId,
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || undefined,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      role: String(formData.get("role") ?? "").trim() || undefined,
      other_contact: String(formData.get("other_contact") ?? "").trim() || undefined,
      linkedin: String(formData.get("linkedin") ?? "").trim() || undefined,
      comments: String(formData.get("comments") ?? "").trim() || undefined,
      status_name: String(formData.get("status_name") ?? "").trim() || undefined,
      owner_user_id: assignOwner ? actor.id : undefined,
      owner_email: assignOwner ? actor.email : undefined,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath("/contacts");
    redirect("/contacts?tab=all&page=1");
  }

  return (
    <AppShell title="Nuevo contacto" subtitle="Alta manual de contacto" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card" style={{ maxWidth: 900 }}>
        <form action={createContactAction} className="stack">
          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label>Cuenta</label>
              <select name="investor_id" required style={{ width: "100%" }}>
                <option value="">Selecciona una cuenta</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Nombre del contacto</label>
              <input name="full_name" required placeholder="Nombre y apellidos" style={{ width: "100%" }} />
            </div>
          </div>

          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label>Email</label>
              <input name="email" type="email" placeholder="email@empresa.com" style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Teléfono</label>
              <input name="phone" placeholder="+34 ..." style={{ width: "100%" }} />
            </div>
          </div>

          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label>Rol</label>
              <input name="role" placeholder="Socio, director, analista..." style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Otro contacto</label>
              <input name="other_contact" placeholder="Dato extra de contacto" style={{ width: "100%" }} />
            </div>
          </div>

          <div>
            <label>LinkedIn</label>
            <input name="linkedin" placeholder="https://linkedin.com/in/..." style={{ width: "100%" }} />
          </div>

          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label>Estado</label>
              <input name="status_name" placeholder="Nuevo, En progreso..." style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Owner</label>
              <select name="assign_owner" defaultValue="yes" style={{ width: "100%" }}>
                <option value="yes">Asignarme como owner</option>
                <option value="no">Sin owner</option>
              </select>
            </div>
          </div>

          <div>
            <label>Comentarios</label>
            <textarea name="comments" rows={5} placeholder="Notas internas..." style={{ width: "100%" }} />
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="submit">Crear contacto</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
