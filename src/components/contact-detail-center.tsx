"use client";

import { useEffect, useState } from "react";
import { ContactProfileEditDialog } from "@/components/contact-profile-edit-dialog";
import { TaskOccurredAtField } from "@/components/task-occurred-at-field";

type ContactDefaults = {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  other_contact: string;
  linkedin: string;
  comments: string;
  is_financier: string;
  is_prescriber: string;
  owner_user_id: string;
  next_step: string;
  due_date: string;
};

type DealItem = {
  id: string;
  name: string;
  priority: string;
  amount: string;
};

type CommentItem = {
  id: string;
  createdBy: string;
  createdAt: string;
  body: string;
};

type ActivityItem = {
  id: string;
  title: string;
  type: string;
  occurredAt: string;
  body: string;
};

type AuditItem = {
  id: string;
  field: string;
  changedAt: string;
  changedBy: string;
  oldValue: string;
  newValue: string;
};

type TagItem = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  defaults: ContactDefaults;
  owners: Array<{ id: string; email: string }>;
  info: {
    name: string;
    email: string;
    phone: string;
    role: string;
    otherContact: string;
    linkedin: string;
    isFinancier: string;
    isPrescriber: string;
    comments: string;
  };
  closedDeals: DealItem[];
  comments: CommentItem[];
  activities: ActivityItem[];
  auditRows: AuditItem[];
  advanced: {
    company: string;
    owner: string;
    linkedin: string;
    comments: string;
    tags: string;
    lastActivity: string;
    leads: string;
    opportunities: string;
  };
  updateAction: (formData: FormData) => void | Promise<void>;
  addCommentAction: (formData: FormData) => void | Promise<void>;
  initialTab?: string;
};

type ContactTab = "info" | "activities" | "revenue" | "advanced";

function normalizeContactTab(value: string | undefined): ContactTab {
  if (value === "activities" || value === "revenue" || value === "advanced") return value;
  return "info";
}

export function ContactDetailCenter({
  defaults,
  owners,
  info,
  closedDeals,
  comments,
  activities,
  auditRows,
  advanced,
  updateAction,
  addCommentAction,
  initialTab
}: Props) {
  const [tab, setTab] = useState<ContactTab>(normalizeContactTab(initialTab));

  useEffect(() => {
    setTab(normalizeContactTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (tab !== "activities") return;
    if (typeof window === "undefined" || window.location.hash !== "#contact-notes") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("contact-notes")?.scrollIntoView({ block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  return (
    <section className="contact-record-main stack">
      <div className="contact-record-center-tabs" aria-label={"Secciones del contacto"}>
        <button type="button" className={`contact-record-center-tab ${tab === "info" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("info")}>{"Informaci\u00f3n"}</button>
        <button type="button" className={`contact-record-center-tab ${tab === "revenue" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("revenue")}>Ingresos</button>
        <button type="button" className={`contact-record-center-tab ${tab === "advanced" ? "contact-record-center-tab-active" : ""}`} onClick={() => setTab("advanced")}>{"Informaci\u00f3n avanzada"}</button>
      </div>

      {tab === "info" ? (
        <article className="card company-edit-card">
          <div className="company-record-section-head">
            <div>
              <p className="workspace-kicker">{"Informaci\u00f3n"}</p>
            </div>
            <div className="company-profile-actions">
              <ContactProfileEditDialog action={updateAction} defaults={defaults} owners={owners} />
            </div>
          </div>

          <div className="company-profile-grid contact-profile-grid">
            <div className="company-profile-item"><span>Nombre</span><strong>{info.name}</strong></div>
            <div className="company-profile-item"><span>Email</span><strong>{info.email}</strong></div>
            <div className="company-profile-item"><span>{"Tel\u00e9fono"}</span><strong>{info.phone}</strong></div>
            <div className="company-profile-item"><span>Rol</span><strong>{info.role}</strong></div>
            <div className="company-profile-item"><span>Otro contacto</span><strong>{info.otherContact}</strong></div>
            <div className="company-profile-item"><span>Es financiador</span><strong>{info.isFinancier}</strong></div>
            <div className="company-profile-item"><span>Es preescriptor</span><strong>{info.isPrescriber}</strong></div>
            <div className="company-profile-item"><span>LinkedIn</span><strong>{info.linkedin}</strong></div>
            <div className="company-profile-item contact-profile-item-wide"><span>Comentarios</span><strong>{info.comments}</strong></div>
          </div>
        </article>
      ) : null}

      {tab === "activities" ? (
        <article className="card company-edit-card stack">
          <div className="company-record-section-head">
            <div>
              <p className="workspace-kicker">Actividad comercial</p>
              <h3>Timeline y notas</h3>
            </div>
          </div>

          <div id="contact-notes" className="company-note-list stack">
            <form action={addCommentAction} className="stack">
              <textarea name="body" rows={4} placeholder={"A\u00f1adir nota interna..."} />
              <TaskOccurredAtField />
              <button type="submit">Guardar nota</button>
            </form>
            {activities.map((activity) => (
              <div key={activity.id} className="company-note-item">
                <strong>{activity.title}</strong>
                <div className="muted">{activity.type} | {activity.occurredAt}</div>
                <p>{activity.body}</p>
              </div>
            ))}
            {comments.map((comment) => (
              <div key={comment.id} className="company-note-item">
                <div className="muted">{comment.createdBy} | {comment.createdAt}</div>
                <p>{comment.body}</p>
              </div>
            ))}
            {comments.length === 0 ? <p className="muted">Sin comentarios.</p> : null}
          </div>
        </article>
      ) : null}

      {tab === "revenue" ? (
        <article className="card company-side-card">
          <h3>Negocios cerrados</h3>
          <div className="company-note-list stack">
            {closedDeals.map((deal) => (
              <div key={deal.id} className="company-note-item">
                <strong>{deal.name}</strong>
                <div className="muted">{deal.priority} | {deal.amount}</div>
              </div>
            ))}
            {closedDeals.length === 0 ? <p className="muted">Sin negocios cerrados.</p> : null}
          </div>
        </article>
      ) : null}

      {tab === "advanced" ? (
        <article className="card company-profile-card">
          <div className="company-record-section-head">
            <div>
              <p className="workspace-kicker">{"Informaci\u00f3n avanzada"}</p>
              <h3>{"Datos adicionales del contacto"}</h3>
            </div>
            <div className="company-profile-actions">
              <ContactProfileEditDialog action={updateAction} defaults={defaults} owners={owners} />
            </div>
          </div>

          <div className="company-profile-grid">
            <div className="company-profile-item"><span>{"Compa\u00f1\u00eda vinculada"}</span><strong>{advanced.company}</strong></div>
            <div className="company-profile-item"><span>Propietario</span><strong>{advanced.owner}</strong></div>
            <div className="company-profile-item"><span>LinkedIn</span><strong>{advanced.linkedin}</strong></div>
            <div className="company-profile-item"><span>{"\u00daltima actividad"}</span><strong>{advanced.lastActivity}</strong></div>
            <div className="company-profile-item"><span>Leads</span><strong>{advanced.leads}</strong></div>
            <div className="company-profile-item"><span>Opportunities</span><strong>{advanced.opportunities}</strong></div>
            <div className="company-profile-item"><span>Etiquetas</span><strong>{advanced.tags}</strong></div>
            <div className="company-profile-item company-profile-item-wide"><span>Comentarios</span><strong>{advanced.comments}</strong></div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
