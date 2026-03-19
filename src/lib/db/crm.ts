import { writeAuditEntry } from "@/lib/db/audit";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import type { ContactColumnFilterState } from "@/lib/ui/contact-table-filters";
import type { InvestorColumnFilterState } from "@/lib/ui/investor-table-filters";
import { normalizeEmail, normalizeOptionalText, normalizePhone, requireText } from "@/lib/validation/crm";

export type InvestorInput = {
  name: string;
  category: string;
  website?: string;
  strategy?: string;
  sector?: string;
  status_name?: string;
  address?: string;
  linkedin?: string;
  portfolio?: string;
  comments?: string;
  fit?: string;
  reason?: string;
  min_investment?: string;
  max_investment?: string;
  priority?: string;
  office?: string;
  company_size?: string;
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
  is_financier?: boolean;
  is_prescriber?: boolean;
  owner_user_id?: string;
  owner_email?: string;
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
  is_financier: "Si" | "No";
  is_prescriber: "Si" | "No";
  owner_user_id: string | null;
  owner_email: string | null;
  updated_at: string | null;
};

function toYesNoFlag(value: unknown): "Si" | "No" {
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "number") return value === 1 ? "Si" : "No";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["si", "sí", "true", "1", "yes", "y"].includes(normalized)) return "Si";
  }
  return "No";
}

function normalizeContactFlagFilter(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["si", "sí", "true", "1", "yes", "y"].includes(normalized)) return true;
  if (["no", "false", "0", "n"].includes(normalized)) return false;
  return null;
}

function parseContactDateFilter(value: string): { startIso: string; endIso: string } | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const esMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : esMatch
      ? { year: Number(esMatch[3]), month: Number(esMatch[2]), day: Number(esMatch[1]) }
      : null;

  if (!parts) return null;

  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  if (Number.isNaN(start.getTime())) return null;

  return {
    startIso: start.toISOString(),
    endIso: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };
}

function applyContactsTabFilter(query: any, tab: ContactsTab, userId: string) {
  switch (tab) {
    case "mine":
      return query.eq("owner_user_id", userId);
    case "unassigned":
      return query.is("owner_user_id", null);
    case "in_progress":
      return query.not("owner_user_id", "is", null);
    case "all":
    default:
      return query;
  }
}

function applyContactsSearchFilter(query: any, q: string, includeOwnerEmail = true) {
  const trimmed = q.trim();
  if (!trimmed) return query;
  const pattern = `%${trimmed}%`;
  if (includeOwnerEmail) {
    return query.or(`persona_contacto.ilike.${pattern},compania.ilike.${pattern},owner_email.ilike.${pattern}`);
  }
  return query.or(`persona_contacto.ilike.${pattern},compania.ilike.${pattern}`);
}

function applyContactColumnFilters(query: any, filters: ContactColumnFilterState) {
  let nextQuery = query;
  const now = Date.now();

  for (const [key, rawValue] of Object.entries(filters)) {
    const value = String(rawValue ?? "").trim();
    if (!value) continue;

    switch (key) {
      case "id":
        nextQuery = /^\d+$/.test(value) ? nextQuery.eq("contact_id", Number(value)) : nextQuery.eq("contact_id", -1);
        break;
      case "full_name":
        nextQuery = nextQuery.ilike("persona_contacto", `%${value}%`);
        break;
      case "investor_name":
        nextQuery = nextQuery.ilike("compania", `%${value}%`);
        break;
      case "is_financier": {
        const flag = normalizeContactFlagFilter(value);
        if (flag != null) nextQuery = nextQuery.eq("es_financiador", flag);
        break;
      }
      case "is_prescriber": {
        const flag = normalizeContactFlagFilter(value);
        if (flag != null) nextQuery = nextQuery.eq("es_preescriptor", flag);
        break;
      }
      case "owner_email":
        nextQuery = nextQuery.eq("owner_user_id", value);
        break;
      case "owner_user_id":
        nextQuery = nextQuery.ilike("owner_user_id", `%${value}%`);
        break;
      case "email":
        nextQuery = nextQuery.ilike("email", `%${value}%`);
        break;
      case "phone":
        nextQuery = nextQuery.ilike("telefono", `%${value}%`);
        break;
      case "role":
        nextQuery = nextQuery.ilike("rol", `%${value}%`);
        break;
      case "other_contact":
        nextQuery = nextQuery.ilike("otro_contacto", `%${value}%`);
        break;
      case "linkedin":
        nextQuery = nextQuery.ilike("linkedin", `%${value}%`);
        break;
      case "comments":
        nextQuery = nextQuery.ilike("comentarios", `%${value}%`);
        break;
      case "updated_at": {
        const dateRange = parseContactDateFilter(value);
        if (dateRange) {
          nextQuery = nextQuery.gte("updated_at", dateRange.startIso).lt("updated_at", dateRange.endIso);
        }
        break;
      }
      case "days_without_action": {
        const days = Number(value);
        if (Number.isFinite(days) && days >= 0) {
          if (days >= 999) {
            nextQuery = nextQuery.is("updated_at", null);
          } else {
            const upperBound = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
            const lowerBound = new Date(now - (days + 1) * 24 * 60 * 60 * 1000).toISOString();
            nextQuery = nextQuery.lte("updated_at", upperBound).gt("updated_at", lowerBound);
          }
        }
        break;
      }
      case "follow_up_status": {
        const normalized = value.toLowerCase();
        const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const fourteenDaysAgoIso = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
        if (normalized === "rojo") {
          nextQuery = nextQuery.or(`updated_at.lt.${fourteenDaysAgoIso},updated_at.is.null`);
        } else if (normalized === "ambar") {
          nextQuery = nextQuery.lte("updated_at", sevenDaysAgoIso).gt("updated_at", fourteenDaysAgoIso);
        } else if (normalized === "verde") {
          nextQuery = nextQuery.gte("updated_at", sevenDaysAgoIso);
        }
        break;
      }
      default:
        break;
    }
  }

  return nextQuery;
}

function usesMissingOptionalContactColumns(filters: ContactColumnFilterState) {
  return Boolean(
    String(filters.owner_email ?? "").trim() ||
      String(filters.owner_user_id ?? "").trim() ||
      String(filters.is_financier ?? "").trim() ||
      String(filters.is_prescriber ?? "").trim()
  );
}

function parseInvestorDateFilter(value: string): { startIso: string; endIso: string } | null {
  return parseContactDateFilter(value);
}

function applyInvestorColumnFilters(query: any, filters: InvestorColumnFilterState) {
  let nextQuery = query;

  for (const [key, rawValue] of Object.entries(filters)) {
    const value = String(rawValue ?? "").trim();
    if (!value) continue;

    switch (key) {
      case "id":
        nextQuery = /^\d+$/.test(value) ? nextQuery.eq("company_id", Number(value)) : nextQuery.eq("company_id", -1);
        break;
      case "name":
        nextQuery = nextQuery.ilike("compania", `%${value}%`);
        break;
      case "category":
        nextQuery = nextQuery.ilike("vertical", `%${value}%`);
        break;
      case "website":
        nextQuery = nextQuery.ilike("web", `%${value}%`);
        break;
      case "strategy":
        nextQuery = nextQuery.ilike("estrategia", `%${value}%`);
        break;
      case "status_name":
      case "sector":
        nextQuery = nextQuery.eq("company_id", -1);
        break;
      case "updated_at": {
        const dateRange = parseInvestorDateFilter(value);
        if (dateRange) {
          nextQuery = nextQuery.gte("updated_at", dateRange.startIso).lt("updated_at", dateRange.endIso);
        }
        break;
      }
      default:
        break;
    }
  }

  return nextQuery;
}

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
    .select("contact_id, persona_contacto, email, telefono, compania, updated_at")
    .order("updated_at", { ascending: false })
    .limit(150);
  return (data ?? []).map((row) => ({
    id: String(row.contact_id),
    full_name: row.persona_contacto ?? "(sin nombre)",
    email: row.email,
    phone: row.telefono,
    status_name: null,
    due_date: null,
    next_step: null,
    investor_name: row.compania,
    is_financier: "No",
    is_prescriber: "No"
  }));
}

export async function listInvestorsPage(params: {
  page: number;
  pageSize?: number;
  q?: string;
  columnFilters?: InvestorColumnFilterState;
}): Promise<{ rows: ListedInvestor[]; totalCount: number }> {
  const supabase = createSourceCrmServerClient();
  const pageSize = params.pageSize ?? 25;
  const page = Number.isFinite(params.page) && params.page > 0 ? Math.trunc(params.page) : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = String(params.q ?? "").trim();
  const columnFilters = params.columnFilters ?? {};

  let query = supabase
    .from("inversion")
    .select("company_id, compania, vertical, web, estrategia, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`compania.ilike.${pattern},vertical.ilike.${pattern},estrategia.ilike.${pattern},web.ilike.${pattern}`);
  }

  query = applyInvestorColumnFilters(query, columnFilters);

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

export async function getInvestorQuickCounts(params?: { q?: string; columnFilters?: InvestorColumnFilterState }): Promise<{ withoutWebCount: number; updated7dCount: number }> {
  const supabase = createSourceCrmServerClient();
  const q = String(params?.q ?? "").trim();
  const columnFilters = params?.columnFilters ?? {};

  let query = supabase.from("inversion").select("web, updated_at, compania, vertical, estrategia, company_id");
  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`compania.ilike.${pattern},vertical.ilike.${pattern},estrategia.ilike.${pattern},web.ilike.${pattern}`);
  }

  query = applyInvestorColumnFilters(query, columnFilters);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const withoutWebCount = rows.filter((row) => {
    const normalized = String(row.web ?? "").trim().toLowerCase();
    if (!normalized) return true;
    return ["-", "--", "n/a", "na", "sin web", "no web", "none", "null"].includes(normalized);
  }).length;

  const updated7dCount = rows.filter((row) => {
    if (!row.updated_at) return false;
    return now - new Date(row.updated_at).getTime() <= sevenDaysMs;
  }).length;

  return {
    withoutWebCount,
    updated7dCount
  };
}

export async function listContactsPage(params: {
  tab: ContactsTab;
  userId: string;
  page: number;
  pageSize?: number;
  q?: string;
  columnFilters?: ContactColumnFilterState;
}): Promise<{ rows: ListedContact[]; filteredCount: number; totalCount: number }> {
  const supabase = createSourceCrmServerClient();
  const pageSize = params.pageSize ?? 25;
  const page = Number.isFinite(params.page) && params.page > 0 ? Math.trunc(params.page) : 1;
  const q = String(params.q ?? "").trim();
  const columnFilters = params.columnFilters ?? {};
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let filteredQuery = supabase
    .from("contactos")
    .select(
      "contact_id, persona_contacto, email, telefono, rol, otro_contacto, linkedin, comentarios, compania, es_financiador, es_preescriptor, owner_user_id, owner_email, updated_at",
      {
        count: "exact"
      }
    );

  filteredQuery = applyContactsTabFilter(filteredQuery, params.tab, params.userId);
  filteredQuery = applyContactsSearchFilter(filteredQuery, q);
  filteredQuery = applyContactColumnFilters(filteredQuery, columnFilters);

  let [filteredResult, totalResult] = await Promise.all([
    filteredQuery.order("updated_at", { ascending: false }).range(from, to),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true })
  ]);

  const optionalColumnsMissing =
    (filteredResult.error?.code === "PGRST204" || filteredResult.error?.code === "42703") &&
    (
      filteredResult.error.message.includes("owner_user_id") ||
      filteredResult.error.message.includes("owner_email") ||
      filteredResult.error.message.includes("es_financiador") ||
      filteredResult.error.message.includes("es_preescriptor")
    );

  if (optionalColumnsMissing) {
    if (usesMissingOptionalContactColumns(columnFilters)) {
      filteredResult = {
        ...filteredResult,
        data: [],
        count: 0,
        error: null
      } as typeof filteredResult;
    } else {
    let fallbackQuery = supabase
      .from("contactos")
      .select("contact_id, persona_contacto, email, telefono, rol, otro_contacto, linkedin, comentarios, compania, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (params.tab === "mine" || params.tab === "in_progress") {
      filteredResult = {
        ...filteredResult,
        data: [],
        count: 0
      } as typeof filteredResult;
    } else {
      fallbackQuery = applyContactsSearchFilter(fallbackQuery, q, false);
      fallbackQuery = applyContactColumnFilters(fallbackQuery, columnFilters).range(from, to);

      const fallbackResult = await fallbackQuery;
      filteredResult = {
        ...fallbackResult,
        data: (fallbackResult.data ?? []).map((row) => ({
          ...row,
          es_financiador: null,
          es_preescriptor: null,
          owner_user_id: null,
          owner_email: null
        }))
      } as typeof filteredResult;

      if (params.tab === "unassigned") {
        filteredResult = {
          ...filteredResult,
          count: fallbackResult.count ?? totalResult.count ?? 0
        } as typeof filteredResult;
      }
    }
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
    status_name: null,
    due_date: null,
    next_step: null,
    investor_name: row.compania,
    is_financier: toYesNoFlag(row.es_financiador),
    is_prescriber: toYesNoFlag(row.es_preescriptor),
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

export async function getContactQuickCounts(params: {
  tab: ContactsTab;
  userId: string;
  q?: string;
  columnFilters?: ContactColumnFilterState;
}): Promise<{ needsActionCount: number; criticalCount: number }> {
  const supabase = createSourceCrmServerClient();
  const q = String(params.q ?? "").trim();
  const columnFilters = params.columnFilters ?? {};
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  async function runCount(updatedBeforeIso: string) {
    let query = supabase
      .from("contactos")
      .select("contact_id", { count: "exact", head: true })
      .or(`updated_at.lt.${updatedBeforeIso},updated_at.is.null`);

    query = applyContactsTabFilter(query, params.tab, params.userId);
    query = applyContactsSearchFilter(query, q);
    query = applyContactColumnFilters(query, columnFilters);

    let result = await query;
    const ownerColumnMissing =
      (result.error?.code === "PGRST204" || result.error?.code === "42703") &&
      (
        result.error.message.includes("owner_user_id") ||
        result.error.message.includes("owner_email") ||
        result.error.message.includes("es_financiador") ||
        result.error.message.includes("es_preescriptor")
      );

    if (ownerColumnMissing) {
      if (usesMissingOptionalContactColumns(columnFilters)) {
        return 0;
      }
      let fallbackQuery = supabase
        .from("contactos")
        .select("contact_id", { count: "exact", head: true })
        .or(`updated_at.lt.${updatedBeforeIso},updated_at.is.null`);

      if (params.tab === "mine" || params.tab === "in_progress") {
        return 0;
      }
      fallbackQuery = applyContactsSearchFilter(fallbackQuery, q, false);
      fallbackQuery = applyContactColumnFilters(fallbackQuery, columnFilters);
      result = await fallbackQuery;
    }

    if (result.error) throw result.error;
    return result.count ?? 0;
  }

  const [needsActionCount, criticalCount] = await Promise.all([
    runCount(sevenDaysAgoIso),
    runCount(fourteenDaysAgoIso)
  ]);

  return {
    needsActionCount,
    criticalCount
  };
}

export async function createInvestor(input: InvestorInput) {
  const supabase = createSourceCrmServerClient();
  const safeName = requireText(input.name, "Nombre de cuenta", 150);
  const safeCategory = normalizeOptionalText(input.category, 120) ?? "Sin categoria";
  const safeWebsite = normalizeOptionalText(input.website, 250);
  const safeStrategy = normalizeOptionalText(input.strategy, 250);
  const safeAddress = normalizeOptionalText(input.address, 250);
  const safeLinkedin = normalizeOptionalText(input.linkedin, 250);
  const safePortfolio = normalizeOptionalText(input.portfolio, 250);
  const safeComments = normalizeOptionalText(input.comments, 1000);
  const safeFit = normalizeOptionalText(input.fit, 250);
  const safeReason = normalizeOptionalText(input.reason, 500);
  const safeMinInvestment = normalizeOptionalText(input.min_investment, 120);
  const safeMaxInvestment = normalizeOptionalText(input.max_investment, 120);
  const safePriority = normalizeOptionalText(input.priority, 120);
  const safeOffice = normalizeOptionalText(input.office, 160);
  const safeCompanySize = normalizeOptionalText(input.company_size, 120);

  const nextCompanyId = Date.now();
  const { data, error } = await supabase
    .from("inversion")
    .insert({
      company_id: nextCompanyId,
      compania: safeName,
      vertical: safeCategory,
      web: safeWebsite,
      estrategia: safeStrategy,
      direccion: safeAddress,
      linkedin: safeLinkedin,
      portfolio: safePortfolio,
      comentarios: safeComments,
      encaje_summax: safeFit,
      motivo: safeReason,
      inversion_minima: safeMinInvestment,
      inversion_maxima: safeMaxInvestment,
      prioridad: safePriority,
      sede: safeOffice,
      tamano_empresa: safeCompanySize
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

export async function updateInvestorProfile(input: {
  investor_id: string;
  name: string;
  category?: string;
  website?: string;
  strategy?: string;
  address?: string;
  linkedin?: string;
  portfolio?: string;
  comments?: string;
  fit?: string;
  reason?: string;
  min_investment?: string;
  max_investment?: string;
  priority?: string;
  office?: string;
  company_size?: string;
  actor_user_id: string;
  actor_email: string;
}) {
  const supabase = createSourceCrmServerClient();
  const safeName = requireText(input.name, "Nombre de compa?ia", 150);
  const payload = {
    compania: safeName,
    vertical: normalizeOptionalText(input.category, 120),
    web: normalizeOptionalText(input.website, 250),
    estrategia: normalizeOptionalText(input.strategy, 250),
    direccion: normalizeOptionalText(input.address, 250),
    linkedin: normalizeOptionalText(input.linkedin, 250),
    portfolio: normalizeOptionalText(input.portfolio, 250),
    comentarios: normalizeOptionalText(input.comments, 1000),
    encaje_summax: normalizeOptionalText(input.fit, 250),
    motivo: normalizeOptionalText(input.reason, 500),
    inversion_minima: normalizeOptionalText(input.min_investment, 120),
    inversion_maxima: normalizeOptionalText(input.max_investment, 120),
    prioridad: normalizeOptionalText(input.priority, 120),
    sede: normalizeOptionalText(input.office, 160),
    tamano_empresa: normalizeOptionalText(input.company_size, 120),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("inversion").update(payload).eq("company_id", Number(input.investor_id));
  if (error) throw error;

  await writeAuditEntry({
    entityType: "investor",
    entityId: input.investor_id,
    action: "update",
    changedByUserId: input.actor_user_id,
    changedByEmail: input.actor_email,
    field: "profile",
    newValue: safeName,
    metadata: payload
  });
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
  const { data: inversion } = await supabase
    .from("inversion")
    .select("compania")
    .eq("company_id", Number(input.investor_id))
    .maybeSingle();

  const { data, error } = await supabase
    .from("contactos")
    .insert({
      contact_id: Date.now(),
      company_id: Number(input.investor_id),
      compania: inversion?.compania ?? null,
      persona_contacto: safeFullName,
      email: safeEmail,
      telefono: safePhone,
      rol: safeRole,
      otro_contacto: safeOtherContact,
      linkedin: safeLinkedin,
      comentarios: safeComments,
      es_financiador: input.is_financier ?? false,
      es_preescriptor: input.is_prescriber ?? false,
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
        address: inv.data.direccion ?? null,
        linkedin: inv.data.linkedin ?? null,
        portfolio: inv.data.portfolio ?? null,
        comments: inv.data.comentarios ?? null,
        fit: inv.data.encaje_summax ?? null,
        reason: inv.data.motivo ?? null,
        min_investment: inv.data.inversion_minima ?? null,
        max_investment: inv.data.inversion_maxima ?? null,
        priority: inv.data.prioridad ?? null,
        office: inv.data.sede ?? null,
        company_size: inv.data.tamano_empresa ?? null,
        updated_at: inv.data.updated_at ?? null,
        sector: (sectores.data ?? []).map((s) => s.sector_consolidado ?? s.sector).filter(Boolean).join(", "),
        tipo_fondo: (tipos.data ?? []).map((t) => t.tipo_fondo).join(", "),
        mercados: (mapas.data ?? []).map((m) => m.area_geografica).join(", ")
      }
    : null;

  const mappedContacts = (contacts.data ?? []).map((c) => ({
    id: String(c.contact_id),
    full_name: c.persona_contacto ?? "(sin nombre)",
    email: c.email,
        status_name: null
  }));

  const comments =
    inv.data?.comentarios
      ? [
          {
            id: "inv-" + String(inv.data.company_id),
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
        role: data.rol ?? null,
        other_contact: data.otro_contacto ?? null,
        linkedin: data.linkedin ?? null,
        comments: data.comentarios ?? null,
        is_financier: toYesNoFlag(data.es_financiador),
        is_prescriber: toYesNoFlag(data.es_preescriptor),
        next_step: data.proxima_accion ?? null,
        due_date: data.fecha_objetivo ?? null,
        owner_user_id: data.owner_user_id ?? null,
        owner_email: data.owner_email ?? null,
        updated_at: data.updated_at ?? null,
        status_name: null
      }
    : null;

  const comments =
    data?.comentarios
      ? [
          {
            id: "con-" + String(data.contact_id),
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

export async function addEntityNote(params: {
  entity_type: "investor" | "contact";
  entity_id: string;
  body: string;
  created_by_user_id: string;
  created_by_email: string;
  created_at?: string;
}) {
  const supabase = createSourceCrmServerClient();
  const safeBody = requireText(params.body, "Nota", 4000);

  const { error } = await supabase.from("entity_notes").insert({
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    body: safeBody,
    created_by_user_id: params.created_by_user_id,
    created_by_email: params.created_by_email,
    created_at: normalizeOptionalText(params.created_at, 64) ?? undefined
  });

  if (error) throw error;

  await writeAuditEntry({
    entityType: params.entity_type,
    entityId: params.entity_id,
    action: "update",
    changedByUserId: params.created_by_user_id,
    changedByEmail: params.created_by_email,
    field: "nota",
    newValue: safeBody
  });
}

export async function addComment(params: {
  entity_type: "investor" | "contact";
  entity_id: string;
  body: string;
  created_by_user_id: string;
  created_by_email: string;
  created_at?: string;
}) {
  const supabase = createSourceCrmServerClient();
  const createdAt = normalizeOptionalText(params.created_at, 64) ?? new Date().toISOString();
  if (params.entity_type === "investor") {
    const { data } = await supabase.from("inversion").select("comentarios").eq("company_id", Number(params.entity_id)).single();
    const nextValue = [data?.comentarios ?? "", params.body].filter(Boolean).join(" | ");
    const { error } = await supabase
      .from("inversion")
      .update({ comentarios: nextValue, updated_at: createdAt })
      .eq("company_id", Number(params.entity_id));
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
  const { error } = await supabase
    .from("contactos")
    .update({ comentarios: nextValue, updated_at: createdAt })
    .eq("contact_id", Number(params.entity_id));
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

export async function updateContactProfile(input: {
  contact_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role?: string;
  other_contact?: string;
  linkedin?: string;
  comments?: string;
  is_financier?: boolean;
  is_prescriber?: boolean;
  owner_user_id?: string;
  owner_email?: string;
  next_step?: string;
  due_date?: string;
  actor_user_id: string;
  actor_email: string;
}) {
  const supabase = createSourceCrmServerClient();
  const safeFullName = requireText(input.full_name, "Nombre del contacto", 150);
  const basePayload = {
    persona_contacto: safeFullName,
    email: normalizeEmail(input.email),
    telefono: normalizePhone(input.phone),
    rol: normalizeOptionalText(input.role, 120),
    otro_contacto: normalizeOptionalText(input.other_contact, 120),
    linkedin: normalizeOptionalText(input.linkedin, 250),
    comentarios: normalizeOptionalText(input.comments, 1000),
    es_financiador: input.is_financier ?? false,
    es_preescriptor: input.is_prescriber ?? false,
    owner_user_id: normalizeOptionalText(input.owner_user_id, 64),
    owner_email: normalizeEmail(input.owner_email),
    updated_at: new Date().toISOString()
  };
  const extendedPayload: Record<string, string | boolean | null> = {
    ...basePayload,
    proxima_accion: normalizeOptionalText(input.next_step, 250),
    fecha_objetivo: normalizeOptionalText(input.due_date, 40)
  };

  let payloadUsed: Record<string, string | boolean | null> = extendedPayload;
  let result = await supabase.from("contactos").update(extendedPayload).eq("contact_id", Number(input.contact_id));

  const missingFollowupColumns =
    result.error?.code === "PGRST204" ||
    String(result.error?.message ?? "").includes("proxima_accion") ||
    String(result.error?.message ?? "").includes("fecha_objetivo") ||
    String(result.error?.message ?? "").includes("column");

  if (result.error && missingFollowupColumns) {
    payloadUsed = basePayload;
    result = await supabase.from("contactos").update(basePayload).eq("contact_id", Number(input.contact_id));
  }

  if (result.error) throw result.error;

  await writeAuditEntry({
    entityType: "contact",
    entityId: input.contact_id,
    action: "update",
    changedByUserId: input.actor_user_id,
    changedByEmail: input.actor_email,
    field: "profile",
    newValue: safeFullName,
    metadata: payloadUsed
  });
}

export async function attachContactToInvestor(params: {
  contact_id: string;
  investor_id: string;
  actor_user_id: string;
  actor_email: string;
}) {
  const supabase = createSourceCrmServerClient();
  const { data: investor, error: investorError } = await supabase
    .from("inversion")
    .select("company_id, compania")
    .eq("company_id", Number(params.investor_id))
    .single();

  if (investorError) throw investorError;

  const payload = {
    company_id: investor.company_id,
    compania: investor.compania,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("contactos").update(payload).eq("contact_id", Number(params.contact_id));
  if (error) throw error;

  await writeAuditEntry({
    entityType: "contact",
    entityId: params.contact_id,
    action: "update",
    changedByUserId: params.actor_user_id,
    changedByEmail: params.actor_email,
    field: "company_id",
    newValue: String(investor.company_id),
    metadata: payload
  });
}


