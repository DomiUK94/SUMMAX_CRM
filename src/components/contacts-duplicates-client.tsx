"use client";

import { useEffect, useState } from "react";

type DuplicateGroup = {
  rule: string;
  records: Array<{
    contact_id: number;
    persona_contacto: string | null;
    compania: string | null;
    email: string | null;
    telefono: string | null;
    updated_at: string | null;
  }>;
};

export function ContactsDuplicatesClient() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadGroups() {
    setError(null);
    const res = await fetch("/api/contacts/duplicates");
    const payload = (await res.json().catch(() => null)) as { groups?: DuplicateGroup[]; error?: string } | null;
    if (!res.ok) {
      setError(payload?.error ?? "No se pudieron cargar duplicados");
      return;
    }
    setGroups(payload?.groups ?? []);
  }

  useEffect(() => {
    void loadGroups();
  }, []);

  async function mergeContacts(keepId: number, removeId: number) {
    const key = `${keepId}-${removeId}`;
    setBusy(key);
    setError(null);
    const res = await fetch("/api/contacts/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keep_id: String(keepId), remove_id: String(removeId) })
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(payload?.error ?? "No se pudo hacer merge");
      setBusy(null);
      return;
    }
    await loadGroups();
    setBusy(null);
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Duplicados de contactos</h2>
        <p className="muted">Reglas: email, telefono o nombre+compania coincidentes.</p>
        <button onClick={() => void loadGroups()}>Refrescar</button>
        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      </div>

      {(groups ?? []).map((group) => (
        <div key={group.rule} className="card">
          <h3 style={{ marginTop: 0 }}>{group.rule}</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Compania</th>
                <th>Email</th>
                <th>Telefono</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {group.records.map((record) => (
                <tr key={record.contact_id}>
                  <td>{record.contact_id}</td>
                  <td>{record.persona_contacto ?? "--"}</td>
                  <td>{record.compania ?? "--"}</td>
                  <td>{record.email ?? "--"}</td>
                  <td>{record.telefono ?? "--"}</td>
                  <td>
                    {group.records
                      .filter((target) => target.contact_id !== record.contact_id)
                      .map((target) => (
                        <button
                          key={`${record.contact_id}-${target.contact_id}`}
                          disabled={busy === `${target.contact_id}-${record.contact_id}`}
                          onClick={() => void mergeContacts(target.contact_id, record.contact_id)}
                        >
                          Mantener {target.contact_id}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {groups.length === 0 ? <div className="card">No se detectaron duplicados.</div> : null}
    </div>
  );
}
