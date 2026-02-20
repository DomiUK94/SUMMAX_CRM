import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type Params = {
  params: {
    id: string;
  };
};

export default async function SugerenciaDetailPage({ params }: Params) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const suggestionId = params.id;

  async function addEventAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const db = createSourceCrmServerClient();
    const eventType = String(formData.get("event_type") ?? "nota").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    const normalizedEventType = eventType === "feedback" ? "feedback" : "nota";
    await db.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: normalizedEventType,
      body,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    await db
      .from("suggestions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", suggestionId);

    revalidatePath(`/sugerencias/${suggestionId}`);
    revalidatePath("/sugerencias");
  }

  const [{ data: suggestion }, { data: events }] = await Promise.all([
    db
      .from("suggestions")
      .select("id, suggestion_text, status, created_by_user_id, created_by_email, created_at, updated_at")
      .eq("id", suggestionId)
      .maybeSingle(),
    db
      .from("suggestion_events")
      .select("id, event_type, body, created_by_user_id, created_by_email, created_at")
      .eq("suggestion_id", suggestionId)
      .order("created_at", { ascending: false })
      .limit(400)
  ]);

  if (!suggestion) {
    return (
      <AppShell title="Sugerencias" canViewGlobal={user.can_view_global_dashboard}>
        <div className="card">Sugerencia no encontrada.</div>
      </AppShell>
    );
  }

  const participantIds = Array.from(
    new Set((events ?? []).map((e) => e.created_by_user_id).filter((id): id is string => Boolean(id)))
  );
  const { data: participants } = participantIds.length
    ? await db.from("users").select("id, full_name, email").in("id", participantIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };
  const nameById = new Map((participants ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]));
  const ownerDisplayName = nameById.get(suggestion.created_by_user_id) ?? suggestion.created_by_email;

  return (
    <AppShell title="Sugerencias" subtitle="Historial y seguimiento" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Detalle de sugerencia</h3>
            <Link href="/sugerencias" className="contacts-tab">
              Volver
            </Link>
          </div>
          <p><strong>Usuario:</strong> {ownerDisplayName}</p>
          <p><strong>Estado:</strong> {suggestion.status}</p>
          <p><strong>Creada:</strong> {new Date(suggestion.created_at).toLocaleString("es-ES")}</p>
          <p><strong>Actualizada:</strong> {new Date(suggestion.updated_at).toLocaleString("es-ES")}</p>
          <p><strong>Sugerencia:</strong> {suggestion.suggestion_text}</p>
        </div>

        <div className="card">
          <h3>Añadir nota o feedback</h3>
          <form action={addEventAction} className="stack" style={{ maxWidth: 760 }}>
            <div className="row" style={{ justifyContent: "start", gap: 8 }}>
              <label>
                Tipo
                <select name="event_type" defaultValue="nota">
                  <option value="nota">nota</option>
                  <option value="feedback">feedback</option>
                </select>
              </label>
            </div>
            <textarea name="body" rows={4} placeholder="Escribe aquí la nota o feedback..." required />
            <div>
              <button type="submit">Guardar en historial</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Historial de actividades</h3>
          <div className="suggestion-history">
            {(events ?? []).map((e) => {
              const isOwner = Boolean(suggestion.created_by_user_id) && e.created_by_user_id === suggestion.created_by_user_id;
              return (
                <article key={e.id} className={`suggestion-bubble ${isOwner ? "suggestion-bubble-owner" : "suggestion-bubble-other"}`}>
                  <div className="muted">
                    {(e.created_by_user_id ? nameById.get(e.created_by_user_id) : null) ?? e.created_by_email} - {e.event_type} -{" "}
                    {new Date(e.created_at).toLocaleString("es-ES")}
                  </div>
                  <p style={{ margin: "6px 0 0" }}>{e.body}</p>
                </article>
              );
            })}
            {(events ?? []).length === 0 ? <p className="muted">Sin historial todavía.</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
