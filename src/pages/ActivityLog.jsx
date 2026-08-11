/**
 * ActivityLog.jsx — Refactor (Phase 6)
 *
 * Menampilkan audit trail lokal dari Dexie `activity_log` (SRS §5.2).
 * Plus tab terpisah untuk monitor sync_queue dengan trigger manual.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

const ACTION_LABELS = {
  tambah_baris:       'Tambah Baris',
  bulk_tambah_baris:  'Tambah Baris (Bulk)',
  duplikat_baris:     'Duplikat Baris',
  edit_sel:           'Edit Sel',
  hapus_baris:        'Hapus Baris',
  bulk_hapus_baris:   'Hapus Baris (Bulk)',
  find_replace:       'Find & Replace',
  bulk_fill_kolom:    'Isi Kolom Massal',
  bulk_flag:          'Flag Massal',
  import_excel:       'Import Excel',
  import_commit:      'Import Commit',
  hapus_kolom:        'Hapus Kolom',
  edit_kolom:         'Edit Kolom',
  tambah_kolom:       'Tambah Kolom',
  tambah_line:        'Tambah Line',
  hapus_line:         'Hapus Line',
  tambah_department:  'Tambah Department',
  hapus_department:   'Hapus Department',
  tambah_lokasi:      'Tambah Lokasi',
  hapus_lokasi:       'Hapus Lokasi',
  pulihkan_baris:     'Pulihkan Baris',
  hapus_permanen:     'Hapus Permanen',
}

const ACTION_COLORS = {
  tambah_baris:      { bg: '#e6f4ea', color: '#188038' },
  import_excel:      { bg: '#e8f0fe', color: '#1a73e8' },
  import_commit:     { bg: '#e8f0fe', color: '#1a73e8' },
  hapus_baris:       { bg: '#fce8e6', color: '#d93025' },
  bulk_hapus_baris:  { bg: '#fce8e6', color: '#d93025' },
  hapus_permanen:    { bg: '#fce8e6', color: '#d93025' },
  hapus_kolom:       { bg: '#fce8e6', color: '#d93025' },
  edit_kolom:        { bg: '#fef7e0', color: '#b06000' },
  tambah_kolom:      { bg: '#e6f4ea', color: '#188038' },
  tambah_line:       { bg: '#e6f4ea', color: '#188038' },
  tambah_department: { bg: '#e6f4ea', color: '#188038' },
  tambah_lokasi:     { bg: '#e6f4ea', color: '#188038' },
}

function formatDate(ts) {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(ts))
  } catch { return ts }
}

function ActionBadge({ action }) {
  const style = ACTION_COLORS[action] || { bg: '#f1f3f4', color: '#5f6368' }
  return (
    <span style={{
      fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
      background: style.bg, color: style.color, fontWeight: 500,
    }}>
      {ACTION_LABELS[action] || action}
    </span>
  )
}

export default function ActivityLog() {
  const navigate = useNavigate()
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [limit, setLimit] = useState(100)

  // Live query dari Dexie activity_log
  const logs = useLiveQuery(
    () => db.activity_log.orderBy('id').reverse().limit(300).toArray(),
    [], []
  )

  const uniqueActions = [...new Set((logs || []).map(l => l.action).filter(Boolean))].sort()
  const uniqueEntityTypes = [...new Set((logs || []).map(l => l.entity_type).filter(Boolean))].sort()

  const filteredLogs = (logs || [])
    .filter(log => !filterAction || log.action === filterAction)
    .filter(log => !filterEntityType || log.entity_type === filterEntityType)
    .slice(0, limit)

  function parseDetail(detail) {
    if (!detail) return null
    try {
      const obj = typeof detail === 'string' ? JSON.parse(detail) : detail
      const parts = []
      if (obj.count) parts.push(`${obj.count} baris`)
      if (obj.location) parts.push(String(obj.location))
      if (obj.dept || obj.department_id) parts.push(String(obj.dept || obj.department_id))
      if (obj.name) parts.push(`"${obj.name}"`)
      if (obj.label) parts.push(`"${obj.label}"`)
      if (obj.colKey) parts.push(`kolom ${obj.colKey}`)
      return parts.length ? parts.join(' · ') : null
    } catch { return null }
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa' }}>
      {/* Header */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #dadce0',
        padding: '0 20px', height: '52px',
        display: 'flex', alignItems: 'center', gap: '16px',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}
          onClick={() => navigate('/')}>← Kembali</button>
        <div>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2328' }}>Activity Log</h1>
        </div>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Filters */}
        <div style={{
          background: '#fff', borderRadius: '10px', padding: '14px 16px',
          border: '1px solid #dadce0', marginBottom: '16px',
          display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '6px', minWidth: '180px' }}>
            <option value="">Semua Aksi</option>
            {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
          <select value={filterEntityType} onChange={e => setFilterEntityType(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '6px', minWidth: '140px' }}>
            <option value="">Semua Tipe</option>
            {uniqueEntityTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filterAction || filterEntityType) && (
            <button onClick={() => { setFilterAction(''); setFilterEntityType('') }}
              style={{ background: 'none', border: 'none', color: '#1a73e8', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}>
              × Reset Filter
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#80868b' }}>
            {filteredLogs.length} entri ditampilkan
          </span>
        </div>

        {/* Log Table */}
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #dadce0', overflow: 'hidden' }}>
          {!logs?.length ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#80868b' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>Belum ada aktivitas tercatat</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Log akan muncul saat pengguna melakukan aksi di grid atau pengaturan admin.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#80868b', fontSize: '13px' }}>
              Tidak ada hasil untuk filter yang dipilih.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '170px' }}>Waktu</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '160px' }}>User</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '160px' }}>Aksi</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '100px' }}>Tipe</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                      <td style={{ padding: '9px 14px', color: '#80868b', whiteSpace: 'nowrap' }}>
                        {formatDate(log.timestamp)}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#1f2328', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                        {log.user_id || '—'}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <ActionBadge action={log.action} />
                      </td>
                      <td style={{ padding: '9px 14px', color: '#80868b' }}>
                        {log.entity_type || '—'}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#5f6368' }}>
                        {parseDetail(log.detail) || (log.entity_id ? `ID: ${log.entity_id}` : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Load More */}
        {(logs?.length || 0) > limit && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button className="btn-secondary" style={{ padding: '8px 24px', fontSize: '13px' }}
              onClick={() => setLimit(l => l + 100)}>
              Muat 100 entri lagi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
