/**
 * MainLayout.jsx
 *
 * Shell layout global yang dipakai oleh semua halaman authenticated.
 * Struktur dari atas ke bawah:
 *   1. Header (logo + nama user + tombol logout)
 *   2. SyncStatusBar (selalu terlihat — DESIGN_v2 §6)
 *   3. {children} — konten halaman
 *   4. UpdatePrompt (fixed bottom-center, conditional — DESIGN_v2 §7)
 *
 * DESIGN_v2.md §2 — Layout Global
 */

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import SyncStatusBar from '../common/SyncStatusBar'
import UpdatePrompt from '../common/UpdatePrompt'

/* ------------------------------------------------------------------ */
/*  Header                                                              */
/* ------------------------------------------------------------------ */
function AppHeader() {
  const { currentUser, userRole, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header
      id="app-header"
      style={{
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#188038',
        color: '#ffffff',
        flexShrink: 0,
        boxShadow: 'rgba(0,0,0,0.15) 0 1px 3px',
        zIndex: 100,
      }}
    >
      {/* Logo / App name */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#ffffff',
          textDecoration: 'none',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '-0.01em',
        }}
      >
        {/* Wrench icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
        Plant Sourcing
      </Link>

      {/* Right side: user info + admin links + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Admin links */}
        {userRole === 'admin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/admin/settings"
              id="nav-admin-settings"
              style={{
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Pengaturan
            </Link>
            <Link
              to="/admin/recycle-bin"
              id="nav-admin-recycle"
              style={{
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Recycle Bin
            </Link>
          </div>
        )}

        {/* User name */}
        {currentUser && (
          <span style={{
            fontSize: '12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: 'rgba(255,255,255,0.85)',
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentUser.email}
          </span>
        )}

        {/* Logout button */}
        <button
          id="btn-logout"
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#ffffff',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
        >
          Logout
        </button>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  MainLayout                                                          */
/* ------------------------------------------------------------------ */
/**
 * @param {React.ReactNode} children
 * @param {boolean} [showHeader=true]
 */
export default function MainLayout({ children, showHeader = true }) {
  return (
    <div
      id="main-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',       // full viewport height
        overflow: 'hidden',     // children yang scroll secara internal
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {showHeader && <AppHeader />}
      <SyncStatusBar />

      {/* Page content */}
      <main
        id="main-content"
        style={{
          flex: 1,
          overflow: 'hidden',   // halaman child yang mengelola scroll internalnya
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>

      {/* UpdatePrompt — fixed, tidak memengaruhi layout */}
      <UpdatePrompt />
    </div>
  )
}
