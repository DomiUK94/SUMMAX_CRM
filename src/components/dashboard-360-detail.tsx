import Link from "next/link";
import { CrmIcon } from "@/components/ui/crm-icon";
import {
  formatDashboard360DocumentMeta,
  type Dashboard360DecisionItem,
  type Dashboard360KnowledgeItem,
  type Dashboard360NextAction,
  type Dashboard360PipelineItem,
  type Dashboard360RelationshipItem,
  type Dashboard360ResponsibleItem,
  type Dashboard360Summary,
  type Dashboard360TimelineItem
} from "@/lib/db/dashboard-360";
import type { EntityFileView } from "@/lib/db/entity-files";

type QuickAction = {
  label: string;
  href?: string;
  icon: "overview" | "task" | "companies" | "contacts" | "web" | "linkedin" | "mail";
  external?: boolean;
};

type Props = {
  summary: Dashboard360Summary;
  knowledge: Dashboard360KnowledgeItem[];
  pipeline: Dashboard360PipelineItem[];
  timeline: Dashboard360TimelineItem[];
  decisions: Dashboard360DecisionItem[];
  documents: EntityFileView[];
  nextAction: Dashboard360NextAction;
  responsibles: Dashboard360ResponsibleItem[];
  relationships: Dashboard360RelationshipItem[];
  relationshipsTitle: string;
  quickActions: QuickAction[];
};

function sourceLabel(source: Dashboard360TimelineItem["source"]) {
  if (source === "pipeline") return "Pipeline";
  if (source === "audit") return "Auditoría";
  return "Nota";
}

function nextActionClass(status: Dashboard360NextAction["status"]) {
  if (status === "missing") return "dashboard-360-next-action-missing";
  if (status === "focus") return "dashboard-360-next-action-focus";
  return "dashboard-360-next-action-scheduled";
}

export function Dashboard360Detail({
  summary,
  knowledge,
  pipeline,
  timeline,
  decisions,
  documents,
  nextAction,
  responsibles,
  relationships,
  relationshipsTitle,
  quickActions
}: Props) {
  return (
    <div className="dashboard-360-shell stack">
      <section className="dashboard-360-hero card">
        <div className="dashboard-360-hero-copy">
          <p className="workspace-kicker">Visión 360</p>
          <h2>{summary.title}</h2>
          <p className="muted">{summary.subtitle}</p>
          <div className="dashboard-360-meta-row">
            <span className="dashboard-360-chip">{summary.statusLabel}</span>
            <span className="dashboard-360-meta-pill">Responsable: {summary.ownerLabel}</span>
            <span className="dashboard-360-meta-pill">Última interacción: {summary.lastActivityLabel}</span>
          </div>
          {summary.relationLabel ? (
            summary.relationHref ? (
              <Link href={summary.relationHref} className="dashboard-360-relation-link">
                {summary.relationLabel}
              </Link>
            ) : (
              <span className="dashboard-360-relation-link dashboard-360-relation-link-static">{summary.relationLabel}</span>
            )
          ) : null}
        </div>

        <div className="dashboard-360-hero-side">
          <div className="dashboard-360-metrics-grid">
            {summary.metrics.map((metric) => (
              <div key={metric.label} className="dashboard-360-metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <div className="dashboard-360-actions-grid">
            {quickActions.map((action) =>
              action.href ? (
                action.external ? (
                  <a key={action.label} href={action.href} target="_blank" rel="noreferrer" className="dashboard-360-action-pill">
                    <CrmIcon name={action.icon} className="crm-icon" />
                    <span>{action.label}</span>
                  </a>
                ) : (
                  <Link key={action.label} href={action.href} className="dashboard-360-action-pill">
                    <CrmIcon name={action.icon} className="crm-icon" />
                    <span>{action.label}</span>
                  </Link>
                )
              ) : (
                <span key={action.label} className="dashboard-360-action-pill dashboard-360-action-pill-disabled">
                  <CrmIcon name={action.icon} className="crm-icon" />
                  <span>{action.label}</span>
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-360-grid">
        <article className="dashboard-360-main stack">
          <section className={`card dashboard-360-next-action ${nextActionClass(nextAction.status)}`}>
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Qué toca ahora</p>
                <h3>{nextAction.title}</h3>
              </div>
              <Link href={nextAction.href} className="quick-pill">
                <span>{nextAction.ctaLabel}</span>
              </Link>
            </div>
            <p>{nextAction.detail}</p>
            <small>{nextAction.dueLabel}</small>
          </section>

          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Qué sabemos</p>
                <h3>Contexto y datos clave</h3>
              </div>
            </div>
            <div className="dashboard-360-knowledge-grid">
              {knowledge.map((item) => (
                <div key={item.label} className="dashboard-360-info-card">
                  <span>{item.label}</span>
                  {item.href ? (
                    item.href.startsWith("http") ? (
                      <a href={item.href} target="_blank" rel="noreferrer">
                        <strong>{item.value}</strong>
                      </a>
                    ) : (
                      <Link href={item.href}>
                        <strong>{item.value}</strong>
                      </Link>
                    )
                  ) : (
                    <strong>{item.value}</strong>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Pipeline actual</p>
                <h3>Negocio y responsables</h3>
              </div>
            </div>
            <div className="dashboard-360-pipeline-list">
              {pipeline.length > 0 ? (
                pipeline.map((item) => (
                  <Link key={item.id} href={item.href} className="dashboard-360-pipeline-card">
                    <div className="dashboard-360-pipeline-head">
                      <strong>{item.title}</strong>
                      <span className={`dashboard-360-kind dashboard-360-kind-${item.kind}`}>{item.kind === "lead" ? "Lead" : "Opportunity"}</span>
                    </div>
                    <span>{item.status}</span>
                    <small>{item.owner} · {item.detail}</small>
                  </Link>
                ))
              ) : (
                <div className="table-empty-state">
                  <strong>Sin pipeline asociado.</strong>
                  <p>No hay leads ni opportunities vinculadas en esta vista.</p>
                </div>
              )}
            </div>
          </section>

          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Qué hemos hecho</p>
                <h3>Timeline unificado</h3>
              </div>
            </div>
            <div className="dashboard-360-timeline">
              {timeline.length > 0 ? (
                timeline.map((item) => (
                  <div key={item.id} className="dashboard-360-timeline-item">
                    <div className="dashboard-360-timeline-head">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{sourceLabel(item.source)}</span>
                      </div>
                      <small>{item.occurredAt}</small>
                    </div>
                    <p>{item.body}</p>
                    {item.href ? (
                      <Link href={item.href} className="dashboard-360-inline-link">
                        Abrir contexto
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="table-empty-state">
                  <strong>Sin actividad registrada.</strong>
                  <p>Cuando haya interacciones, notas o cambios importantes aparecerán aquí.</p>
                </div>
              )}
            </div>
          </section>
        </article>

        <aside className="dashboard-360-side stack">
          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Responsables</p>
                <h3>Quién lleva la cuenta</h3>
              </div>
            </div>
            <div className="dashboard-360-compact-list">
              {responsibles.map((item) => (
                <div key={item.label} className="dashboard-360-compact-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Relaciones</p>
                <h3>{relationshipsTitle}</h3>
              </div>
            </div>
            <div className="dashboard-360-relationship-list">
              {relationships.length > 0 ? (
                relationships.map((item) =>
                  item.href ? (
                    <Link key={item.id} href={item.href} className="dashboard-360-relationship-card">
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </Link>
                  ) : (
                    <div key={item.id} className="dashboard-360-relationship-card dashboard-360-relationship-card-static">
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </div>
                  )
                )
              ) : (
                <p className="muted">Sin relaciones vinculadas.</p>
              )}
            </div>
          </section>

          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Documentos</p>
                <h3>Archivos vinculados</h3>
              </div>
            </div>
            <div className="dashboard-360-doc-list">
              {documents.length > 0 ? (
                documents.map((file) => (
                  <div key={file.id} className="dashboard-360-doc-card">
                    {file.downloadUrl ? (
                      <Link href={file.downloadUrl} target="_blank" rel="noreferrer" className="dashboard-360-inline-link">
                        {file.file_name}
                      </Link>
                    ) : (
                      <strong>{file.file_name}</strong>
                    )}
                    <span>{formatDashboard360DocumentMeta(file)}</span>
                  </div>
                ))
              ) : (
                <p className="muted">Sin documentación cargada.</p>
              )}
            </div>
          </section>

          <section className="card dashboard-360-section">
            <div className="dashboard-360-section-head">
              <div>
                <p className="workspace-kicker">Decisiones</p>
                <h3>Cambios relevantes</h3>
              </div>
            </div>
            <div className="dashboard-360-decision-list">
              {decisions.length > 0 ? (
                decisions.map((item) => (
                  <div key={item.id} className="dashboard-360-decision-card">
                    <strong>{item.title}</strong>
                    <span>{item.occurredAt}</span>
                    <p>{item.body}</p>
                    {item.href ? (
                      <Link href={item.href} className="dashboard-360-inline-link">
                        Abrir detalle
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="muted">Sin decisiones destacadas todavía.</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
