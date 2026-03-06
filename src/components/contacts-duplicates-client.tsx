"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getCoreRowModel, type ColumnDef, useReactTable } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";

type DuplicateRecord = {
  contact_id: number;
  persona_contacto: string | null;
  compania: string | null;
  email: string | null;
  telefono: string | null;
  updated_at: string | null;
};

type DuplicateGroup = {
  rule: string;
  records: DuplicateRecord[];
};

type DuplicateTableRow = {
  rowId: string;
  rule: string;
  record: DuplicateRecord;
  targets: DuplicateRecord[];
};

type PendingMerge = {
  keepId: number;
  removeId: number;
} | null;

export function ContactsDuplicatesClient() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge>(null);

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
    setPendingMerge(null);
  }

  const rows = useMemo<DuplicateTableRow[]>(
    () =>
      groups.flatMap((group) =>
        group.records.map((record) => ({
          rowId: `${group.rule}-${record.contact_id}`,
          rule: group.rule,
          record,
          targets: group.records.filter((target) => target.contact_id !== record.contact_id)
        }))
      ),
    [groups]
  );

  const columns = useMemo<ColumnDef<DuplicateTableRow>[]>(
    () => [
      { id: "rule", header: "Regla", cell: ({ row }) => row.original.rule },
      { id: "contact_id", header: "ID", cell: ({ row }) => row.original.record.contact_id },
      { id: "persona_contacto", header: "Nombre", cell: ({ row }) => row.original.record.persona_contacto ?? "--" },
      { id: "compania", header: "Compañía", cell: ({ row }) => row.original.record.compania ?? "--" },
      { id: "email", header: "Email", cell: ({ row }) => row.original.record.email ?? "--" },
      { id: "telefono", header: "Teléfono", cell: ({ row }) => row.original.record.telefono ?? "--" },
      {
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="entity-toolbar-actions" style={{ marginLeft: 0, gap: 8, flexWrap: "wrap" }}>
            {row.original.targets.map((target) => (
              <button
                key={`${row.original.record.contact_id}-${target.contact_id}`}
                disabled={busy === `${target.contact_id}-${row.original.record.contact_id}`}
                onClick={() => setPendingMerge({ keepId: target.contact_id, removeId: row.original.record.contact_id })}
              >
                Mantener {target.contact_id}
              </button>
            ))}
          </div>
        )
      }
    ],
    [busy]
  );

  const table = useReactTable({ data: rows, columns, getRowId: (row) => row.rowId, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <div className="stack">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Duplicados de contactos</h2>
              <p className="muted">Reglas: email, teléfono o nombre + compañía coincidentes.</p>
            </div>
            <button onClick={() => void loadGroups()}>Refrescar</button>
          </div>
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
        </div>
        <div className="card">
          <DataTable
            table={table}
            emptyLabel="No se detectaron duplicados."
            emptyHint="Cuando haya coincidencias por email, teléfono o nombre con compañía, aparecerán aquí para revisión."
          />
        </div>
      </div>

      <Dialog.Root open={Boolean(pendingMerge)} onOpenChange={(open) => !open && setPendingMerge(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="radix-dialog-overlay" />
          <Dialog.Content className="radix-dialog-content">
            <div className="radix-dialog-head">
              <div>
                <Dialog.Title>Confirmar fusión</Dialog.Title>
                <Dialog.Description>
                  Se conservará el contacto {pendingMerge?.keepId ?? "--"} y se fusionará el registro {pendingMerge?.removeId ?? "--"}.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="radix-dialog-close" aria-label="Cerrar">
                  ×
                </button>
              </Dialog.Close>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              Esta acción está pensada para consolidar duplicados detectados automáticamente. Revisa bien el contacto que vas a mantener.
            </p>

            <div className="radix-dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="quick-pill quick-pill-ghost">
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={!pendingMerge || busy === `${pendingMerge.keepId}-${pendingMerge.removeId}`}
                onClick={() => pendingMerge && void mergeContacts(pendingMerge.keepId, pendingMerge.removeId)}
              >
                {pendingMerge && busy === `${pendingMerge.keepId}-${pendingMerge.removeId}` ? "Fusionando..." : "Confirmar merge"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
