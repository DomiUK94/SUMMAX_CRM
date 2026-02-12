import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>SUMMAX CRM</h1>
        <p>Base MVP implementada: auth, permisos, dashboards, CRM, import y export.</p>
        <div className="row">
          <Link href="/login">Ir a login</Link>
          <Link href="/dashboard/me">Mi dashboard</Link>
          <Link href="/dashboard/general">Dashboard general</Link>
        </div>
      </div>
    </main>
  );
}
