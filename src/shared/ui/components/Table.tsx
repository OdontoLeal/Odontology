// src/shared/ui/components/Table.tsx
import React from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  emptyMessage = 'No se encontraron registros.',
  className = '',
  onRowClick,
}: TableProps<T>): React.ReactElement {
  return (
    <div className={`w-full overflow-x-auto rounded-2xl border border-[#E2E6EA] bg-white shadow-xs ${className}`}>
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-[#F8F9FA] text-[11px] font-extrabold uppercase tracking-wider text-[#687380] border-b border-[#E2E6EA]">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} scope="col" className={`px-4 py-3.5 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E6EA] text-[#1E242B]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-[#8F99A3]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors hover:bg-[#FBF6E6]/30 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                    {col.cell
                      ? col.cell(row, rowIdx)
                      : col.accessorKey
                      ? String(row[col.accessorKey] ?? '')
                      : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
