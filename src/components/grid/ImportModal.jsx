/**
 * ImportModal.jsx
 *
 * Import Excel Wizard (4 Tahap) — SRS v2.0 §10.1
 *
 * Tahap 1: Upload file .xlsx / .csv
 * Tahap 2: Mapping header → kolom (auto-detect + manual override)
 *          - Header cocok → auto-mapped (tidak bisa diubah user)
 *          - Header TIDAK cocok + isAdmin → 3 opsi: buat kolom baru / petakan ke existing / abaikan
 *          - Header TIDAK cocok + bukan Admin → 2 opsi: petakan ke existing / abaikan
 *          - Tipe data + select_options editor jika "buat kolom baru" dipilih
 * Tahap 3: Validasi & Preview baris data
 * Tahap 4: Konfirmasi commit
 *          - Kolom baru dibuat via addColumn() SEBELUM baris ditulis
 *          - Collision key dicegah: check existing + check antar-kolom dalam batch
 *
 * RBAC: opsi "buat kolom baru" hanya muncul jika isAdmin=true (SRS §3, §10.1)
 *
 * Setelah commit:
 *   - import_batch_id tercatat di setiap baris
 *   - Tombol "Batalkan Import Ini" muncul via ImportUndoContext / toast
 */

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  parseExcelFile,
  mapHeadersToColumns,
  validateImportRows,
  rowToComponents,
  extractUniqueValues,
  NEW_COLUMN_SENTINEL,
} from '../../lib/excelEngine'
import { useDialog } from '../../contexts/DialogContext'
import { generateColumnKey } from '../../hooks/useDynamicSchema'
import { createImportBatch } from '../../lib/importUndo'
import { db } from '../../lib/db'

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
/*  SelectOptionsEditor — edit list of select_options untuk kolom baru */
/* ------------------------------------------------------------------ */
function SelectOptionsEditor({ options, onChange }) {
  const [newVal, setNewVal] = useState('')

  const addOption = () => {
    const v = newVal.trim()
    if (!v || options.includes(v)) return
    onChange([...options, v])
    setNewVal('')
  }

  const removeOption = (opt) => onChange(options.filter(o => o !== opt))

  return (
    <div style={{ marginTop: '8px', padding: '8px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e8eaed' }}>
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#5f6368' }}>
        Pilihan dropdown ({options.length} nilai):
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px', maxHeight: '80px', overflowY: 'auto' }}>
        {options.length === 0 ? (
          <span style={{ fontSize: '11px', color: '#80868b', fontStyle: 'italic' }}>Belum ada pilihan diekstrak.</span>
        ) : options.map(opt => (
          <span key={opt} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
            background: '#e8f0fe', color: '#1a73e8', fontWeight: 500,
          }}>
            {opt}
            <button
              onClick={() => removeOption(opt)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#80868b', padding: 0, lineHeight: 1, fontSize: '11px' }}
              title="Hapus pilihan ini"
            >×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
          placeholder="Tambah pilihan manual..."
          style={{ flex: 1, padding: '4px 6px', fontSize: '11px', border: '1px solid #dadce0', borderRadius: '4px', outline: 'none' }}
        />
        <button
          onClick={addOption}
          disabled={!newVal.trim()}
          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', opacity: newVal.trim() ? 1 : 0.5 }}
        >+ Tambah</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */

/**
 * @param {Object}   props
 * @param {Object[]} props.columns         - kolom existing dari useDynamicSchema (applies_to='records')
 * @param {Function} props.bulkInsertRows  - dari useGridData
 * @param {Function} props.addColumn       - dari useDynamicSchema — untuk buat kolom baru
 * @param {boolean}  props.isAdmin         - dari AuthContext — mengontrol opsi "buat kolom baru"
 * @param {string}   props.departmentId    - department aktif (wajib untuk addColumn)
 * @param {string}   [props.locationId]
 * @param {string}   [props.locationName]
 * @param {string}   [props.deptName]
 * @param {string}   [props.userId]
 * @param {Function} props.onClose
 * @param {Function} [props.onImported]    - callback({ batchId, rowCount }) setelah commit
 */
export default function ImportModal({
  columns,
  bulkInsertRows,
  addColumn,
  isAdmin = false,
  departmentId,
  locationId,
  locationName = '',
  deptName = '',
  userId = '',
  onClose,
  onImported,
}) {
  const { alert } = useDialog()
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [mapping, setMapping] = useState([])
  const [validation, setValidation] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState(null)
  const [parseError, setParseError] = useState(null)
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  // Filter kolom existing yang hanya untuk records (bukan ref catalog)
  const recordsColumns = columns.filter(c => !c.applies_to || c.applies_to === 'records')

  /* ---- Step 1: Upload ---- */
  const handleFileChange = useCallback(async (f) => {
    if (!f) return
    setFile(f)
    setParseError(null)
    setParsing(true)
    try {
      const result = await parseExcelFile(f)
      setParseResult(result)
      const mapped = mapHeadersToColumns(result.headers, recordsColumns)
      if (!isAdmin) {
        // Non-admin: semua kolom baru (NEW_COLUMN_SENTINEL) dijadikan null (diabaikan)
        // RBAC: hanya Admin yang boleh buat kolom baru (SRS §3)
        setMapping(mapped.map(m => m.isNew ? { ...m, colKey: null } : m))
      } else {
        setMapping(mapped)
      }
      setStep(2)
    } catch (err) {
      setParseError(err.message)
    } finally {
      setParsing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, isAdmin])

  const onFileInput = (e) => handleFileChange(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))) {
      handleFileChange(f)
    }
  }

  /* ---- Step 2: Mapping helpers ---- */

  const updateMapping = (fileHeader, newColKey) => {
    setMapping(prev => prev.map(m => {
      if (m.fileHeader !== fileHeader) return m
      const isNewCol = newColKey === NEW_COLUMN_SENTINEL
      return {
        ...m,
        colKey: newColKey || null,
        isNew: isNewCol,
        type: isNewCol ? (m.type || 'text') : (
          recordsColumns.find(c => c.key === newColKey)?.type || 'text'
        ),
        select_options: isNewCol ? m.select_options : [],
      }
    }))
  }

  const updateNewColType = (fileHeader, newType) => {
    setMapping(prev => prev.map(m => {
      if (m.fileHeader !== fileHeader || m.colKey !== NEW_COLUMN_SENTINEL) return m
      // Auto-extract unique values jika type=select (SRS §10.1 §2b)
      const select_options = newType === 'select'
        ? extractUniqueValues(parseResult?.data || [], fileHeader)
        : []
      return { ...m, type: newType, select_options }
    }))
  }

  const updateNewColOptions = (fileHeader, newOptions) => {
    setMapping(prev => prev.map(m =>
      m.fileHeader === fileHeader && m.colKey === NEW_COLUMN_SENTINEL
        ? { ...m, select_options: newOptions }
        : m
    ))
  }

  const proceedToValidation = () => {
    const result = validateImportRows(parseResult.data, mapping, recordsColumns)
    setValidation(result)
    setStep(3)
  }

  /* ---- Step 4: Commit ---- */
  const handleCommit = async () => {
    if (!validation?.rows?.length) return
    setCommitting(true)
    try {
      const newColumnMappings = mapping.filter(m => m.colKey === NEW_COLUMN_SENTINEL && isAdmin)

      // Ambil semua key existing untuk collision check (SRS §10.1 perhatian teknis 2)
      const existingKeys = new Set(
        (await db.columns_config
          .where('department_id').equals(departmentId)
          .toArray()
        ).map(c => c.key)
      )
      // Track key baru yang sudah di-generate dalam batch ini
      const newKeysInBatch = new Set()

      /**
       * Generate key aman: tidak bentrok dengan existing NOR dengan batch ini.
       * Tambahkan suffix _2, _3, dst. bila perlu (key bersifat immutable — SRS §5.2).
       */
      function generateSafeKey(label) {
        const base = generateColumnKey(label)
        let candidate = base
        let counter = 2
        while (existingKeys.has(candidate) || newKeysInBatch.has(candidate)) {
          candidate = `${base}_${counter}`
          counter++
        }
        newKeysInBatch.add(candidate)
        return candidate
      }

      // Buat kolom baru SEBELUM insert rows (SRS §10.1 — Tahap 4)
      const resolvedMapping = await Promise.all(
        mapping.map(async (m) => {
          if (m.colKey !== NEW_COLUMN_SENTINEL) return m

          // Safety gate: hanya admin yang boleh lewat sini
          if (!isAdmin) return { ...m, colKey: null }

          const newKey = generateSafeKey(m.fileHeader)

          await addColumn({
            key: newKey,
            label: m.fileHeader,
            type: m.type || 'text',
            applies_to: 'records',           // SRS §10.1: kolom import selalu untuk records
            is_required: false,              // default: tidak wajib
            is_visible: true,                // langsung tampil di grid
            is_editable_by_pic: true,        // PIC bisa isi
            is_ref_trigger: false,           // bukan kolom pemicu
            is_item_code_column: false,      // bukan kolom item code
            is_search_key: false,            // bukan kunci pencarian ref catalog
            is_auto: false,
            is_readonly: false,
            select_options: m.type === 'select' ? m.select_options : [],
          })

          return { ...m, colKey: newKey }
        })
      )

      // Filter baris valid + konversi ke components dengan resolvedMapping
      const rowsToInsert = validation.rows
        .filter(r => r._errors.length === 0)
        .map(r => rowToComponents(r, resolvedMapping))

      const batchId = await createImportBatch({
        locationId,
        departmentId,
        rowCount: rowsToInsert.length,
        importedBy: userId,
        columnMappingSnapshot: resolvedMapping,
      })

      await bulkInsertRows(rowsToInsert, batchId, userId)

      setCommitResult({
        batchId,
        rowCount: rowsToInsert.length,
        newColumnsCreated: newColumnMappings.length,
      })
      if (typeof onImported === 'function') onImported({ batchId, rowCount: rowsToInsert.length })
      setStep(4)
    } catch (err) {
      console.error('Import process failed:', err)
      alert({ title: 'Gagal Impor', message: 'Gagal mengimpor: ' + err.message, danger: true })
    } finally {
      setCommitting(false)
    }
  }

  /* ---- Computed stats ---- */
  const mappedCount = mapping.filter(m => m.colKey && m.colKey !== NEW_COLUMN_SENTINEL).length
  const newColCount = mapping.filter(m => m.colKey === NEW_COLUMN_SENTINEL).length
  const ignoredCount = mapping.filter(m => !m.colKey).length
  const hasInvalidSelect = isAdmin && mapping.some(
    m => m.colKey === NEW_COLUMN_SENTINEL && m.type === 'select' && (!m.select_options || m.select_options.length === 0)
  )

  /* ---- Render ---- */
  return createPortal(
    <div className="modal-backdrop" onClick={step < 4 ? undefined : onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '720px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
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
              <p style={{ fontSize: '13px', color: '#5f6368', marginBottom: '4px' }}>
                Ditemukan <strong>{parseResult.headers.length} kolom</strong> di file
                &ldquo;<strong>{file?.name}</strong>&rdquo;. Petakan ke kolom yang tersedia:
              </p>

              {/* Info RBAC untuk non-admin */}
              {!isAdmin && mapping.some(m => m.isNew) && (
                <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#fff8e1', border: '1px solid #f9ab00', borderRadius: '6px', fontSize: '12px', color: '#b06000' }}>
                  ⚠ <strong>{mapping.filter(m => m.isNew).length} header</strong> tidak cocok dengan kolom manapun.
                  Untuk membuat kolom baru otomatis, diperlukan akses Admin.
                  Petakan manual ke kolom existing atau abaikan.
                </div>
              )}

              <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #dadce0', width: '28%' }}>Header File Excel</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #dadce0' }}>Pemetaan & Konfigurasi</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #dadce0', width: '90px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapping.map((m, i) => (
                      <tr key={m.fileHeader} style={{
                        borderBottom: i < mapping.length - 1 ? '1px solid #f1f3f4' : 'none',
                        background: m.colKey === NEW_COLUMN_SENTINEL ? '#f0f6ff' : undefined,
                      }}>
                        {/* Header file */}
                        <td style={{ padding: '8px 12px', color: '#1f2328', fontWeight: 500, verticalAlign: 'top', paddingTop: '12px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f1f3f4', padding: '2px 5px', borderRadius: '3px' }}>
                            {m.fileHeader}
                          </span>
                        </td>

                        {/* Mapping & konfigurasi */}
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          {m.matched ? (
                            /* Auto-matched — tidak bisa diubah */
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#188038" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              <span style={{ color: '#188038', fontWeight: 500 }}>
                                {recordsColumns.find(c => c.key === m.colKey)?.label || m.label}
                              </span>
                              <span style={{ color: '#80868b', fontSize: '11px' }}>({m.type})</span>
                            </div>
                          ) : (
                            /* Belum terpetakan — user pilih */
                            <div>
                              <select
                                value={m.colKey || ''}
                                onChange={e => updateMapping(m.fileHeader, e.target.value || null)}
                                style={{
                                  width: '100%', padding: '5px 6px', fontSize: '12px',
                                  border: `1px solid ${m.colKey === NEW_COLUMN_SENTINEL ? '#1a73e8' : '#dadce0'}`,
                                  borderRadius: '4px', background: '#fff',
                                }}
                              >
                                <option value="">(Abaikan kolom ini)</option>
                                {isAdmin && (
                                  <option value={NEW_COLUMN_SENTINEL}>✦ Buat kolom baru dari header ini</option>
                                )}
                                <optgroup label="— Petakan ke kolom existing —">
                                  {recordsColumns.map(col => (
                                    <option key={col.key} value={col.key}>{col.label}</option>
                                  ))}
                                </optgroup>
                              </select>

                              {/* Konfigurasi tipe data kolom baru */}
                              {m.colKey === NEW_COLUMN_SENTINEL && (
                                <div style={{ marginTop: '6px' }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '11px', color: '#5f6368', whiteSpace: 'nowrap' }}>Tipe data:</label>
                                    <select
                                      value={m.type}
                                      onChange={e => updateNewColType(m.fileHeader, e.target.value)}
                                      style={{ padding: '3px 5px', fontSize: '11px', border: '1px solid #dadce0', borderRadius: '4px' }}
                                    >
                                      <option value="text">Teks</option>
                                      <option value="number">Angka</option>
                                      <option value="select">Pilihan (Select)</option>
                                    </select>
                                  </div>
                                  {m.type === 'select' && (
                                    <SelectOptionsEditor
                                      options={m.select_options || []}
                                      onChange={opts => updateNewColOptions(m.fileHeader, opts)}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status badge */}
                        <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'top', paddingTop: '12px' }}>
                          {m.matched ? (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: '#e6f4ea', color: '#188038', fontWeight: 500 }}>
                              ✓ Auto
                            </span>
                          ) : m.colKey === NEW_COLUMN_SENTINEL ? (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: '#e8f0fe', color: '#1a73e8', fontWeight: 500 }}>
                              ✦ Baru
                            </span>
                          ) : m.colKey ? (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: '#fef7e0', color: '#b06000', fontWeight: 500 }}>
                              → Manual
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

              {/* Summary */}
              <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f8f9fa', borderRadius: '6px', fontSize: '11px', color: '#5f6368', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>✓ {mappedCount} dipetakan</span>
                {isAdmin && newColCount > 0 && <span style={{ color: '#1a73e8' }}>✦ {newColCount} kolom baru akan dibuat</span>}
                {ignoredCount > 0 && <span>× {ignoredCount} diabaikan</span>}
              </div>

              {/* Warning kolom select tanpa options */}
              {hasInvalidSelect && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fff8e1', border: '1px solid #f9ab00', borderRadius: '6px', fontSize: '12px', color: '#b06000' }}>
                  ⚠ Ada kolom bertipe "Pilihan" yang belum memiliki opsi pilihan. Tambahkan minimal 1 opsi atau ganti tipenya.
                </div>
              )}
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
                {isAdmin && newColCount > 0 && (
                  <div style={{ padding: '10px 16px', borderRadius: '8px', background: '#e8f0fe', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a73e8' }}>{newColCount}</div>
                    <div style={{ fontSize: '11px', color: '#1a73e8' }}>Kolom Baru</div>
                  </div>
                )}
              </div>

              {/* Info kolom baru */}
              {isAdmin && newColCount > 0 && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#e8f0fe', borderRadius: '8px', border: '1px solid #1a73e8', fontSize: '12px', color: '#1a73e8' }}>
                  <strong>✦ {newColCount} kolom baru akan dibuat:</strong>{' '}
                  {mapping.filter(m => m.colKey === NEW_COLUMN_SENTINEL).map(m => (
                    <span key={m.fileHeader} style={{ fontFamily: 'monospace', marginLeft: '4px', background: '#c5d8ff', padding: '1px 5px', borderRadius: '3px' }}>
                      {m.fileHeader} ({m.type})
                    </span>
                  ))}
                  <br />
                  <span style={{ fontSize: '11px', color: '#5f6368', marginTop: '4px', display: 'block' }}>
                    Kolom akan dibuat di schema Department sebelum data dimasukkan.
                  </span>
                </div>
              )}

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
                      {/* Kolom aktif: dipetakan (termasuk kolom baru dengan sentinel) */}
                      {mapping.filter(m => m.colKey).map(m => (
                        <th key={m.fileHeader} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #dadce0', whiteSpace: 'nowrap' }}>
                          {m.colKey === NEW_COLUMN_SENTINEL
                            ? <span style={{ color: '#1a73e8' }}>✦ {m.fileHeader}</span>
                            : (recordsColumns.find(c => c.key === m.colKey)?.label || m.fileHeader)
                          }
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
              {commitResult.newColumnsCreated > 0 && (
                <div style={{ marginBottom: '12px', padding: '10px', background: '#e8f0fe', borderRadius: '8px', fontSize: '13px', color: '#1a73e8' }}>
                  ✦ <strong>{commitResult.newColumnsCreated}</strong> kolom baru berhasil dibuat di schema Department.
                </div>
              )}
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
              <button
                className="btn-primary"
                style={{ padding: '8px 18px', opacity: hasInvalidSelect ? 0.5 : 1 }}
                onClick={proceedToValidation}
                disabled={hasInvalidSelect}
                title={hasInvalidSelect ? 'Kolom select harus memiliki minimal 1 pilihan' : ''}
              >
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
                {committing
                  ? 'Mengimpor...'
                  : `Import ${validation?.rows?.filter(r => r._errors.length === 0).length || 0} Baris${newColCount > 0 ? ` + Buat ${newColCount} Kolom` : ''}`
                }
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