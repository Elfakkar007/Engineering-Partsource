import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

const DialogContext = createContext(null)

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}

export function DialogProvider({ children }) {
  const [dialogs, setDialogs] = useState([])

  const confirm = useCallback(({ title, message, confirmText = 'Konfirmasi', cancelText = 'Batal', danger = false }) => {
    return new Promise((resolve) => {
      const id = Date.now().toString() + Math.random().toString()
      setDialogs((prev) => [
        ...prev,
        {
          id,
          type: 'confirm',
          title,
          message,
          confirmText,
          cancelText,
          danger,
          onConfirm: () => {
            resolve(true)
            setDialogs((p) => p.filter((d) => d.id !== id))
          },
          onCancel: () => {
            resolve(false)
            setDialogs((p) => p.filter((d) => d.id !== id))
          },
        },
      ])
    })
  }, [])

  const alert = useCallback(({ title = 'Perhatian', message, confirmText = 'OK', danger = false }) => {
    return new Promise((resolve) => {
      const id = Date.now().toString() + Math.random().toString()
      setDialogs((prev) => [
        ...prev,
        {
          id,
          type: 'alert',
          title,
          message,
          confirmText,
          danger,
          onConfirm: () => {
            resolve()
            setDialogs((p) => p.filter((d) => d.id !== id))
          },
        },
      ])
    })
  }, [])

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {/* Render Dialogs */}
      {dialogs.map((dialog) =>
        createPortal(
          <div key={dialog.id} className="modal-backdrop" onClick={dialog.type === 'confirm' ? dialog.onCancel : dialog.onConfirm} style={{ zIndex: 99999, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
              animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)', 
              width: '100%',
              maxWidth: '420px',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {dialog.title}
              </h3>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {dialog.message}
                </p>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {dialog.type === 'confirm' && (
                  <button onClick={dialog.onCancel} style={{ 
                    background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '8px 16px', fontSize: '14px', fontWeight: 500, color: '#374151', cursor: 'pointer', borderRadius: '6px'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#e5e7eb'}
                  onMouseOut={(e) => e.target.style.background = '#f3f4f6'}
                  >
                    {dialog.cancelText}
                  </button>
                )}
                <button
                  onClick={dialog.onConfirm}
                  autoFocus
                  style={{
                    background: dialog.danger ? '#dc2626' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseOver={(e) => e.target.style.background = dialog.danger ? '#b91c1c' : '#1d4ed8'}
                  onMouseOut={(e) => e.target.style.background = dialog.danger ? '#dc2626' : '#2563eb'}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </DialogContext.Provider>
  )
}
