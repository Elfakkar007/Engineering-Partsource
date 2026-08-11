/**
 * UpdatePrompt.jsx (pindah ke common/)
 *
 * Notifikasi non-blocking saat Service Worker mendeteksi versi baru aplikasi.
 * Tetap tampil sampai user klik "Perbarui" atau "Nanti" (tidak auto-dismiss).
 *
 * DESIGN_v2.md §7 — UpdatePrompt
 */

import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      id="update-prompt"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#1f2328',       // color.ink — DESIGN_v2 §7
        color: '#ffffff',
        padding: '10px 16px',
        borderRadius: '8px',
        boxShadow: 'rgba(0,0,0,0.12) 0 4px 16px',  // shadow.popover
        fontSize: '13px',
        fontFamily: 'Inter, system-ui, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Refresh icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="#188038" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>

      <span>Versi baru tersedia</span>

      {/* Refresh button */}
      <button
        id="update-prompt-refresh"
        onClick={() => updateServiceWorker(true)}
        style={{
          background: 'transparent',
          color: '#8ab4f8',       // secondary-on-dark — DESIGN_v2 §7
          border: 'none',
          padding: '0',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
        }}
      >
        Refresh
      </button>

      {/* Dismiss button */}
      <button
        id="update-prompt-dismiss"
        onClick={() => setNeedRefresh(false)}
        aria-label="Tutup"
        style={{
          background: 'transparent',
          color: '#9aa0a6',
          border: 'none',
          padding: '0 0 0 4px',
          fontSize: '16px',
          lineHeight: 1,
          cursor: 'pointer',
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = '#ffffff' }}
        onMouseOut={(e) => { e.currentTarget.style.color = '#9aa0a6' }}
      >
        ×
      </button>
    </div>
  )
}
