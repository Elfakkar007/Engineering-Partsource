/**
 * ExportModal.jsx
 *
 * Modal Export Excel — SRS v2.0 §10.2
 *
 * Opsi:
 *   ① Semua Data
 *   ② Data Terfilter (filteredRows dari DataGrid)
 *   ③ Baris Terpilih (selectedRows dari DataGrid)
 *
 * Header Excel 100% mengikuti label dan urutan kolom dari columns_config
 * (bukan hardcode). Gunakan excelEngine.exportToExcel() dari SheetJS.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { exportToExcel } from '../../lib/excelEngine'
import { useDialog } from '../../contexts/DialogContext'

/**
 * @param {Object}   props
 * @param {Object[]} props.allRows          - semua baris grid
 * @param {Object[]} props.filteredRows     - baris yang lolos filter aktif
 * @param {Set}      props.selectedRows     - Set of row IDs yang dipilih (checkbox)
 * @param {Object[]} props.columns          - kolom dari useDynamicSchema
 * @param {string}   [props.locationName]   - nama lokasi aktif
 * @param {string}   [props.deptName]       - nama department aktif
 * @param {Function} props.onClose
 */
export default function ExportModal({
  allRows,
  filteredRows,
  selectedRows,
  columns,
  locationName = '',
  deptName = '',
  onClose,
}) {
  const { alert } = useDialog()
  const [scope, setScope] = useState(
    selectedRows?.size > 0 ? 'selected'
    : filteredRows?.length < allRows?.length ? 'filtered'
    : 'all'
  )
  const [isExporting, setIsExporting] = useState(false)

  // Tentukan rows yang akan diekspor
  const scopeRows = {
    all: allRows,
    filtered: filteredRows,
    selected: allRows.filter(r => selectedRows?.has(r.id)),
  }

  const rowsToExport = scopeRows[scope] || allRows
  const rowCount = rowsToExport.length

  async function handleExport() {
    if (!rowsToExport.length) return
    setIsExporting(true)
    try {
      const filename = [
        'partsource',
        deptName || 'export',
        locationName || '',
        new Date().toISOString().slice(0, 10),
      ].filter(Boolean).join('_').replace(/\s+/g, '_')

      exportToExcel(rowsToExport, columns, {
        sheetName: deptName || 'Data',
        filename,
        locationName,
        deptName,
      })
      onClose()
    } catch (err) {
      console.error('[ExportModal] export error:', err)
      alert({ title: 'Gagal Ekspor', message: 'Terjadi kesalahan: ' + err.message, danger: true })
    } finally {
      setIsExporting(false)
    }
  }

  const scopeOptions = [
    { value: 'all',      label: `Semua Data`,       count: allRows.length },
    { value: 'filtered', label: `Data Terfilter`,    count: filteredRows.length, disabled: filteredRows.length === allRows.length },
    { value: 'selected', label: `Baris Terpilih`,    count: selectedRows?.size || 0, disabled: !selectedRows?.size },
  ]

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#188038" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2328' }}>Export Excel</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#5f6368' }}>
              {deptName}{locationName ? ` — ${locationName}` : ''}
            </p>
          </div>
        </div>

        {/* Scope Selector */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: '#1f2328', marginBottom: '10px' }}>
            Pilih data yang akan diekspor:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scopeOptions.map(opt => (
              <label
                key={opt.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px', cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  border: `1.5px solid ${scope === opt.value ? '#188038' : '#dadce0'}`,
                  background: scope === opt.value ? '#e6f4ea' : '#fff',
                  opacity: opt.disabled ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  disabled={opt.disabled}
                  onChange={() => !opt.disabled && setScope(opt.value)}
                  style={{ accentColor: '#188038' }}
                />
                <span style={{ flex: 1, fontSize: '13px', fontWeight: scope === opt.value ? 600 : 400 }}>
                  {opt.label}
                </span>
                <span style={{
                  fontSize: '12px', padding: '2px 8px', borderRadius: '10px',
                  background: scope === opt.value ? '#188038' : '#f1f3f4',
                  color: scope === opt.value ? '#fff' : '#5f6368',
                  fontWeight: 500,
                }}>
                  {opt.count} baris
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview info */}
        <div style={{
          padding: '12px', background: '#f8f9fa', borderRadius: '8px',
          border: '1px solid #dadce0', marginBottom: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#5f6368' }}>
            <strong>File output:</strong> .xlsx dengan {columns.length} kolom, {rowCount} baris data.
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>
            Header mengikuti konfigurasi kolom Department <strong>{deptName || 'aktif'}</strong>.
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" style={{ padding: '8px 20px' }} onClick={onClose}>
            Batal
          </button>
          <button
            className="btn-primary"
            style={{ padding: '8px 20px', background: '#188038', borderColor: '#188038', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleExport}
            disabled={isExporting || rowCount === 0}
          >
            {isExporting ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Mengekspor...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download {rowCount} Baris
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
