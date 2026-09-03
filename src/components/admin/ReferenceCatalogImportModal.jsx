/**
 * ReferenceCatalogImportModal.jsx
 *
 * Wizard 3-step untuk import Excel ke Reference Catalog (SRS v2.0 §7).
 *
 * Step 1 — Upload file Excel/CSV
 * Step 2 — Mapping kolom: pilih mana Item Code, mana Search Key, mana Data, mana yang Diabaikan
 * Step 3 — Preview hasil + Commit
 *
 * Fitur kunci:
 *   - Kolom columns_config (applies_to="reference_catalog") dibuat OTOMATIS dari header Excel
 *     jika belum ada — Admin tidak perlu buat kolom manual di Schema Builder dulu.
 *   - Auto-suggest role kolom berdasarkan nama header (mis. "Item Code", "Kode" → role Item Code)
 *   - Bulk insert via bulkAddCatalogEntries() — efisien untuk ratusan/ribuan baris
 */

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../../lib/db'
import { parseExcelFile } from '../../lib/excelEngine'
import { bulkAddCatalogEntries } from '../../lib/itemCodeEngine'
import { useToast } from '../../contexts/ToastContext'

/* ------------------------------------------------------------------ */
/*  Constants & Helpers                                                  */
/* ------------------------------------------------------------------ */

const ROLES = {
  ITEM_CODE:  'item_code',
  SEARCH_KEY: 'search_key',
  DATA:       'data',
  IGNORE:     'ignore',
}

const ROLE_LABELS = {
  [ROLES.ITEM_CODE]:  'Item Code \u2605',
  [ROLES.SEARCH_KEY]: 'Search Key \u2605',
  [ROLES.DATA]:       'Data Katalog',
  [ROLES.IGNORE]:     'Abaikan',
}

const ROLE_COLORS = {
  [ROLES.ITEM_CODE]:  { bg: '#e6f4ea', color: '#188038', border: '#a8d5b5' },
  [ROLES.SEARCH_KEY]: { bg: '#fff3e0', color: '#e37400', border: '#f9c74f' },
  [ROLES.DATA]:       { bg: '#e8f0fe', color: '#1a73e8', border: '#c2d7f7' },
  [ROLES.IGNORE]:     { bg: '#f1f3f4', color: '#80868b', border: '#dadce0' },
}

/**
 * Tebak role kolom berdasarkan nama header (heuristic auto-suggest).
 * Hanya menjadi default — Admin bisa ubah.
 */
function guessRole(header) {
  const h = header.toLowerCase().replace(/\s+/g, '')
  if (/itemcode|kodeitem|kode|code|partno|part_no|partnumber/.test(h)) return ROLES.ITEM_CODE
  if (/searchkey|keyword|key|deskripsi|description|spesifikasi|specification|nama/.test(h)) return ROLES.SEARCH_KEY
  return ROLES.DATA
}

/**
 * Build initial mapping: { [header]: role } dengan auto-guess,
 * pastikan hanya 1 item_code dan 1 search_key yang ter-assign otomatis.
 */
function buildInitialMapping(headers) {
  const mapping = {}
  let hasItemCode = false
  let hasSearchKey = false

  headers.forEach(h => {
    const guessed = guessRole(h)
    if (guessed === ROLES.ITEM_CODE) {
      if (!hasItemCode) { mapping[h] = ROLES.ITEM_CODE; hasItemCode = true }
      else mapping[h] = ROLES.DATA
    } else if (guessed === ROLES.SEARCH_KEY) {
      if (!hasSearchKey) { mapping[h] = ROLES.SEARCH_KEY; hasSearchKey = true }
      else mapping[h] = ROLES.DATA
    } else {
      mapping[h] = guessed
    }
  })
  return mapping
}

/* ------------------------------------------------------------------ */
/*  Step Indicator                                                       */
/* ------------------------------------------------------------------ */
function StepIndicator({ current }) {
  const steps = ['Upload File', 'Pemetaan Kolom', 'Preview & Simpan']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '24px' }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done = current > idx
        const active = current === idx
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700,
                background: done ? '#188038' : active ? '#1a73e8' : '#e8eaed',
                color: done || active ? '#fff' : '#80868b',
                transition: 'all 0.2s',
              }}>
                {done ? '\u2713' : idx}
              </div>
              <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, color: active ? '#1a73e8' : done ? '#188038' : '#80868b', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? '#188038' : '#e8eaed', margin: '0 6px', marginBottom: '18px', transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Upload                                                      */
/* ------------------------------------------------------------------ */
function Step1Upload({ onParsed }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Format tidak didukung. Gunakan .xlsx, .xls, atau .csv')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await parseExcelFile(file)
      if (!result.headers.length) throw new Error('Tidak ada kolom ditemukan di file.')
      if (!result.data.length) throw new Error('File tidak memiliki baris data.')
      onParsed(result, file.name)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onParsed])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1a73e8' : '#dadce0'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#e8f0fe' : '#fafbfc',
          transition: 'all 0.2s',
        }}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        {loading ? (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#x23F3;</div>
            <p style={{ margin: 0, color: '#5f6368', fontSize: '14px' }}>Memproses file...</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x1F4CA;</div>
            <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#1f2328', fontSize: '15px' }}>
              {dragging ? 'Lepas file di sini' : 'Tarik & Lepas file Excel'}
            </p>
            <p style={{ margin: 0, color: '#80868b', fontSize: '13px' }}>
              atau klik untuk memilih file &mdash; .xlsx, .xls, .csv
            </p>
          </div>
        )}
      </div>
      {error && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fce8e6', borderRadius: '8px', color: '#d93025', fontSize: '13px' }}>
          &#x26A0; {error}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Mapping Kolom                                               */
/* ------------------------------------------------------------------ */
function Step2Mapping({ headers, sampleRow, mapping, onChange, onNext, onBack }) {
  const itemCodeCols  = Object.entries(mapping).filter(([, r]) => r === ROLES.ITEM_CODE)
  const searchKeyCols = Object.entries(mapping).filter(([, r]) => r === ROLES.SEARCH_KEY)

  const canProceed = itemCodeCols.length === 1 && searchKeyCols.length === 1

  const setRole = (header, role) => {
    const next = { ...mapping }
    // Jika memilih item_code atau search_key, clear yang lama dulu (hanya boleh 1)
    if (role === ROLES.ITEM_CODE) {
      Object.keys(next).forEach(h => { if (next[h] === ROLES.ITEM_CODE) next[h] = ROLES.DATA })
    }
    if (role === ROLES.SEARCH_KEY) {
      Object.keys(next).forEach(h => { if (next[h] === ROLES.SEARCH_KEY) next[h] = ROLES.DATA })
    }
    next[header] = role
    onChange(next)
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#5f6368' }}>
        Tentukan peran setiap kolom Excel. Tepat <strong>1 kolom Item Code</strong> dan <strong>1 kolom Search Key</strong> wajib dipilih.
        Kolom yang belum ada akan <strong>dibuat otomatis</strong> &mdash; tidak perlu ke Schema Builder dulu.
      </p>

      {/* Validasi banner */}
      {!canProceed && (
        <div style={{ padding: '8px 12px', background: '#fff3e0', borderRadius: '6px', fontSize: '12px', color: '#e37400', marginBottom: '12px', border: '1px solid #f9c74f' }}>
          {itemCodeCols.length !== 1 && <div>&#x26A0; Pilih tepat 1 kolom sebagai <strong>Item Code</strong> (saat ini: {itemCodeCols.length})</div>}
          {searchKeyCols.length !== 1 && <div>&#x26A0; Pilih tepat 1 kolom sebagai <strong>Search Key</strong> (saat ini: {searchKeyCols.length})</div>}
        </div>
      )}

      {/* Tabel mapping */}
      <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#5f6368', fontWeight: 600, width: '32%' }}>Kolom Excel</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#5f6368', fontWeight: 600, width: '23%' }}>Contoh Nilai</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Peran</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header, i) => {
              const role = mapping[header] || ROLES.DATA
              const colors = ROLE_COLORS[role]
              return (
                <tr key={header} style={{ borderBottom: i < headers.length - 1 ? '1px solid #f1f3f4' : 'none', background: role === ROLES.IGNORE ? '#fafbfc' : '#fff' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <code style={{ fontSize: '12px', background: '#f1f3f4', padding: '2px 6px', borderRadius: '4px', color: '#1f2328' }}>
                      {header}
                    </code>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#5f6368', fontSize: '12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sampleRow ? String(sampleRow[header] ?? '\u2014') : '\u2014'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {Object.values(ROLES).map(r => (
                        <button
                          key={r}
                          onClick={() => setRole(header, r)}
                          style={{
                            padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                            border: `1px solid ${role === r ? colors.border : '#dadce0'}`,
                            background: role === r ? colors.bg : '#fff',
                            color: role === r ? colors.color : '#80868b',
                            transition: 'all 0.15s',
                          }}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn-secondary" onClick={onBack}>&larr; Kembali</button>
        <button className="btn-primary" onClick={onNext} disabled={!canProceed}
          style={{ opacity: canProceed ? 1 : 0.5, cursor: canProceed ? 'pointer' : 'not-allowed' }}>
          Lihat Preview &rarr;
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Preview & Commit                                            */
/* ------------------------------------------------------------------ */
function Step3Preview({ previewRows, totalRows, onCommit, onBack, committing }) {
  const PREVIEW_MAX = 5
  const shown = previewRows.slice(0, PREVIEW_MAX)
  const componentKeys = shown[0]?.componentKeys || []

  return (
    <div>
      <div style={{ padding: '10px 14px', background: '#e6f4ea', borderRadius: '8px', fontSize: '13px', color: '#188038', marginBottom: '14px', border: '1px solid #a8d5b5' }}>
        &#x2713; Siap mengimport <strong>{totalRows} entri</strong> ke Reference Catalog
        {totalRows > PREVIEW_MAX && ` (menampilkan ${PREVIEW_MAX} dari ${totalRows})`}
      </div>

      <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ overflowX: 'auto', maxHeight: '240px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: '#5f6368', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Search Key <span style={{ background: '#fff3e0', color: '#e37400', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px' }}>&#x2605;</span>
                </th>
                <th style={{ padding: '7px 12px', textAlign: 'left', color: '#5f6368', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Item Code <span style={{ background: '#e6f4ea', color: '#188038', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px' }}>&#x2605;</span>
                </th>
                {componentKeys.map(k => (
                  <th key={k} style={{ padding: '7px 12px', textAlign: 'left', color: '#5f6368', fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '6px 12px', color: '#1f2328' }}>{row.searchKey || '\u2014'}</td>
                  <td style={{ padding: '6px 12px' }}>
                    <code style={{ fontFamily: 'monospace', fontWeight: 600, color: '#188038', fontSize: '12px' }}>{row.itemCode || '\u2014'}</code>
                  </td>
                  {componentKeys.map(k => (
                    <td key={k} style={{ padding: '6px 12px', color: '#5f6368', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(row.components?.[k] ?? '\u2014')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#80868b', marginBottom: '16px', padding: '8px 12px', background: '#f8f9fa', borderRadius: '6px' }}>
        &#x2139; Kolom yang belum ada di Reference Catalog akan <strong>dibuat otomatis</strong>. Kamu bisa atur lebih lanjut di Schema Builder setelah import selesai.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn-secondary" onClick={onBack} disabled={committing}>&larr; Kembali</button>
        <button className="btn-primary" onClick={onCommit} disabled={committing}
          style={{ minWidth: '180px' }}>
          {committing ? '&#x23F3; Menyimpan...' : `\u2713 Commit Import (${totalRows} entri)`}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Modal                                                           */
/* ------------------------------------------------------------------ */
export default function ReferenceCatalogImportModal({ deptId, onClose }) {
  const { addToast } = useToast()
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [dataRows, setDataRows] = useState([])
  const [mapping, setMapping] = useState({})  // { [excelHeader]: role }
  const [committing, setCommitting] = useState(false)

  /* -------- Step 1 → 2 -------- */
  function handleParsed({ headers: h, data: d }, name) {
    setFileName(name)
    setHeaders(h)
    setDataRows(d)
    setMapping(buildInitialMapping(h))
    setStep(2)
  }

  /* Computed dari mapping state */
  const itemCodeHeader  = Object.keys(mapping).find(h => mapping[h] === ROLES.ITEM_CODE)
  const searchKeyHeader = Object.keys(mapping).find(h => mapping[h] === ROLES.SEARCH_KEY)
  const dataHeaders     = Object.keys(mapping).filter(h => mapping[h] === ROLES.DATA)

  function buildPreviewRows(rows) {
    return rows.map(row => ({
      itemCode:      String(row[itemCodeHeader] ?? '').trim(),
      searchKey:     String(row[searchKeyHeader] ?? '').trim(),
      components:    Object.fromEntries(dataHeaders.map(h => [h, row[h] ?? ''])),
      componentKeys: dataHeaders,
    }))
  }

  function countValidRows() {
    return dataRows.filter(row => {
      const code = String(row[itemCodeHeader] ?? '').trim()
      const sk   = String(row[searchKeyHeader] ?? '').trim()
      return code && sk
    }).length
  }

  /* -------- Commit --------
   * 1. Auto-create columns_config (applies_to="reference_catalog") dari header yang belum ada
   * 2. bulkAdd semua entri ke reference_catalog
   */
  async function handleCommit() {
    if (!deptId || !itemCodeHeader || !searchKeyHeader) return
    setCommitting(true)
    try {
      const now = new Date().toISOString()

      // --- 1. Ambil kolom ref_catalog yang sudah ada ---
      const existingRefCols = await db.columns_config
        .where('department_id').equals(deptId)
        .filter(c => c.applies_to === 'reference_catalog')
        .toArray()

      let maxOrder = existingRefCols.reduce((m, c) => Math.max(m, c.order ?? 0), 0)

      // Helper: normalize header → safe key (prefix ref_)
      const toSafeKey = h => 'ref_' + h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '')

      // Kolom yang perlu dipastikan ada: search key header + semua data headers
      const headersToEnsure = [
        { header: searchKeyHeader, isSearchKey: true },
        ...dataHeaders.map(h => ({ header: h, isSearchKey: false })),
      ]

      for (const { header, isSearchKey } of headersToEnsure) {
        const safeKey = toSafeKey(header)

        // Skip jika kolom dengan key atau label yang sama sudah ada
        const alreadyExists = existingRefCols.some(
          c => c.key === safeKey || c.label.toLowerCase() === header.toLowerCase()
        )
        if (alreadyExists) {
          // Jika ini search key dan kolom sudah ada tapi flag-nya belum set, set sekarang
          if (isSearchKey) {
            const existing = existingRefCols.find(
              c => c.key === safeKey || c.label.toLowerCase() === header.toLowerCase()
            )
            if (existing && !existing.is_search_key) {
              const prev = existingRefCols.find(c => c.is_search_key && c.id !== existing.id)
              if (prev) await db.columns_config.update(prev.id, { is_search_key: false })
              await db.columns_config.update(existing.id, { is_search_key: true })
            }
          }
          continue
        }

        // Jika isSearchKey: clear flag search_key dari kolom lain dulu
        if (isSearchKey) {
          const prevSK = existingRefCols.find(c => c.is_search_key)
          if (prevSK) await db.columns_config.update(prevSK.id, { is_search_key: false })
        }

        maxOrder++
        await db.columns_config.add({
          department_id: deptId,
          applies_to: 'reference_catalog',
          key: safeKey,
          label: header,
          type: 'text',
          select_options: [],
          is_required: false,
          is_visible: true,
          is_editable_by_pic: false,
          is_ref_trigger: false,
          is_search_key: isSearchKey,
          is_item_code_column: false,
          is_auto: false,
          is_readonly: false,
          order: maxOrder,
          created_at: now,
        })
      }

      // --- 2. Build entries & bulk insert ---
      const entries = dataRows
        .filter(row => {
          const code = String(row[itemCodeHeader] ?? '').trim()
          const sk   = String(row[searchKeyHeader] ?? '').trim()
          return code && sk
        })
        .map(row => ({
          itemCode:   String(row[itemCodeHeader] ?? '').trim(),
          searchKey:  String(row[searchKeyHeader] ?? '').trim(),
          components: Object.fromEntries(dataHeaders.map(h => [h, row[h] ?? ''])),
        }))

      const inserted = await bulkAddCatalogEntries(deptId, entries)
      addToast(`Berhasil mengimport ${inserted} entri ke Reference Catalog.`, 'success')
      onClose()
    } catch (err) {
      addToast('Import gagal: ' + err.message, 'error')
      console.error('[ReferenceCatalogImportModal] commit error:', err)
    } finally {
      setCommitting(false)
    }
  }

  const previewRows = step === 3 ? buildPreviewRows(dataRows) : []

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !committing) onClose() }}>
      <div
        className="modal-content"
        style={{ maxWidth: '740px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 className="modal-title" style={{ margin: 0, fontSize: '16px' }}>
              Import Excel &rarr; Reference Catalog
            </h3>
            {fileName && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#80868b' }}>
                File: <strong>{fileName}</strong>
                {dataRows.length > 0 && ` \u00B7 ${dataRows.length} baris ditemukan`}
              </p>
            )}
          </div>
          <button
            onClick={() => !committing && onClose()}
            style={{ background: 'none', border: 'none', cursor: committing ? 'not-allowed' : 'pointer', fontSize: '20px', color: '#80868b', padding: '0 4px', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Content per step */}
        {step === 1 && <Step1Upload onParsed={handleParsed} />}

        {step === 2 && (
          <Step2Mapping
            headers={headers}
            sampleRow={dataRows[0] || null}
            mapping={mapping}
            onChange={setMapping}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <Step3Preview
            previewRows={previewRows}
            totalRows={countValidRows()}
            onCommit={handleCommit}
            onBack={() => setStep(2)}
            committing={committing}
          />
        )}
      </div>
    </div>,
    document.body
  )
}
