import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { addComment, getInvestorById } from "@/lib/db/crm";

export default async function InvestorDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const data = await getInvestorById(params.id);

  async function addCommentAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    await addComment({
      entity_type: "investor",
      entity_id: params.id,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });
    revalidatePath(`/investors/${params.id}`);
  }

  if (!data.investor) {
    return (
      <AppShell title="Fondo" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Fondo no encontrado.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={data.investor.name} subtitle="Detalle del fondo" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Resumen</h3>
          <p><strong>Categoria:</strong> {data.investor.category}</p>
          <p><strong>Estado:</strong> {data.investor.status_name ?? "-"}</p>
          <p><strong>Web:</strong> {data.investor.website ?? "-"}</p>
          <p><strong>Estrategia:</strong> {data.investor.strategy ?? "-"}</p>
        </div>

        <div className="card">
          <h3>Contactos vinculados</h3>
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Estado</th></tr></thead>
            <tbody>
              {data.contacts.map((c) => (
                <tr key={c.id}><td>{c.full_name}</td><td>{c.email ?? "-"}</td><td>{c.status_name ?? "-"}</td></tr>
              ))}
              {data.contacts.length === 0 ? <tr><td colSpan={3}>Sin contactos.</td></tr> : null}
            </tbody>
          </table>
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
