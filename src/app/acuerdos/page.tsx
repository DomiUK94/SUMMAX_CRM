import { AppShell } from "@/components/app-shell";
import { DealsBoard } from "@/components/deals-board";
import { RowsPerPageSelect } from "@/components/rows-per-page-select";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";
import { normalizePerPage } from "@/lib/ui/pagination";
import Link from "next/link";
import { CrmIcon } from "@/components/ui/crm-icon";

type DealRow = {
  company_id: number;
  compania: string;
  prioridad: string | null;
  encaje_summax: string | null;
  inversion_maxima: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DealCard = {
  id: number;
  name: string;
  amount: string;
  priority: string;
  contactName: string;
  contactId: number | null;
  closeDate: string;
  createdDate: string;
};

const BOARD_STAGES = [
  "Cita agendada",
  "Calificado para comprar",
  "Presentación agendada",
  "Decision maker alineado",
  "Contrato enviado",
  "Ganado",
  "Perdido"
];

function pickStage(deal: DealRow): string {
  const signal = `${deal.encaje_summax ?? ""} ${deal.prioridad ?? ""}`.toLowerCase();
  if (signal.includes("won") || signal.includes("ganado")) return "Ganado";
  if (signal.includes("lost") || signal.includes("perdido")) return "Perdido";
  if (signal.includes("contract") || signal.includes("contrato")) return "Contrato enviado";
  if (signal.includes("decision")) return "Decision maker alineado";
  if (signal.includes("present") || signal.includes("presentacion")) return "Presentación agendada";
  if (signal.includes("qual") || signal.includes("calific")) return "Calificado para comprar";
  return "Cita agendada";
}

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

function hrefFor(page: number, perPage: number): string {
  return `/acuerdos?page=${page}&per_page=${perPage}`;
}

function formatDate(value: string | null): string {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("es-ES");
}

export default async function AcuerdosPage({
  searchParams
}: {
  searchParams?: { page?: string; per_page?: string };
}) {
  const user = await requireUser();
  const db = createSourceCrmServerClient();
  const requestedPage = normalizePage(searchParams?.page);
  const perPage = normalizePerPage(searchParams?.per_page);
  const initialFrom = (requestedPage - 1) * perPage;
  const initialTo = initialFrom + (perPage - 1);

  let invRes = await db
    .from("inversion")
    .select("company_id, compania, prioridad, encaje_summax, inversion_maxima, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(initialFrom, initialTo);

  const totalCount = invRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);

  if (currentPage !== requestedPage) {
    const from = (currentPage - 1) * perPage;
    const to = from + (perPage - 1);
    invRes = await db
      .from("inversion")
      .select("company_id, compania, prioridad, encaje_summax, inversion_maxima, created_at, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);
  }

  const deals: DealRow[] = invRes.data ?? [];
  const companyIds = deals.map((d) => d.company_id);
  const contactsRes =
    companyIds.length > 0
      ? await db.from("contactos").select("contact_id, company_id, persona_contacto").in("company_id", companyIds)
      : { data: [] as Array<{ contact_id: number; company_id: number; persona_contacto: string | null }> };
  const contacts = contactsRes.data ?? [];
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const contactMap = new Map<number, Array<{ id: number; name: string }>>();
  contacts.forEach((c) => {
    const arr = contactMap.get(c.company_id) ?? [];
    if (c.persona_contacto) {
      arr.push({ id: c.contact_id, name: c.persona_contacto });
    }
    contactMap.set(c.company_id, arr);
  });

  const byStage: Record<string, DealCard[]> = {};
  BOARD_STAGES.forEach((stage) => {
    byStage[stage] = [];
  });

  deals.forEach((deal) => {
    const stage = pickStage(deal);
    const bucket = byStage[stage];
    if (!bucket) return;
    const contactsForDeal = contactMap.get(deal.company_id) ?? [];
    const firstContact = contactsForDeal[0];
    bucket.push({
      id: deal.company_id,
      name: deal.compania,
      amount: deal.inversion_maxima ?? "$0",
      priority: deal.prioridad ?? "--",
      contactName: firstContact?.name ?? "Sin contacto",
      contactId: firstContact?.id ?? null,
      closeDate: formatDate(deal.updated_at),
      createdDate: formatDate(deal.created_at)
    });
  });

  return (
    <AppShell title="Negocios" subtitle="Vista CRM tipo pipeline" canViewGlobal={user.can_view_global_dashboard}>
      <div className="deals-shell">
        <div className="deals-top-tabs">
          <button className="deals-main-tab deals-main-tab-active">
            <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="deals" className="crm-icon" /></span><span>Todos los negocios</span> <span className="deals-badge">{totalCount}</span>
          </button>
          <Link href="/acuerdos/manage" className="deals-edit">
            <span className="module-tab-icon" aria-hidden="true"><CrmIcon name="edit" className="crm-icon" /></span><span>Modificar datos negocios</span>
          </Link>
          <Link href="/acuerdos/new" className="deals-add">Añadir</Link>
        </div>
        <div className="deals-toolbar card">
          <DealsBoard stages={BOARD_STAGES} initialByStage={byStage} storageKeyPrefix={`user:${user.id}:deals`} />
          <div className="companies-pagination">
            {hasPrev ? (
              <Link href={hrefFor(currentPage - 1, perPage)} className="deals-main-tab">
                Anterior
              </Link>
            ) : (
              <button disabled>Anterior</button>
            )}
            <span className="companies-page-current">{currentPage}</span>
            {hasNext ? (
              <Link href={hrefFor(currentPage + 1, perPage)} className="deals-main-tab">
                Siguiente
              </Link>
            ) : (
              <button disabled>Siguiente</button>
            )}
            <RowsPerPageSelect value={perPage} storageKey={`user:${user.id}:deals:per_page`} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
