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

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { evaluateRowCompleteness } from '../hooks/useRowCompleteness'
import { logActivity } from '../lib/activityLog'
import { useDialog } from '../contexts/DialogContext'

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

  // Routing columns (Opsi B — navigation router, SRS v2.0 §10.1)
  const [plantColHeader, setPlantColHeader] = useState('')
  const [locationColHeader, setLocationColHeader] = useState('')
  const [fallbackLocationId, setFallbackLocationId] = useState('')

  // Schema-free mode: saat dept belum punya kolom, user assign tipe dari header Excel
  // { [excelHeader]: { label: string, type: 'text'|'number'|'select', is_required: bool, role: 'data'|'router_plant'|'router_loc'|'ignore' } }
  const [headerTyping, setHeaderTyping] = useState({})

  // Tahap 3
  const [validationResult, setValidationResult] = useState(null)

  // Tahap 4
  const [isImporting, setIsImporting] = useState(false)

  const fileInputRef = useRef(null)
  const { addToast } = useToast()
  const { currentUser } = useAuth()
  const { confirm } = useDialog()

  // Ketika kolom dipilih sebagai router, otomatis keluarkan dari tabel Mode Adaptif
  // agar tidak muncul redundan dua kali (di routing section & di tabel mapping)
  useEffect(() => {
    const routerCols = [plantColHeader, locationColHeader].filter(Boolean)
    if (routerCols.length === 0) return
    setHeaderTyping(prev => {
      const next = { ...prev }
      routerCols.forEach(h => delete next[h])
      return next
    })
  }, [plantColHeader, locationColHeader])

  // Live queries dari Dexie
  const departments = useLiveQuery(() => db.departments_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], []) ?? []
  const locations = useLiveQuery(
    () => selectedDeptId ? db.locations_cache.where('department_id').equals(selectedDeptId).toArray() : [],
    [selectedDeptId], []
  ) ?? []
  // Semua lines & locations untuk routing (tidak difilter per dept)
  const allLines = useLiveQuery(() => db.lines_cache.toArray().then(r => r.sort((a,b) => (a.order??0)-(b.order??0))), [], []) ?? []
  const allLocations = useLiveQuery(() => db.locations_cache.toArray(), [], []) ?? []
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
  // Kolom yang dipilih sebagai router (Plant/Lokasi) diexclude dari mapping biasa
  const routerHeaders = new Set([plantColHeader, locationColHeader].filter(Boolean))
  const mappableColumns = deptColumns.filter(c => !c.is_auto && c.is_visible !== false)

  /* ---------------------------------------------------------------- */
  /*  Routing Helpers (Opsi B)                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Normalisasi nilai Plant/Line: "Line 1", "L1", "1", "line1" → "1"
   * Dipakai untuk fuzzy-match ke lines_cache.name
   */
  function normalizePlant(val) {
    return String(val ?? '').toLowerCase()
      .replace(/\s+/g, '')    // hapus semua spasi
      .replace(/^line/, '')   // hapus prefix "line"
      .replace(/^l(?=\d)/, '') // hapus prefix "l" jika diikuti angka
      .trim()
  }

  /**
   * Resolve location_id dari nilai Plant + Lokasi pada satu baris Excel.
   * Jika tidak cocok → kembalikan fallbackLocationId.
   *
   * @param {string} plantVal - nilai kolom Plant di baris ini
   * @param {string} locationVal - nilai kolom Lokasi di baris ini
   * @returns {{ locationId: string, routed: boolean, debugInfo: string }}
   */
  function resolveLocationId(plantVal, locationVal) {
    if (!plantColHeader && !locationColHeader) {
      return { locationId: fallbackLocationId || 'auto_fallback', routed: false, debugInfo: 'Tanpa routing' }
    }

    const p = String(plantVal ?? '').trim()
    const l = String(locationVal ?? '').trim()
    
    if (!p && !l) {
      return { locationId: fallbackLocationId || 'auto_fallback', routed: false, debugInfo: 'Baris kosong → Fallback/Unassigned' }
    }

    // Kembalikan marker auto-create, akan dibuat di handleConfirmImport
    return { locationId: `auto_${p}|${l}`, routed: true, debugInfo: `Otomatis: ${p || 'Unassigned'} → ${l || 'Unassigned'}` }
  }

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

        // Schema-free mode: jika dept belum punya kolom, inisialisasi headerTyping dari semua headers
        if (mappableColumns.length === 0) {
          const initTyping = {}
          const allHeaders = sheets.flatMap(s => s.headers)
          const uniqueHeaders = [...new Set(allHeaders)]
          uniqueHeaders.forEach(h => {
            initTyping[h] = { label: h, type: 'text', is_required: false, role: 'data' }
          })
          setHeaderTyping(initTyping)
        }

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
        const rowObj = {}
        sheet.headers.forEach((h, i) => {
          rowObj[h] = row[i] !== undefined ? String(row[i]).trim() : ''
        })

        // Routing: resolve location_id per baris dari kolom Plant + Lokasi
        const plantVal = plantColHeader ? rowObj[plantColHeader] : ''
        const locationVal = locationColHeader ? rowObj[locationColHeader] : ''
        const routing = resolveLocationId(plantVal, locationVal)

        // Konversi ke format components
        const components = {}

        if (mappableColumns.length > 0) {
          // Mode normal: pakai colMapping
          mappableColumns.forEach(col => {
            const excelHeader = colMapping[col.key]
            if (!excelHeader || routerHeaders.has(excelHeader)) return
            if (rowObj[excelHeader] !== undefined) {
              let val = rowObj[excelHeader]
              if (col.type === 'number' && val !== '') {
                const num = Number(String(val).replace(',', '.'))
                val = isNaN(num) ? val : num
              }
              components[col.key] = val
            }
          })
        } else {
          // Schema-free mode: pakai headerTyping, key = sanitized header
          Object.entries(headerTyping).forEach(([h, cfg]) => {
            if (cfg.role === 'ignore' || cfg.role === 'router_plant' || cfg.role === 'router_loc') return
            const colKey = 'col_' + h.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)
            let val = rowObj[h] ?? ''
            if (cfg.type === 'number' && val !== '') {
              const num = Number(String(val).replace(',', '.'))
              val = isNaN(num) ? val : num
            }
            components[colKey] = val
          })
        }

        return {
          sheetName: sheet.name,
          rowIndex: idx + 2, // Excel 1-indexed + header row
          components,
          resolvedLocationId: routing.locationId,
          routed: routing.routed,
          routingDebug: routing.debugInfo,
          plantVal,
          locationVal,
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
        const missingCols = deptColumns
          .filter(col => col.is_required && !col.is_auto)
          .filter(col => {
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

    // Bangun routing summary: { locationId → { name, lineId, count, unrouted } }
    const routingMap = {}
    allRows.forEach(r => {
      const locId = r.resolvedLocationId || fallbackLocationId
      if (!routingMap[locId]) {
        const loc = allLocations.find(l => l.id === locId)
        const line = allLines.find(l => l.id === loc?.line_id)
        routingMap[locId] = { locId, locName: loc?.name || locId, lineName: line?.name || '', count: 0, unroutedCount: 0 }
      }
      routingMap[locId].count++
      if (!r.routed && (plantColHeader || locationColHeader)) routingMap[locId].unroutedCount++
    })

    setValidationResult({ validRows, invalidRows, allRows, routingSummary: Object.values(routingMap) })
    setStep(3)
  }

  /* ---------------------------------------------------------------- */
  /*  Commit Import (Tahap 4) — support schema-free mode               */
  /* ---------------------------------------------------------------- */
  async function handleCommitImport() {
    const deptName = departments.find(d => d.id === selectedDeptId)?.name || ''
    const rowCount = validationResult?.allRows?.length || 0
    const locCount = validationResult?.routingSummary?.length || 1
    const routingNote = (plantColHeader || locationColHeader)
      ? `Data akan didistribusikan ke ${locCount} lokasi berdasarkan kolom routing.`
      : `Semua data akan masuk ke satu lokasi.`
    const confirmed = await confirm({
      title: 'Konfirmasi Import Data',
      message: `Anda akan mengimport ${rowCount} baris ke department ${deptName}.\n\n${routingNote}`,
      confirmText: 'Ya, Import Sekarang'
    })
    if (!confirmed) return
    setIsImporting(true)

    try {
      // Schema-free: auto-create columns_config SEBELUM insert records
      if (mappableColumns.length === 0 && Object.keys(headerTyping).length > 0) {
        const now = new Date().toISOString()
        let order = 1
        const newCols = []
        for (const [h, cfg] of Object.entries(headerTyping)) {
          if (cfg.role === 'ignore' || cfg.role === 'router_plant' || cfg.role === 'router_loc') continue
          const colKey = 'col_' + h.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)
          newCols.push({
            department_id: selectedDeptId,
            key: colKey,
            label: cfg.label || h,
            type: cfg.type || 'text',
            is_required: cfg.is_required || false,
            is_auto: false,
            is_visible: true,
            order: order++,
            created_at: now,
          })
        }
        if (newCols.length > 0) {
          await db.columns_config.bulkAdd(newCols)
          console.log(`[import] Auto-created ${newCols.length} kolom untuk dept ${selectedDeptId}`)
        }

        // Set plant/location router header dari headerTyping jika belum diset
        const plantEntry = Object.entries(headerTyping).find(([, c]) => c.role === 'router_plant')
        const locEntry = Object.entries(headerTyping).find(([, c]) => c.role === 'router_loc')
        if (plantEntry && !plantColHeader) setPlantColHeader(plantEntry[0])
        if (locEntry && !locationColHeader) setLocationColHeader(locEntry[0])
      }
      const importBatchId = Date.now()
      const now = new Date().toISOString()
      const userId = currentUser?.email || currentUser?.id || ''

      // Routing aktif: setiap baris punya resolvedLocationId masing-masing
      const allValidRows = validationResult?.validRows || []

      if (!allValidRows.length) {
        addToast('Tidak ada baris valid untuk diimport.', 'error')
        setIsImporting(false)
        return
      }

      // --- AUTO-CREATE LOKASI ---
      const uniqueLocsToCreate = new Set()
      allValidRows.forEach(r => {
        if (typeof r.resolvedLocationId === 'string' && r.resolvedLocationId.startsWith('auto_')) {
          uniqueLocsToCreate.add(r.resolvedLocationId)
        }
      })
      
      const realLocationIds = {}
      
      for (const autoId of uniqueLocsToCreate) {
        if (autoId === 'auto_fallback') {
           let unassignedLine = allLines.find(l => l.name === 'Unassigned')
           if (!unassignedLine) {
             const newId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
             await db.lines_cache.add({ id: newId, name: 'Unassigned', order: 999 })
             unassignedLine = { id: newId, name: 'Unassigned' }
             allLines.push(unassignedLine)
           }
           let unassignedLoc = allLocations.find(l => l.line_id === unassignedLine.id && l.department_id === selectedDeptId && l.name === 'Unassigned')
           if (!unassignedLoc) {
             const newId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
             await db.locations_cache.add({ id: newId, name: 'Unassigned', line_id: unassignedLine.id, department_id: selectedDeptId, order: 999 })
             unassignedLoc = { id: newId }
             allLocations.push(unassignedLoc)
           }
           realLocationIds[autoId] = unassignedLoc.id
           continue
        }
        
        const [plantVal, locVal] = autoId.replace('auto_', '').split('|')
        const pName = plantVal || 'Unassigned'
        const lName = locVal || 'Unassigned'
        const normP = normalizePlant(pName)
        const normL = lName.toLowerCase().trim()
        
        let line = allLines.find(l => normalizePlant(l.name) === normP)
        if (!line) {
          const newId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
          await db.lines_cache.add({ id: newId, name: pName, order: allLines.length + 1 })
          line = { id: newId, name: pName }
          allLines.push(line)
        }
        
        let loc = allLocations.find(l => l.line_id === line.id && l.department_id === selectedDeptId && l.name.toLowerCase().trim() === normL)
        if (!loc) {
          const newId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
          await db.locations_cache.add({ id: newId, name: lName, line_id: line.id, department_id: selectedDeptId, order: allLocations.length + 1 })
          loc = { id: newId }
          allLocations.push(loc)
        }
        
        realLocationIds[autoId] = loc.id
      }

      const rowsToInsert = allValidRows.map(r => ({
        location_id: (r.resolvedLocationId && r.resolvedLocationId.startsWith('auto_')) 
            ? realLocationIds[r.resolvedLocationId] 
            : r.resolvedLocationId,
        department_id: selectedDeptId,
        pb_id: null,
        // components TIDAK mengandung nilai kolom Plant & Lokasi (sudah diexclude di runValidation)
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

      // Hitung ringkasan untuk log
      const locCounts = {}
      rowsToInsert.forEach(r => { locCounts[r.location_id] = (locCounts[r.location_id] || 0) + 1 })

      logActivity('import_excel', userId, {
        importBatchId,
        totalRows: rowsToInsert.length,
        department_id: selectedDeptId,
        routing_active: !!(plantColHeader || locationColHeader),
        location_distribution: locCounts,
      })

      const routingNote = (plantColHeader || locationColHeader)
        ? ` (didistribusikan ke ${Object.keys(locCounts).length} lokasi)`
        : ''
      addToast(`Import selesai! ${rowsToInsert.length} baris berhasil ditambahkan${routingNote}.`, 'success', { duration: 8000 })
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
    setPlantColHeader('')
    setLocationColHeader('')
    setFallbackLocationId('')
    setHeaderTyping({})
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
    <div style={{ background: '#f8f9fa', minHeight: '100%' }}>
      <div style={{ padding: '20px 28px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#1f2328' }}>Import Data Excel</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#5f6368' }}>
            Tahap {step} dari {STEP_LABELS.length}: {STEP_LABELS[step - 1]}
          </p>
        </div>
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
        {step === 2 && (() => {
          const canProceed = true
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* === Bagian Routing (Opsi B) === */}
              <div style={{ background: '#fff', border: '2px solid #0969da', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#ddf4ff', borderBottom: '1px solid #b6e3ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0969da" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0969da' }}>Routing Navigasi (Auto-Create)</span>
                    <span style={{ fontSize: '12px', color: '#0969da', marginLeft: '8px', fontWeight: 400 }}>
                      Pilih kolom Excel penentu Line dan Lokasi. <strong>Sistem otomatis membuatkan Lokasi/Line baru jika belum ada!</strong>
                    </span>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                  {/* Plant / Line column */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#0969da', display: 'block', marginBottom: '4px' }}>
                      Kolom Line / Plant
                    </label>
                    <select
                      value={plantColHeader}
                      onChange={e => setPlantColHeader(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: `1px solid ${plantColHeader ? '#0969da' : '#d0d7de'}`, borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                    >
                      <option value=''>-- Tidak ada / Abaikan --</option>
                      {allExcelHeaders.map(h => (
                        <option key={h} value={h} disabled={h === locationColHeader}>{h}</option>
                      ))}
                    </select>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#5f6368' }}>mis. kolom "Plant", "Line", "Area"</p>
                  </div>

                  {/* Location column */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#0969da', display: 'block', marginBottom: '4px' }}>
                      Kolom Lokasi
                    </label>
                    <select
                      value={locationColHeader}
                      onChange={e => setLocationColHeader(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: `1px solid ${locationColHeader ? '#0969da' : '#d0d7de'}`, borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                    >
                      <option value=''>-- Tidak ada / Abaikan --</option>
                      {allExcelHeaders.map(h => (
                        <option key={h} value={h} disabled={h === plantColHeader}>{h}</option>
                      ))}
                    </select>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#5f6368' }}>mis. kolom "Location", "Lokasi"</p>
                  </div>

                  {/* Fallback location */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#0969da', display: 'block', marginBottom: '4px' }}>
                      Lokasi Fallback (Opsional)
                    </label>
                    <select
                      value={fallbackLocationId}
                      onChange={e => setFallbackLocationId(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: `1px solid #d0d7de`, borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                    >
                      <option value=''>-- Auto (Akan dibuatkan "Unassigned") --</option>
                      {allLocations
                        .filter(l => l.department_id === selectedDeptId)
                        .map(l => {
                          const line = allLines.find(ln => ln.id === l.line_id)
                          return <option key={l.id} value={l.id}>{line?.name} — {l.name}</option>
                        })}
                    </select>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#5f6368' }}>Tempat penampungan jika baris excel tidak punya nama Line/Lokasi.</p>
                  </div>
                </div>

                {(plantColHeader || locationColHeader) && (
                  <div style={{ margin: '0 20px 14px', padding: '8px 12px', background: '#e6f4ea', border: '1px solid #188038', borderRadius: '6px', fontSize: '12px', color: '#188038' }}>
                    ✨ Kolom <strong>{[plantColHeader, locationColHeader].filter(Boolean).join(', ')}</strong> akan otomatis dikonversi jadi hierarki Lokasi secara ajaib!
                  </div>
                )}
              </div>

              {/* === Bagian Mapping / Schema-Free Kolom Data === */}
              <div style={{ background: '#fff', border: `1px solid ${mappableColumns.length === 0 ? '#8250df' : '#d0d7de'}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: mappableColumns.length === 0 ? '#fbefff' : '#f6f8fa', borderBottom: `1px solid ${mappableColumns.length === 0 ? '#d8b4fe' : '#e1e4e8'}` }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: mappableColumns.length === 0 ? '#8250df' : '#1f2328' }}>
                    {mappableColumns.length === 0 ? '✨ Mode Adaptif — Kolom Otomatis dari Excel' : 'Pemetaan Kolom Data'}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>
                    {mappableColumns.length === 0
                      ? `Department ini belum punya kolom. Sistem akan membuat kolom baru otomatis dari ${allExcelHeaders.length} header file Excel Anda.`
                      : `File: `}{mappableColumns.length > 0 && <strong>{fileName}</strong>}
                    {mappableColumns.length > 0 && ` • ${totalExcelRows} baris. Petakan kolom sistem ke kolom Excel.`}
                  </p>
                </div>

                {mappableColumns.length === 0 ? (
                  /* ---- Schema-Free: tabel assign tipe per header ---- */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                          <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '25%' }}>Header Excel</th>
                          <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '25%' }}>Label Kolom</th>
                          <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '20%' }}>Tipe Data</th>
                          <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#5f6368', width: '15%' }}>Fungsi</th>
                          <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#5f6368', width: '10%' }}>Wajib?</th>
                          <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#5f6368', width: '5%' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(headerTyping).map(([h, cfg], i) => (
                          <tr key={h} style={{ borderBottom: '1px solid #f1f3f4', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '8px 14px', fontWeight: 500, color: '#1f2328' }}>
                              <code style={{ background: '#f6f8fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{h}</code>
                            </td>
                            <td style={{ padding: '6px 14px' }}>
                              <input
                                value={cfg.label}
                                onChange={e => setHeaderTyping(prev => ({ ...prev, [h]: { ...cfg, label: e.target.value } }))}
                                style={{ width: '100%', padding: '5px 8px', border: '1px solid #d0d7de', borderRadius: '5px', fontSize: '12px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 14px' }}>
                              <select
                                value={cfg.type}
                                onChange={e => setHeaderTyping(prev => ({ ...prev, [h]: { ...cfg, type: e.target.value } }))}
                                style={{ width: '100%', padding: '5px 8px', border: '1px solid #d0d7de', borderRadius: '5px', fontSize: '12px', background: '#fff' }}
                                disabled={cfg.role !== 'data'}
                              >
                                <option value='text'>Teks</option>
                                <option value='number'>Angka</option>
                                <option value='select'>Pilihan</option>
                                <option value='gdrive_link'>🖼️ Link Foto (GDrive)</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px 14px' }}>
                              <select
                                value={cfg.role}
                                onChange={e => setHeaderTyping(prev => ({ ...prev, [h]: { ...cfg, role: e.target.value } }))}
                                style={{ width: '100%', padding: '5px 8px', border: `1px solid ${cfg.role !== 'data' ? '#8250df' : '#d0d7de'}`, borderRadius: '5px', fontSize: '12px', background: '#fff', color: cfg.role !== 'data' ? '#8250df' : '#1f2328', fontWeight: cfg.role !== 'data' ? 600 : 400 }}
                              >
                                <option value='data'>Data Kolom</option>
                                <option value='router_plant'>🔀 Router Line</option>
                                <option value='router_loc'>🔀 Router Lokasi</option>
                                <option value='ignore'>— Abaikan</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                              <input
                                type='checkbox'
                                checked={cfg.is_required}
                                onChange={e => setHeaderTyping(prev => ({ ...prev, [h]: { ...cfg, is_required: e.target.checked } }))}
                                disabled={cfg.role !== 'data'}
                                style={{ width: '16px', height: '16px', accentColor: '#188038', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                              <button 
                                onClick={() => {
                                  setHeaderTyping(prev => {
                                    const next = { ...prev }
                                    delete next[h]
                                    return next
                                  })
                                }}
                                title="Hapus kolom ini dari import"
                                style={{ background: 'transparent', border: 'none', color: '#cf222e', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#ffebe9'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '10px 14px', background: '#fbefff', borderTop: '1px solid #d8b4fe', fontSize: '12px', color: '#6e40c9' }}>
                      ✨ Kolom dengan fungsi <strong>Data Kolom</strong> akan otomatis dibuat di schema department ini. Kolom <strong>Router</strong> hanya dipakai untuk mengarahkan baris ke Line/Lokasi yang benar dan tidak disimpan ke grid.
                    </div>
                  </div>
                ) : (
                  /* ---- Mode Normal: dropdown mapping ---- */
                  <>
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
                            <option value=''>-- Abaikan / Tidak Ada --</option>
                            {allExcelHeaders
                              .filter(h => !routerHeaders.has(h))
                              .map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {unmappedRequired.length > 0 && (
                      <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: '#ffebe9', border: '1px solid #cf222e', borderRadius: '6px', fontSize: '13px', color: '#cf222e' }}>
                        &#x26A0; Kolom wajib belum dipetakan: <strong>{unmappedRequired.map(c => c.label).join(', ')}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn-secondary" onClick={resetAll} style={{ padding: '8px 16px' }}>Mulai Ulang</button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="btn-secondary" onClick={() => setStep(1)} style={{ padding: '8px 16px' }}>← Kembali</button>
                  <button className="btn-primary" onClick={runValidation} style={{ padding: '8px 16px' }}>
                    Lanjut ke Validasi →
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ---- Tahap 3: Validasi ---- */}
        {step === 3 && validationResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Summary stats */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>Ringkasan Validasi</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>
                  Evaluasi kelengkapan baris berdasarkan konfigurasi department &amp; aturan pengecualian.
                </p>
              </div>
              <div style={{ padding: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Baris Lengkap ✓', value: validationResult.validRows.length, color: '#1a7f37', bg: '#e6f4ea' },
                  { label: 'Baris Tidak Lengkap', value: validationResult.invalidRows.length, color: validationResult.invalidRows.length > 0 ? '#cf222e' : '#5f6368', bg: validationResult.invalidRows.length > 0 ? '#ffebe9' : '#f6f8fa' },
                  { label: 'Total Baris', value: validationResult.allRows.length, color: '#1f2328', bg: '#f6f8fa' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, minWidth: '100px', padding: '16px', background: s.bg, borderRadius: '8px', textAlign: 'center', border: `1px solid ${s.color}30` }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Routing summary — hanya tampil jika routing aktif */}
            {(plantColHeader || locationColHeader) && validationResult.routingSummary?.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #0969da', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', background: '#ddf4ff', borderBottom: '1px solid #b6e3ff' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0969da' }}>&#x1F4CD; Distribusi Routing</span>
                  <span style={{ fontSize: '12px', color: '#0969da', marginLeft: '8px' }}>
                    Baris akan didistribusikan ke {validationResult.routingSummary.length} lokasi
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Line</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Lokasi</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#5f6368' }}>Jumlah Baris</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#5f6368' }}>Fallback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.routingSummary.map((r, i) => (
                        <tr key={r.locId} style={{ borderBottom: '1px solid #f1f3f4', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '8px 12px', color: '#1f2328', fontWeight: 500 }}>{r.lineName || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#1f2328' }}>{r.locName}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#1a7f37' }}>{r.count}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {r.unroutedCount > 0 && (
                              <span style={{ background: '#fff8c5', color: '#7d4e00', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                                {r.unroutedCount} tidak cocok
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error detail — baris tidak lengkap */}
            {validationResult.invalidRows.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #cf222e', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', background: '#ffebe9', borderBottom: '1px solid #ffc4be', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#cf222e' }}>&#x26A0; Baris dengan Data Tidak Lengkap</span>
                  <span style={{ fontSize: '12px', color: '#5f6368' }}>
                    (Baris ini <strong>tetap akan diimpor</strong> &mdash; harap lengkapi data kemudian)
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
                          <td style={{ padding: '8px 12px', color: '#cf222e', fontWeight: 600 }}>{r.sheetName} &middot; Baris {r.rowIndex}</td>
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
              <button className="btn-secondary" onClick={() => setStep(2)} style={{ padding: '8px 16px' }}>← Kembali ke Mapping</button>
              <button
                className="btn-primary"
                onClick={handleCommitImport}
                style={{ padding: '8px 20px' }}
                disabled={validationResult.allRows.length === 0}
              >
                Import {validationResult.allRows.length} Baris Sekarang &rarr;
              </button>
            </div>
          </div>
        )}
      </div>


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
