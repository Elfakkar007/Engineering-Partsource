import { useState, useEffect } from 'react'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useToast } from '../contexts/ToastContext'
import { COLUMNS } from './LinePage'
import { useNavigate } from 'react-router-dom'

export const DEFAULT_REQUIRED = ['subMachine', 'category', 'part', 'spesification', 'status', 'qty', 'foto']

export default function AdminSettings() {
  const [config, setConfig] = useState({
    requiredColumns: DEFAULT_REQUIRED,
    hiddenColumns: []
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const docRef = doc(db, 'settings', 'gridConfig')
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfig({
          requiredColumns: docSnap.data().requiredColumns || DEFAULT_REQUIRED,
          hiddenColumns: docSnap.data().hiddenColumns || []
        })
      } else {
        setConfig({
          requiredColumns: DEFAULT_REQUIRED,
          hiddenColumns: []
        })
      }
      setLoading(false)
    }, (error) => {
      console.error('Error fetching gridConfig:', error)
      addToast('Gagal memuat konfigurasi', 'error')
      setLoading(false)
    })
    return () => unsubscribe()
  }, [addToast])

  const handleToggleRequired = (colKey) => {
    setConfig(prev => {
      const isReq = prev.requiredColumns.includes(colKey)
      return {
        ...prev,
        requiredColumns: isReq 
          ? prev.requiredColumns.filter(k => k !== colKey)
          : [...prev.requiredColumns, colKey]
      }
    })
  }

  const handleToggleVisible = (colKey) => {
    setConfig(prev => {
      const isHidden = prev.hiddenColumns.includes(colKey)
      return {
        ...prev,
        hiddenColumns: isHidden 
          ? prev.hiddenColumns.filter(k => k !== colKey)
          : [...prev.hiddenColumns, colKey]
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const docRef = doc(db, 'settings', 'gridConfig')
      await setDoc(docRef, config, { merge: true })
      addToast('Pengaturan grid berhasil disimpan', 'success')
    } catch (err) {
      console.error('Error saving gridConfig:', err)
      if (err.code === 'permission-denied') {
        addToast('Akses ditolak: Anda bukan Admin', 'error')
      } else {
        addToast('Gagal menyimpan pengaturan', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#5f6368' }}>
        Memuat konfigurasi...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa', paddingBottom: '48px' }}>
      {/* Header */}
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
          Pengaturan Admin
        </h1>
      </header>

      <main style={{ maxWidth: '800px', margin: '32px auto 0', padding: '0 16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1f2328' }}>
            Konfigurasi Grid
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#5f6368' }}>
            Atur kolom mana yang menjadi syarat kelengkapan data (baris selesai), dan kolom mana yang ditampilkan di tabel.
          </p>
        </div>

        <div className="ds-card" style={{ padding: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8eaed' }}>
                <th style={{ padding: '12px 8px', color: '#5f6368', fontWeight: 600, fontSize: '13px' }}>Nama Kolom</th>
                <th style={{ padding: '12px 8px', color: '#5f6368', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Syarat Selesai</th>
                <th style={{ padding: '12px 8px', color: '#5f6368', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Tampilkan di Grid</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map(col => {
                const isRequired = config.requiredColumns.includes(col.key)
                const isVisible = !config.hiddenColumns.includes(col.key)

                return (
                  <tr key={col.key} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={{ padding: '16px 8px', fontSize: '14px', fontWeight: 500, color: '#1f2328' }}>
                      {col.label}
                    </td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={isRequired}
                        onChange={() => handleToggleRequired(col.key)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1a73e8' }}
                      />
                    </td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={isVisible}
                        onChange={() => handleToggleVisible(col.key)}
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          cursor: 'pointer',
                          accentColor: '#1a73e8' 
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e8eaed' }}>
            <button 
              className="btn-primary" 
              onClick={handleSave} 
              disabled={saving}
              style={{ padding: '10px 24px', fontSize: '14px' }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
