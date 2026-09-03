/**
 * SyncMonitor.jsx
 *
 * Panel monitor sync_queue — menampilkan status antrian sinkronisasi lokal.
 * SRS v2.0 §12 & DESIGN_v2.md §6 (SyncStatusBar detail popover)
 *
 * Fitur:
 *   - Daftar entri pending / failed dari Dexie sync_queue
 *   - Tombol manual "Sync Sekarang"
 *   - Tombol retry untuk item failed
 *   - Statistik ringkas (pending, syncing, failed, done)
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { triggerSync, retryFailedItems } from '../../lib/syncWorker'
import { useToast } from '../../contexts/ToastContext'
import { useDialog } from '../../contexts/DialogContext'

const STATUS_STYLES = {
  pending:  { bg: '#fef7e0', color: '#b06000', label: 'Menunggu' },
  syncing:  { bg: '#e8f0fe', color: '#1a73e8', label: 'Mengirim' },
  failed:   { bg: '#fce8e6', color: '#d93025', label: 'Gagal' },
  done:     { bg: '#e6f4ea', color: '#188038', label: 'Selesai' },
}

export default function SyncMonitor() {
  const { addToast } = useToast()
  const { confirm } = useDialog()
  const [syncing, setSyncing] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Live query: tampilkan entri terbaru (maks 50)
  const queueEntries = useLiveQuery(
    () => db.sync_queue.orderBy('id').reverse().limit(50).toArray(),
    [], []
  )

  // Statistik
  const stats = useLiveQuery(async () => {
    const all = await db.sync_queue.toArray()
    return {
      pending: all.filter(e => e.status === 'pending').length,
      syncing: all.filter(e => e.status === 'syncing').length,
      failed:  all.filter(e => e.status === 'failed').length,
      total:   all.length,
    }
  }, [], { pending: 0, syncing: 0, failed: 0, total: 0 })

  async function handleSyncNow() {
    setSyncing(true)
    try {
      triggerSync()
      addToast('Sync dipicu. Perubahan sedang dikirim ke server...', 'success')
      await new Promise(r => setTimeout(r, 1500))
    } finally {
      setSyncing(false)
    }
  }

  async function handleRetryFailed() {
    setRetrying(true)
    try {
      await retryFailedItems()
      addToast('Item gagal dijadwalkan ulang untuk sync.', 'success')
    } catch (err) {
      addToast('Gagal retry: ' + err.message, 'error')
    } finally {
      setRetrying(false)
    }
  }

  async function handleRemove(id) {
    const isConfirmed = await confirm({
      title: 'Hapus Antrian Sync?',
      message: 'Hapus entri ini dari antrian? Data tidak akan dikirim ke server.',
      danger: true,
      confirmText: 'Hapus'
    })
    if (!isConfirmed) return
    await db.sync_queue.delete(id)
  }

  // Last sync info from stats
  const lastSyncInfo = useLiveQuery(async () => {
    const done = await db.sync_queue.where('status').equals('done').last()
    return done?.updated_at || null
  }, [], null)

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Menunggu', count: stats?.pending || 0, bg: '#fef7e0', color: '#b06000' },
          { label: 'Gagal Sync', count: stats?.failed || 0, bg: '#fce8e6', color: '#d93025' },
          { label: 'Total Antrian', count: stats?.total || 0, bg: '#f8f9fa', color: '#5f6368' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 16px', borderRadius: '8px', background: s.bg, textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '11px', color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Last sync info */}
      {lastSyncInfo && (
        <p style={{ fontSize: '12px', color: '#5f6368', marginBottom: '12px' }}>
          Sync terakhir: <strong>{new Date(lastSyncInfo).toLocaleString('id-ID')}</strong>
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button className="btn-primary"
          style={{ padding: '7px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={handleSyncNow} disabled={syncing}>
          {syncing ? (
            <>
              <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Mengirim...
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Sync Sekarang
            </>
          )}
        </button>

        {(stats?.failed || 0) > 0 && (
          <button className="btn-secondary"
            style={{ padding: '7px 18px', fontSize: '13px', color: '#d93025', borderColor: '#d93025' }}
            onClick={handleRetryFailed} disabled={retrying}>
            {retrying ? 'Mencoba Ulang...' : `↩ Retry ${stats.failed} Item Gagal`}
          </button>
        )}
      </div>

      {/* Queue entries table */}
      {!queueEntries?.length ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#80868b' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
          <p style={{ margin: 0, fontSize: '13px' }}>Antrian kosong — semua data tersinkronisasi.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', maxHeight: '320px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Operasi</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Entity</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Waktu</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Retry</th>
                <th style={{ padding: '7px 10px', textAlign: 'center', color: '#5f6368', fontWeight: 600, width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {queueEntries.map(entry => {
                const st = STATUS_STYLES[entry.status] || STATUS_STYLES.pending
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: st.bg, color: st.color, fontWeight: 500 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#1f2328' }}>{entry.operation}</td>
                    <td style={{ padding: '7px 10px', color: '#5f6368' }}>
                      {entry.entity_type} #{entry.entity_id}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#80868b', whiteSpace: 'nowrap' }}>
                      {entry.created_at ? new Date(entry.created_at).toLocaleTimeString('id-ID') : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#80868b' }}>
                      {entry.retry_count || 0}×
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <button onClick={() => handleDeleteEntry(entry.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#80868b', fontSize: '14px' }}
                        title="Buang dari antrian">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
