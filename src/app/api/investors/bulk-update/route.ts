import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteCrm } from "@/lib/auth/authorize";
import { updateInvestorProfile } from "@/lib/db/crm";

type BulkInvestorUpdateItem = {
  investor_id?: string;
  name?: string;
  category?: string | null;
  website?: string | null;
  strategy?: string | null;
};

type BulkInvestorUpdatePayload = {
  investors?: BulkInvestorUpdateItem[];
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canWriteCrm(user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as BulkInvestorUpdatePayload | null;
  const investors = payload?.investors ?? [];
  if (!Array.isArray(investors) || investors.length === 0) {
    return NextResponse.json({ error: "No hay companias para actualizar" }, { status: 400 });
  }

  try {
    for (const investor of investors) {
      const investorId = String(investor.investor_id ?? "").trim();
      await updateInvestorProfile({
        investor_id: investorId,
        name: String(investor.name ?? "").trim(),
        category: String(investor.category ?? "").trim() || undefined,
        website: String(investor.website ?? "").trim() || undefined,
        strategy: String(investor.strategy ?? "").trim() || undefined,
        actor_user_id: user.id,
        actor_email: user.email
      });
      revalidatePath(`/investors/${investorId}`);
    }

    revalidatePath("/investors");
    return NextResponse.json({ ok: true, updated: investors.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron aplicar los cambios" },
      { status: 500 }
    );
  }
}
