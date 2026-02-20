import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type SearchProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function SearchPage({ searchParams }: SearchProps) {
  const user = await requireUser();
  const q = String(searchParams?.q ?? "").trim();
  const db = createSourceCrmServerClient();
  const pattern = `%${q}%`;

  const [contactsRes, investorsRes, dealsRes, activitiesRes] =
    q.length >= 2
      ? await Promise.all([
          db
            .from("contactos")
            .select("contact_id, persona_contacto, compania, email")
            .or(`persona_contacto.ilike.${pattern},compania.ilike.${pattern},email.ilike.${pattern}`)
            .limit(20),
          db
            .from("inversion")
            .select("company_id, compania, vertical")
            .or(`compania.ilike.${pattern},vertical.ilike.${pattern},web.ilike.${pattern}`)
            .limit(20),
          db
            .from("inversion")
            .select("company_id, compania, prioridad, inversion_maxima")
            .or(`compania.ilike.${pattern},prioridad.ilike.${pattern},inversion_maxima.ilike.${pattern}`)
            .limit(20),
          db
            .from("activities")
            .select("id, title, entity_type, occurred_at")
            .or(`title.ilike.${pattern},body.ilike.${pattern},activity_type.ilike.${pattern}`)
            .limit(20)
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <AppShell title="Busqueda global" subtitle="Contactos, Cuentas, Negocios y Actividades" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <form method="get" className="entity-toolbar">
            <input className="toolbar-search" name="q" defaultValue={q} placeholder="Escribe al menos 2 caracteres..." />
            <button type="submit">Buscar</button>
          </form>
        </div>

        <div className="card">
          <h3>Contactos ({contactsRes.data?.length ?? 0})</h3>
          <div className="stack">
            {(contactsRes.data ?? []).map((c) => (
              <Link key={c.contact_id} href={`/contacts/${c.contact_id}`}>
                {c.persona_contacto ?? "(sin nombre)"} | {c.compania ?? "--"} | {c.email ?? "--"}
              </Link>
            ))}
            {q.length >= 2 && (contactsRes.data ?? []).length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Cuentas ({investorsRes.data?.length ?? 0})</h3>
          <div className="stack">
            {(investorsRes.data ?? []).map((inv) => (
              <Link key={inv.company_id} href={`/investors/${inv.company_id}`}>
                {inv.compania} | {inv.vertical ?? "--"}
              </Link>
            ))}
            {q.length >= 2 && (investorsRes.data ?? []).length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Negocios ({dealsRes.data?.length ?? 0})</h3>
          <div className="stack">
            {(dealsRes.data ?? []).map((deal) => (
              <Link key={`${deal.company_id}-${deal.prioridad ?? "s"}`} href={`/investors/${deal.company_id}`}>
                {deal.compania} | {deal.prioridad ?? "--"} | {deal.inversion_maxima ?? "--"}
              </Link>
            ))}
            {q.length >= 2 && (dealsRes.data ?? []).length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Actividades ({activitiesRes.data?.length ?? 0})</h3>
          <div className="stack">
            {(activitiesRes.data ?? []).map((a) => (
              <p key={a.id}>
                {a.title ?? "(sin titulo)"} | {a.entity_type ?? "--"} |{" "}
                {a.occurred_at ? new Date(a.occurred_at).toLocaleString("es-ES") : "--"}
              </p>
            ))}
            {q.length >= 2 && (activitiesRes.data ?? []).length === 0 ? <p className="muted">Sin resultados.</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
