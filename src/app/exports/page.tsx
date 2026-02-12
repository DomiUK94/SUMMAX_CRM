import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function ExportsPage() {
  const user = await requireUser();

  return (
    <AppShell title="Exportaciones" subtitle="CSV general y detallado" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card stack">
        <p>Descarga reportes en CSV para trabajo externo.</p>
        <div className="row" style={{ justifyContent: "start" }}>
          <Link href="/api/exports/csv?mode=general">Descargar CSV General</Link>
          <Link href="/api/exports/csv?mode=detail">Descargar CSV Detallado</Link>
        </div>
      </div>
    </AppShell>
  );
}
