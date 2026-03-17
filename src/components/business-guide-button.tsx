"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function BusinessGuideButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button type="button" className="business-guide-trigger" onClick={() => setIsOpen(true)}>
        GUIA
      </button>

      {isOpen ? (
        <div className="business-guide-overlay" role="dialog" aria-modal="true" aria-label="Guia de negocios">
          <button
            type="button"
            className="business-guide-backdrop"
            aria-label="Cerrar guia"
            onClick={() => setIsOpen(false)}
          />
          <div className="business-guide-modal card">
            <div className="business-guide-modal-header">
              <strong>Resumen del pipeline</strong>
              <button type="button" className="business-guide-close" aria-label="Cerrar guia" onClick={() => setIsOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="business-guide-modal-body">
              <Image
                src="/negocios-resumen.png"
                alt="Resumen de negocios"
                width={1600}
                height={900}
                className="business-guide-image"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
