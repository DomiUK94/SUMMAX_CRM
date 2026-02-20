import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { writeAuditEntry } from "@/lib/db/audit";
import { normalizeEmail, normalizeOptionalText, normalizePhone, requireText } from "@/lib/validation/crm";

export type InvestorInput = {
  name: string;
  category: string;
  website?: string;
  strategy?: string;
  sector?: string;
  status_name?: string;
  actor_user_id?: string;
  actor_email?: string;
};

export type ContactInput = {
  investor_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role?: string;
  other_contact?: string;
  linkedin?: string;
  comments?: string;
  owner_user_id?: string;
  owner_email?: string;
  status_name?: string;
  next_step?: string;
  due_date?: string;
  actor_user_id?: string;
  actor_email?: string;
};

export type ListedInvestor = {
  id: string;
  name: string;
  category: string | null;
  website: string | null;
  strategy: string | null;
  status_name: string | null;
  sector: string | null;
  updated_at: string | null;
};

export type ContactsTab = "mine" | "all" | "unassigned" | "in_progress";

export type ListedContact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  other_contact: string | null;
  linkedin: string | null;
  comments: string | null;
  status_name: string | null;
  due_date: null;
  next_step: null;
  investor_name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  updated_at: string | null;
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

export async function listInvestorsPage(params: {
  page: number;
  pageSize?: number;
  q?: string;
}): Promise<{ rows: ListedInvestor[]; totalCount: number }> {
  const supabase = createSourceCrmServerClient();
  const pageSize = params.pageSize ?? 25;
  const page = Number.isFinite(params.page) && params.page > 0 ? Math.trunc(params.page) : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = String(params.q ?? "").trim();

  let query = supabase
    .from("inversion")
    .select("company_id, compania, vertical, web, estrategia, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`compania.ilike.${pattern},vertical.ilike.${pattern},estrategia.ilike.${pattern},web.ilike.${pattern}`);
  }

  const result = await query.range(from, to);
  if (result.error) throw result.error;

  const rows: ListedInvestor[] = (result.data ?? []).map((row) => ({
    id: String(row.company_id),
    name: row.compania,
    category: row.vertical ?? null,
    website: row.web ?? null,
    strategy: row.estrategia ?? null,
    status_name: null,
    sector: null,
    updated_at: row.updated_at ?? null
  }));

  return {
    rows,
    totalCount: result.count ?? 0
  };
}

export async function listContactsPage(params: {
  tab: ContactsTab;
  userId: string;
  page: number;
  pageSize?: number;
  q?: string;
}): Promise<{ rows: ListedContact[]; filteredCount: number; totalCount: number }> {
  const supabase = createSourceCrmServerClient();
  const pageSize = params.pageSize ?? 25;
  const page = Number.isFinite(params.page) && params.page > 0 ? Math.trunc(params.page) : 1;
  const q = String(params.q ?? "").trim();
  const hasSearch = q.length > 0;
  const searchPattern = `%${q}%`;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let filteredQuery = supabase
    .from("contactos")
    .select(
      "contact_id, persona_contacto, email, telefono, rol, otro_contacto, linkedin, comentarios, compania, prioritario, owner_user_id, owner_email, updated_at",
      {
      count: "exact"
      }
    );

  switch (params.tab) {
    case "mine":
      filteredQuery = filteredQuery.eq("owner_user_id", params.userId);
      break;
    case "unassigned":
      filteredQuery = filteredQuery.is("owner_user_id", null);
      break;
    case "in_progress":
      filteredQuery = filteredQuery.not("owner_user_id", "is", null);
      break;
    case "all":
    default:
      break;
  }

  if (hasSearch) {
    filteredQuery = filteredQuery.or(
      `persona_contacto.ilike.${searchPattern},compania.ilike.${searchPattern},prioritario.ilike.${searchPattern},owner_email.ilike.${searchPattern}`
    );
  }

  let [filteredResult, totalResult] = await Promise.all([
    filteredQuery.order("updated_at", { ascending: false }).range(from, to),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true })
  ]);

  const ownerColumnsMissing =
    filteredResult.error?.code === "PGRST204" &&
    (filteredResult.error.message.includes("owner_user_id") || filteredResult.error.message.includes("owner_email"));

  if (ownerColumnsMissing) {
    let fallbackQuery = supabase
      .from("contactos")
      .select("contact_id, persona_contacto, email, telefono, rol, otro_contacto, linkedin, comentarios, compania, prioritario, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (hasSearch) {
      fallbackQuery = fallbackQuery.or(
        `persona_contacto.ilike.${searchPattern},compania.ilike.${searchPattern},prioritario.ilike.${searchPattern}`
      );
    }

    fallbackQuery = fallbackQuery.range(from, to);

    const fallbackResult = await fallbackQuery;
    filteredResult = {
      ...fallbackResult,
      data: (fallbackResult.data ?? []).map((row) => ({
        ...row,
        owner_user_id: null,
        owner_email: null
      }))
    } as typeof filteredResult;

    if (params.tab === "mine" || params.tab === "in_progress") {
      filteredResult = {
        ...filteredResult,
        data: [],
        count: 0
      } as typeof filteredResult;
    }

    if (params.tab === "unassigned") {
      filteredResult = {
        ...filteredResult,
        count: totalResult.count ?? fallbackResult.count ?? 0
      } as typeof filteredResult;
    }
  }

  if (filteredResult.error) {
    throw filteredResult.error;
  }

  const rows: ListedContact[] = (filteredResult.data ?? []).map((row) => ({
    id: String(row.contact_id),
    full_name: row.persona_contacto ?? "(sin nombre)",
    email: row.email,
    phone: row.telefono,
    role: row.rol ?? null,
    other_contact: row.otro_contacto ?? null,
    linkedin: row.linkedin ?? null,
    comments: row.comentarios ?? null,
    status_name: row.prioritario,
    due_date: null,
    next_step: null,
    investor_name: row.compania,
    owner_user_id: row.owner_user_id ?? null,
    owner_email: row.owner_email ?? null,
    updated_at: row.updated_at ?? null
  }));

  return {
    rows,
    filteredCount: filteredResult.count ?? 0,
    totalCount: totalResult.count ?? 0
  };
}

export async function createInvestor(input: InvestorInput) {
  const supabase = createSourceCrmServerClient();
  const safeName = requireText(input.name, "Nombre de cuenta", 150);
  const safeCategory = normalizeOptionalText(input.category, 120) ?? "Sin categoria";
  const safeWebsite = normalizeOptionalText(input.website, 250);
  const safeStrategy = normalizeOptionalText(input.strategy, 250);

  const nextCompanyId = Date.now();
  const { data, error } = await supabase
    .from("inversion")
    .insert({
      company_id: nextCompanyId,
      compania: safeName,
      vertical: safeCategory,
      web: safeWebsite,
      estrategia: safeStrategy
    })
    .select("company_id")
    .single();

  if (error) throw error;
  if (input.actor_user_id && input.actor_email) {
    await writeAuditEntry({
      entityType: "investor",
      entityId: String(data.company_id),
      action: "create",
      changedByUserId: input.actor_user_id,
      changedByEmail: input.actor_email,
      newValue: safeName
    });
  }
  return { id: String(data.company_id) };
}

export async function createContact(input: ContactInput) {
  const supabase = createSourceCrmServerClient();
  const safeFullName = requireText(input.full_name, "Nombre del contacto", 150);
  const safeEmail = normalizeEmail(input.email);
  const safePhone = normalizePhone(input.phone);
  const safeRole = normalizeOptionalText(input.role, 120);
  const safeOtherContact = normalizeOptionalText(input.other_contact, 120);
  const safeLinkedin = normalizeOptionalText(input.linkedin, 250);
  const safeComments = normalizeOptionalText(input.comments, 1000);
  const safeStatus = normalizeOptionalText(input.status_name, 120);

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
      persona_contacto: safeFullName,
      email: safeEmail,
      telefono: safePhone,
      rol: safeRole,
      otro_contacto: safeOtherContact,
      linkedin: safeLinkedin,
      comentarios: safeComments,
      prioritario: safeStatus,
      owner_user_id: input.owner_user_id ?? null,
      owner_email: input.owner_email ?? null
    })
    .select("contact_id")
    .single();

  if (error) throw error;
  if (input.actor_user_id && input.actor_email) {
    await writeAuditEntry({
      entityType: "contact",
      entityId: String(data.contact_id),
      action: "create",
      changedByUserId: input.actor_user_id,
      changedByEmail: input.actor_email,
      newValue: safeFullName
    });
  }
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
        investor_id: data.company_id != null ? String(data.company_id) : null,
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
    await writeAuditEntry({
      entityType: "investor",
      entityId: params.entity_id,
      action: "update",
      changedByUserId: params.created_by_user_id,
      changedByEmail: params.created_by_email,
      field: "comentarios",
      newValue: params.body
    });
    return;
  }

  const { data } = await supabase.from("contactos").select("comentarios").eq("contact_id", Number(params.entity_id)).single();
  const nextValue = [data?.comentarios ?? "", params.body].filter(Boolean).join(" | ");
  const { error } = await supabase.from("contactos").update({ comentarios: nextValue, updated_at: new Date().toISOString() }).eq("contact_id", Number(params.entity_id));
  if (error) throw error;
  await writeAuditEntry({
    entityType: "contact",
    entityId: params.entity_id,
    action: "update",
    changedByUserId: params.created_by_user_id,
    changedByEmail: params.created_by_email,
    field: "comentarios",
    newValue: params.body
  });
}

export async function changeContactStatus(params: {
  contact_id: string;
  to_status_name: string;
  follow_up_date: string;
  note?: string;
  actor_user_id: string;
  actor_email: string;
}) {
  const supabase = createSourceCrmServerClient();
  const { data: current } = await supabase.from("contactos").select("comentarios").eq("contact_id", Number(params.contact_id)).single();
  const nextActionPart = ` next_action=${params.follow_up_date}`;
  const notePart = params.note ? ` [${params.note}]` : "";
  const statusComment = `status=${params.to_status_name}${nextActionPart}${notePart}`;
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
  await writeAuditEntry({
    entityType: "contact",
    entityId: params.contact_id,
    action: "status_change",
    changedByUserId: params.actor_user_id,
    changedByEmail: params.actor_email,
    field: "prioritario",
    newValue: params.to_status_name,
    metadata: { follow_up_date: params.follow_up_date, note: params.note ?? null }
  });
}
