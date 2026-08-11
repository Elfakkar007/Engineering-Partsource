import { createPortal } from 'react-dom'

export default function ConfirmDeleteModal({ 
  title = "Konfirmasi Hapus", 
  itemLabel, 
  warningText = "Data yang dihapus akan dipindahkan ke Recycle Bin dan bisa di-restore oleh Admin.",
  confirmText = "Hapus",
  onConfirm, 
  onCancel 
}) {
  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d93025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {title}
        </h3>
        <div className="modal-body">
          <p>Anda akan menghapus <strong>{itemLabel}</strong>.</p>
          {warningText && (
            <p style={{ fontSize: '12px', color: '#5f6368', marginTop: '8px' }}>
              {warningText}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Batal</button>
          <button className="btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
