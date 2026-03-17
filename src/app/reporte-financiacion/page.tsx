import { AppShell } from "@/components/app-shell";
import { StaticTable } from "@/components/ui/static-table";
import { requireUser } from "@/lib/auth/session";
import { formatCurrencyRange, getProductFamilyLabel, listProducts } from "@/lib/db/products";
import { CrmIcon } from "@/components/ui/crm-icon";

export default async function ReporteFinanciacionPage() {
  const user = await requireUser();
  const products = await listProducts();
  const activeProducts = products.filter((product) => product.active);
  const inactiveProducts = products.length - activeProducts.length;
  const loanProducts = products.filter((product) => product.product_family === "loan");
  const franchiseProducts = products.filter((product) => product.product_family === "franchise");
  const amountConfiguredCount = products.filter((product) => product.requires_amount).length;
  const multiplierConfiguredCount = products.filter((product) => product.requires_multiplier).length;
  const highestTicketProduct =
    [...products].sort((a, b) => (b.amount_max ?? b.amount_min ?? 0) - (a.amount_max ?? a.amount_min ?? 0))[0] ?? null;

  return (
    <AppShell title="Reporte productos" subtitle="Resumen del catálogo financiero base" canViewGlobal={user.can_view_global_dashboard}>
      <section className="dashboard-hero dashboard-financing-hero">
        <div className="card dashboard-highlight-card">
          <p className="workspace-kicker">
            <span className="workspace-kicker-icon" aria-hidden="true">
              <CrmIcon name="report" className="crm-icon" />
            </span>
            <span>Portfolio</span>
          </p>
          <h2>Catálogo de financiación</h2>
          <p className="muted">Vista rápida del portfolio activo, estructura de producto y señales de configuración disponibles para originación.</p>
          <div className="dashboard-highlight-metric">
            <strong>{products.length}</strong>
            <span>productos configurados en la dimensión financiera</span>
          </div>
          <div className="dashboard-insight-grid">
            <div className="dashboard-insight-card dashboard-insight-card-soft">
              <span className="dashboard-insight-label">Producto de mayor ticket</span>
              <strong>{highestTicketProduct?.name ?? "-"}</strong>
              <small>{highestTicketProduct ? formatCurrencyRange(highestTicketProduct.amount_min, highestTicketProduct.amount_max) : "Sin rango definido"}</small>
            </div>
            <div className="dashboard-insight-card dashboard-insight-card-soft">
              <span className="dashboard-insight-label">Configuración avanzada</span>
              <strong>{multiplierConfiguredCount}</strong>
              <small>productos que usan multiplicador por defecto</small>
            </div>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true">
              <CrmIcon name="overview" className="crm-icon" />
            </span>
            <span>Productos activos</span>
            <strong>{activeProducts.length}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true">
              <CrmIcon name="warning" className="crm-icon" />
            </span>
            <span>Productos inactivos</span>
            <strong>{inactiveProducts}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true">
              <CrmIcon name="deals" className="crm-icon" />
            </span>
            <span>Préstamo</span>
            <strong>{loanProducts.length}</strong>
          </div>
          <div className="card dashboard-kpi-card">
            <span className="dashboard-kpi-icon" aria-hidden="true">
              <CrmIcon name="companies" className="crm-icon" />
            </span>
            <span>Franquicia</span>
            <strong>{franchiseProducts.length}</strong>
          </div>
        </div>
      </section>

      <section className="dashboard-split-grid dashboard-analysis-grid">
        <div className="card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <p className="workspace-kicker">
                <span className="workspace-kicker-icon" aria-hidden="true">
                  <CrmIcon name="spark" className="crm-icon" />
                </span>
                <span>Capacidades</span>
              </p>
              <h3>Señales de configuración</h3>
              <p className="muted">Qué variables están habilitadas hoy dentro del catálogo.</p>
            </div>
          </div>
          <div className="dashboard-stat-list">
            <div className="dashboard-stat-row">
              <div>
                <strong>Rango de importe</strong>
                <span>Productos que requieren importe mínimo/máximo.</span>
              </div>
              <b>{amountConfiguredCount}</b>
            </div>
            <div className="dashboard-stat-row">
              <div>
                <strong>Multiplicador</strong>
                <span>Productos con cálculo basado en múltiplo.</span>
              </div>
              <b>{multiplierConfiguredCount}</b>
            </div>
            <div className="dashboard-stat-row">
              <div>
                <strong>Valoración empresa</strong>
                <span>Productos que requieren company valuation.</span>
              </div>
              <b>{products.filter((product) => product.requires_company_valuation).length}</b>
            </div>
            <div className="dashboard-stat-row">
              <div>
                <strong>País obligatorio</strong>
                <span>Productos que dependen de país objetivo.</span>
              </div>
              <b>{products.filter((product) => product.requires_country).length}</b>
            </div>
          </div>
        </div>

        <div className="card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <p className="workspace-kicker">
                <span className="workspace-kicker-icon" aria-hidden="true">
                  <CrmIcon name="overview" className="crm-icon" />
                </span>
                <span>Mix</span>
              </p>
              <h3>Familias de producto</h3>
              <p className="muted">Distribución actual del portfolio financiero base.</p>
            </div>
          </div>
          <div className="dashboard-ranking-list">
            {[
              { label: "Préstamo", value: loanProducts.length },
              { label: "Franquicia", value: franchiseProducts.length }
            ].map((family, index) => {
              const ratio = products.length > 0 ? (family.value / products.length) * 100 : 0;
              return (
                <div key={family.label} className="dashboard-ranking-item">
                  <div className="dashboard-ranking-head">
                    <span className="dashboard-ranking-index">0{index + 1}</span>
                    <div>
                      <strong>{family.label}</strong>
                      <span>{family.value} productos</span>
                    </div>
                    <b>{Math.round(ratio)}%</b>
                  </div>
                  <div className="dashboard-progress">
                    <span style={{ width: `${Math.max(ratio, 8)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="card dashboard-table-card">
        <div className="dashboard-section-head">
          <div>
            <p className="workspace-kicker">Detalle</p>
            <h3>Catálogo completo</h3>
            <p className="muted">Vista tabular del setup operativo de cada producto.</p>
          </div>
        </div>
        <StaticTable
          columns={["Producto", "Código", "Familia", "Rango importe", "Multiplicador", "Activo"]}
          rows={products.map((product) => [
            product.name,
            product.code,
            getProductFamilyLabel(product.product_family),
            formatCurrencyRange(product.amount_min, product.amount_max),
            product.default_multiplier ? `${product.default_multiplier.toLocaleString("es-ES", { maximumFractionDigits: 2 })}x` : "-",
            product.active ? "Sí" : "No"
          ])}
          emptyLabel="Sin productos configurados."
        />
      </div>
    </AppShell>
  );
}
