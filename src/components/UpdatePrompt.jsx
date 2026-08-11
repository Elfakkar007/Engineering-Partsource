import { useRegisterSW } from 'virtual:pwa-register/react'

function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--color-ink, #1f2328)',
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: 'rgba(0, 0, 0, 0.2) 0 4px 16px',
        fontSize: '13px',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#188038" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
        <span>Versi baru aplikasi telah tersedia!</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            background: 'var(--color-primary, #188038)',
            color: '#ffffff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#0F9D58'}
          onMouseOut={(e) => e.currentTarget.style.background = '#188038'}
        >
          Perbarui
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{
            background: 'transparent',
            color: '#9aa0a6',
            border: 'none',
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
          onMouseOut={(e) => e.currentTarget.style.color = '#9aa0a6'}
        >
          Nanti
        </button>
      </div>
    </div>
  )
}

export default UpdatePrompt