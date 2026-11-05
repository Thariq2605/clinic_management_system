import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmText = 'Confirm', busy, onConfirm, onClose }) {
  return <Modal title={title} onClose={onClose}><div className="modal-body"><p>{message}</p><div className="form-actions"><button className="button button-secondary" onClick={onClose} disabled={busy}>Keep</button><button className="button button-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmText}</button></div></div></Modal>;
}
