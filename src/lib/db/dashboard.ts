import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type CountByStatus = { status: string; count: number };

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

  const [
    allContacts,
    highPriority,
    mediumPriority,
    lowPriority,
    list
  ] = await Promise.all([
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("prioritario", "Si"),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("prioritario", "Medio"),
    supabase.from("contactos").select("contact_id", { count: "exact", head: true }).eq("prioritario", "No"),
    supabase
      .from("contactos")
      .select("contact_id, persona_contacto, prioritario, comentarios, compania, updated_at")
      .order("updated_at", { ascending: false })
      .limit(15)
  ]);

  return {
    totals: {
      myContacts: allContacts.count ?? 0,
      dueToday: highPriority.count ?? 0,
      overdue: mediumPriority.count ?? 0,
      upcoming: lowPriority.count ?? 0
    },
    queue: (list.data ?? []).map((row) => ({
      id: String(row.contact_id),
      full_name: row.persona_contacto,
      status_name: row.prioritario,
      next_step: row.comentarios,
      due_date: null,
      priority_level: null,
      investor_name: row.compania
    }))
  };
}
