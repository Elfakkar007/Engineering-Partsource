/**
 * AdminSettings.jsx — Refactor Total (Phase 6)
 *
 * Multi-tab Admin Panel berdasarkan SRS v2.0 & DESIGN_v2.md §5.
 *
 * Tab:
 *   1. Schema Manager  — kelola kolom per Department via SchemaBuilder
 *   2. Hierarki        — kelola Line / Department / Location
 *   3. Aturan Kode     — template item code + reference catalog
 *   4. Sync Monitor    — status antrian sync_queue + trigger manual
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SchemaBuilder from '../components/admin/SchemaBuilder'
import HierarchyManager from '../components/admin/HierarchyManager'
import ItemCodeRuleManager from '../components/admin/ItemCodeRuleManager'
import SyncMonitor from '../components/admin/SyncMonitor'
import CompletionRulesManager from '../components/admin/CompletionRulesManager'
import UnmatchedReport from '../components/admin/UnmatchedReport'

/* ------------------------------------------------------------------ */
/*  Tab config                                                           */
/* ------------------------------------------------------------------ */
const TABS = [
  {
    id: 'schema',
    label: 'Skema Kolom',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
      </svg>
    ),
    desc: 'Tambah, edit, dan susun kolom data per Department.',
  },
  {
    id: 'hierarchy',
    label: 'Hierarki',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    desc: 'Kelola Line, Department, dan Location.',
  },
  {
    id: 'itemcode',
    label: 'Aturan Kode',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    desc: 'Konfigurasi kolom Item Code dan kelola Reference Catalog per Department.',
  },
  {
    id: 'unmatched',
    label: 'Belum Ketemu Kode',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    desc: 'Laporan baris Mode Auto yang belum mendapatkan kode item dari katalog.',
  },
  {
    id: 'sync',
    label: 'Sync Monitor',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
    desc: 'Monitor dan trigger sinkronisasi data ke PocketBase.',
  },
  {
    id: 'exception_rules',
    label: 'Exception Rules',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    desc: 'Atur kondisi di mana kolom wajib boleh dikosongkan.',
  },
]

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function AdminSettings() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('schema')

  const userId = currentUser?.email || currentUser?.uid || ''
  const activeTabDef = TABS.find(t => t.id === activeTab)

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa' }}>
      {/* ---- Header ---- */}
      <header style={{
        background: '#188038', color: '#fff',
        padding: '0 20px', height: '52px',
        display: 'flex', alignItems: 'center', gap: '16px',
        position: 'sticky', top: 0, zIndex: 30,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px', fontSize: '13px' }}
        >
          ← Kembali
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07A10 10 0 0 1 4.93 4.93" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 15.54a5 5 0 0 1 0-7.07" />
          </svg>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Panel Admin</h1>
        </div>
        {userId && (
          <span style={{ fontSize: '12px', opacity: 0.85 }}>{userId}</span>
        )}
      </header>

      <div style={{ display: 'flex', maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', gap: '24px' }}>
        {/* ---- Sidebar Tab Navigation ---- */}
        <aside style={{ width: '200px', flexShrink: 0 }}>
          <nav style={{ position: 'sticky', top: '76px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                  border: 'none', textAlign: 'left', width: '100%', fontSize: '13px',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  background: activeTab === tab.id ? '#e6f4ea' : 'transparent',
                  color: activeTab === tab.id ? '#188038' : '#5f6368',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ---- Main Content ---- */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Tab header */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#1f2328' }}>
              {activeTabDef?.label}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#5f6368' }}>{activeTabDef?.desc}</p>
          </div>

          {/* Tab panels */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #dadce0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {activeTab === 'schema'           && <SchemaBuilder userId={userId} />}
            {activeTab === 'hierarchy'         && <HierarchyManager userId={userId} />}
            {activeTab === 'itemcode'          && <ItemCodeRuleManager />}
            {activeTab === 'sync'              && <SyncMonitor />}
            {activeTab === 'exception_rules'   && <CompletionRulesManager />}
            {activeTab === 'unmatched'         && <UnmatchedReport />}
          </div>
        </main>
      </div>
    </div>
  )
}
