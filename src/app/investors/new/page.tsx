import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NewInvestorForm } from "@/components/new-investor-form";
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
      address: String(formData.get("address") ?? "").trim() || undefined,
      linkedin: String(formData.get("linkedin") ?? "").trim() || undefined,
      portfolio: String(formData.get("portfolio") ?? "").trim() || undefined,
      comments: String(formData.get("comments") ?? "").trim() || undefined,
      fit: String(formData.get("fit") ?? "").trim() || undefined,
      reason: String(formData.get("reason") ?? "").trim() || undefined,
      min_investment: String(formData.get("min_investment") ?? "").trim() || undefined,
      max_investment: String(formData.get("max_investment") ?? "").trim() || undefined,
      priority: String(formData.get("priority") ?? "").trim() || undefined,
      office: String(formData.get("office") ?? "").trim() || undefined,
      company_size: String(formData.get("company_size") ?? "").trim() || undefined,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath("/investors");
    redirect("/investors");
  }

  return (
    <AppShell title="Nueva compañia" subtitle="Alta manual de compañia" canViewGlobal={user.can_view_global_dashboard}>
      <NewInvestorForm createInvestorAction={createInvestorAction} />
    </AppShell>
  );
}

