/**
 * ImportModal.jsx
 *
 * Import Excel Wizard (4 Tahap) — SRS v2.0 §10.1
 *
 * Tahap 1: Upload file .xlsx / .csv
 * Tahap 2: Mapping header → kolom (auto-detect + manual override)
 * Tahap 3: Validasi & Preview baris data
 * Tahap 4: Konfirmasi commit & insert ke Dexie via bulkInsertRows
 *
 * Setelah commit:
 *   - import_batch_id tercatat di setiap baris
 *   - Tombol "Batalkan Import Ini" muncul via ImportUndoContext / toast
 */

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { parseExcelFile, mapHeadersToColumns, validateImportRows, rowToComponents } from '../../lib/excelEngine'
import { createImportBatch } from '../../lib/importUndo'

const STEP_LABELS = ['Upload File', 'Pemetaan Kolom', 'Validasi', 'Konfirmasi']

/* ------------------------------------------------------------------ */
/*  Step Indicator                                                       */
/* ------------------------------------------------------------------ */
function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
      {STEP_LABELS.map((label, idx) => {
        const step = idx + 1
        const isActive = step === currentStep
        const isDone = step < currentStep
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: step < STEP_LABELS.length ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 600,
                background: isDone ? '#188038' : isActive ? '#1a73e8' : '#f1f3f4',
                color: isDone || isActive ? '#fff' : '#80868b',
                transition: 'all 0.2s',
              }}>
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : step}
              </div>
              <span style={{ fontSize: '10px', color: isActive ? '#1a73e8' : '#80868b', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {step < STEP_LABELS.length && (
              <div style={{ flex: 1, height: '2px', background: isDone ? '#188038' : '#e8eaed', margin: '0 6px', marginBottom: '18px', transition: 'background 0.2s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */

/**
 * @param {Object}   props
 * @param {Object[]} props.columns         - kolom dari useDynamicSchema
 * @param {Function} props.bulkInsertRows  - dari useGridData
 * @param {string}   [props.locationId]
 * @param {string}   [props.departmentId]
 * @param {string}   [props.locationName]
 * @param {string}   [props.deptName]
 * @param {string}   [props.userId]
 * @param {Function} props.onClose
 * @param {Function} [props.onImported]    - callback({ batchId, rowCount }) setelah commit
 */
export default function ImportModal({
  columns,
  bulkInsertRows,
  locationId,
  departmentId,
  locationName = '',
  deptName = '',
  userId = '',
  onClose,
  onImported,
}) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState(null) // { headers, data, sheetName }
  const [mapping, setMapping] = useState([])           // mapHeadersToColumns result
  const [validation, setValidation] = useState(null)   // { valid, rows, errors }
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState(null)
  const [parseError, setParseError] = useState(null)
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  /* ---- Step 1: Upload ---- */
  const handleFileChange = useCallback(async (f) => {
    if (!f) return
    setFile(f)
    setParseError(null)
    setParsing(true)
    try {
      const result = await parseExcelFile(f)
      setParseResult(result)
      // Auto-generate mapping
      const mapped = mapHeadersToColumns(result.headers, columns)
      setMapping(mapped)
      setStep(2)
    } catch (err) {
      setParseError(err.message)
    } finally {
      setParsing(false)
    }
  }, [columns])

  const onFileInput = (e) => handleFileChange(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))) {
      handleFileChange(f)
    }
  }

  /* ---- Step 2: Mapping — pilih colKey untuk unmapped header ---- */
  const updateMapping = (fileHeader, newColKey) => {
    setMapping(prev => prev.map(m =>
      m.fileHeader === fileHeader
        ? { ...m, colKey: newColKey, matched: Boolean(newColKey), isNew: !newColKey }
        : m
    ))
  }

  const proceedToValidation = () => {
    const result = validateImportRows(parseResult.data, mapping, columns)
    setValidation(result)
    setStep(3)
  }

  /* ---- Step 4: Commit ---- */
  const handleCommit = async () => {
    if (!validation?.rows?.length) return
    setCommitting(true)
    try {
      // Filter hanya baris tanpa error (atau semua jika valid)
      const rowsToInsert = validation.rows
        .filter(r => r._errors.length === 0)
        .map(r => rowToComponents(r, mapping))

      // Buat batch record dulu
      const batchId = await createImportBatch({
        locationId,
        departmentId,
        rowCount: rowsToInsert.length,
        importedBy: userId,
        columnMappingSnapshot: mapping,
      })

      // Bulk insert
      await bulkInsertRows(rowsToInsert, batchId, userId)

      setCommitResult({ batchId, rowCount: rowsToInsert.length })
      if (typeof onImported === 'function') onImported({ batchId, rowCount: rowsToInsert.length })
      setStep(4)
    } catch (err) {
      alert('Gagal mengimpor: ' + err.message)
    } finally {
      setCommitting(false)
    }
  }

  /* ---- Render ---- */
  return createPortal(
    <div className="modal-backdrop" onClick={step < 4 ? undefined : onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '700px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2328' }}>Import Excel</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#5f6368' }}>
                {deptName}{locationName ? ` — ${locationName}` : ''}
              </p>
            </div>
          </div>
          {step < 4 && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#80868b', padding: '4px', borderRadius: '4px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <StepIndicator currentStep={step} />

        {/* Step content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ---- Step 1: Upload ---- */}
          {step === 1 && (
            <div>
              <div
                ref={dropRef}
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                style={{
                  border: '2px dashed #dadce0', borderRadius: '12px',
                  padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#80868b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={{ margin: 0, fontWeight: 600, color: '#1f2328', fontSize: '14px' }}>
                  Seret file ke sini atau klik untuk memilih
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#80868b' }}>
                  Mendukung: .xlsx, .xls, .csv — Maks 10MB
                </p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFileInput} />
              </div>

              {parsing && (
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a73e8', fontSize: '13px' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #e8f0fe', borderTop: '2px solid #1a73e8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Membaca file...
                </div>
              )}
              {parseError && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fce8e6', borderRadius: '8px', color: '#d93025', fontSize: '13px' }}>
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* ---- Step 2: Mapping ---- */}
          {step === 2 && parseResult && (
            <div>
              <p style={{ fontSize: '13px', color: '#5f6368', marginBottom: '12px' }}>
                Ditemukan <strong>{parseResult.headers.length} kolom</strong> di file
                &ldquo;<strong>{file?.name}</strong>&rdquo;. Petakan ke kolom yang tersedia:
              </p>
              <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #dadce0', width: '35%' }}>Header File Excel</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #dadce0' }}>Petakan ke Kolom</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #dadce0', width: '80px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapping.map((m, i) => (
                      <tr key={m.fileHeader} style={{ borderBottom: i < mapping.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                        <td style={{ padding: '8px 12px', color: '#1f2328', fontWeight: 500 }}>
                          {m.fileHeader}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <select
                            value={m.colKey || ''}
                            onChange={e => updateMapping(m.fileHeader, e.target.value || null)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px' }}
                          >
                            <option value="">(Abaikan kolom ini)</option>
                            {columns.map(col => (
                              <option key={col.key} value={col.key}>{col.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {m.colKey ? (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: '#e6f4ea', color: '#188038', fontWeight: 500 }}>
                              ✓ Terpetakan
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: '#f1f3f4', color: '#80868b', fontWeight: 500 }}>
                              Diabaikan
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: '10px', fontSize: '11px', color: '#80868b' }}>
                {mapping.filter(m => m.colKey).length} dari {mapping.length} header dipetakan.
                Kolom yang diabaikan tidak akan diimpor.
              </p>
            </div>
          )}

          {/* ---- Step 3: Validasi & Preview ---- */}
          {step === 3 && validation && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ padding: '10px 16px', borderRadius: '8px', background: '#e6f4ea', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#188038' }}>{validation.rows.filter(r => r._errors.length === 0).length}</div>
                  <div style={{ fontSize: '11px', color: '#188038' }}>Baris Valid</div>
                </div>
                <div style={{ padding: '10px 16px', borderRadius: '8px', background: validation.errors.length ? '#fce8e6' : '#f1f3f4', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: validation.errors.length ? '#d93025' : '#80868b' }}>{validation.rows.filter(r => r._errors.length > 0).length}</div>
                  <div style={{ fontSize: '11px', color: validation.errors.length ? '#d93025' : '#80868b' }}>Baris Bermasalah</div>
                </div>
                <div style={{ padding: '10px 16px', borderRadius: '8px', background: '#e8f0fe', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a73e8' }}>{validation.rows.length}</div>
                  <div style={{ fontSize: '11px', color: '#1a73e8' }}>Total Baris</div>
                </div>
              </div>

              {/* Error list */}
              {validation.errors.length > 0 && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef7e0', borderRadius: '8px', border: '1px solid #f9ab00' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#b06000' }}>
                    ⚠ {validation.errors.length} masalah ditemukan. Baris bermasalah akan dilewati saat import.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#80868b', maxHeight: '80px', overflowY: 'auto' }}>
                    {validation.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                    {validation.errors.length > 10 && <li>...dan {validation.errors.length - 10} masalah lainnya</li>}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              <p style={{ fontSize: '12px', color: '#5f6368', marginBottom: '8px' }}>Preview data (5 baris pertama):</p>
              <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '500px' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr style={{ background: '#f8f9fa' }}>
                      {mapping.filter(m => m.colKey).map(m => (
                        <th key={m.fileHeader} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #dadce0', whiteSpace: 'nowrap' }}>
                          {columns.find(c => c.key === m.colKey)?.label || m.fileHeader}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validation.rows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} style={{ background: row._errors.length ? '#fce8e6' : undefined, borderBottom: '1px solid #f1f3f4' }}>
                        {mapping.filter(m => m.colKey).map(m => (
                          <td key={m.fileHeader} style={{ padding: '5px 10px', color: '#1f2328' }}>
                            {String(row[m.fileHeader] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---- Step 4: Sukses ---- */}
          {step === 4 && commitResult && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#188038" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#188038' }}>Import Berhasil!</h3>
              <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#5f6368' }}>
                <strong>{commitResult.rowCount}</strong> baris berhasil diimpor ke{' '}
                <strong>{locationName}</strong>.
              </p>
              <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', fontSize: '12px', color: '#80868b', textAlign: 'left' }}>
                <p style={{ margin: 0 }}>
                  Batch ID: <code style={{ background: '#e8eaed', padding: '1px 6px', borderRadius: '4px' }}>#{commitResult.batchId}</code>
                </p>
                <p style={{ margin: '4px 0 0' }}>
                  Jika data tidak sesuai, Anda bisa membatalkan import ini lewat notifikasi yang muncul.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigasi */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', flexShrink: 0, paddingTop: '16px', borderTop: '1px solid #f1f3f4' }}>
          <div>
            {step > 1 && step < 4 && (
              <button className="btn-secondary" style={{ padding: '8px 18px' }} onClick={() => setStep(s => s - 1)}>
                ← Kembali
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step < 4 && (
              <button className="btn-secondary" style={{ padding: '8px 18px' }} onClick={onClose}>
                Batal
              </button>
            )}
            {step === 2 && (
              <button className="btn-primary" style={{ padding: '8px 18px' }} onClick={proceedToValidation}>
                Validasi Data →
              </button>
            )}
            {step === 3 && (
              <button
                className="btn-primary"
                style={{ padding: '8px 18px', background: '#188038', borderColor: '#188038' }}
                onClick={handleCommit}
                disabled={committing || validation?.rows?.filter(r => r._errors.length === 0).length === 0}
              >
                {committing ? 'Mengimpor...' : `Import ${validation?.rows?.filter(r => r._errors.length === 0).length || 0} Baris`}
              </button>
            )}
            {step === 4 && (
              <button className="btn-primary" style={{ padding: '8px 18px' }} onClick={onClose}>
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
