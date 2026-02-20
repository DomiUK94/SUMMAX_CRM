"use client";

import { useEffect, useMemo, useState } from "react";

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

  return (
    <div className="stack">
      <div className="row">
        <h3>Historial</h3>
        <div className="muted">
          Actualizado: {new Date(updatedAt).toLocaleTimeString("es-ES")}
          {hasProcessing ? <span className="import-live"> Actualizando...</span> : null}
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th>Estado</th><th>Filas</th><th>Inserted</th><th>Merged</th><th>Warnings</th><th>Errors</th></tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{new Date(j.created_at).toLocaleString("es-ES")}</td>
              <td>{j.source_type}</td>
              <td>{j.filename}</td>
              <td><span className={`import-status status-${j.status}`}>{j.status}</span></td>
              <td>{j.summary_json?.rowsProcessed ?? 0}</td>
              <td>{j.inserted_count}</td>
              <td>{j.merged_count}</td>
              <td>{j.warning_count}</td>
              <td>{j.error_count}</td>
            </tr>
          ))}
          {jobs.length === 0 ? <tr><td colSpan={9}>Sin importaciones todavia.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
