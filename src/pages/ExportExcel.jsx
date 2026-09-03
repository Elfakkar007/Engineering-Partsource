import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useToast } from '../contexts/ToastContext'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'



export default function ExportExcel() {
  const [mode, setMode] = useState('per-line') // 'per-line' | 'gabungan'
  const [selectedLine, setSelectedLine] = useState('')
  const { addToast } = useToast()

  const lines = useLiveQuery(() => db.lines_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], [])
  const locations = useLiveQuery(() => db.locations_cache.toArray(), [], [])
  const records = useLiveQuery(() => db.records.filter(r => r.isDeleted !== true).toArray(), [], [])
  const columns = useLiveQuery(() => db.columns_config.filter(c => c.applies_to !== 'reference_catalog').toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], [])


  useEffect(() => {
    if (lines?.length > 0 && !selectedLine) {
      setSelectedLine(lines[0].id)
    }
  }, [lines, selectedLine])

  const LINE_OPTIONS = lines ? lines.map(l => ({ id: l.id, label: l.name })) : []

  // Generate Excel-friendly data array for a specific line
  const getExportDataForLine = (lineId) => {
    if (!locations || !records || !columns) return []

    // 1. Dapatkan lokasi-lokasi di Line ini
    const lineLocations = locations.filter(l => l.line_id === lineId)
    const locIds = new Set(lineLocations.map(l => l.id))
    const locMap = {}
    lineLocations.forEach(l => locMap[l.id] = l.name)

    // 2. Filter record yang berada di lokasi-lokasi tersebut
    const lineRecords = records.filter(r => locIds.has(r.location_id))

    // 3. Bangun array hasil
    return lineRecords.map(row => {
      const rowData = {}
      rowData['Plant / Line'] = LINE_OPTIONS.find(l => l.id === lineId)?.label || lineId
      rowData['Lokasi'] = locMap[row.location_id] || 'Tidak diketahui'
      
      // Ambil department_id dari lokasi baris ini
      const loc = lineLocations.find(l => l.id === row.location_id)
      const deptId = loc ? loc.department_id : null
      
      // Filter kolom yang berlaku untuk department ini
      const deptCols = columns.filter(c => c.department_id === deptId)
      
      deptCols.forEach(col => {
        rowData[col.label] = row.components?.[col.key] ?? ''
      })
      
      return rowData
    })
  }

  const createStyledSheet = (dataArray, headerKeys) => {
    const ws = XLSX.utils.json_to_sheet(dataArray, { header: headerKeys })

    // Auto column width logic
    const colWidths = headerKeys.map(col => {
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
      
      // Ambil semua key (header) yang muncul di data (karena kolom dinamis per dept)
      const allKeys = new Set(['Plant / Line', 'Lokasi'])
      dataArray.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))
      const headerKeys = Array.from(allKeys)

      const ws = createStyledSheet(dataArray, headerKeys)
      XLSX.utils.book_append_sheet(wb, ws, LINE_OPTIONS.find(l => l.id === selectedLine)?.label || selectedLine)
      filename = `PlantSourcing_Export_${(LINE_OPTIONS.find(l => l.id === selectedLine)?.label || selectedLine).replace(/ /g, '')}_${dateStr}.xlsx`
    } else {
      LINE_OPTIONS.forEach(opt => {
        const dataArray = getExportDataForLine(opt.id)
        
        const allKeys = new Set(['Plant / Line', 'Lokasi'])
        dataArray.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))
        const headerKeys = Array.from(allKeys)

        const ws = createStyledSheet(dataArray, headerKeys)
        XLSX.utils.book_append_sheet(wb, ws, opt.label)
      })
      filename = `PlantSourcing_Export_Gabungan_${dateStr}.xlsx`
    }

    XLSX.writeFile(wb, filename)
    addToast('File Excel berhasil diunduh', 'success')
  }

  const previewRows = getExportDataForLine(mode === 'gabungan' ? (LINE_OPTIONS[0]?.id || '') : selectedLine)
  const totalPreviewRows = previewRows.length
  const previewData = previewRows.slice(0, 20)
  
  const previewHeaders = new Set(['Plant / Line', 'Lokasi'])
  previewData.forEach(row => Object.keys(row).forEach(k => previewHeaders.add(k)))
  const previewHeaderArray = Array.from(previewHeaders)

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-surface-panel)' }}>
      <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--color-ink)' }}>Export Data Excel</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-muted)' }}>Unduh data dari sistem ke dalam format .xlsx</p>
        </div>
        {(!lines || !locations || !records || !columns) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', background: 'var(--color-canvas)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-border)', borderTop: `3px solid var(--color-primary)`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '16px', color: 'var(--color-ink-muted)' }}>Memuat data dari database lokal...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : LINE_OPTIONS.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', background: 'var(--color-canvas)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
            <h3 style={{ color: 'var(--color-ink)', margin: '0 0 8px' }}>Belum Ada Data Line</h3>
            <p style={{ color: 'var(--color-ink-muted)', margin: 0 }}>Silakan tambahkan Line terlebih dahulu di pengaturan Hierarki.</p>
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
                {mode === 'gabungan' && <strong>Preview menampilkan {LINE_OPTIONS[0]?.label}. Hasil download akan berisi {LINE_OPTIONS.length} sheet terpisah. </strong>}
                Menampilkan maksimal 20 baris pertama dari {totalPreviewRows} total baris untuk {LINE_OPTIONS.find(l => l.id === (mode === 'gabungan' ? LINE_OPTIONS[0]?.id : selectedLine))?.label}.
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
                        {previewHeaderArray.map((h, i) => (
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
                          {previewHeaderArray.map((col, colIndex) => (
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
      </div>
    </div>
  )
}
