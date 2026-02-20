import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    ok?: string;
    error?: string;
    tab?: string;
  };
};

const STATUS_OPTIONS = ["abierta", "en_revision", "planificada", "en_progreso", "resuelta", "descartada"] as const;
type SuggestionsTab = "mine" | "mine_closed" | "all";
const CLOSED_STATUS = ["resuelta", "descartada"];

function normalizeTab(value: string | undefined): SuggestionsTab {
  if (value === "mine" || value === "mine_closed" || value === "all") return value;
  return "mine";
}

function hrefForTab(tab: SuggestionsTab): string {
  return `/sugerencias?tab=${tab}`;
}

export default async function SugerenciasPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const isAdmin = user.role === "admin";
  const activeTab = normalizeTab(searchParams?.tab);

  async function createSuggestionAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const db = createSourceCrmServerClient();
    const suggestionText = String(formData.get("suggestion_text") ?? "").trim();
    if (!suggestionText) {
      redirect("/sugerencias?error=sugerencia_vacia");
    }

    const created = await db
      .from("suggestions")
      .insert({
        suggestion_text: suggestionText,
        status: "abierta",
        created_by_user_id: actor.id,
        created_by_email: actor.email,
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (created.error || !created.data) {
      redirect(`/sugerencias?error=${encodeURIComponent(created.error?.message ?? "create_failed")}`);
    }

    await db.from("suggestion_events").insert({
      suggestion_id: created.data.id,
      event_type: "creacion",
      body: "Sugerencia creada",
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath("/sugerencias");
    redirect("/sugerencias?ok=created");
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const db = createSourceCrmServerClient();
    const suggestionId = String(formData.get("suggestion_id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const statusReason = String(formData.get("status_reason") ?? "").trim();
    if (!suggestionId || !STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) return;

    const updated = await db
      .from("suggestions")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", suggestionId);
    if (updated.error) return;

    await db.from("suggestion_events").insert({
      suggestion_id: suggestionId,
      event_type: "cambio_estado",
      body: statusReason ? `Estado actualizado a: ${status}. Motivo: ${statusReason}` : `Estado actualizado a: ${status}`,
      created_by_user_id: actor.id,
      created_by_email: actor.email
    });

    revalidatePath("/sugerencias");
  }

  let suggestionsQuery = db
    .from("suggestions")
    .select("id, suggestion_text, status, created_by_email, created_by_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeTab === "mine") {
    suggestionsQuery = suggestionsQuery.eq("created_by_user_id", user.id).not("status", "in", `(${CLOSED_STATUS.join(",")})`);
  } else if (activeTab === "mine_closed") {
    suggestionsQuery = suggestionsQuery.eq("created_by_user_id", user.id).in("status", CLOSED_STATUS);
  }

  const [{ data: suggestions }, mineCountRes, mineClosedCountRes, allCountRes] = await Promise.all([
    suggestionsQuery,
    db
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", user.id)
      .not("status", "in", `(${CLOSED_STATUS.join(",")})`),
    db
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", user.id)
      .in("status", CLOSED_STATUS),
    db.from("suggestions").select("id", { count: "exact", head: true })
  ]);

  const tabCounts = {
    mine: mineCountRes.count ?? 0,
    mine_closed: mineClosedCountRes.count ?? 0,
    all: allCountRes.count ?? 0
  };

  let kpis: {
    suggestionsWithoutResponse: number;
    newNonAdminNotes7d: number;
    pendingSuggestions: Array<{ id: string; suggestion_text: string; created_by_email: string; created_at: string }>;
  } | null = null;

  if (isAdmin) {
    const [{ data: admins }, { data: events }] = await Promise.all([
      db.from("users").select("id").eq("role", "admin").eq("is_active", true),
      db
        .from("suggestion_events")
        .select("suggestion_id, event_type, created_by_user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(5000)
    ]);

    const adminIds = new Set((admins ?? []).map((a) => a.id));
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const adminTouchedSuggestions = new Set(
      (events ?? [])
        .filter((e) => adminIds.has(e.created_by_user_id) && (e.event_type === "nota" || e.event_type === "feedback" || e.event_type === "cambio_estado"))
        .map((e) => e.suggestion_id)
    );

    const suggestionsWithoutResponse = (suggestions ?? []).filter(
      (s) => !adminIds.has(s.created_by_user_id) && !adminTouchedSuggestions.has(s.id)
    ).length;

    const newNonAdminNotes7d = (events ?? []).filter(
      (e) =>
        (e.event_type === "nota" || e.event_type === "feedback") &&
        !adminIds.has(e.created_by_user_id) &&
        new Date(e.created_at).getTime() >= sevenDaysAgo
    ).length;

    const pendingSuggestions = (suggestions ?? [])
      .filter((s) => !adminIds.has(s.created_by_user_id) && !adminTouchedSuggestions.has(s.id))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        suggestion_text: s.suggestion_text,
        created_by_email: s.created_by_email,
        created_at: s.created_at
      }));

    kpis = {
      suggestionsWithoutResponse,
      newNonAdminNotes7d,
      pendingSuggestions
    };
  }

  return (
    <AppShell title="Sugerencias" subtitle="Feedback para desarrollo y seguimiento" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        {isAdmin && kpis ? (
          <div className="card">
            <h3>Panel de control</h3>
            <div className="stats-grid">
              <div className="card">
                <strong>{kpis.suggestionsWithoutResponse}</strong>
                <div className="muted">Sugerencias sin responder</div>
              </div>
              <div className="card">
                <strong>{kpis.newNonAdminNotes7d}</strong>
                <div className="muted">Nuevas notas de no-admin (7 dias)</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Pendientes de respuesta</h4>
              <div className="stack">
                {kpis.pendingSuggestions.map((s) => (
                  <Link key={s.id} href={`/sugerencias/${encodeURIComponent(s.id)}`} className="contacts-tab">
                    {s.created_by_email} - {s.suggestion_text.length > 90 ? `${s.suggestion_text.slice(0, 90)}...` : s.suggestion_text}
                  </Link>
                ))}
                {kpis.pendingSuggestions.length === 0 ? <p className="muted">No hay pendientes de respuesta.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="card">
          <h3>Nueva sugerencia</h3>
          {searchParams?.ok === "created" ? <p style={{ color: "#0f766e" }}>Sugerencia enviada.</p> : null}
          {searchParams?.error ? <p style={{ color: "#b91c1c" }}>Error: {searchParams.error}</p> : null}
          <form action={createSuggestionAction} className="stack" style={{ maxWidth: 760 }}>
            <textarea name="suggestion_text" rows={4} placeholder="Escribe aqui la sugerencia para el desarrollador..." required />
            <div>
              <button type="submit">Enviar sugerencia</button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="contacts-top-tabs" style={{ marginBottom: 10 }}>
            <Link href={hrefForTab("mine")} className={`contacts-tab ${activeTab === "mine" ? "contacts-tab-active" : ""}`}>
              Mis sugerencias <span className="contacts-badge">{tabCounts.mine}</span>
            </Link>
            <Link href={hrefForTab("mine_closed")} className={`contacts-tab ${activeTab === "mine_closed" ? "contacts-tab-active" : ""}`}>
              Mis sugerencias cerradas <span className="contacts-badge">{tabCounts.mine_closed}</span>
            </Link>
            <Link href={hrefForTab("all")} className={`contacts-tab ${activeTab === "all" ? "contacts-tab-active" : ""}`}>
              Todas las sugerencias <span className="contacts-badge">{tabCounts.all}</span>
            </Link>
          </div>

          <h3>Listado de sugerencias</h3>
          <table>
            <thead>
              <tr>
                <th>Nombre de usuario</th>
                <th>Sugerencia</th>
                <th>Estado sugerencia</th>
                <th>Historial</th>
              </tr>
            </thead>
            <tbody>
              {(suggestions ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.created_by_email}</td>
                  <td>
                    <Link href={`/sugerencias/${encodeURIComponent(s.id)}`}>
                      {s.suggestion_text.length > 140 ? `${s.suggestion_text.slice(0, 140)}...` : s.suggestion_text}
                    </Link>
                  </td>
                  <td>
                    <form action={updateStatusAction} className="row" style={{ justifyContent: "start", gap: 8 }}>
                      <input type="hidden" name="suggestion_id" value={s.id} />
                      <select name="status" defaultValue={s.status}>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <input name="status_reason" placeholder="Motivo (opcional)" />
                      <button type="submit">Guardar</button>
                    </form>
                  </td>
                  <td>
                    <Link href={`/sugerencias/${encodeURIComponent(s.id)}`} className="contacts-tab">
                      Ver historial
                    </Link>
                  </td>
                </tr>
              ))}
              {(suggestions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4}>Todavia no hay sugerencias.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
