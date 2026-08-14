/**
 * ImportExcel.jsx 鈥?Refactor SRS v2.0
 *
 * Alur 4-Tahap Import yang sepenuhnya dinamis (tidak ada STANDARD_COLUMNS hardcoded):
 *   Tahap 1: Pilih Department tujuan + Upload file Excel/CSV
 *   Tahap 2: Mapping kolom Excel 鈫?columns_config Department tujuan
 *   Tahap 3: Validasi baris menggunakan evaluateRowCompleteness (dinamis)
 *   Tahap 4: Konfirmasi & Commit ke Dexie via useGridData.bulkInsertRows()
 *
 * SRS v2.0 搂10.1
 */

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { evaluateRowCompleteness } from '../hooks/useRowCompleteness'
import { logActivity } from '../lib/activityLog'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

/* ------------------------------------------------------------------ */
/*  Step indicator                                                       */
/* ------------------------------------------------------------------ */
const STEP_LABELS = [
  'Pilih Department & File',
  'Pemetaan Kolom',
  'Validasi Data',
  'Konfirmasi Import',
]

function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '24px' }}>
      {STEP_LABELS.map((label, i) => {
        const num = i + 1
        const done = step > num
        const active = step === num
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: done ? '#188038' : active ? '#0969da' : '#e8eaed',
                color: done || active ? '#fff' : '#5f6368',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0,
              }}>
                {done ? '\u2713' : num}
              </div>
              <span style={{ fontSize: '11px', color: active ? '#0969da' : '#5f6368', marginTop: '4px', textAlign: 'center', lineHeight: 1.2 }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? '#188038' : '#e8eaed', margin: '0 4px', marginBottom: '20px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Utility                                                              */
/* ------------------------------------------------------------------ */
function isEmpty(val) {
  return val === null || val === undefined || String(val).trim() === ''
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function ImportExcel() {
  const [step, setStep] = useState(1)

  // Tahap 1
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [parsedSheets, setParsedSheets] = useState([]) // [{name, headers, rows}]

  // Tahap 2
  const [colMapping, setColMapping] = useState({}) // { col_key: excelHeaderName }

  // Tahap 3
  const [validationResult, setValidationResult] = useState(null) // { validRows, invalidRows }

  // Tahap 4
  const [isImporting, setIsImporting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fileInputRef = useRef(null)
  const { addToast } = useToast()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  // Live queries dari Dexie
  const departments = useLiveQuery(() => db.departments_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], []) ?? []
  const locations = useLiveQuery(
    () => selectedDeptId ? db.locations_cache.where('department_id').equals(selectedDeptId).toArray() : [],
    [selectedDeptId], []
  ) ?? []
  const deptColumns = useLiveQuery(
    () => selectedDeptId
      ? db.columns_config.where('department_id').equals(selectedDeptId).sortBy('order')
      : [],
    [selectedDeptId], []
  ) ?? []
  const exceptionRules = useLiveQuery(
    () => selectedDeptId
      ? db.completion_exception_rules.where('department_id').equals(selectedDeptId).toArray()
      : [],
    [selectedDeptId], []
  ) ?? []

  // Visible columns for mapping (tidak include auto-generated)
  const mappableColumns = deptColumns.filter(c => !c.is_auto && c.is_visible !== false)

  /* ---------------------------------------------------------------- */
  /*  File Parsing                                                       */
  /* ---------------------------------------------------------------- */
  const processFile = useCallback((file) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      addToast('File harus berupa format Excel (.xlsx/.xls) atau CSV', 'error')
      return
    }
    if (!selectedDeptId) {
      addToast('Pilih Department tujuan terlebih dahulu.', 'error')
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' })
        const sheets = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name]
          const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
          const headers = (raw[0] || []).map(h => String(h).trim()).filter(Boolean)
          const rows = raw.slice(1).filter(row => row.some(cell => !isEmpty(cell)))
          return { name, headers, rows }
        }).filter(s => s.rows.length > 0)

        if (sheets.length === 0) {
          addToast('File tidak memiliki data yang bisa diproses.', 'error')
          return
        }

        setParsedSheets(sheets)

        // Auto-mapping: cocokkan header Excel dengan label / key kolom
        const initialMapping = {}
        mappableColumns.forEach(col => {
          const allHeaders = sheets.flatMap(s => s.headers)
          const match = allHeaders.find(h => {
            const hn = h.toLowerCase().trim()
            return hn === col.label.toLowerCase().trim() || hn === col.key.toLowerCase()
          })
          initialMapping[col.key] = match || ''
        })
        setColMapping(initialMapping)
        setStep(2)
        addToast(`File "${file.name}" berhasil diparsing (${sheets.reduce((s, sh) => s + sh.rows.length, 0)} baris).`, 'success')
      } catch (err) {
        console.error(err)
        addToast('Gagal membaca file Excel: ' + err.message, 'error')
      }
    }
    reader.readAsBinaryString(file)
  }, [selectedDeptId, mappableColumns, addToast])

  /* ---------------------------------------------------------------- */
  /*  Validation (Tahap 3)                                              */
  /* ---------------------------------------------------------------- */
  function runValidation() {
    const allRows = parsedSheets.flatMap(sheet =>
      sheet.rows.map((row, idx) => {
        // Gabungkan header 鈫?value dari semua sheet
        const rowObj = {}
        sheet.headers.forEach((h, i) => {
          rowObj[h] = row[i] !== undefined ? String(row[i]).trim() : ''
        })

        // Konversi ke format components berdasarkan mapping
        const components = {}
        mappableColumns.forEach(col => {
          const excelHeader = colMapping[col.key]
          if (excelHeader && rowObj[excelHeader] !== undefined) {
            let val = rowObj[excelHeader]
            if (col.type === 'number' && val !== '') {
              const num = Number(String(val).replace(',', '.'))
              val = isNaN(num) ? val : num
            }
            components[col.key] = val
          }
        })

        return {
          sheetName: sheet.name,
          rowIndex: idx + 2, // Excel 1-indexed + header row
          components,
        }
      })
    )

    const validRows = []
    const invalidRows = []

    allRows.forEach(r => {
      const isComplete = evaluateRowCompleteness(r.components, deptColumns, exceptionRules)
      if (isComplete) {
        validRows.push(r)
      } else {
        // Temukan kolom apa yang kosong tapi wajib
        const missingCols = deptColumns
          .filter(col => col.is_required && !col.is_auto)
          .filter(col => {
            // Cek exception rules
            const anyRuleMatch = exceptionRules.some(rule => {
              const condVal = String(r.components[rule.condition_column_key] ?? '').trim().toLowerCase()
              const expectedVal = String(rule.condition_value ?? '').trim().toLowerCase()
              return condVal === expectedVal && rule.exempt_column_keys?.includes(col.key)
            })
            if (anyRuleMatch) return false
            const val = r.components[col.key]
            return val === null || val === undefined || val === ''
          })
          .map(col => col.label)
        invalidRows.push({ ...r, missingCols })
      }
    })

    setValidationResult({ validRows, invalidRows, allRows })
    setStep(3)
  }

  /* ---------------------------------------------------------------- */
  /*  Commit Import (Tahap 4)                                           */
  /* ---------------------------------------------------------------- */
  async function handleCommitImport() {
    setShowConfirm(false)
    setIsImporting(true)

    try {
      const importBatchId = Date.now()
      const now = new Date().toISOString()
      const userId = currentUser?.email || currentUser?.id || ''

      // Gunakan lokasi pertama dari department terpilih sebagai default
      // (di implementasi penuh, user bisa pilih per-sheet)
      const defaultLocation = locations[0]
      if (!defaultLocation) {
        addToast('Tidak ada lokasi untuk department ini. Tambahkan lokasi di Admin 鈫?Hierarki.', 'error')
        setIsImporting(false)
        return
      }

      // Tulis langsung ke Dexie (offline-first)
      const allValidRows = validationResult?.validRows || []
      const rowsToInsert = allValidRows.map(r => ({
        location_id: defaultLocation.id,
        department_id: selectedDeptId,
        pb_id: null,
        components: r.components,
        status_completeness: true,
        flag: null,
        flag_note: null,
        isDeleted: false,
        deletedAt: null,
        import_batch_id: importBatchId,
        created_by: userId,
        last_edited_by: userId,
        created_at: now,
        lastUpdated: now,
        sync_status: 'pending',
      }))

      await db.transaction('rw', [db.records, db.sync_queue], async () => {
        for (const row of rowsToInsert) {
          const newId = await db.records.add(row)
          await db.sync_queue.add({
            entity_type: 'record',
            entity_id: newId,
            pb_id: null,
            operation: 'create',
            payload: { ...row, id: newId },
            status: 'pending',
            retry_count: 0,
            created_at: now,
            last_attempt_at: null,
            error_message: null,
          })
        }
      })

      logActivity('import_excel', userId, {
        importBatchId,
        totalRows: rowsToInsert.length,
        department_id: selectedDeptId,
        location_id: defaultLocation.id,
      })

      addToast(`Import selesai! ${rowsToInsert.length} baris berhasil ditambahkan.`, 'success', { duration: 8000 })
      resetAll()
    } catch (err) {
      console.error(err)
      addToast('Import gagal: ' + err.message, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  function resetAll() {
    setStep(1)
    setFileName('')
    setParsedSheets([])
    setColMapping({})
    setValidationResult(null)
  }

  /* ---------------------------------------------------------------- */
  /*  Derived stats                                                      */
  /* ---------------------------------------------------------------- */
  const totalExcelRows = parsedSheets.reduce((s, sh) => s + sh.rows.length, 0)
  const allExcelHeaders = [...new Set(parsedSheets.flatMap(s => s.headers))]
  const unmappedRequired = mappableColumns.filter(c => c.is_required && !colMapping[c.key])

  /* ---------------------------------------------------------------- */
  /*  Render                                                             */
  /* ---------------------------------------------------------------- */
  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e1e4e8', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => navigate('/')}>&larr;</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2328', margin: 0 }}>Import Data Excel</h1>
          <p style={{ fontSize: '13px', color: '#5f6368', margin: '4px 0 0' }}>
            Tahap {step} dari {STEP_LABELS.length}: {STEP_LABELS[step - 1]}
          </p>
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <StepBar step={step} />

        {/* ---- Tahap 1: Pilih Department & Upload File ---- */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Department selector */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
                1. Pilih Department Tujuan
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#5f6368' }}>
                Kolom yang tersedia saat mapping akan disesuaikan dengan konfigurasi department ini.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {departments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#cf222e' }}>Belum ada department. Tambahkan di Admin &rarr; Hierarki.</p>
                ) : departments.map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    style={{
                      padding: '8px 16px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer',
                      border: `1.5px solid ${selectedDeptId === dept.id ? '#188038' : '#dadce0'}`,
                      background: selectedDeptId === dept.id ? '#e6f4ea' : '#fff',
                      color: selectedDeptId === dept.id ? '#188038' : '#5f6368',
                      fontWeight: selectedDeptId === dept.id ? 600 : 400,
                    }}
                  >
                    {dept.name}
                    {selectedDeptId === dept.id && <span style={{ marginLeft: '6px' }}>{'\u2713'}</span>}
                  </button>
                ))}
              </div>
              {selectedDeptId && (
                <p style={{ fontSize: '12px', color: '#5f6368', margin: '8px 0 0' }}>
                  {deptColumns.length} kolom tersedia &bull; {mappableColumns.filter(c => c.is_required).length} kolom wajib
                </p>
              )}
            </div>

            {/* File upload */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
                2. Upload File Excel / CSV
              </h3>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]) }}
                onClick={() => selectedDeptId ? fileInputRef.current?.click() : addToast('Pilih department dulu.', 'error')}
                style={{
                  border: `2px dashed ${isDragging ? '#0969da' : selectedDeptId ? '#d0d7de' : '#e8eaed'}`,
                  borderRadius: '8px', padding: '48px 24px', textAlign: 'center',
                  background: isDragging ? '#f3f8ff' : '#fafbfc', cursor: selectedDeptId ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s', opacity: selectedDeptId ? 1 : 0.6,
                }}
              >
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx,.xls,.csv" onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: '#1f2328' }}>
                  {selectedDeptId ? 'Seret file ke sini, atau klik untuk memilih' : 'Pilih department terlebih dahulu'}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#5f6368' }}>Format: .xlsx, .xls, .csv</p>
              </div>
            </div>
          </div>
        )}

        {/* ---- Tahap 2: Mapping Kolom ---- */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>Pemetaan Kolom</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>
                  File: <strong>{fileName}</strong> &bull; {totalExcelRows} baris ditemukan.
                  Petakan setiap kolom sistem ke kolom Excel yang sesuai.
                </p>
              </div>
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {mappableColumns.map(col => (
                  <div key={col.key}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: '4px' }}>
                      {col.label}
                      {col.is_required && <span style={{ color: '#cf222e', marginLeft: '3px' }}>*</span>}
                      <span style={{ marginLeft: '6px', fontSize: '10px', color: '#80868b', fontWeight: 400 }}>({col.type})</span>
                    </label>
                    <select
                      value={colMapping[col.key] || ''}
                      onChange={e => setColMapping(prev => ({ ...prev, [col.key]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: `1px solid ${colMapping[col.key] ? '#188038' : col.is_required ? '#cf222e' : '#d0d7de'}`, borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="">-- Abaikan / Tidak Ada --</option>
                      {allExcelHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {unmappedRequired.length > 0 && (
                <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: '#ffebe9', border: '1px solid #cf222e', borderRadius: '6px', fontSize: '13px', color: '#cf222e' }}>
                  鈿狅笍 Kolom wajib belum dipetakan: <strong>{unmappedRequired.map(c => c.label).join(', ')}</strong>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={resetAll} style={{ padding: '8px 16px' }}>Mulai Ulang</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={() => setStep(1)} style={{ padding: '8px 16px' }}>鈫?Kembali</button>
                <button className="btn-primary" onClick={runValidation} style={{ padding: '8px 16px' }}>
                  Lanjut ke Validasi 鈫?                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- Tahap 3: Validasi ---- */}
        {step === 3 && validationResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Summary */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>Ringkasan Validasi</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>
                  Evaluasi kelengkapan baris berdasarkan konfigurasi department & aturan pengecualian.
                </p>
              </div>
              <div style={{ padding: '20px', display: 'flex', gap: '16px' }}>
                {[
                  { label: 'Baris Lengkap \u2713', value: validationResult.validRows.length, color: '#1a7f37', bg: '#e6f4ea' },
                  { label: 'Baris Tidak Lengkap', value: validationResult.invalidRows.length, color: validationResult.invalidRows.length > 0 ? '#cf222e' : '#5f6368', bg: validationResult.invalidRows.length > 0 ? '#ffebe9' : '#f6f8fa' },
                  { label: 'Total Baris', value: validationResult.allRows.length, color: '#1f2328', bg: '#f6f8fa' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, padding: '16px', background: s.bg, borderRadius: '8px', textAlign: 'center', border: `1px solid ${s.color}30` }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error detail */}
            {validationResult.invalidRows.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #cf222e', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', background: '#ffebe9', borderBottom: '1px solid #ffc4be', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#cf222e' }}>鈿?Baris dengan Data Tidak Lengkap</span>
                  <span style={{ fontSize: '12px', color: '#5f6368' }}>
                    (Baris ini <strong>tetap akan diimpor</strong> 鈥?harap lengkapi data kemudian)
                  </span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Sheet / Baris Excel</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Kolom Wajib yang Kosong</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.invalidRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f3f4', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '8px 12px', color: '#cf222e', fontWeight: 600 }}>{r.sheetName} 路 Baris {r.rowIndex}</td>
                          <td style={{ padding: '8px 12px', color: '#5f6368' }}>
                            {r.missingCols.map(mc => (
                              <span key={mc} style={{ display: 'inline-block', background: '#ffebe9', color: '#cf222e', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', marginRight: '4px' }}>{mc}</span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: '#fff', border: '1px solid #d0d7de', borderRadius: '8px' }}>
              <button className="btn-secondary" onClick={() => setStep(2)} style={{ padding: '8px 16px' }}>鈫?Kembali ke Mapping</button>
              <button
                className="btn-primary"
                onClick={() => setShowConfirm(true)}
                style={{ padding: '8px 20px' }}
                disabled={validationResult.validRows.length === 0}
              >
                Import {validationResult.validRows.length} Baris Sekarang 鈫?              </button>
            </div>
          </div>
        )}
      </main>

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmDeleteModal
          title="Konfirmasi Import Data"
          itemLabel={`${validationResult?.validRows?.length || 0} baris ke department yang dipilih`}
          warningText={`Data akan ditambahkan ke lokasi pertama di department ini. Proses tidak dapat dibatalkan secara otomatis.`}
          confirmText="Ya, Import Sekarang"
          onConfirm={handleCommitImport}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {isImporting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #e6f4ea', borderTop: '3px solid #188038', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <style>{`@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }`}</style>
            <p style={{ margin: 0, color: '#1f2328', fontWeight: 500 }}>Menyimpan data ke perangkat...</p>
          </div>
        </div>
      )}
    </div>
  )
}
