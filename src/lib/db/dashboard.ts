import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type CountByStatus = { status: string; count: number };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDaysWithoutAction(updatedAt: string | null): number {
  if (!updatedAt) return 999;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diffMs / ONE_DAY_MS));
}

export async function getGlobalDashboardData() {
  const supabase = createSourceCrmServerClient();

  const [
    investorsRes,
    contactsRes,
    highPriorityRes,
    statusRes,
    staleRes
  ] = await Promise.all([
    supabase.from("inversion").select("company_id", { count: "exact", head: true }),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }),
    supabase
      .from("contactos")
      .select("contact_id", { count: "exact", head: true })
      .eq("prioritario", "Si"),
    supabase
      .from("contactos")
      .select("prioritario")
      .not("prioritario", "is", null),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, updated_at, compania")
      .lt("updated_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(8)
  ]);

  const byStatusMap = new Map<string, number>();
  (statusRes.data ?? []).forEach((row) => {
    const key = row.prioritario ?? "Sin estado";
    byStatusMap.set(key, (byStatusMap.get(key) ?? 0) + 1);
  });

  const byStatus: CountByStatus[] = Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count }));

  return {
    totals: {
      investors: investorsRes.count ?? 0,
      contacts: contactsRes.count ?? 0,
      overdue: 0,
      meetings48h: highPriorityRes.count ?? 0
    },
    byStatus,
    staleContacts: (staleRes.data ?? []).map((row) => ({
      id: String(row.contact_id),
      full_name: row.persona_contacto,
      status_name: row.prioritario,
      next_step: row.comentarios,
      due_date: null,
      owner_email: row.compania,
      updated_at: row.updated_at
    }))
  };
}

export async function getMyDashboardData(userId: string) {
  const supabase = createSourceCrmServerClient();
  const sevenDaysAgoIso = new Date(Date.now() - 7 * ONE_DAY_MS).toISOString();
  const fourteenDaysAgoIso = new Date(Date.now() - 14 * ONE_DAY_MS).toISOString();

  const [
    myContacts,
    unassignedContacts,
    stale7Days,
    stale14Days,
    highPriorityContacts,
    list,
    unassignedList
  ] = await Promise.all([
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("owner_user_id", userId),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).is("owner_user_id", null),
    supabase
      .from("contactos")
      .select("contact_id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .lt("updated_at", sevenDaysAgoIso),
    supabase
      .from("contactos")
      .select("contact_id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .lt("updated_at", fourteenDaysAgoIso),
    supabase
      .from("contactos")
      .select("contact_id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .eq("prioritario", "Si"),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, compania, updated_at, owner_email")
      .eq("owner_user_id", userId)
      .lt("updated_at", sevenDaysAgoIso)
      .order("updated_at", { ascending: true })
      .limit(25),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, compania, updated_at")
      .is("owner_user_id", null)
      .order("updated_at", { ascending: true })
      .limit(25)
  ]);

  const queue = (list.data ?? []).map((row) => ({
    id: String(row.contact_id),
    full_name: row.persona_contacto,
    status_name: row.prioritario,
    next_step: row.comentarios,
    due_date: null,
    priority_level: null,
    investor_name: row.compania,
    owner_email: row.owner_email,
    updated_at: row.updated_at,
    days_without_action: toDaysWithoutAction(row.updated_at)
  }));

  return {
    totals: {
      myContacts: myContacts.count ?? 0,
      stale7Days: stale7Days.count ?? 0,
      stale14Days: stale14Days.count ?? 0,
      unassignedContacts: unassignedContacts.count ?? 0,
      highPriorityContacts: highPriorityContacts.count ?? 0
    },
    queue,
    unassignedQueue: (unassignedList.data ?? []).map((row) => ({
      id: String(row.contact_id),
      full_name: row.persona_contacto,
      status_name: row.prioritario,
      next_step: row.comentarios,
      investor_name: row.compania,
      updated_at: row.updated_at,
      days_without_action: toDaysWithoutAction(row.updated_at)
    }))
  };
}
