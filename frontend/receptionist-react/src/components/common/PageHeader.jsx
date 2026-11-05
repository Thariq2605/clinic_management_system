export default function PageHeader({ eyebrow = 'Reception desk', title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div>{action}</div>}</div>;
}
