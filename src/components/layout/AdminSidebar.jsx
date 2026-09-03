/**
 * AdminSidebar.jsx
 *
 * Sidebar navigasi kiri untuk halaman-halaman admin.
 * - Desktop: collapsible (icon-only ↔ full label)
 * - State collapse disimpan ke localStorage
 * - Dropdown untuk sub-menu Pengaturan Kolom
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

/* ---- Ikon ---- */
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  import: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  export: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  activityLog: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  recycleBin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  schema: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
    </svg>
  ),
  hierarchy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  code: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  sync: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  layers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  chevronDown: (size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  chevronRight: (size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  wrench: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
}

const SETTINGS_TABS = [
  { id: 'schema', label: 'Skema Kolom', icon: Icons.schema },
  { id: 'hierarchy', label: 'Hierarki', icon: Icons.hierarchy },
  { id: 'itemcode', label: 'Aturan Kode', icon: Icons.code },
  { id: 'unmatched', label: 'Belum Ketemu Kode', icon: Icons.alert },
  { id: 'sync', label: 'Sync Monitor', icon: Icons.sync },
  { id: 'exception_rules', label: 'Exception Rules', icon: Icons.layers },
]

export default function AdminSidebar({ activeSettingsTab, onSettingsTabChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, logout } = useAuth()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('admin_sidebar_collapsed') === 'true' } catch { return false }
  })
  const [settingsOpen, setSettingsOpen] = useState(() => {
    return location.pathname.startsWith('/admin/settings')
  })

  useEffect(() => {
    // Auto-open settings dropdown saat berada di halaman settings
    if (location.pathname.startsWith('/admin/settings')) {
      setSettingsOpen(true)
    }
  }, [location.pathname])

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('admin_sidebar_collapsed', String(next)) } catch {}
      return next
    })
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  function isActive(path) {
    return location.pathname === path
  }

  const W = collapsed ? 56 : 220

  const navItemStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : '10px',
    padding: collapsed ? '10px 0' : '9px 14px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: '8px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    background: active ? '#e6f4ea' : 'transparent',
    color: active ? '#188038' : '#3d4043',
    transition: 'all 0.15s',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    flexShrink: 0,
    fontFamily: 'Inter, system-ui, sans-serif',
  })

  const subItemStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px 7px 36px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    background: active ? '#e6f4ea' : 'transparent',
    color: active ? '#188038' : '#5f6368',
    transition: 'all 0.12s',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    fontFamily: 'Inter, system-ui, sans-serif',
  })

  const isSettingsActive = location.pathname.startsWith('/admin/settings')

  return (
    <aside
      id="admin-sidebar"
      style={{
        width: `${W}px`,
        minWidth: `${W}px`,
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid #e8eaed',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        zIndex: 30,
        flexShrink: 0,
      }}
    >
      {/* ---- Logo / Header ---- */}
      <div style={{
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 12px',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid #e8eaed',
        flexShrink: 0,
        gap: '8px',
      }}>
        {!collapsed && (
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', overflow: 'hidden' }}
          >
            <div style={{ color: '#188038', flexShrink: 0 }}>{Icons.wrench}</div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2328', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
              Plant Sourcing
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            color: '#5f6368',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {Icons.menu}
        </button>
      </div>

      {/* ---- Nav Items ---- */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>

        {/* Dashboard */}
        <button
          style={navItemStyle(isActive('/'))}
          onClick={() => navigate('/')}
          title={collapsed ? 'Dashboard' : ''}
          onMouseEnter={e => { if (!isActive('/')) e.currentTarget.style.background = '#f1f3f4' }}
          onMouseLeave={e => { if (!isActive('/')) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ flexShrink: 0, opacity: isActive('/') ? 1 : 0.65 }}>{Icons.dashboard}</span>
          {!collapsed && 'Dashboard'}
        </button>

        <div style={{ height: '1px', background: '#f1f3f4', margin: '4px 0' }} />

        {/* Import */}
        <button
          style={navItemStyle(isActive('/admin/import'))}
          onClick={() => navigate('/admin/import')}
          title={collapsed ? 'Import' : ''}
          onMouseEnter={e => { if (!isActive('/admin/import')) e.currentTarget.style.background = '#f1f3f4' }}
          onMouseLeave={e => { if (!isActive('/admin/import')) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ flexShrink: 0, opacity: isActive('/admin/import') ? 1 : 0.65 }}>{Icons.import}</span>
          {!collapsed && 'Import'}
        </button>

        {/* Export */}
        <button
          style={navItemStyle(isActive('/admin/export'))}
          onClick={() => navigate('/admin/export')}
          title={collapsed ? 'Export' : ''}
          onMouseEnter={e => { if (!isActive('/admin/export')) e.currentTarget.style.background = '#f1f3f4' }}
          onMouseLeave={e => { if (!isActive('/admin/export')) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ flexShrink: 0, opacity: isActive('/admin/export') ? 1 : 0.65 }}>{Icons.export}</span>
          {!collapsed && 'Export'}
        </button>

        {/* Activity Log */}
        <button
          style={navItemStyle(isActive('/admin/activity-log'))}
          onClick={() => navigate('/admin/activity-log')}
          title={collapsed ? 'Activity Log' : ''}
          onMouseEnter={e => { if (!isActive('/admin/activity-log')) e.currentTarget.style.background = '#f1f3f4' }}
          onMouseLeave={e => { if (!isActive('/admin/activity-log')) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ flexShrink: 0, opacity: isActive('/admin/activity-log') ? 1 : 0.65 }}>{Icons.activityLog}</span>
          {!collapsed && 'Activity Log'}
        </button>

        {/* Recycle Bin */}
        <button
          style={navItemStyle(isActive('/admin/recycle-bin'))}
          onClick={() => navigate('/admin/recycle-bin')}
          title={collapsed ? 'Recycle Bin' : ''}
          onMouseEnter={e => { if (!isActive('/admin/recycle-bin')) e.currentTarget.style.background = '#f1f3f4' }}
          onMouseLeave={e => { if (!isActive('/admin/recycle-bin')) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ flexShrink: 0, opacity: isActive('/admin/recycle-bin') ? 1 : 0.65 }}>{Icons.recycleBin}</span>
          {!collapsed && 'Recycle Bin'}
        </button>

        <div style={{ height: '1px', background: '#f1f3f4', margin: '4px 0' }} />

        {/* Pengaturan Kolom — dropdown trigger */}
        <button
          style={{
            ...navItemStyle(isSettingsActive && !settingsOpen ? true : false),
            background: isSettingsActive ? '#e6f4ea' : 'transparent',
            color: isSettingsActive ? '#188038' : '#3d4043',
          }}
          onClick={() => {
            if (collapsed) {
              setCollapsed(false)
              try { localStorage.setItem('admin_sidebar_collapsed', 'false') } catch {}
              setTimeout(() => { setSettingsOpen(true); navigate('/admin/settings') }, 50)
            } else {
              setSettingsOpen(prev => !prev)
              if (!location.pathname.startsWith('/admin/settings')) {
                navigate('/admin/settings')
              }
            }
          }}
          title={collapsed ? 'Pengaturan Kolom' : ''}
          onMouseEnter={e => { if (!isSettingsActive) e.currentTarget.style.background = '#f1f3f4' }}
          onMouseLeave={e => { if (!isSettingsActive) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ flexShrink: 0, opacity: isSettingsActive ? 1 : 0.65 }}>{Icons.settings}</span>
          {!collapsed && (
            <>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>Pengaturan Kolom</span>
              <span style={{
                flexShrink: 0,
                transition: 'transform 0.2s',
                transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                {Icons.chevronDown()}
              </span>
            </>
          )}
        </button>

        {/* Settings sub-items */}
        {!collapsed && settingsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {SETTINGS_TABS.map(tab => {
              const isTabActive = isSettingsActive && activeSettingsTab === tab.id
              return (
                <button
                  key={tab.id}
                  style={subItemStyle(isTabActive)}
                  onClick={() => {
                    if (!location.pathname.startsWith('/admin/settings')) navigate('/admin/settings')
                    onSettingsTabChange?.(tab.id)
                  }}
                  onMouseEnter={e => { if (!isTabActive) e.currentTarget.style.background = '#f1f3f4' }}
                  onMouseLeave={e => { if (!isTabActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ opacity: isTabActive ? 1 : 0.55 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}
      </nav>

      {/* ---- User Info + Logout ---- */}
      <div style={{
        borderTop: '1px solid #e8eaed',
        padding: collapsed ? '12px 0' : '12px',
        display: 'flex',
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#1f2328', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || currentUser?.email?.split('@')[0] || 'Admin'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#80868b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.email || ''}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          style={{
            background: 'none',
            border: '1px solid #dadce0',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            color: '#5f6368',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fce8e6'; e.currentTarget.style.color = '#d93025'; e.currentTarget.style.borderColor = '#d93025' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#5f6368'; e.currentTarget.style.borderColor = '#dadce0' }}
        >
          {Icons.logout}
        </button>
      </div>
    </aside>
  )
}
