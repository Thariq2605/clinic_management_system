export default function StatusBadge({ value }) {
  const label = value || 'Unknown';
  const key = String(label).toLowerCase().replaceAll(' ', '-');
  return <span className={`badge-status badge badge-${key}`}>{label}</span>;
}
