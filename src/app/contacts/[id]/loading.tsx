import { AppShell } from "@/components/app-shell";

function SkeletonLine({ width }: { width: string }) {
  return <div className="contact-skeleton-line" style={{ width }} />;
}

export default function ContactDetailLoading() {
  return (
    <AppShell title="Contactos" subtitle="Cargando ficha de contacto..." canViewGlobal={false}>
      <div className="contact-detail-layout contact-detail-pro">
        <aside className="contact-left card contact-pane contact-pane-1">
          <SkeletonLine width="120px" />
          <div className="contact-head">
            <div className="contact-skeleton-avatar" />
            <div style={{ width: "100%" }}>
              <SkeletonLine width="72%" />
              <SkeletonLine width="56%" />
            </div>
          </div>
          <div className="contact-quick-actions">
            <div className="contact-skeleton-pill" />
            <div className="contact-skeleton-pill" />
          </div>
          <div className="stack">
            <SkeletonLine width="45%" />
            <SkeletonLine width="88%" />
            <SkeletonLine width="76%" />
            <SkeletonLine width="82%" />
          </div>
        </aside>

        <section className="contact-center contact-pane contact-pane-2">
          <div className="card contact-tabs contact-surface">
            <div className="contact-skeleton-pill" />
            <div className="contact-skeleton-pill" />
            <div className="contact-skeleton-pill" />
            <div className="contact-skeleton-pill" />
          </div>
          <div className="card contact-surface">
            <SkeletonLine width="42%" />
            <SkeletonLine width="60%" />
            <SkeletonLine width="95%" />
            <SkeletonLine width="90%" />
            <SkeletonLine width="86%" />
          </div>
          <div className="card contact-surface">
            <SkeletonLine width="38%" />
            <SkeletonLine width="100%" />
            <SkeletonLine width="100%" />
            <div className="contact-skeleton-button" />
          </div>
        </section>

        <aside className="contact-right contact-pane contact-pane-3">
          <div className="card contact-surface">
            <SkeletonLine width="54%" />
            <SkeletonLine width="78%" />
          </div>
          <div className="card contact-surface">
            <SkeletonLine width="54%" />
            <SkeletonLine width="90%" />
          </div>
          <div className="card contact-surface">
            <SkeletonLine width="54%" />
            <SkeletonLine width="84%" />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
