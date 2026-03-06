"use client";

import { useEffect, useMemo, useState } from "react";
import { getCoreRowModel, type ColumnDef, useReactTable } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";

type ImportJob = {
  id: string;
  source_type: string;
  filename: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  inserted_count: number;
  merged_count: number;
  warning_count: number;
  error_count: number;
  summary_json?: { rowsProcessed?: number } | null;
  created_at: string;
};

export function ImportJobsTable({ initialJobs }: { initialJobs: ImportJob[] }) {
  const [jobs, setJobs] = useState<ImportJob[]>(initialJobs);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());
  const hasProcessing = useMemo(() => jobs.some((j) => j.status === "processing" || j.status === "queued"), [jobs]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/imports/status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { jobs?: ImportJob[] };
        if (!cancelled && Array.isArray(json.jobs)) {
          setJobs(json.jobs);
          setUpdatedAt(new Date().toISOString());
        }
      } catch {
        // Silent on transient network failures.
      }
    }

    const intervalMs = hasProcessing ? 3000 : 12000;
    const timer = setInterval(refresh, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasProcessing]);

  const columns = useMemo<ColumnDef<ImportJob>[]>(() => [
    { id: "created_at", header: "Fecha", cell: ({ row }) => new Date(row.original.created_at).toLocaleString("es-ES") },
    { id: "source_type", header: "Tipo", cell: ({ row }) => row.original.source_type },
    { id: "filename", header: "Archivo", cell: ({ row }) => row.original.filename },
    { id: "status", header: "Estado", cell: ({ row }) => <span className={`import-status status-${row.original.status}`}>{row.original.status}</span> },
    { id: "rows", header: "Filas", cell: ({ row }) => row.original.summary_json?.rowsProcessed ?? 0 },
    { id: "inserted_count", header: "Nuevos", cell: ({ row }) => row.original.inserted_count },
    { id: "merged_count", header: "Fusionados", cell: ({ row }) => row.original.merged_count },
    { id: "warning_count", header: "Avisos", cell: ({ row }) => row.original.warning_count },
    { id: "error_count", header: "Errores", cell: ({ row }) => row.original.error_count }
  ], []);

  const table = useReactTable({ data: jobs, columns, getRowId: (row) => row.id, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="stack">
      <div className="row">
        <h3>Historial</h3>
        <div className="muted">
          Actualizado: {new Date(updatedAt).toLocaleTimeString("es-ES")}
          {hasProcessing ? <span className="import-live"> Actualizando en vivo...</span> : null}
        </div>
      </div>
      <DataTable
        table={table}
        emptyLabel="Sin importaciones todav\u00eda."
        emptyHint="Cuando subas un archivo ver\u00e1s aqu\u00ed el estado, los avisos y el resultado final."
      />
    </div>
  );
}
