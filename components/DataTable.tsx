import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, rowKey, loading, emptyMessage = 'Nothing here yet.' }: DataTableProps<T>) {
  if (loading && !rows) return <div className="loading">Loading…</div>;
  if (!rows || rows.length === 0) return <div className="empty">{emptyMessage}</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.numeric ? 'num' : undefined} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.numeric ? 'num' : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
