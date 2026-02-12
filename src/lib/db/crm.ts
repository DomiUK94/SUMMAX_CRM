import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractDomain, normalizeText } from "@/lib/utils/normalize";

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
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("investors")
    .select("id, name, category, website, status_name, sector, strategy, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function listContacts() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, status_name, due_date, next_step, investor_name")
    .order("updated_at", { ascending: false })
    .limit(150);
  return data ?? [];
}

export async function createInvestor(input: InvestorInput) {
  const supabase = createSupabaseServerClient();
  const normalizedName = normalizeText(input.name);
  const websiteDomain = extractDomain(input.website);

  const { data, error } = await supabase
    .from("investors")
    .insert({
      name: input.name,
      normalized_name: normalizedName,
      category: input.category,
      website: input.website ?? null,
      website_domain: websiteDomain || null,
      strategy: input.strategy ?? null,
      sector: input.sector ?? null,
      status_name: input.status_name ?? "Nuevo"
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function createContact(input: ContactInput) {
  const supabase = createSupabaseServerClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("name")
    .eq("id", input.investor_id)
    .single();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      investor_id: input.investor_id,
      investor_name: investor?.name ?? null,
      full_name: input.full_name,
      normalized_full_name: normalizeText(input.full_name),
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role ?? null,
      owner_user_id: input.owner_user_id ?? null,
      status_name: input.status_name ?? "Nuevo",
      next_step: input.next_step ?? null,
      due_date: input.due_date ?? null,
      priority_level: 1
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function getInvestorById(id: string) {
  const supabase = createSupabaseServerClient();
  const [inv, contacts, comments] = await Promise.all([
    supabase.from("investors").select("*").eq("id", id).single(),
    supabase.from("contacts").select("*").eq("investor_id", id).order("updated_at", { ascending: false }),
    supabase
      .from("comments")
      .select("id, body, created_at, created_by_email")
      .eq("entity_type", "investor")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
  ]);

  return {
    investor: inv.data,
    contacts: contacts.data ?? [],
    comments: comments.data ?? []
  };
}

export async function getContactById(id: string) {
  const supabase = createSupabaseServerClient();
  const [contact, comments] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).single(),
    supabase
      .from("comments")
      .select("id, body, created_at, created_by_email")
      .eq("entity_type", "contact")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
  ]);

  return {
    contact: contact.data,
    comments: comments.data ?? []
  };
}

export async function addComment(params: {
  entity_type: "investor" | "contact";
  entity_id: string;
  body: string;
  created_by_user_id: string;
  created_by_email: string;
}) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("comments").insert(params);
  if (error) throw error;
}

export async function changeContactStatus(params: {
  contact_id: string;
  to_status_name: string;
  note?: string;
  actor_user_id: string;
  actor_email: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data: current } = await supabase.from("contacts").select("status_name").eq("id", params.contact_id).single();

  const from = current?.status_name ?? "Nuevo";

  const { error: updError } = await supabase
    .from("contacts")
    .update({ status_name: params.to_status_name })
    .eq("id", params.contact_id);
  if (updError) throw updError;

  const { error: evtError } = await supabase.from("status_events").insert({
    entity_type: "contact",
    entity_id: params.contact_id,
    from_status_name: from,
    to_status_name: params.to_status_name,
    note: params.note ?? null,
    created_by_user_id: params.actor_user_id,
    created_by_email: params.actor_email
  });

  if (evtError) throw evtError;
}
