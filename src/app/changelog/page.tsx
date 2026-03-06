import { promises as fs } from "fs";
import path from "path";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

function cleanSuggestionText(rawText: string) {
  return rawText
    .replace(/\[Modulo:[^\]]+\]\s*/gi, "")
    .replace(/\[Prioridad:[^\]]+\]\s*/gi, "")
    .replace(/\[Impacto:[^\]]+\]\s*/gi, "")
    .trim();
}

export default async function ChangeLogPage() {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const filePath = path.join(process.cwd(), "ChangeLog.md");

  let content = "";
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    content = "# ChangeLog\n\nNo se encontro el archivo `ChangeLog.md`.";
  }
  const { data: resolved } = await db
    .from("suggestions")
    .select("id, suggestion_text, suggestion_type, priority_level, impact_scope, updated_at")
    .eq("status", "resuelta")
    .order("updated_at", { ascending: false })
    .limit(120);

  const resolvedRows = resolved ?? [];
  const byVersionDate = new Map<string, typeof resolvedRows>();
  resolvedRows.forEach((item) => {
    const dateKey = new Date(item.updated_at).toISOString().slice(0, 10);
    const list = byVersionDate.get(dateKey) ?? [];
    list.push(item);
    byVersionDate.set(dateKey, list);
  });
  const versionBlocks = [...byVersionDate.entries()];

  return (
    <AppShell title="ChangeLog" subtitle="Resumen diario de cambios de la aplicacion" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card">
        <pre className="changelog-pre">{content}</pre>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>ChangeLog automatico por sugerencias resueltas</h3>
        {versionBlocks.length === 0 ? <p className="muted">Aun no hay sugerencias resueltas para generar versiones automaticas.</p> : null}
        <div className="stack">
          {versionBlocks.map(([dateKey, items]) => (
            <section key={dateKey} className="panel-card">
              <h4 style={{ margin: "0 0 8px 0" }}>Version v{dateKey.replace(/-/g, ".")}</h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {items.map((item) => (
                  <li key={item.id}>
                    [{item.suggestion_type ?? "sugerencia"} | {item.priority_level ?? "media"} | {item.impact_scope ?? "equipo"}]{" "}
                    {cleanSuggestionText(item.suggestion_text)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
