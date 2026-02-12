import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createInvestor, listInvestors } from "@/lib/db/crm";

export default async function InvestorsPage() {
  const user = await requireUser();
  const investors = await listInvestors();

  async function createInvestorAction(formData: FormData) {
    "use server";
    await requireUser();

    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    if (!name || !category) return;

    await createInvestor({ name, category, website: website || undefined });
    revalidatePath("/investors");
  }

  return (
    <AppShell title="Fondos" subtitle="Listado y alta manual" canViewGlobal={user.can_view_global_dashboard}>
      <div className="stack">
        <div className="card">
          <h3>Nuevo fondo</h3>
          <form action={createInvestorAction} className="row" style={{ alignItems: "end" }}>
            <div>
              <label>Nombre</label>
              <input name="name" required />
            </div>
            <div>
              <label>Categoria</label>
              <input name="category" required placeholder="Tecnologicos, Deuda..." />
            </div>
            <div>
              <label>Web</label>
              <input name="website" placeholder="https://..." />
            </div>
            <button type="submit">Crear</button>
          </form>
        </div>

        <div className="card">
          <h3>Listado</h3>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Categoria</th><th>Estado</th><th>Sector</th><th>Web</th><th></th></tr>
            </thead>
            <tbody>
              {investors.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.name}</td>
                  <td>{inv.category}</td>
                  <td>{inv.status_name ?? "-"}</td>
                  <td>{inv.sector ?? "-"}</td>
                  <td>{inv.website ?? "-"}</td>
                  <td><Link href={`/investors/${inv.id}`}>Detalle</Link></td>
                </tr>
              ))}
              {investors.length === 0 ? <tr><td colSpan={6}>Sin fondos.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
