import { getErrorMessage } from '../services/api.js';

export function Loading({ label = 'Loading data…' }) { return <div className="inline-state"><span className="spinner small"/><span>{label}</span></div>; }
export function ErrorState({ error, onRetry }) { return <div className="alert error" role="alert"><div><strong>Could not load this data.</strong><p>{getErrorMessage(error)}</p></div>{onRetry && <button className="button" onClick={onRetry}>Retry</button>}</div>; }
export function EmptyState({ children = 'No records found.' }) { return <div className="empty-state"><span className="empty-icon">◇</span><strong>{children}</strong></div>; }
export function Notice({ children }) { return <div className="notice">{children}</div>; }

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type || 'success'}`} role="status"><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={onClose}>×</button></div>;
}

export function ConfirmDialog({ open, title, children, onCancel, onConfirm, busy = false }) {
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">{title}</h2><div className="dialog-content">{children}</div><div className="dialog-actions"><button className="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : 'Confirm'}</button></div></section></div>;
}
