"use client";

import { useState } from "react";

export function NewInvestorForm({
  createInvestorAction
}: {
  createInvestorAction: (formData: FormData) => Promise<void>;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <form action={createInvestorAction} className="contact-new-form card" style={{ maxWidth: 980 }}>
      <div className="contact-new-grid">
        <label className="form-field contact-new-field-wide">
          <span>Nombre de la compañia</span>
          <input name="name" required placeholder="Nombre de la compañia" />
        </label>

        <label className="form-field">
          <span>Categoria</span>
          <input name="category" placeholder="Vertical o categoria" />
        </label>

        <label className="form-field">
          <span>Web</span>
          <input name="website" placeholder="https://empresa.com" />
        </label>
      </div>

      <div className="contact-new-advanced-toggle">
        <button type="button" className="quick-pill quick-pill-ghost" onClick={() => setAdvancedOpen((current) => !current)}>
          {advancedOpen ? "Ocultar avanzado" : "Avanzado"}
        </button>
      </div>

      {advancedOpen ? (
        <div className="contact-new-advanced-panel">
          <div className="contact-new-grid">
            <label className="form-field">
              <span>Estrategia</span>
              <input name="strategy" placeholder="Tesis o estrategia" />
            </label>
            <label className="form-field">
              <span>Direccion</span>
              <input name="address" placeholder="Direccion principal" />
            </label>
            <label className="form-field">
              <span>LinkedIn</span>
              <input name="linkedin" placeholder="https://linkedin.com/company/..." />
            </label>
            <label className="form-field">
              <span>Portfolio</span>
              <input name="portfolio" placeholder="Portfolio o web adicional" />
            </label>
            <label className="form-field">
              <span>Encaje SUMMAX</span>
              <input name="fit" placeholder="Encaje con SUMMAX" />
            </label>
            <label className="form-field">
              <span>Motivo</span>
              <input name="reason" placeholder="Motivo o notas de interes" />
            </label>
            <label className="form-field">
              <span>Inversion minima</span>
              <input name="min_investment" placeholder="Ej. 250k" />
            </label>
            <label className="form-field">
              <span>Inversion maxima</span>
              <input name="max_investment" placeholder="Ej. 2M" />
            </label>
            <label className="form-field">
              <span>Prioridad</span>
              <input name="priority" placeholder="Alta, media..." />
            </label>
            <label className="form-field">
              <span>Sede</span>
              <input name="office" placeholder="Ciudad o pais" />
            </label>
            <label className="form-field">
              <span>Tamano empresa</span>
              <input name="company_size" placeholder="Tamano de empresa" />
            </label>
            <label className="form-field contact-new-field-full">
              <span>Comentarios</span>
              <textarea name="comments" rows={5} placeholder="Notas internas..." />
            </label>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="submit">Crear compañia</button>
      </div>
    </form>
  );
}

