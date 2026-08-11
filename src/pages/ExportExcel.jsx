import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

const LINE_OPTIONS = [
  { id: 'line1', label: 'Line 1' },
  { id: 'line2', label: 'Line 2' },
  { id: 'line3', label: 'Line 3' },
  { id: 'line4', label: 'Line 4' },
]

const STANDARD_COLUMNS = [
  'Plant', 'Location', 'Sub-Machine', 'Item Code', 'Category',
  'Part', 'Description ( Bella )', 'Spesification', 'Warehouse Name',
  'Status', 'Qty', 'Foto', 'Qty WH'
]

const fieldMapping = {
  'Sub-Machine': 'subMachine',
  'Item Code': 'itemCode',
  'Category': 'category',
  'Part': 'part',
  'Description ( Bella )': 'description',
  'Spesification': 'spesification',
  'Warehouse Name': 'warehouseName',
  'Status': 'status',
  'Foto': 'foto'
}

export default function ExportExcel() {
  const [mode, setMode] = useState('per-line') // 'per-line' | 'gabungan'
  const [selectedLine, setSelectedLine] = useState('line1')

  const [isLoading, setIsLoading] = useState(true)
  const [dataCache, setDataCache] = useState({ locations: {}, componentsByLine: {} })
  const { addToast } = useToast()
  const navigate = useNavigate()

  // 1. Fetch data ONCE on mount
  useEffect(() => {
    async function fetchAllData() {
      try {
        // Fetch locations
        const locSnap = await getDocs(collection(db, 'locations'))
        const locMap = {}
        locSnap.forEach(doc => {
          locMap[doc.id] = doc.data().name
        })

        // Fetch valid components across all lines
        const compQ = query(collection(db, 'components'), where('isDeleted', '==', false))
        const compSnap = await getDocs(compQ)

        const compsByLine = { line1: [], line2: [], line3: [], line4: [] }
        compSnap.forEach(doc => {
          const data = doc.data()
          if (compsByLine[data.line]) {
            compsByLine[data.line].push(data)
          }
        })

        // Sort each line array by createdAt ascending exactly like LinePage.jsx
        Object.keys(compsByLine).forEach(line => {
          compsByLine[line].sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0
            const bTime = b.createdAt?.toMillis?.() || 0
            return aTime - bTime
          })
        })

        setDataCache({ locations: locMap, componentsByLine: compsByLine })
      } catch (err) {
        console.error('Error fetching data for export:', err)
        addToast('Gagal memuat data dari database', 'error')
      } finally {
        setIsLoading(false)
      }
    }
    fetchAllData()
  }, []) // Empty dependency array = one-time fetch

  // Generate Excel-friendly data array for a specific line
  const getExportDataForLine = (lineId) => {
    const rows = dataCache.componentsByLine[lineId] || []
    return rows.map(row => {
      const rowData = {}

      // Plant (Line Label)
      rowData['Plant'] = LINE_OPTIONS.find(l => l.id === lineId)?.label || lineId
      // Location (Real Name)
      rowData['Location'] = dataCache.locations[row.locationId] || 'Belum Ada Lokasi'
      // Qty
      rowData['Qty'] = row.qty !== undefined && row.qty !== null ? row.qty : ''
      // Qty WH
      rowData['Qty WH'] = row.qtyWh !== undefined && row.qtyWh !== null ? row.qtyWh : ''

      // Map other text fields
      Object.entries(fieldMapping).forEach(([stdCol, camelKey]) => {
        rowData[stdCol] = row[camelKey] || ''
      })

      return rowData
    })
  }

  const createStyledSheet = (dataArray) => {
    const ws = XLSX.utils.json_to_sheet(dataArray, { header: STANDARD_COLUMNS })

    // Auto column width logic
    const colWidths = STANDARD_COLUMNS.map(col => {
      let maxLen = col.length
      dataArray.forEach(row => {
        const val = row[col] !== undefined && row[col] !== null ? String(row[col]) : ''
        if (val.length > maxLen) maxLen = val.length
      })
      return { wch: Math.min(maxLen + 2, 50) } // pad by 2, cap at 50 width
    })
    ws['!cols'] = colWidths

    return ws
  }

  const handleDownload = () => {
    const wb = XLSX.utils.book_new()
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}${mm}${dd}`

    let filename = ''

    if (mode === 'per-line') {
      const dataArray = getExportDataForLine(selectedLine)
      const ws = createStyledSheet(dataArray)
      XLSX.utils.book_append_sheet(wb, ws, LINE_OPTIONS.find(l => l.id === selectedLine)?.label || selectedLine)
      filename = `PlantSourcing_Export_${LINE_OPTIONS.find(l => l.id === selectedLine)?.label.replace(' ', '')}_${dateStr}.xlsx`
    } else {
      LINE_OPTIONS.forEach(opt => {
        const dataArray = getExportDataForLine(opt.id)
        const ws = createStyledSheet(dataArray)
        XLSX.utils.book_append_sheet(wb, ws, opt.label)
      })
      filename = `PlantSourcing_Export_Gabungan_${dateStr}.xlsx`
    }

    XLSX.writeFile(wb, filename)
    addToast('File Excel berhasil diunduh', 'success')
  }

  const previewRows = getExportDataForLine(mode === 'gabungan' ? 'line1' : selectedLine)
  const totalPreviewRows = previewRows.length
  const previewData = previewRows.slice(0, 20)

  return (
    <div className="layout-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--color-surface-panel)' }}>
      {/* Header */}
      <header className="page-header" style={{ padding: '16px 24px', background: 'var(--color-canvas)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn-secondary"
            onClick={() => navigate('/')}
            style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '20px', color: 'var(--color-ink)' }}>Export Data Excel</h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-ink-muted)' }}>Unduh data dari sistem ke dalam format .xlsx</p>
          </div>
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', background: 'var(--color-canvas)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-border)', borderTop: `3px solid var(--color-primary)`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '16px', color: 'var(--color-ink-muted)' }}>Memuat data dari Firestore...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Toolbar Mode & Konfigurasi */}
            <div style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'rgba(0, 0, 0, 0.06) 0 1px 2px' }}>
              <div className="toolbar" style={{ display: 'flex', gap: '16px', borderBottom: mode === 'per-line' ? '1px solid var(--color-border)' : 'none' }}>
                <button
                  className={mode === 'per-line' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setMode('per-line')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Export Per-Line
                </button>
                <button
                  className={mode === 'gabungan' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setMode('gabungan')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  Export Gabungan
                </button>
              </div>

              {mode === 'per-line' && (
                <div style={{ padding: '16px 24px', display: 'flex', gap: '8px', background: 'var(--color-surface-subtle)' }}>
                  {LINE_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedLine(opt.id)}
                      className={selectedLine === opt.id ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tabel Preview */}
            <div style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'rgba(0, 0, 0, 0.06) 0 1px 2px' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-ink)', marginRight: 'auto' }}>Preview Data Export</h3>
                <button
                  className="btn-primary"
                  onClick={handleDownload}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download Excel
                </button>
              </div>

              <div style={{ padding: '12px 24px', background: 'var(--color-surface-subtle)', fontSize: '13px', color: 'var(--color-ink-muted)' }}>
                {mode === 'gabungan' && <strong>Preview menampilkan Line 1. Hasil download akan berisi 4 sheet terpisah. </strong>}
                Menampilkan maksimal 20 baris pertama dari {totalPreviewRows} total baris untuk {LINE_OPTIONS.find(l => l.id === (mode === 'gabungan' ? 'line1' : selectedLine))?.label}.
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '500px', borderTop: '1px solid var(--color-border)' }}>
                {previewData.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                    Tidak ada data pada Line ini.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', top: 0, background: 'var(--color-surface-subtle)', padding: '8px 12px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', color: 'var(--color-ink)', fontWeight: 600, textAlign: 'center', width: '40px' }}>
                          #
                        </th>
                        {STANDARD_COLUMNS.map((h, i) => (
                          <th key={i} style={{ position: 'sticky', top: 0, background: 'var(--color-surface-subtle)', padding: '8px 12px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', color: 'var(--color-ink)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, rowIndex) => (
                        <tr key={rowIndex} style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-canvas)' }}>
                          <td style={{ padding: '6px 12px', borderRight: '1px solid var(--color-border)', color: 'var(--color-ink-muted)', textAlign: 'center' }}>
                            {rowIndex + 1}
                          </td>
                          {STANDARD_COLUMNS.map((col, colIndex) => (
                            <td key={colIndex} style={{ padding: '6px 12px', borderRight: '1px solid var(--color-border)', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
