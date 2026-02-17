import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

export type InvestorInput = {
  name: string;
  category: string;
  website?: string;
  strategy?: string;
  sector?: string;
  status_name?: string;
};

export type ContactInput = {
  investor_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role?: string;
  owner_user_id?: string;
  status_name?: string;
  next_step?: string;
  due_date?: string;
};

export async function listInvestors() {
  const supabase = createSourceCrmServerClient();
  const { data } = await supabase
    .from("inversion")
    .select("company_id, compania, vertical, web, estrategia, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((row) => ({
    id: String(row.company_id),
    name: row.compania,
    category: row.vertical,
    website: row.web,
    status_name: null,
    sector: null,
    strategy: row.estrategia,
    updated_at: row.updated_at
  }));
}

export async function listContacts() {
  const supabase = createSourceCrmServerClient();
  const { data } = await supabase
    .from("contactos")
    .select("contact_id, persona_contacto, email, telefono, compania, prioritario, updated_at")
    .order("updated_at", { ascending: false })
    .limit(150);
  return (data ?? []).map((row) => ({
    id: String(row.contact_id),
    full_name: row.persona_contacto ?? "(sin nombre)",
    email: row.email,
    phone: row.telefono,
    status_name: row.prioritario,
    due_date: null,
    next_step: null,
    investor_name: row.compania
  }));
}

export async function createInvestor(input: InvestorInput) {
  const supabase = createSourceCrmServerClient();

  const nextCompanyId = Date.now();
  const { data, error } = await supabase
    .from("inversion")
    .insert({
      company_id: nextCompanyId,
      compania: input.name,
      vertical: input.category,
      web: input.website ?? null,
      estrategia: input.strategy ?? null
    })
    .select("company_id")
    .single();

  if (error) throw error;
  return { id: String(data.company_id) };
}

export async function createContact(input: ContactInput) {
  const supabase = createSourceCrmServerClient();

  const { data: inversion } = await supabase
    .from("inversion")
    .select("compania")
    .eq("company_id", Number(input.investor_id))
    .single();

  const nextContactId = Date.now();
  const { data, error } = await supabase
    .from("contactos")
    .insert({
      contact_id: nextContactId,
      company_id: Number(input.investor_id),
      compania: inversion?.compania ?? "",
      persona_contacto: input.full_name,
      email: input.email ?? null,
      telefono: input.phone ?? null,
      rol: input.role ?? null,
      prioritario: input.status_name ?? null
    })
    .select("contact_id")
    .single();

  if (error) throw error;
  return { id: String(data.contact_id) };
}

export async function getInvestorById(id: string) {
  const supabase = createSourceCrmServerClient();
  const [inv, contacts, sectores, tipos, mapas] = await Promise.all([
    supabase.from("inversion").select("*").eq("company_id", Number(id)).single(),
    supabase.from("contactos").select("*").eq("company_id", Number(id)).order("updated_at", { ascending: false }),
    supabase.from("sector").select("sector, sector_consolidado").eq("company_id", Number(id)),
    supabase.from("tipo_fondo").select("tipo_fondo, excepciones").eq("company_id", Number(id)),
    supabase.from("mapa_area_geografica").select("area_geografica").eq("company_id", Number(id))
  ]);

  const investor = inv.data
    ? {
        id: String(inv.data.company_id),
        name: inv.data.compania,
        category: inv.data.vertical,
        status_name: null,
        website: inv.data.web,
        strategy: inv.data.estrategia,
        sector: (sectores.data ?? []).map((s) => s.sector_consolidado ?? s.sector).filter(Boolean).join(", "),
        tipo_fondo: (tipos.data ?? []).map((t) => t.tipo_fondo).join(", "),
        mercados: (mapas.data ?? []).map((m) => m.area_geografica).join(", ")
      }
    : null;

  const mappedContacts = (contacts.data ?? []).map((c) => ({
    id: String(c.contact_id),
    full_name: c.persona_contacto ?? "(sin nombre)",
    email: c.email,
    status_name: c.prioritario
  }));

  const comments =
    inv.data?.comentarios
      ? [
          {
            id: `inv-${inv.data.company_id}`,
            body: inv.data.comentarios,
            created_at: inv.data.updated_at,
            created_by_email: "sourcecrm"
          }
        ]
      : [];

  return {
    investor,
    contacts: mappedContacts,
    comments
  };
}

export async function getContactById(id: string) {
  const supabase = createSourceCrmServerClient();
  const { data } = await supabase.from("contactos").select("*").eq("contact_id", Number(id)).single();

  const contact = data
    ? {
        id: String(data.contact_id),
        full_name: data.persona_contacto ?? "(sin nombre)",
        investor_name: data.compania,
        email: data.email,
        phone: data.telefono,
        status_name: data.prioritario
      }
    : null;

  const comments =
    data?.comentarios
      ? [
          {
            id: `con-${data.contact_id}`,
            body: data.comentarios,
            created_at: data.updated_at,
            created_by_email: "sourcecrm"
          }
        ]
      : [];

  return {
    contact,
    comments
  };
}

export async function addComment(params: {
  entity_type: "investor" | "contact";
  entity_id: string;
  body: string;
  created_by_user_id: string;
  created_by_email: string;
}) {
  const supabase = createSourceCrmServerClient();
  if (params.entity_type === "investor") {
    const { data } = await supabase.from("inversion").select("comentarios").eq("company_id", Number(params.entity_id)).single();
    const nextValue = [data?.comentarios ?? "", params.body].filter(Boolean).join(" | ");
    const { error } = await supabase.from("inversion").update({ comentarios: nextValue, updated_at: new Date().toISOString() }).eq("company_id", Number(params.entity_id));
    if (error) throw error;
    return;
  }

  const { data } = await supabase.from("contactos").select("comentarios").eq("contact_id", Number(params.entity_id)).single();
  const nextValue = [data?.comentarios ?? "", params.body].filter(Boolean).join(" | ");
  const { error } = await supabase.from("contactos").update({ comentarios: nextValue, updated_at: new Date().toISOString() }).eq("contact_id", Number(params.entity_id));
  if (error) throw error;
}

export async function changeContactStatus(params: {
  contact_id: string;
  to_status_name: string;
  note?: string;
  actor_user_id: string;
  actor_email: string;
}) {
  const supabase = createSourceCrmServerClient();
  const { data: current } = await supabase.from("contactos").select("comentarios").eq("contact_id", Number(params.contact_id)).single();
  const notePart = params.note ? ` [${params.note}]` : "";
  const statusComment = `status=${params.to_status_name}${notePart}`;
  const nextComments = [current?.comentarios ?? "", statusComment].filter(Boolean).join(" | ");

  const { error } = await supabase
    .from("contactos")
    .update({
      prioritario: params.to_status_name,
      comentarios: nextComments,
      updated_at: new Date().toISOString()
    })
    .eq("contact_id", Number(params.contact_id));
  if (error) throw error;
}
