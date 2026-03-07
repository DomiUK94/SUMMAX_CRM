import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { NewContactForm } from "@/components/new-contact-form";
import { requireUser } from "@/lib/auth/session";
import { createContact, createInvestor, listInvestors } from "@/lib/db/crm";

export default async function NewContactPage() {
  const user = await requireUser();
  const investors = await listInvestors();

  async function createContactAction(formData: FormData) {
    "use server";
    const actor = await requireUser();

    let investorId = String(formData.get("investor_id") ?? "").trim();
    const newInvestorName = String(formData.get("new_investor_name") ?? "").trim();
    const fullName = String(formData.get("full_name") ?? "").trim();
    if (!fullName) return;

    if (investorId === "__draft_new__") {
      investorId = "";
    }

    if (!investorId && newInvestorName) {
      const createdInvestor = await createInvestor({
        name: newInvestorName,
        category: String(formData.get("new_investor_category") ?? "").trim() || "Sin categoria",
        website: String(formData.get("new_investor_website") ?? "").trim() || undefined,
        strategy: String(formData.get("new_investor_strategy") ?? "").trim() || undefined,
        actor_user_id: actor.id,
        actor_email: actor.email
      });
      investorId = createdInvestor.id;
    }

    if (!investorId) return;

    const assignOwner = String(formData.get("assign_owner") ?? "yes") === "yes";
    await createContact({
      investor_id: investorId,
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || undefined,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      role: String(formData.get("role") ?? "").trim() || undefined,
      other_contact: String(formData.get("other_contact") ?? "").trim() || undefined,
      linkedin: String(formData.get("linkedin") ?? "").trim() || undefined,
      comments: String(formData.get("comments") ?? "").trim() || undefined,
      status_name: String(formData.get("status_name") ?? "").trim() || undefined,
      owner_user_id: assignOwner ? actor.id : undefined,
      owner_email: assignOwner ? actor.email : undefined,
      actor_user_id: actor.id,
      actor_email: actor.email
    });

    revalidatePath("/contacts");
    revalidatePath("/investors");
    redirect("/contacts?tab=all&page=1");
  }

  return (
    <AppShell title="Nuevo contacto" subtitle="Alta manual de contacto" canViewGlobal={user.can_view_global_dashboard}>
      <NewContactForm
        investors={investors.map((inv) => ({ id: inv.id, name: inv.name }))}
        defaultOwnerUserId={user.id}
        createContactAction={createContactAction}
      />
    </AppShell>
  );
}
