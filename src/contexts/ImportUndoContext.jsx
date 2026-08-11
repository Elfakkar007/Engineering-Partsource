import { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { undoImportBatch } from '../lib/importUndo'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import { useToast } from './ToastContext'
import { logActivity } from '../lib/activityLog'
import { useAuth } from './AuthContext'

const ImportUndoContext = createContext()

export function useImportUndo() {
  return useContext(ImportUndoContext)
}

export function ImportUndoProvider({ children }) {
  const [pendingUndo, setPendingUndo] = useState(null)
  const [isUndoing, setIsUndoing] = useState(false)
  const [undoProgress, setUndoProgress] = useState('')
  const { addToast } = useToast()
  const { currentUser } = useAuth()

  const requestUndo = (importBatchId, rows, locs) => {
    setPendingUndo({ importBatchId, rows, locs })
  }

  const handleConfirmUndo = async () => {
    const batchId = pendingUndo.importBatchId
    setIsUndoing(true)
    setPendingUndo(null)
    setUndoProgress('Memulai pembatalan import...')
    try {
      const { rowsDeleted, locsDeleted } = await undoImportBatch(batchId, (msg) => {
        setUndoProgress(msg)
      })
      addToast(`Import dibatalkan. ${rowsDeleted} baris dan ${locsDeleted} lokasi dihapus.`, 'success')
      logActivity('undo_import', currentUser?.uid, {
        importBatchId: batchId,
        totalRowsDeleted: rowsDeleted,
        totalLocationsDeleted: locsDeleted
      })
    } catch (err) {
      console.error(err)
      addToast('Gagal membatalkan import. Sebagian data mungkin masih tersisa.', 'error')
    } finally {
      setIsUndoing(false)
      setUndoProgress('')
    }
  }

  return (
    <ImportUndoContext.Provider value={{ requestUndo }}>
      {children}
      {pendingUndo && (
        <ConfirmDeleteModal
          title="Konfirmasi Batalkan Import"
          itemLabel={`Import Batch`}
          warningText={`Anda akan membatalkan import ini — ${pendingUndo.rows} baris data dan ${pendingUndo.locs} lokasi yang baru saja dibuat akan dihapus permanen. Lanjutkan?`}
          confirmText="Ya, Batalkan Import"
          onConfirm={handleConfirmUndo}
          onCancel={() => setPendingUndo(null)}
        />
      )}
      {isUndoing && undoProgress && createPortal(
        <div className="modal-backdrop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #0969da', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <h3 style={{ margin: '0 0 8px', color: '#1f2328' }}>Proses Undo Sedang Berjalan</h3>
            <p style={{ margin: 0, color: '#5f6368', fontSize: '14px' }}>{undoProgress}</p>
          </div>
        </div>,
        document.body
      )}
    </ImportUndoContext.Provider>
  )
}
