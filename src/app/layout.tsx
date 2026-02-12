import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SUMMAX CRM",
  description: "CRM interno SUMMAX"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="mobile-block">
          <main>
            <div className="card">
              <h1>SUMMAX CRM</h1>
              <p>Esta version esta optimizada solo para desktop (&gt;=1280px).</p>
            </div>
          </main>
        </div>
        <div className="desktop-only">{children}</div>
      </body>
    </html>
  );
}
