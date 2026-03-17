import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { createLead, type LeadRecord } from "@/lib/db/leads";
import { normalizeOptionalText, requireText } from "@/lib/validation/crm";

export type ProspectStatus = "contactar" | "en_contacto";
export type ProspectResolution = "open" | "not_interested" | "converted";

export type ProspectRecord = {
  id: string;
  company_id: number;
  contact_id: number;
  owner_user_id: string | null;
  owner_email: string | null;
  status: ProspectStatus;
  resolution: ProspectResolution;
  created_by_user_id: string | null;
  created_by_email: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ListProspectsPageParams = {
  page?: number;
  pageSize?: number;
  ownerUserId?: string;
  resolution?: ProspectResolution;
  contactId?: number | string;
};

type CreateProspectInput = {
  company_id: number | string;
  contact_id: number | string;
  owner_user_id?: string | null;
  owner_email?: string | null;
  created_by_user_id?: string | null;
  created_by_email?: string | null;
  opened_at?: string;
  notes?: string | null;
};

type CloseProspectInput = {
  prospect_id: string;
  notes?: string | null;
};

type ReopenProspectInput = {
  prospect_id: string;
  opened_at?: string;
};

type ConvertProspectToLeadInput = {
  prospect_id: string;
  current_state_id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  opened_at?: string;
};

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return 1;
  return Math.trunc(value as number);
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return 25;
  return Math.min(200, Math.trunc(value as number));
}

function normalizeBigint(value: number | string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} no valido`);
  }
  return Math.trunc(parsed);
}

function prospectStatusFromTaskNames(taskNames: string[]): ProspectStatus {
  const normalized = new Set(taskNames.map((value) => String(value).trim().toLowerCase()));
  if (normalized.has("contactado") || normalized.has("2ndo contacto")) return "en_contacto";
  return "contactar";
}

export async function listProspectsPage(params: ListProspectsPageParams = {}) {
  const db = createSourceCrmServerClient();
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from("prospects")
    .select(
      "id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false });

  if (params.ownerUserId) query = query.eq("owner_user_id", params.ownerUserId);
  if (params.resolution) query = query.eq("resolution", params.resolution);
  if (params.contactId) query = query.eq("contact_id", normalizeBigint(params.contactId, "Contacto"));

  const result = await query.range(from, to);
  if (result.error) throw result.error;

  return {
    rows: (result.data ?? []) as ProspectRecord[],
    totalCount: result.count ?? 0
  };
}

export async function getProspectById(id: string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospects")
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data ?? null) as ProspectRecord | null;
}

export async function getOpenProspectByContact(contactId: number | string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospects")
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .eq("contact_id", normalizeBigint(contactId, "Contacto"))
    .eq("resolution", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data ?? null) as ProspectRecord | null;
}

export async function listProspectHistoryByContact(contactId: number | string) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospects")
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .eq("contact_id", normalizeBigint(contactId, "Contacto"))
    .order("opened_at", { ascending: false });

  if (result.error) throw result.error;
  return (result.data ?? []) as ProspectRecord[];
}

export async function createProspect(input: CreateProspectInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    company_id: normalizeBigint(input.company_id, "Compania"),
    contact_id: normalizeBigint(input.contact_id, "Contacto"),
    owner_user_id: normalizeOptionalText(input.owner_user_id, 64),
    owner_email: normalizeOptionalText(input.owner_email, 320),
    status: "contactar" as ProspectStatus,
    resolution: "open" as ProspectResolution,
    created_by_user_id: normalizeOptionalText(input.created_by_user_id, 64),
    created_by_email: normalizeOptionalText(input.created_by_email, 320),
    opened_at: normalizeOptionalText(input.opened_at, 64) ?? new Date().toISOString(),
    notes: normalizeOptionalText(input.notes, 2000)
  };

  const result = await db
    .from("prospects")
    .insert(payload)
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectRecord;
}

export async function updateProspectStatus(params: { prospect_id: string; status: ProspectStatus }) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospects")
    .update({
      status: params.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.prospect_id)
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectRecord;
}

export async function syncProspectStatusFromTasks(prospectId: string) {
  const db = createSourceCrmServerClient();
  const tasksResult = await db.from("prospect_tasks").select("task_name").eq("prospect_id", prospectId);
  if (tasksResult.error) throw tasksResult.error;
  const status = prospectStatusFromTaskNames((tasksResult.data ?? []).map((row) => String(row.task_name ?? "")));
  return updateProspectStatus({ prospect_id: prospectId, status });
}

export async function closeProspectAsNotInterested(input: CloseProspectInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    resolution: "not_interested" as ProspectResolution,
    closed_at: new Date().toISOString(),
    notes: input.notes === undefined ? undefined : normalizeOptionalText(input.notes, 2000),
    updated_at: new Date().toISOString()
  };

  const result = await db
    .from("prospects")
    .update(payload)
    .eq("id", requireText(input.prospect_id, "Prospecto", 120))
    .eq("resolution", "open")
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectRecord;
}

export async function reopenProspect(input: ReopenProspectInput) {
  const db = createSourceCrmServerClient();
  const status = prospectStatusFromTaskNames(
    (
      (
        await db.from("prospect_tasks").select("task_name").eq("prospect_id", requireText(input.prospect_id, "Prospecto", 120))
      ).data ?? []
    ).map((row) => String(row.task_name ?? ""))
  );

  const result = await db
    .from("prospects")
    .update({
      status,
      resolution: "open" as ProspectResolution,
      opened_at: normalizeOptionalText(input.opened_at, 64) ?? new Date().toISOString(),
      closed_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", requireText(input.prospect_id, "Prospecto", 120))
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectRecord;
}

export async function convertProspectToLead(input: ConvertProspectToLeadInput): Promise<{
  prospect: ProspectRecord;
  lead: LeadRecord;
}> {
  const prospect = await getProspectById(requireText(input.prospect_id, "Prospecto", 120));
  if (!prospect) throw new Error("Prospecto no encontrado");
  if (prospect.resolution !== "open") throw new Error("Solo se puede convertir un prospecto abierto");

  const lead = await createLead({
    company_id: prospect.company_id,
    contact_id: prospect.contact_id,
    current_state_id: requireText(input.current_state_id, "Estado inicial del lead", 120),
    owner_user_id: prospect.owner_user_id ?? input.actor_user_id ?? undefined,
    owner_email: prospect.owner_email ?? input.actor_email ?? undefined,
    created_by_user_id: input.actor_user_id ?? prospect.created_by_user_id ?? undefined,
    created_by_email: input.actor_email ?? prospect.created_by_email ?? undefined,
    opened_at: normalizeOptionalText(input.opened_at, 64) ?? new Date().toISOString(),
    notes: input.notes ?? prospect.notes ?? undefined
  });

  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospects")
    .update({
      resolution: "converted" as ProspectResolution,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", prospect.id)
    .select("id, company_id, contact_id, owner_user_id, owner_email, status, resolution, created_by_user_id, created_by_email, opened_at, closed_at, notes, created_at, updated_at")
    .single();

  if (result.error) throw result.error;

  return {
    prospect: result.data as ProspectRecord,
    lead
  };
}
