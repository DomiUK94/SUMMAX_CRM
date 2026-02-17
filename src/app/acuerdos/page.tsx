import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { createSourceCrmServerClient } from "@/lib/supabase/sourcecrm";

type DealRow = {
  company_id: number;
  compania: string;
  prioridad: string | null;
  encaje_summax: string | null;
  inversion_maxima: string | null;
};

type DealCard = {
  id: number;
  name: string;
  amount: string;
  contact: string;
  closeDate: string;
};

const BOARD_STAGES = [
  "Appointment Scheduled",
  "Qualified To Buy",
  "Presentation Scheduled",
  "Decision Maker Bought-In",
  "Contract Sent",
  "Closed Won",
  "Closed Lost"
];

function pickStage(deal: DealRow): string {
  const signal = `${deal.encaje_summax ?? ""} ${deal.prioridad ?? ""}`.toLowerCase();
  if (signal.includes("won") || signal.includes("ganado")) return "Closed Won";
  if (signal.includes("lost") || signal.includes("perdido")) return "Closed Lost";
  if (signal.includes("contract")) return "Contract Sent";
  if (signal.includes("decision")) return "Decision Maker Bought-In";
  if (signal.includes("present")) return "Presentation Scheduled";
  if (signal.includes("qual")) return "Qualified To Buy";
  return "Appointment Scheduled";
}

export default async function AcuerdosPage() {
  const user = await requireUser();
  const db = createSourceCrmServerClient();

  const [invRes, contactsRes] = await Promise.all([
    db
      .from("inversion")
      .select("company_id, compania, prioridad, encaje_summax, inversion_maxima")
      .order("updated_at", { ascending: false })
      .limit(200),
    db.from("contactos").select("company_id, persona_contacto").limit(500)
  ]);

  const deals: DealRow[] = invRes.data ?? [];
  const contacts = contactsRes.data ?? [];

  const contactMap = new Map<number, string[]>();
  contacts.forEach((c) => {
    const arr = contactMap.get(c.company_id) ?? [];
    if (c.persona_contacto) arr.push(c.persona_contacto);
    contactMap.set(c.company_id, arr);
  });

  const byStage = new Map<string, DealCard[]>();
  BOARD_STAGES.forEach((stage) => byStage.set(stage, []));

  deals.forEach((deal) => {
    const stage = pickStage(deal);
    const bucket = byStage.get(stage);
    if (!bucket) return;
    const contactsForDeal = contactMap.get(deal.company_id) ?? [];
    bucket.push({
      id: deal.company_id,
      name: deal.compania,
      amount: deal.inversion_maxima ?? "$0",
      contact: contactsForDeal[0] ?? "No contact",
      closeDate: "--"
    });
  });

  return (
    <AppShell title="Acuerdos" subtitle="Vista CRM tipo pipeline" canViewGlobal={user.can_view_global_dashboard}>
      <div className="deals-shell">
        <div className="deals-top-tabs">
          <button className="deals-select">Deals ▾</button>
          <button className="deals-main-tab deals-main-tab-active">All deals <span className="deals-badge">{deals.length}</span></button>
          <button className="deals-main-tab">My deals</button>
          <button className="deals-plus">+</button>
          <button className="deals-add">Add deals ▾</button>
        </div>

        <div className="deals-toolbar card">
          <div className="deals-toolbar-row">
            <input className="deals-search" placeholder="Search" />
            <div className="deals-actions">
              <button>Board view ▾</button>
              <button>Deals pipeline ▾</button>
              <button>Filters</button>
              <button>Sort</button>
              <button>Export</button>
              <button>Save</button>
            </div>
          </div>

          <div className="deals-filters-row">
            <button className="deals-filter-chip">Deal owner ▾</button>
            <button className="deals-filter-chip">Create date ▾</button>
            <button className="deals-filter-chip">Last activity date ▾</button>
            <button className="deals-filter-chip">Close date ▾</button>
            <button className="deals-filter-chip">+ More</button>
            <button className="deals-filter-chip">Advanced filters</button>
          </div>

          <div className="deals-board-wrap">
            <div className="deals-board">
              {BOARD_STAGES.map((stage) => {
                const cards = byStage.get(stage) ?? [];
                return (
                  <section key={stage} className="deals-column">
                    <header className="deals-column-header">
                      <span>{stage}</span>
                      <span className="deals-column-count">{cards.length}</span>
                    </header>
                    <div className="deals-column-body">
                      {cards.map((card) => (
                        <article key={card.id} className="deal-card">
                          <a href="#" className="deal-card-title">{card.name}</a>
                          <div>Amount: {card.amount}</div>
                          <div>Close date: {card.closeDate}</div>
                          <hr />
                          <div>{card.contact}</div>
                        </article>
                      ))}
                    </div>
                    <footer className="deals-column-footer">
                      <strong>${cards.length ? "1,000" : "0"}</strong> | Total amount
                    </footer>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
