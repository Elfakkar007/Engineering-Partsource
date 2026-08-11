import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'

const ACTION_LABELS = {
  'tambah_baris': 'Menambah baris',
  'bulk_tambah_baris': 'Menambah baris (bulk)',
  'duplikat_baris': 'Menduplikat baris',
  'bulk_hapus_baris': 'Menghapus baris (bulk)',
  'tambah_lokasi': 'Menambah lokasi',
  'hapus_lokasi': 'Menghapus lokasi',
  'paste_data': 'Paste data (bulk)',
  'pulihkan_baris': 'Memulihkan baris',
  'bulk_pulihkan_baris': 'Memulihkan baris (bulk)',
  'hapus_permanen': 'Hapus permanen',
  'bulk_hapus_permanen': 'Hapus permanen (bulk)'
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState({})
  
  // Filter state
  const [filterLine, setFilterLine] = useState('')
  const [filterAction, setFilterAction] = useState('')
  
  const { addToast } = useToast()
  const navigate = useNavigate()

  // Computed filter options
  const uniqueLines = Array.from(new Set(logs.map(r => r.line).filter(Boolean))).sort()
  const uniqueActions = Array.from(new Set(logs.map(r => r.action).filter(Boolean)))

  const filteredLogs = logs.filter(log => {
    let matchLine = true
    if (filterLine) {
      matchLine = log.line === filterLine
    }

    let matchAction = true
    if (filterAction) {
      matchAction = log.action === filterAction
    }

    return matchLine && matchAction
  })

  const hasFilters = filterLine !== '' || filterAction !== ''
  const handleClearFilters = () => {
    setFilterLine('')
    setFilterAction('')
  }

  useEffect(() => {
    const q = query(
      collection(db, 'activityLog'),
      orderBy('timestamp', 'desc'),
      limit(200)
    )

    const unsubLogs = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setLogs(data)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching activity log:', error)
      addToast('Gagal memuat log aktivitas', 'error')
      setLoading(false)
    })

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersMap = {}
      snapshot.docs.forEach(d => {
        usersMap[d.id] = d.data()
      })
      setUsers(usersMap)
    })

    return () => {
      unsubLogs()
      unsubUsers()
    }
  }, [addToast])

  const formatDate = (timestamp) => {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date)
  }

  const formatDetail = (log) => {
    const parts = []
    if (log.line) {
      const lineLabel = log.line.replace('line', 'Line ')
      if (log.locationName) {
        parts.push(`${lineLabel} - ${log.locationName}`)
      } else {
        parts.push(lineLabel)
      }
    }
    if (log.count) {
      parts.push(`${log.count} baris`)
    }
    return parts.join(' | ') || '-'
  }

  const getUserDisplay = (uid) => {
    if (!uid) return 'Sistem'
    const u = users[uid]
    if (u) {
      return u.name || u.email || uid
    }
    return uid
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa' }}>
      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e1e4e8', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => navigate('/')}>
            ←
          </button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2328', margin: 0 }}>Activity Log</h1>
            <p style={{ fontSize: '13px', color: '#5f6368', margin: '4px 0 0' }}>Riwayat aktivitas terbaru (maks 200)</p>
          </div>
        </div>
      </header>

      {/* TOOLBAR */}
      <div style={{ padding: '24px 24px 0', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative' }}>
            <select
              className="grid-cell-input"
              style={{ width: '160px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #d0d7de', background: '#fff' }}
              value={filterLine}
              onChange={e => setFilterLine(e.target.value)}
            >
              <option value="">Semua Line</option>
              {uniqueLines.map(line => (
                <option key={line} value={line}>{line.replace('line', 'Line ')}</option>
              ))}
            </select>
          </div>
          
          <div style={{ position: 'relative' }}>
            <select
              className="grid-cell-input"
              style={{ width: '220px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #d0d7de', background: '#fff' }}
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="">Semua Aksi</option>
              {uniqueActions.map(actionKey => (
                <option key={actionKey} value={actionKey}>{ACTION_LABELS[actionKey] || actionKey}</option>
              ))}
            </select>
          </div>
          
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              style={{
                background: 'none', border: 'none', color: '#0969da', fontSize: '13px',
                cursor: 'pointer', padding: '4px 8px'
              }}
            >
              Hapus semua filter
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <main style={{ padding: '0 24px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #d0d7de' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368', borderRight: '1px solid #d0d7de', width: '160px' }}>Waktu</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368', borderRight: '1px solid #d0d7de', width: '180px' }}>User</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368', borderRight: '1px solid #d0d7de', width: '200px' }}>Aksi</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#5f6368' }}>
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#5f6368' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                      <div style={{ fontWeight: 500 }}>
                        {hasFilters ? 'Tidak ada hasil untuk filter yang dipilih' : 'Belum ada aktivitas tercatat'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #d0d7de', background: '#fff' }}>
                      <td style={{ padding: '10px 16px', borderRight: '1px solid #d0d7de', whiteSpace: 'nowrap' }}>
                        {formatDate(log.timestamp)}
                      </td>
                      <td style={{ padding: '10px 16px', borderRight: '1px solid #d0d7de' }}>
                        {getUserDisplay(log.userId)}
                      </td>
                      <td style={{ padding: '10px 16px', borderRight: '1px solid #d0d7de' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#f6f8fa',
                          border: '1px solid #d0d7de',
                          fontSize: '12px'
                        }}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {formatDetail(log)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
