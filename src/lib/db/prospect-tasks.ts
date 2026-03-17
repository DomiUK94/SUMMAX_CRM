import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { normalizeOptionalText, requireText } from "@/lib/validation/crm";

export type ProspectTaskRecord = {
  id: string;
  prospect_id: string | null;
  company_id: number;
  contact_id: number;
  task_id: string;
  task_name: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  notes: string | null;
  created_at: string;
};

type CreateProspectTaskInput = {
  prospect_id: string;
  company_id: number | string;
  contact_id: number | string;
  task_id: string;
  task_name: string;
  occurred_at?: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  notes?: string | null;
};

function normalizeBigint(value: number | string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} no valido`);
  }
  return Math.trunc(parsed);
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    String(error.message ?? "").toLowerCase().includes("prospect_tasks")
  );
}

export async function listRecentProspectTasks(limit = 120) {
  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospect_tasks")
    .select("id, prospect_id, company_id, contact_id, task_id, task_name, occurred_at, actor_user_id, actor_email, notes, created_at")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (result.error) {
    if (isMissingTableError(result.error)) return [] as ProspectTaskRecord[];
    throw result.error;
  }

  return (result.data ?? []) as ProspectTaskRecord[];
}

export async function listProspectTasksByProspectIds(prospectIds: string[]) {
  if (prospectIds.length === 0) return [] as ProspectTaskRecord[];

  const db = createSourceCrmServerClient();
  const result = await db
    .from("prospect_tasks")
    .select("id, prospect_id, company_id, contact_id, task_id, task_name, occurred_at, actor_user_id, actor_email, notes, created_at")
    .in("prospect_id", prospectIds)
    .order("occurred_at", { ascending: false });

  if (result.error) {
    if (isMissingTableError(result.error)) return [] as ProspectTaskRecord[];
    throw result.error;
  }

  return (result.data ?? []) as ProspectTaskRecord[];
}

export async function createProspectTask(input: CreateProspectTaskInput) {
  const db = createSourceCrmServerClient();
  const payload = {
    prospect_id: requireText(input.prospect_id, "Prospecto", 120),
    company_id: normalizeBigint(input.company_id, "Compania"),
    contact_id: normalizeBigint(input.contact_id, "Contacto"),
    task_id: requireText(input.task_id, "Tarea", 120),
    task_name: requireText(input.task_name, "Nombre de tarea", 180),
    occurred_at: normalizeOptionalText(input.occurred_at, 64) ?? new Date().toISOString(),
    actor_user_id: normalizeOptionalText(input.actor_user_id, 64),
    actor_email: normalizeOptionalText(input.actor_email, 320),
    notes: normalizeOptionalText(input.notes, 2000)
  };

  const result = await db
    .from("prospect_tasks")
    .insert(payload)
    .select("id, prospect_id, company_id, contact_id, task_id, task_name, occurred_at, actor_user_id, actor_email, notes, created_at")
    .single();

  if (result.error) throw result.error;
  return result.data as ProspectTaskRecord;
}
