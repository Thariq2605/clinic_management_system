import { EmptyState } from './Feedback.jsx';

export function DataTable({ columns, rows, rowKey, actions, onRowClick }) {
  if (!rows?.length) return <EmptyState />;
  return <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{actions && <th>Actions</th>}</tr></thead><tbody>{rows.map((row) => <tr key={rowKey ? rowKey(row) : row.id} onClick={() => onRowClick?.(row)}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}</td>)}{actions && <td className="row-actions">{actions(row)}</td>}</tr>)}</tbody></table></div>;
}
