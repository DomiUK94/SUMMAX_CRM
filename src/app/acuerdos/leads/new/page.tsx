import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NewLeadForm } from "@/components/new-lead-form";
import { requireUser } from "@/lib/auth/session";
import { createLead } from "@/lib/db/leads";
import { logStateEvent } from "@/lib/db/pipeline";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export default async function NewLeadPage() {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const dim = createDimServerClient();

  const [companiesRes, contactsRes, statesRes] = await Promise.all([
    db.from("inversion").select("company_id, compania").order("compania", { ascending: true }).limit(500),
    db.from("contactos").select("contact_id, company_id, persona_contacto").order("persona_contacto", { ascending: true }).limit(500),
    dim.from("state").select("id, name").eq("entity_type", "lead").order("sort_order", { ascending: true })
  ]);

  const companies = (companiesRes.data ?? []).map((row) => ({
    id: String(row.company_id),
    name: row.compania ?? `Compañía ${row.company_id}`
  }));

  const contacts = (contactsRes.data ?? []).map((row) => ({
    id: String(row.contact_id),
    companyId: String(row.company_id),
    name: row.persona_contacto ?? `Contacto ${row.contact_id}`
  }));

  const states = (statesRes.data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name ?? "Estado"
  }));

  async function createLeadAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const currentStateId = String(formData.get("current_state_id") ?? "").trim();
    const assignOwner = String(formData.get("assign_owner") ?? "yes") === "yes";
    const occurredAt = new Date().toISOString();

    const lead = await createLead({
      company_id: String(formData.get("company_id") ?? "").trim(),
      contact_id: String(formData.get("contact_id") ?? "").trim(),
      current_state_id: currentStateId,
      name: String(formData.get("name") ?? "").trim() || undefined,
      owner_user_id: assignOwner ? actor.id : undefined,
      owner_email: assignOwner ? actor.email : undefined,
      created_by_user_id: actor.id,
      created_by_email: actor.email,
      opened_at: occurredAt,
      notes: String(formData.get("notes") ?? "").trim() || undefined
    });

    await logStateEvent({
      entity_type: "lead",
      lead_id: lead.id,
      company_id: lead.company_id,
      contact_id: lead.contact_id,
      state_id: lead.current_state_id,
      occurred_at: occurredAt,
      actor_user_id: actor.id,
      actor_email: actor.email,
      notes: "Lead creado"
    });

    revalidatePath("/acuerdos");
    redirect("/acuerdos?section=leads");
  }

  return (
    <AppShell title="Nuevo lead" subtitle="Alta manual de lead comercial" canViewGlobal={user.can_view_global_dashboard}>
      <NewLeadForm
        companies={companies}
        contacts={contacts}
        states={states}
        defaultOwnerUserId={user.id}
        createLeadAction={createLeadAction}
      />
    </AppShell>
  );
}
