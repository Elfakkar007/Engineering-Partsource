/**
 * SyncStatusBar.jsx
 *
 * Komponen indikator status sinkronisasi yang selalu terlihat di header global.
 * Terhubung ke syncWorker.js untuk menampilkan status real-time:
 *   - Online/tersimpan (hijau)
 *   - Offline (kuning)
 *   - Syncing (biru + spinner)
 *   - Gagal (merah + tombol "Coba Lagi")
 *
 * DESIGN_v2.md §6 — SyncStatusBar
 */

import { useState, useEffect } from 'react'
import { onSyncStatusChange, getSyncStatus, retryFailedItems } from '../../lib/syncWorker'

/* ------------------------------------------------------------------ */
/*  Spinner CSS animation (injected once)                               */
/* ------------------------------------------------------------------ */
const SPINNER_STYLE = `
@keyframes ssb-spin {
  to { transform: rotate(360deg); }
}
.ssb-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(26, 115, 232, 0.3);
  border-top-color: #1a73e8;
  border-radius: 50%;
  animation: ssb-spin 0.8s linear infinite;
  flex-shrink: 0;
}
`

/* ------------------------------------------------------------------ */
/*  Icons                                                               */
/* ------------------------------------------------------------------ */
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function IconWarn() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  State derivation                                                    */
/* ------------------------------------------------------------------ */
function deriveBarState(isOnline, syncStatus) {
  if (!isOnline) return 'offline'
  if (syncStatus.failedCount > 0) return 'failed'
  if (syncStatus.isSyncing || syncStatus.syncingCount > 0) return 'syncing'
  if (syncStatus.pendingCount > 0) return 'syncing'
  return 'online'
}

const BAR_CONFIG = {
  online: {
    bg: '#e6f4ea',
    color: '#188038',
    label: 'Tersimpan • Terhubung ke Server Pabrik',
  },
  offline: {
    bg: '#fef7e0',
    color: '#b06000',
    label: 'Mode Offline • Tersimpan di perangkat, akan sinkron otomatis',
  },
  syncing: {
    bg: '#e8f0fe',
    color: '#1a73e8',
    label: null, // diisi dinamis
  },
  failed: {
    bg: '#fce8e6',
    color: '#d93025',
    label: null, // diisi dinamis
  },
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function SyncStatusBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState({
    pendingCount: 0,
    syncingCount: 0,
    isSyncing: false,
    failedCount: 0,
    lastSyncAt: null,
  })

  useEffect(() => {
    // Inject spinner CSS once
    if (!document.getElementById('ssb-style')) {
      const style = document.createElement('style')
      style.id = 'ssb-style'
      style.textContent = SPINNER_STYLE
      document.head.appendChild(style)
    }

    // Online/offline browser events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Subscribe ke sync worker status updates
    onSyncStatusChange((status) => setSyncStatus(s => ({ ...s, ...status })))

    // Load initial status
    getSyncStatus().then(status => setSyncStatus(s => ({ ...s, ...status })))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const barState = deriveBarState(isOnline, syncStatus)
  const cfg = BAR_CONFIG[barState]

  let label = cfg.label
  if (barState === 'syncing') {
    const n = syncStatus.pendingCount + syncStatus.syncingCount
    label = `Menyinkronkan ${n > 0 ? n : ''} perubahan ke server...`.trim()
  }
  if (barState === 'failed') {
    label = `${syncStatus.failedCount} perubahan gagal sinkron — klik untuk coba lagi`
  }

  const handleClick = () => {
    if (barState === 'failed') retryFailedItems()
  }

  return (
    <div
      id="sync-status-bar"
      onClick={handleClick}
      style={{
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
        cursor: barState === 'failed' ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'background 0.3s, color 0.3s',
        flexShrink: 0,
      }}
    >
      {/* Icon / spinner */}
      {barState === 'syncing' ? (
        <div className="ssb-spinner" />
      ) : barState === 'online' ? (
        <IconCheck />
      ) : barState === 'failed' ? (
        <IconAlert />
      ) : (
        <IconWarn />
      )}

      <span>{label}</span>

      {/* "Coba Lagi" button for failed state */}
      {barState === 'failed' && (
        <button
          onClick={(e) => { e.stopPropagation(); retryFailedItems() }}
          style={{
            marginLeft: '6px',
            padding: '2px 8px',
            background: '#d93025',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Coba Lagi
        </button>
      )}
    </div>
  )
}
