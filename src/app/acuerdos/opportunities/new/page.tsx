import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NewOpportunityForm } from "@/components/new-opportunity-form";
import { requireUser } from "@/lib/auth/session";
import { getLeadById } from "@/lib/db/leads";
import { createOpportunity } from "@/lib/db/opportunities";
import { listProducts } from "@/lib/db/products";
import { logStateEvent } from "@/lib/db/pipeline";
import { listAssignableUsers } from "@/lib/db/users";
import { createDimServerClient } from "@/lib/supabase/dim";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type LeadRow = {
  id: string;
  company_id: number;
  contact_id: number;
  name: string | null;
  resolution: string;
};

type CompanyRow = {
  company_id: number;
  compania: string | null;
};

type ContactRow = {
  contact_id: number;
  persona_contacto: string | null;
};

export default async function NewOpportunityPage({
  searchParams
}: {
  searchParams?: { lead_id?: string };
}) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const dim = createDimServerClient();

  const [leadsRes, companiesRes, contactsRes, statesRes, products, users] = await Promise.all([
    db
      .from("leads")
      .select("id, company_id, contact_id, name, resolution")
      .neq("resolution", "discarded")
      .order("updated_at", { ascending: false })
      .limit(500),
    db.from("inversion").select("company_id, compania").order("compania", { ascending: true }).limit(500),
    db.from("contactos").select("contact_id, persona_contacto").order("persona_contacto", { ascending: true }).limit(500),
    dim.from("state").select("id, name").eq("entity_type", "opportunity").order("sort_order", { ascending: true }),
    listProducts(),
    listAssignableUsers()
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (companiesRes.error) throw companiesRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (statesRes.error) throw statesRes.error;

  const companyById = new Map(((companiesRes.data ?? []) as CompanyRow[]).map((row) => [row.company_id, row.compania ?? `Compañía ${row.company_id}`]));
  const contactById = new Map(((contactsRes.data ?? []) as ContactRow[]).map((row) => [row.contact_id, row.persona_contacto ?? `Contacto ${row.contact_id}`]));

  const leads = ((leadsRes.data ?? []) as LeadRow[]).map((lead) => ({
    id: lead.id,
    name: lead.name ?? `Lead ${lead.id.slice(0, 8)}`,
    companyName: companyById.get(lead.company_id) ?? `Compañía ${lead.company_id}`,
    contactName: contactById.get(lead.contact_id) ?? `Contacto ${lead.contact_id}`
  }));

  const states = (statesRes.data ?? []).map((state) => ({
    id: String(state.id),
    name: state.name ?? "Estado"
  }));

  async function createOpportunityAction(formData: FormData) {
    "use server";
    const actor = await requireUser();
    const occurredAt = new Date().toISOString();
    const leadId = String(formData.get("lead_id") ?? "").trim();
    const ownerUserId = String(formData.get("owner_user_id") ?? "").trim();
    const activeUsers = await listAssignableUsers();
    const owner = activeUsers.find((candidate) => candidate.id === ownerUserId) ?? null;
    const lead = await getLeadById(leadId);

    if (!lead) {
      throw new Error("Lead no encontrado");
    }

    const opportunity = await createOpportunity({
      lead_id: lead.id,
      company_id: lead.company_id,
      contact_id: lead.contact_id,
      product_id: String(formData.get("product_id") ?? "").trim(),
      current_state_id: String(formData.get("current_state_id") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim() || undefined,
      owner_user_id: owner?.id ?? undefined,
      owner_email: owner?.email ?? undefined,
      created_by_user_id: actor.id,
      created_by_email: actor.email,
      opened_at: occurredAt,
      estimated_amount: String(formData.get("estimated_amount") ?? "").trim() || null,
      closed_amount: String(formData.get("closed_amount") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || undefined
    });

    await logStateEvent({
      entity_type: "opportunity",
      opportunity_id: opportunity.id,
      company_id: opportunity.company_id,
      contact_id: opportunity.contact_id,
      product_id: opportunity.product_id,
      state_id: opportunity.current_state_id,
      occurred_at: occurredAt,
      actor_user_id: actor.id,
      actor_email: actor.email,
      notes: "Opportunity creada manualmente",
      metadata: {
        lead_id: lead.id,
        creation_mode: "manual"
      }
    });

    revalidatePath("/acuerdos");
    redirect(`/acuerdos/opportunities/${opportunity.id}`);
  }

  return (
    <AppShell title="Nueva opportunity" subtitle="Alta manual vinculada a un lead existente" canViewGlobal={user.can_view_global_dashboard}>
      <NewOpportunityForm
        leads={leads}
        products={products}
        states={states}
        users={users}
        defaultOwnerUserId={user.id}
        defaultLeadId={String(searchParams?.lead_id ?? "").trim() || undefined}
        createOpportunityAction={createOpportunityAction}
      />
    </AppShell>
  );
}
