/**
 * AdminShell.jsx
 *
 * Wrapper layout untuk semua halaman admin.
 * - Desktop (≥768px): sidebar kiri + konten di kanan
 * - Mobile (<768px): bottom nav bar + konten full-width
 *
 * Juga meng-expose context activeSettingsTab via prop callback
 * sehingga AdminSettings.jsx bisa sinkron dengan sidebar dropdown.
 */

import { useState, createContext, useContext } from 'react'
import AdminSidebar from './AdminSidebar'
import AdminBottomBar from './AdminBottomBar'
import SyncStatusBar from '../common/SyncStatusBar'

/* ---- Context untuk sync activeTab antara shell dan AdminSettings ---- */
const AdminShellContext = createContext({ activeTab: 'schema', setActiveTab: () => {} })
export function useAdminShell() { return useContext(AdminShellContext) }

export default function AdminShell({ children }) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('schema')

  return (
    <AdminShellContext.Provider value={{ activeTab: activeSettingsTab, setActiveTab: setActiveSettingsTab }}>
      <div style={{
        display: 'flex',
        height: '100dvh',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: '#f8f9fa',
      }}>
        {/* Sidebar — hanya tampil di desktop via CSS */}
        <div className="admin-sidebar-wrapper">
          <AdminSidebar
            activeSettingsTab={activeSettingsTab}
            onSettingsTabChange={setActiveSettingsTab}
          />
        </div>

        {/* Main area: SyncStatusBar + page content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <SyncStatusBar />
          <main style={{ flex: 1, overflow: 'auto' }}>
            {children}
          </main>
        </div>

        {/* Bottom bar — hanya tampil di mobile via CSS di dalam component */}
        <AdminBottomBar
          activeSettingsTab={activeSettingsTab}
          onSettingsTabChange={setActiveSettingsTab}
        />
      </div>

      <style>{`
        @media (max-width: 767px) {
          .admin-sidebar-wrapper { display: none !important; }
        }
        @media (min-width: 768px) {
          .admin-sidebar-wrapper { display: flex !important; height: 100%; }
        }
      `}</style>
    </AdminShellContext.Provider>
  )
}
