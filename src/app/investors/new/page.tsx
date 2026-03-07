import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createInvestor } from "@/lib/db/crm";

export default async function NewInvestorPage() {
  const user = await requireUser();

  async function createInvestorAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    await createInvestor({
      name: String(formData.get("name") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim() || "Sin categoria",
      website: String(formData.get("website") ?? "").trim() || undefined,
      strategy: String(formData.get("strategy") ?? "").trim() || undefined,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath("/investors");
    redirect("/investors");
  }

  return (
    <AppShell title="Nueva cuenta" subtitle="Alta manual de cuenta" canViewGlobal={user.can_view_global_dashboard}>
      <div className="card" style={{ maxWidth: 900 }}>
        <form action={createInvestorAction} className="stack">
          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label>Nombre de la cuenta</label>
              <input name="name" required placeholder="Nombre de la compania" style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Categoria</label>
              <input name="category" placeholder="Vertical o categoria" style={{ width: "100%" }} />
            </div>
          </div>

          <div className="row" style={{ gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label>Web</label>
              <input name="website" placeholder="https://empresa.com" style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Estrategia</label>
              <input name="strategy" placeholder="Tesis o estrategia" style={{ width: "100%" }} />
            </div>
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="submit">Crear cuenta</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
