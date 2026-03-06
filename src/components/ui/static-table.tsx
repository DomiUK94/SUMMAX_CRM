import type { ReactNode } from "react";

type StaticTableProps = {
  columns: ReactNode[];
  headerFilters?: ReactNode[];
  rows: ReactNode[][];
  emptyLabel: ReactNode;
  emptyHint?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
};

export function StaticTable({ columns, headerFilters, rows, emptyLabel, emptyHint, emptyAction, className }: StaticTableProps) {
  return (
    <div className={`table-shell ${className ?? "contacts-table-wrap"}`.trim()}>
      <table className="contacts-crm-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
          {headerFilters?.length ? (
            <tr className="table-filter-row">
              {columns.map((_, index) => (
                <th key={index}>{headerFilters[index] ?? null}</th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(columns.length, 1)}>
                <div className="table-empty-state">
                  <div className="table-empty-icon" aria-hidden="true">
                    //
                  </div>
                  <strong>{emptyLabel}</strong>
                  {emptyHint ? <p>{emptyHint}</p> : null}
                  {emptyAction ? <div className="table-empty-actions">{emptyAction}</div> : null}
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
