"use client";

import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { ReactNode } from "react";

type DataTableProps<TData> = {
  table: TanstackTable<TData>;
  emptyLabel: string;
  emptyHint?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
};

export function DataTable<TData>({ table, emptyLabel, emptyHint, emptyAction, className }: DataTableProps<TData>) {
  const columnsCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <div className={`table-shell ${className ?? "contacts-table-wrap"}`.trim()}>
      <table className="contacts-crm-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
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
