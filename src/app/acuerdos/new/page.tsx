import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function NewDealPage({
  searchParams
}: {
  searchParams?: { investor_id?: string; contact_id?: string };
}) {
  const user = await requireUser();
  const investorId = String(searchParams?.investor_id ?? "").trim();
  const contactId = String(searchParams?.contact_id ?? "").trim();

  return (
    <AppShell title="Nuevo negocio" subtitle="Alta contextual desde cuenta" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card stack">
        <p>
          Cuenta origen: <strong>{investorId || "(sin contexto)"}</strong>
        </p>
        <p>
          Contacto origen: <strong>{contactId || "(sin contexto)"}</strong>
        </p>
        <p className="muted">Esta ruta queda preparada para crear un negocio nuevo vinculado a la cuenta.</p>
        {investorId ? (
          <Link href={`/investors/${encodeURIComponent(investorId)}`} className="companies-tab" style={{ width: "fit-content" }}>
            Volver a la cuenta
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
