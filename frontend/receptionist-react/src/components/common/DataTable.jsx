export default function DataTable({ columns, rows, empty = 'No records found.', rowKey = 'id' }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row[rowKey] ?? index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>) : <tr><td className="table-empty" colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div>;
}
