/**
 * AdminBottomBar.jsx
 *
 * Bottom navigation bar untuk mobile (max-width: 768px).
 * - Auto-hide saat scroll down, muncul lagi saat scroll up
 * - Dropdown Pengaturan Kolom membuka ke atas
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const SETTINGS_TABS = [
  {
    id: 'schema', label: 'Skema Kolom',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  },
  {
    id: 'hierarchy', label: 'Hierarki',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    id: 'itemcode', label: 'Aturan Kode',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
  {
    id: 'unmatched', label: 'Belum Ketemu Kode',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  },
  {
    id: 'sync', label: 'Sync Monitor',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  },
  {
    id: 'exception_rules', label: 'Exception Rules',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  },
]

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        padding: '6px 4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        flex: 1,
        minWidth: 0,
        color: active ? '#188038' : '#5f6368',
        transition: 'color 0.15s',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span style={{ opacity: active ? 1 : 0.65 }}>{icon}</span>
      <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '52px' }}>
        {label}
      </span>
    </button>
  )
}

export default function AdminBottomBar({ activeSettingsTab, onSettingsTabChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  const [visible, setVisible] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const lastScrollY = useRef(0)
  const dropdownRef = useRef(null)

  // Auto-hide on scroll down, show on scroll up
  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY.current + 8) {
        setVisible(false)
        setSettingsOpen(false)
      } else if (currentScrollY < lastScrollY.current - 4) {
        setVisible(true)
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [settingsOpen])

  const isActive = (path) => location.pathname === path
  const isSettingsActive = location.pathname.startsWith('/admin/settings')

  return (
    <>
      {/* Overlay for settings dropdown */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.2)' }}
        />
      )}

      {/* Settings dropdown (opens upward) */}
      {settingsOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            bottom: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(280px, 90vw)',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e8eaed',
            zIndex: 50,
            overflow: 'hidden',
            animation: 'slideUpFade 0.18s ease-out',
          }}
        >
          <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid #f1f3f4' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#80868b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pengaturan Kolom
            </p>
          </div>
          {SETTINGS_TABS.map(tab => {
            const isTabActive = isSettingsActive && activeSettingsTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!location.pathname.startsWith('/admin/settings')) navigate('/admin/settings')
                  onSettingsTabChange?.(tab.id)
                  setSettingsOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '11px 16px',
                  background: isTabActive ? '#e6f4ea' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isTabActive ? 600 : 400,
                  color: isTabActive ? '#188038' : '#1f2328',
                  textAlign: 'left',
                  borderBottom: '1px solid #f8f9fa',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isTabActive) e.currentTarget.style.background = '#f8f9fa' }}
                onMouseLeave={e => { if (!isTabActive) e.currentTarget.style.background = 'none' }}
              >
                <span style={{ opacity: isTabActive ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
                {isTabActive && (
                  <span style={{ marginLeft: 'auto', color: '#188038' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Bottom Bar */}
      <nav
        id="admin-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: '#ffffff',
          borderTop: '1px solid #e8eaed',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 48,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <NavBtn
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
          label="Dashboard"
          active={isActive('/')}
          onClick={() => { setSettingsOpen(false); navigate('/') }}
        />
        <NavBtn
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          label="Import"
          active={isActive('/admin/import')}
          onClick={() => { setSettingsOpen(false); navigate('/admin/import') }}
        />
        <NavBtn
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          label="Export"
          active={isActive('/admin/export')}
          onClick={() => { setSettingsOpen(false); navigate('/admin/export') }}
        />
        <NavBtn
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          label="Log"
          active={isActive('/admin/activity-log')}
          onClick={() => { setSettingsOpen(false); navigate('/admin/activity-log') }}
        />
        <NavBtn
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
          label="Recycle"
          active={isActive('/admin/recycle-bin')}
          onClick={() => { setSettingsOpen(false); navigate('/admin/recycle-bin') }}
        />

        {/* Pengaturan — dropdown ke atas */}
        <button
          onClick={() => setSettingsOpen(prev => !prev)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '6px 4px',
            background: settingsOpen || isSettingsActive ? '#e6f4ea' : 'none',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            minWidth: 0,
            color: isSettingsActive || settingsOpen ? '#188038' : '#5f6368',
            transition: 'all 0.15s',
            fontFamily: 'Inter, system-ui, sans-serif',
            position: 'relative',
          }}
        >
          <span style={{ opacity: isSettingsActive || settingsOpen ? 1 : 0.65 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </span>
          <span style={{ fontSize: '10px', fontWeight: isSettingsActive || settingsOpen ? 600 : 400, display: 'flex', alignItems: 'center', gap: '1px' }}>
            Kolom
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </button>
      </nav>

      {/* Spacer agar konten tidak ketutup bottom bar di mobile */}
      <div className="admin-bottom-bar-spacer" style={{ height: '60px' }} />

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (min-width: 768px) {
          #admin-bottom-bar { display: none !important; }
          .admin-bottom-bar-spacer { display: none !important; }
        }
      `}</style>
    </>
  )
}
