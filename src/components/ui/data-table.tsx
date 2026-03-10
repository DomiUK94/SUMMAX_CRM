"use client";

import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { ReactNode } from "react";

type DataTableProps<TData> = {
  table: TanstackTable<TData>;
  emptyLabel: string;
  emptyHint?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
  headerFilters?: Record<string, ReactNode>;
};

export function DataTable<TData>({ table, emptyLabel, emptyHint, emptyAction, className, headerFilters }: DataTableProps<TData>) {
  const columnsCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const leafHeaders = headerGroups[headerGroups.length - 1]?.headers ?? [];

  return (
    <div className={`table-shell ${className ?? "contacts-table-wrap"}`.trim()}>
      <table className="contacts-crm-table">
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
          {headerFilters ? (
            <tr className="table-filter-row">
              {leafHeaders.map((header) => (
                <th key={`${header.id}-filter`}>
                  {header.isPlaceholder ? null : (headerFilters[header.column.id] ?? null)}
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(columnsCount, 1)}>
                <div className="table-empty-state">
                  <div className="table-empty-icon" aria-hidden="true">
                    +
                  </div>
                  <strong>{emptyLabel}</strong>
                  {emptyHint ? <p>{emptyHint}</p> : null}
                  {emptyAction ? <div className="table-empty-actions">{emptyAction}</div> : null}
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
