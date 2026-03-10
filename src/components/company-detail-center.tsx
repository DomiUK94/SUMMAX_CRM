"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyProfileEditDialog } from "@/components/company-profile-edit-dialog";

type CompanyDefaults = {
  name: string;
  category: string;
  website: string;
  strategy: string;
  priority: string;
  office: string;
  company_size: string;
  min_investment: string;
  max_investment: string;
  address: string;
  linkedin: string;
  portfolio: string;
  fit: string;
  reason: string;
  comments: string;
};

type ActivityItem = {
  id: string;
  title: string;
  type: string;
  occurredAt: string;
  body: string;
};

type CompletedDeal = {
  id: string;
  name: string;
  amount: string;
  closedAt: string;
};

type Props = {
  investorId: string;
  defaults: CompanyDefaults;
  profile: {
    city: string;
    address: string;
    zipCode: string;
    region: string;
    country: string;
    sector: string;
  };
  activities: ActivityItem[];
  completedDeals: CompletedDeal[];
  advanced: Array<{ label: string; value: string; wide?: boolean }>;
  action: (formData: FormData) => void | Promise<void>;
};

type CompanyTab = "info" | "activities" | "revenue" | "advanced";

export function CompanyDetailCenter({ investorId, defaults, profile, activities, completedDeals, advanced, action }: Props) {
  const [tab, setTab] = useState<CompanyTab>("info");

  return (
    <section className="company-detail-main stack">
      <div className="contact-record-center-tabs" aria-label="Secciones de la compañía">
        <button type="button" className={`contact-record-center-tab ${tab === "info" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("info")}>Información</button>
        <button type="button" className={`contact-record-center-tab ${tab === "activities" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("activities")}>Actividades</button>
        <button type="button" className={`contact-record-center-tab ${tab === "revenue" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("revenue")}>Ingresos</button>
        <button type="button" className={`contact-record-center-tab ${tab === "advanced" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("advanced")}>Información avanzada</button>
      </div>

      {tab === "info" ? (
        <article className="stack">
          <section className="card company-profile-card">
            <div className="company-record-section-head">
              <h3>Perfil de la compañia</h3>
              <div className="company-profile-actions">
                <CompanyProfileEditDialog action={action} defaults={defaults} />
              </div>
            </div>
            <div className="company-profile-grid">
              <div className="company-profile-item"><span>Ciudad</span><strong>{profile.city}</strong></div>
              <div className="company-profile-item"><span>Dirección</span><strong>{profile.address}</strong></div>
              <div className="company-profile-item"><span>Código postal</span><strong>{profile.zipCode}</strong></div>
              <div className="company-profile-item"><span>Estado o región</span><strong>{profile.region}</strong></div>
              <div className="company-profile-item"><span>País/región</span><strong>{profile.country}</strong></div>
              <div className="company-profile-item"><span>Sector</span><strong>{profile.sector}</strong></div>
            </div>
          </section>
        </article>
      ) : null}

      {tab === "activities" ? (
        <article className="card company-side-card stack">
          <div className="company-record-section-head">
            <h3>Actividades</h3>
            <Link href={`/actividades/new?investor_id=${encodeURIComponent(investorId)}`} className="company-profile-edit-button">Nueva actividad</Link>
          </div>
          <div className="company-note-list stack">
            {activities.map((activity) => (
              <div key={activity.id} className="company-note-item">
                <strong>{activity.title}</strong>
                <div className="muted">{activity.type} | {activity.occurredAt}</div>
                {activity.body ? <p>{activity.body}</p> : null}
              </div>
            ))}
            {activities.length === 0 ? <p className="muted">Sin actividades relacionadas.</p> : null}
          </div>
        </article>
      ) : null}

      {tab === "revenue" ? (
        <article className="card company-side-card stack">
          <div className="company-record-section-head">
            <h3>Negocios completados</h3>
          </div>
          <div className="company-note-list stack">
            {completedDeals.map((deal) => (
              <div key={deal.id} className="company-note-item">
                <strong>{deal.name}</strong>
                <div className="muted">{deal.amount} | {deal.closedAt}</div>
              </div>
            ))}
            {completedDeals.length === 0 ? <p className="muted">Sin negocios completados.</p> : null}
          </div>
        </article>
      ) : null}

      {tab === "advanced" ? (
        <article className="card company-profile-card">
          <div className="company-record-section-head">
            <h3>Información avanzada</h3>
            <div className="company-profile-actions">
              <CompanyProfileEditDialog action={action} defaults={defaults} />
            </div>
          </div>
          <div className="company-profile-grid company-profile-grid-advanced">
            {advanced.map((item) => (
              <div key={item.label} className={`company-profile-item ${item.wide ? "company-profile-item-wide" : ""}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
