import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import { useAuth } from '../contexts/AuthContext'
import { logActivity } from '../lib/activityLog'

export default function RecycleBin() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState({})
  const [users, setUsers] = useState({})
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLine, setFilterLine] = useState('')
  const [filterUser, setFilterUser] = useState('')
  
  // Modal state
  const [deleteTargetIds, setDeleteTargetIds] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  // Computed filter options
  const uniqueLines = Array.from(new Set(rows.map(r => r.line).filter(Boolean))).sort()
  const uniqueUsers = Array.from(new Set(rows.map(r => r.deletedBy).filter(Boolean)))

  const filteredRows = rows.filter(row => {
    // Search match
    let matchSearch = true
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchSub = (row.subMachine || '').toLowerCase().includes(q)
      const matchPart = (row.part || '').toLowerCase().includes(q)
      matchSearch = matchSub || matchPart
    }

    // Line match
    let matchLine = true
    if (filterLine) {
      matchLine = row.line === filterLine
    }

    // User match
    let matchUser = true
    if (filterUser) {
      matchUser = row.deletedBy === filterUser
    }

    return matchSearch && matchLine && matchUser
  })

  const hasFilters = searchQuery !== '' || filterLine !== '' || filterUser !== ''
  const handleClearFilters = () => {
    setSearchQuery('')
    setFilterLine('')
    setFilterUser('')
  }

  useEffect(() => {
    setSelectedIds([])
  }, [searchQuery, filterLine, filterUser])

  useEffect(() => {
    // 1. Fetch soft-deleted components
    const q = query(
      collection(db, 'components'),
      where('isDeleted', '==', true)
    )

    const unsubComponents = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      // Sort by deletedAt descending (newest first)
      data.sort((a, b) => {
        const aTime = a.deletedAt?.toMillis?.() || 0
        const bTime = b.deletedAt?.toMillis?.() || 0
        return bTime - aTime
      })
      setRows(data)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching recycle bin:', error)
      addToast('Gagal memuat Recycle Bin', 'error')
      setLoading(false)
    })

    // 2. Fetch locations mapping
    const unsubLocations = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locMap = {}
      snapshot.docs.forEach(d => {
        locMap[d.id] = d.data().name
      })
      setLocations(locMap)
    })

    // 3. Fetch users mapping
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userMap = {}
      snapshot.docs.forEach(d => {
        const data = d.data()
        userMap[d.id] = data.displayName || data.email?.split('@')[0] || data.email || 'Unknown User'
      })
      setUsers(userMap)
    })

    return () => {
      unsubComponents()
      unsubLocations()
      unsubUsers()
    }
  }, [addToast])

  const handleRestore = (rowId) => {
    const row = rows.find(r => r.id === rowId)
    logActivity('pulihkan_baris', currentUser?.uid, { line: row?.line, count: 1 })
    const docRef = doc(db, 'components', rowId)
    updateDoc(docRef, {
      isDeleted: false,
    }).catch((err) => {
      console.error('Failed to restore:', err)
      addToast('Gagal memulihkan data', 'error')
    })
    addToast('Data berhasil dipulihkan', 'success')
  }

  const handleBulkRestore = () => {
    if (selectedIds.length === 0) return
    logActivity('bulk_pulihkan_baris', currentUser?.uid, { count: selectedIds.length })
    const batch = writeBatch(db)
    const count = selectedIds.length
    selectedIds.forEach(id => {
      batch.update(doc(db, 'components', id), { isDeleted: false })
    })
    batch.commit().catch((err) => {
      console.error('Failed to bulk restore:', err)
      addToast('Gagal memulihkan data', 'error')
    })
    addToast(`Data berhasil dipulihkan (${count} baris)`, 'success')
    setSelectedIds([])
  }

  const handleConfirmPermanentDelete = () => {
    if (!deleteTargetIds || deleteTargetIds.length === 0) return
    logActivity(
      deleteTargetIds.length > 1 ? 'bulk_hapus_permanen' : 'hapus_permanen',
      currentUser?.uid,
      { count: deleteTargetIds.length }
    )
    const batch = writeBatch(db)
    const count = deleteTargetIds.length
    deleteTargetIds.forEach(id => {
      batch.delete(doc(db, 'components', id))
    })
    batch.commit().catch((err) => {
      console.error('Failed to permanently delete:', err)
      if (err.code === 'permission-denied') {
        addToast('Akses ditolak: Hanya Admin yang dapat menghapus permanen.', 'error')
      } else {
        addToast('Gagal menghapus data selamanya', 'error')
      }
    })
    addToast(`Data berhasil dihapus selamanya (${count} baris)`, 'success')
    setSelectedIds(prev => prev.filter(id => !deleteTargetIds.includes(id)))
    setDeleteTargetIds([])
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date)
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#5f6368' }}>Memuat Recycle Bin...</div>
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa', paddingBottom: '48px' }}>
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #dadce0',
        padding: '0 16px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button 
          onClick={() => navigate('/')} 
          className="btn-secondary" 
          style={{ padding: '6px 12px', marginRight: '16px', fontSize: '13px' }}
        >
          &larr; Kembali ke Dashboard
        </button>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2328' }}>
          Recycle Bin
        </h1>
      </header>

      <main style={{ maxWidth: '1000px', margin: '32px auto 0', padding: '0 16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1f2328', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Recycle Bin
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#5f6368' }}>
            Daftar data yang telah dihapus (soft-delete). Anda dapat memulihkannya atau menghapusnya secara permanen.
          </p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Cari Sub-Machine atau Part..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 200px',
                maxWidth: '300px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #dadce0',
                fontSize: '14px'
              }}
            />
            <select
              value={filterLine}
              onChange={(e) => setFilterLine(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #dadce0',
                fontSize: '14px',
                background: '#fff'
              }}
            >
              <option value="">Semua Line</option>
              {uniqueLines.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #dadce0',
                fontSize: '14px',
                background: '#fff',
                maxWidth: '200px'
              }}
            >
              <option value="">Semua User</option>
              {uniqueUsers.map(uid => (
                <option key={uid} value={uid}>{users[uid] || uid}</option>
              ))}
            </select>
            {hasFilters && (
              <button 
                onClick={handleClearFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d93025',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                Hapus semua filter
              </button>
            )}
          </div>
        </div>

        <div className="ds-card" style={{ padding: '0', overflowX: 'auto' }}>
          {selectedIds.length > 0 && (
            <div style={{ padding: '8px 16px', background: '#e8f0fe', borderBottom: '1px solid #dadce0', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '13px', color: '#1f2328', fontWeight: 600 }}>{selectedIds.length} dipilih</span>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', background: '#fff' }} onClick={handleBulkRestore}>
                Pulihkan Terpilih
              </button>
              <button className="btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setDeleteTargetIds(selectedIds)}>
                Hapus Selamanya Terpilih
              </button>
            </div>
          )}
          {rows.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#5f6368' }}>
              Tidak ada data di recycle bin
            </div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#5f6368' }}>
              Tidak ada hasil untuk '{searchQuery}'
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8eaed', background: '#f8f9fa' }}>
                  <th style={{ padding: '12px 16px', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? filteredRows.map(r => r.id) : [])}
                    />
                  </th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Line</th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Location</th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Sub-Machine</th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Part</th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Dihapus Oleh</th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Waktu Hapus</th>
                  <th style={{ padding: '12px 16px', color: '#5f6368', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f3f4', background: selectedIds.includes(row.id) ? '#f4f8fe' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(prev => [...prev, row.id])
                          else setSelectedIds(prev => prev.filter(id => id !== row.id))
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2328' }}>{row.line}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2328' }}>{locations[row.locationId] || row.locationId}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2328' }}>{row.subMachine || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2328' }}>{row.part || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#5f6368' }}>{users[row.deletedBy] || 'Unknown'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#5f6368' }}>{formatDate(row.deletedAt)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleRestore(row.id)}
                        >
                          Pulihkan
                        </button>
                        <button 
                          className="btn-danger"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setDeleteTargetIds([row.id])}
                        >
                          Hapus Selamanya
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTargetIds.length > 0 && (
          <ConfirmDeleteModal
            title="Konfirmasi Hapus Permanen"
            itemLabel={`${deleteTargetIds.length} baris secara permanen`}
            warningText="Tindakan ini akan menghapus dokumen dari database secara permanen dan tidak dapat di-undo."
            confirmText="Hapus Selamanya"
            onConfirm={handleConfirmPermanentDelete}
            onCancel={() => setDeleteTargetIds([])}
          />
        )}
      </main>
    </div>
  )
}
