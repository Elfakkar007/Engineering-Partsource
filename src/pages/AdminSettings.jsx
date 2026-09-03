/**
 * AdminSettings.jsx — Refactor Navigation (Phase Nav)
 *
 * Header halaman dihapus karena navigasi sudah ditangani AdminShell/AdminSidebar.
 * Tab aktif sekarang dikontrol via AdminShellContext (useAdminShell).
 */

import { useAuth } from '../contexts/AuthContext'
import { useAdminShell } from '../components/layout/AdminShell'
import SchemaBuilder from '../components/admin/SchemaBuilder'
import HierarchyManager from '../components/admin/HierarchyManager'
import ItemCodeRuleManager from '../components/admin/ItemCodeRuleManager'
import SyncMonitor from '../components/admin/SyncMonitor'
import CompletionRulesManager from '../components/admin/CompletionRulesManager'
import UnmatchedReport from '../components/admin/UnmatchedReport'

const TABS = [
  { id: 'schema',          label: 'Skema Kolom',        desc: 'Tambah, edit, dan susun kolom data per Department.' },
  { id: 'hierarchy',       label: 'Hierarki',            desc: 'Kelola Line, Department, dan Location.' },
  { id: 'itemcode',        label: 'Aturan Kode',         desc: 'Konfigurasi kolom Item Code dan kelola Reference Catalog per Department.' },
  { id: 'unmatched',       label: 'Belum Ketemu Kode',   desc: 'Laporan baris Mode Auto yang belum mendapatkan kode item dari katalog.' },
  { id: 'sync',            label: 'Sync Monitor',        desc: 'Monitor dan trigger sinkronisasi data ke PocketBase.' },
  { id: 'exception_rules', label: 'Exception Rules',     desc: 'Atur kondisi di mana kolom wajib boleh dikosongkan.' },
]

export default function AdminSettings() {
  const { currentUser } = useAuth()
  const { activeTab, setActiveTab } = useAdminShell()

  const userId = currentUser?.email || currentUser?.uid || ''
  const activeTabDef = TABS.find(t => t.id === activeTab) || TABS[0]

  return (
    <div style={{ padding: '24px 28px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#1f2328' }}>
          {activeTabDef.label}
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#5f6368' }}>{activeTabDef.desc}</p>
      </div>

      {/* Tab panel */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #dadce0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {activeTab === 'schema'           && <SchemaBuilder userId={userId} />}
        {activeTab === 'hierarchy'        && <HierarchyManager userId={userId} />}
        {activeTab === 'itemcode'         && <ItemCodeRuleManager />}
        {activeTab === 'sync'             && <SyncMonitor />}
        {activeTab === 'exception_rules'  && <CompletionRulesManager />}
        {activeTab === 'unmatched'        && <UnmatchedReport />}
      </div>
    </div>
  )
}
