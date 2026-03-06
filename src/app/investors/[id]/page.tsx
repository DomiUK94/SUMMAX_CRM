import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { requireUser } from "@/lib/auth/session";
import { addComment, getInvestorById } from "@/lib/db/crm";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export default async function InvestorDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const data = await getInvestorById(params.id);
  const db = createSourceCrmServerClient();
  const [activitiesRes, auditRes] = await Promise.all([
    db.from("activities").select("id, title, activity_type, occurred_at, body").eq("entity_type", "investor").eq("entity_id", Number(params.id)).order("occurred_at", { ascending: false }).limit(10),
    db.from("audit_log").select("id, field, old_value, new_value, action, changed_by_email, changed_at").eq("entity_type", "investor").eq("entity_id", params.id).order("changed_at", { ascending: false }).limit(20)
  ]);

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
      <AppShell title="Cuenta" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Cuenta no encontrada.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={data.investor.name} subtitle="Detalle de la cuenta" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Resumen</h3>
            <div className="row" style={{ gap: 8 }}>
              <Link href={`/acuerdos/new?investor_id=${encodeURIComponent(params.id)}`} className="companies-tab">Nuevo negocio</Link>
              <Link href={`/actividades/new?investor_id=${encodeURIComponent(params.id)}`} className="companies-tab">Nueva actividad</Link>
            </div>
          </div>
          <p><strong>Categoría:</strong> {data.investor.category}</p>
          <p><strong>Estado:</strong> {data.investor.status_name ?? "-"}</p>
          <p><strong>Web:</strong> {data.investor.website ?? "-"}</p>
          <p><strong>Estrategia:</strong> {data.investor.strategy ?? "-"}</p>
        </div>

        <div className="card">
          <h3>Contactos vinculados</h3>
          <StaticTable
            columns={["Nombre", "Email", "Estado"]}
            rows={data.contacts.map((c) => [c.full_name, c.email ?? "-", c.status_name ?? "-"])}
            emptyLabel="Sin contactos."
          />
        </div>

        <div className="card">
          <h3>Comentarios</h3>
          <form action={addCommentAction} className="stack">
            <textarea name="body" rows={4} placeholder="Añadir comentario..." />
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

        <div className="card">
          <h3>Actividades relacionadas</h3>
          <div className="stack">
            {(activitiesRes.data ?? []).map((activity) => (
              <p key={activity.id}>{activity.title ?? "(sin titulo)"} | {activity.activity_type ?? "--"} | {activity.occurred_at ? new Date(activity.occurred_at).toLocaleString("es-ES") : "--"}</p>
            ))}
            {(activitiesRes.data ?? []).length === 0 ? <p className="muted">Sin actividades relacionadas.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Auditoria de cambios</h3>
          <div className="stack">
            {(auditRes.data ?? []).map((row) => (
              <p key={row.id} className="muted">{new Date(row.changed_at).toLocaleString("es-ES")} | {row.changed_by_email} | {row.action} | {row.field ?? "general"}: {row.old_value ?? "--"} {"->"} {row.new_value ?? "--"}</p>
            ))}
            {(auditRes.data ?? []).length === 0 ? <p className="muted">Sin cambios auditados.</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

