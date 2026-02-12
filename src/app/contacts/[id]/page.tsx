import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { addComment, changeContactStatus, getContactById } from "@/lib/db/crm";

const STATUS_OPTIONS = [
  "Nuevo",
  "Investigando",
  "Pendiente contacto",
  "Contactado",
  "Reply",
  "Reunion agendada",
  "Reunion realizada",
  "Evaluacion interna",
  "Negociacion",
  "Ganado",
  "Perdido",
  "En pausa"
];

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const data = await getContactById(params.id);

  async function addCommentAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    await addComment({
      entity_type: "contact",
      entity_id: params.id,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath(`/contacts/${params.id}`);
  }

  async function changeStatusAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const to_status_name = String(formData.get("to_status_name") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    if (!to_status_name) return;

    await changeContactStatus({
      contact_id: params.id,
      to_status_name,
      note,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath(`/contacts/${params.id}`);
    revalidatePath("/dashboard/me");
    revalidatePath("/dashboard/general");
  }

  if (!data.contact) {
    return (
      <AppShell title="Contacto" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Contacto no encontrado.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={data.contact.full_name} subtitle="Detalle del contacto" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Resumen</h3>
          <p><strong>Fondo:</strong> {data.contact.investor_name ?? "-"}</p>
          <p><strong>Email:</strong> {data.contact.email ?? "-"}</p>
          <p><strong>Telefono:</strong> {data.contact.phone ?? "-"}</p>
          <p><strong>Estado actual:</strong> {data.contact.status_name ?? "-"}</p>
        </div>

        <div className="card">
          <h3>Cambiar estado</h3>
          <form action={changeStatusAction} className="stack">
            <select name="to_status_name" defaultValue={data.contact.status_name ?? "Nuevo"}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <textarea name="note" rows={3} placeholder="Nota del cambio (opcional)" />
            <button type="submit">Actualizar estado</button>
          </form>
        </div>

        <div className="card">
          <h3>Comentarios</h3>
          <form action={addCommentAction} className="stack">
            <textarea name="body" rows={4} placeholder="Anadir comentario..." />
            <button type="submit">Guardar comentario</button>
          </form>
          <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
          <div className="stack">
            {data.comments.map((c) => (
              <div key={c.id} className="card">
                <div className="muted">{c.created_by_email} - {new Date(c.created_at).toLocaleString("es-ES")}</div>
                <div>{c.body}</div>
              </div>
            ))}
            {data.comments.length === 0 ? <div className="muted">Sin comentarios.</div> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
