import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { useImportUndo } from '../contexts/ImportUndoContext'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { logActivity } from '../lib/activityLog'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

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

export default function ImportExcel() {
  const [step, setStep] = useState(1) // 1: Upload, 2: Mapping & Preview, 3: Validation Report
  const [fileName, setFileName] = useState('')
  const [sheetNames, setSheetNames] = useState([])
  const [sheetMapping, setSheetMapping] = useState({})
  const [columnMapping, setColumnMapping] = useState({})
  const [parsedData, setParsedData] = useState({})
  const [validationResults, setValidationResults] = useState({})
  const [previewLine, setPreviewLine] = useState('line1')
  const [isDragging, setIsDragging] = useState(false)

  const [showConfirm, setShowConfirm] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [deleteStats, setDeleteStats] = useState({ components: 0, locations: 0 })

  const fileInputRef = useRef(null)
  const { addToast } = useToast()
  const { requestUndo } = useImportUndo()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (file) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      addToast('File harus berupa format Excel (.xlsx/.xls) atau CSV', 'error')
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target.result
        const workbook = XLSX.read(data, { type: 'binary' })

        const names = workbook.SheetNames
        setSheetNames(names)

        const initialMapping = {}
        const initialColMapping = {}
        const dataMap = {}

        names.forEach(name => {
          // Guess mapping
          const lower = name.toLowerCase()
          let guessed = ''
          if (lower.includes('1') || lower.includes('satu')) guessed = 'line1'
          else if (lower.includes('2') || lower.includes('dua')) guessed = 'line2'
          else if (lower.includes('3') || lower.includes('tiga')) guessed = 'line3'
          else if (lower.includes('4') || lower.includes('empat')) guessed = 'line4'
          initialMapping[name] = guessed

          // Parse data
          const sheet = workbook.Sheets[name]
          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

          const rawHeaders = sheetData[0] || []
          const headers = rawHeaders.slice(0, 13)

          const colMap = {}
          STANDARD_COLUMNS.forEach(stdCol => {
            const match = headers.find(h => h && h.trim().toLowerCase() === stdCol.toLowerCase())
            colMap[stdCol] = match || ''
          })
          initialColMapping[name] = colMap

          const rows = []
          for (let i = 1; i < sheetData.length; i++) {
            const rawRow = sheetData[i] || []
            const truncatedRow = rawRow.slice(0, 13)

            const hasData = truncatedRow.some(cell => {
              if (cell === null || cell === undefined) return false
              if (typeof cell === 'string') return cell.trim() !== ''
              return true
            })

            if (hasData) {
              rows.push({ data: truncatedRow, originalIndex: i + 1 })
            }
          }

          dataMap[name] = { headers, rows }
        })

        setSheetMapping(initialMapping)
        setColumnMapping(initialColMapping)
        setParsedData(dataMap)

        const firstMatch = Object.values(initialMapping).find(v => v !== '')
        if (firstMatch) setPreviewLine(firstMatch)

        setStep(2)
        addToast('File berhasil diparse', 'success')
      } catch (err) {
        console.error(err)
        addToast('Gagal membaca file Excel', 'error')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleMappingChange = (sheet, lineId) => {
    setSheetMapping(prev => ({ ...prev, [sheet]: lineId }))
  }

  const handleColMappingChange = (sheet, stdCol, rawVal) => {
    setColumnMapping(prev => ({
      ...prev,
      [sheet]: {
        ...prev[sheet],
        [stdCol]: rawVal
      }
    }))
  }

  const runValidation = () => {
    const results = {}
    sheetNames.forEach(name => {
      const lineId = sheetMapping[name]
      if (!lineId) return // ignore if sheet is skipped

      const mapping = columnMapping[name]
      const rawHeaders = parsedData[name].headers

      const indexMap = {}
      Object.entries(mapping).forEach(([stdCol, rawName]) => {
        if (rawName) {
          indexMap[stdCol] = rawHeaders.indexOf(rawName)
        }
      })

      const validRows = []
      const invalidRows = []

      parsedData[name].rows.forEach(rowObj => {
        const row = rowObj.data
        const errors = []

        const getVal = (stdCol) => {
          const idx = indexMap[stdCol]
          if (idx !== undefined && idx >= 0) {
            const v = row[idx]
            if (typeof v === 'string') return v.trim()
            if (v !== undefined && v !== null) return String(v).trim()
          }
          return ''
        }

        const mappedData = {}
        STANDARD_COLUMNS.forEach(col => { mappedData[col] = getVal(col) })

        // Validation Rules
        const statusVal = mappedData['Status']
        if (statusVal) {
          if (statusVal !== 'Existing' && statusVal !== 'Tidak Aktif') {
            errors.push({ col: 'Status', message: `Status tidak dikenali: '${statusVal}'` })
          }
        }

        const qtyVal = mappedData['Qty']
        if (qtyVal) {
          const num = Number(qtyVal.replace(',', '.')) // handle possible comma decimals
          if (isNaN(num)) {
            errors.push({ col: 'Qty', message: `Format Qty harus berupa angka, mendapat: '${qtyVal}'` })
          }
        }

        if (errors.length > 0) {
          invalidRows.push({
            originalRowIndex: rowObj.originalIndex,
            line: LINE_OPTIONS.find(l => l.id === lineId)?.label,
            errors,
            data: mappedData
          })
        } else {
          validRows.push({
            originalRowIndex: rowObj.originalIndex,
            line: lineId,
            data: mappedData
          })
        }
      })

      results[name] = { validRows, invalidRows }
    })

    setValidationResults(results)
    setStep(3)
  }

  const handlePrepareImport = async () => {
    setIsImporting(true)
    setImportProgress('Menghitung data lama...')
    try {
      const compSnap = await getDocs(collection(db, 'components'))
      const locSnap = await getDocs(collection(db, 'locations'))
      setDeleteStats({ components: compSnap.size, locations: locSnap.size })
      setShowConfirm(true)
      setIsImporting(false)
      setImportProgress('')
    } catch (error) {
      console.error(error)
      addToast('Gagal menghitung data', 'error')
      setIsImporting(false)
      setImportProgress('')
    }
  }

  const handleCommitImport = async () => {
    setShowConfirm(false)
    setIsImporting(true)
    const batchId = `import_${Date.now()}`

    try {
      // 1. Delete all existing data
      setImportProgress(`Menghapus ${deleteStats.components} data baris lama...`)
      const compSnap = await getDocs(collection(db, 'components'))
      let batch = writeBatch(db)
      let count = 0

      for (const docSnap of compSnap.docs) {
        batch.delete(docSnap.ref)
        count++
        if (count % 500 === 0) {
          await batch.commit()
          batch = writeBatch(db)
        }
      }
      if (count % 500 !== 0) await batch.commit()

      setImportProgress(`Menghapus ${deleteStats.locations} lokasi lama...`)
      const locSnap = await getDocs(collection(db, 'locations'))
      batch = writeBatch(db)
      count = 0
      for (const docSnap of locSnap.docs) {
        batch.delete(docSnap.ref)
        count++
        if (count % 500 === 0) {
          await batch.commit()
          batch = writeBatch(db)
        }
      }
      if (count % 500 !== 0) await batch.commit()

      // 2. Prepare locations
      setImportProgress('Membuat lokasi baru...')
      const uniqueLocs = {} // { lineId: Set<string> }

      const allRowsToInsert = []
      sheetNames.forEach(sheet => {
        const lineId = sheetMapping[sheet]
        if (!lineId || !validationResults[sheet]) return

        const processRow = (rowObj) => {
          const locName = rowObj.data['Location']?.trim() || ''
          if (!uniqueLocs[lineId]) uniqueLocs[lineId] = new Set()
          uniqueLocs[lineId].add(locName)
          allRowsToInsert.push({ lineId, data: rowObj.data })
        }

        validationResults[sheet].validRows.forEach(processRow)
        validationResults[sheet].invalidRows.forEach(processRow)
      })

      const locMapping = {} // { lineId: { locName: locId } }
      batch = writeBatch(db)
      count = 0
      let newLocCount = 0

      for (const [lineId, locSet] of Object.entries(uniqueLocs)) {
        locMapping[lineId] = {}
        for (const locName of locSet) {
          const displayLocName = locName === '' ? 'Belum Ada Lokasi' : locName
          const baseSlug = displayLocName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          const locId = `${lineId}__${baseSlug}`

          locMapping[lineId][locName] = locId

          batch.set(doc(db, 'locations', locId), {
            name: displayLocName,
            line: lineId,
            importBatchId: batchId,
            createdBy: currentUser?.uid || '',
            createdAt: serverTimestamp()
          })
          count++
          newLocCount++

          if (count % 500 === 0) {
            await batch.commit()
            batch = writeBatch(db)
          }
        }
      }
      if (count % 500 !== 0) await batch.commit()

      // 3. Write new components
      setImportProgress(`Menulis ${allRowsToInsert.length} baris data baru...`)
      batch = writeBatch(db)
      count = 0

      for (const rowObj of allRowsToInsert) {
        const { lineId, data } = rowObj
        const locName = data['Location']?.trim() || ''
        const locId = locMapping[lineId][locName]

        const componentData = {
          line: lineId,
          locationId: locId,
          importBatchId: batchId,
          isDeleted: false,
          createdBy: currentUser?.uid || '',
          lastEditedBy: currentUser?.uid || '',
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        }

        const fieldMapping = {
          'Sub-Machine': 'subMachine',
          'Item Code': 'itemCode',
          'Category': 'category',
          'Part': 'part',
          'Description ( Bella )': 'description',
          'Spesification': 'spesification',
          'Warehouse Name': 'warehouseName',
          'Status': 'status',
          'Foto': 'foto',
          'Qty WH': 'qtyWh'
        }

        Object.entries(fieldMapping).forEach(([stdCol, key]) => {
          componentData[key] = data[stdCol] || ''
        })

        const qtyVal = data['Qty']
        if (qtyVal) {
          const num = Number(qtyVal.replace(',', '.'))
          if (!isNaN(num)) {
            componentData['qty'] = num
          } else {
            componentData['qty'] = qtyVal // invalid string as is
          }
        } else {
          componentData['qty'] = ''
        }

        batch.set(doc(collection(db, 'components')), componentData)
        count++

        if (count % 500 === 0) {
          await batch.commit()
          batch = writeBatch(db)
        }
      }
      if (count % 500 !== 0) await batch.commit()

      addToast(`Berhasil mengimpor ${allRowsToInsert.length} baris dan ${newLocCount} lokasi.`, 'success', {
        duration: 15000,
        onUndo: () => {
          requestUndo(batchId, allRowsToInsert.length, newLocCount)
        }
      })

      logActivity('import_excel', currentUser?.uid, {
        importBatchId: batchId,
        totalRows: allRowsToInsert.length,
        totalLocations: newLocCount
      })

      cancelImport()

    } catch (err) {
      console.error(err)
      addToast('Import terhenti di tengah jalan, sebagian data mungkin sudah berubah — hubungi developer sebelum lanjut', 'error')
    } finally {
      setIsImporting(false)
      setImportProgress('')
    }
  }

  const cancelImport = () => {
    setStep(1)
    setFileName('')
    setParsedData({})
    setValidationResults({})
  }

  // --- Derived State for Step 2 UI ---
  const previewSheets = sheetNames.filter(name => sheetMapping[name] === previewLine)
  let combinedHeaders = []
  let combinedRows = []
  if (previewSheets.length > 0) {
    combinedHeaders = parsedData[previewSheets[0]]?.headers || []
    previewSheets.forEach(sheet => {
      combinedRows = combinedRows.concat(parsedData[sheet]?.rows.map(r => r.data) || [])
    })
  }

  const totalRowsByLine = { line1: 0, line2: 0, line3: 0, line4: 0 }
  sheetNames.forEach(sheet => {
    const targetLine = sheetMapping[sheet]
    if (targetLine) {
      totalRowsByLine[targetLine] += (parsedData[sheet]?.rows?.length || 0)
    }
  })
  const grandTotal = Object.values(totalRowsByLine).reduce((a, b) => a + b, 0)

  // --- Derived State for Step 3 UI ---
  let step3ValidTotal = 0
  let step3InvalidTotal = 0
  const step3ByLine = { line1: { valid: 0, invalid: 0 }, line2: { valid: 0, invalid: 0 }, line3: { valid: 0, invalid: 0 }, line4: { valid: 0, invalid: 0 } }
  let allInvalidRows = []

  let w = 0
  if (step === 3) {
    sheetNames.forEach(sheet => {
      const lineId = sheetMapping[sheet]
      if (lineId && validationResults[sheet]) {
        const vCount = validationResults[sheet].validRows.length
        const ivCount = validationResults[sheet].invalidRows.length
        step3ValidTotal += vCount
        step3InvalidTotal += ivCount
        step3ByLine[lineId].valid += vCount
        step3ByLine[lineId].invalid += ivCount
        allInvalidRows = allInvalidRows.concat(validationResults[sheet].invalidRows)
      }
    })

    const uniqueLocsTemp = {}
    sheetNames.forEach(sheet => {
      const lineId = sheetMapping[sheet]
      if (!lineId || !validationResults[sheet]) return
      if (!uniqueLocsTemp[lineId]) uniqueLocsTemp[lineId] = new Set()
      validationResults[sheet].validRows.forEach(r => uniqueLocsTemp[lineId].add(r.data['Location']?.trim() || ''))
      validationResults[sheet].invalidRows.forEach(r => uniqueLocsTemp[lineId].add(r.data['Location']?.trim() || ''))
    })
    Object.values(uniqueLocsTemp).forEach(set => {
      w += set.size
    })
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f8f9fa' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e1e4e8', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => navigate('/')}>
            ←
          </button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1f2328', margin: 0 }}>Import Data Excel</h1>
            <p style={{ fontSize: '13px', color: '#5f6368', margin: '4px 0 0' }}>
              Tahap {step} dari 3: {step === 1 ? 'Pemilihan File' : step === 2 ? 'Mapping & Preview' : 'Validasi Data'}
            </p>
          </div>
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

        {step === 1 && (
          <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px', padding: '48px 24px', textAlign: 'center' }}>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? '#0969da' : '#d0d7de'}`,
                borderRadius: '8px',
                padding: '48px 24px',
                background: isDragging ? '#f3f8ff' : '#fafbfc',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
              />
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#1f2328' }}>
                Seret file Excel ke sini, atau klik untuk memilih
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#5f6368' }}>
                Format didukung: .xlsx, .xls
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Konfigurasi Sheet */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e1e4e8', background: '#f6f8fa' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#1f2328' }}>Pemetaan Sheet ke Line</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>Sistem mencoba menebak alokasi sheet berdasarkan namanya. Silakan koreksi jika ada yang salah.</p>
              </div>
              <div style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {sheetNames.map(sheet => (
                  <div key={sheet} style={{ border: '1px solid #d0d7de', borderRadius: '6px', padding: '12px', background: '#fafbfc', minWidth: '200px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: '#1f2328' }}>
                      {sheet} <span style={{ color: '#5f6368', fontWeight: 400 }}>({parsedData[sheet]?.rows.length} baris)</span>
                    </div>
                    <select
                      className="grid-cell-input"
                      style={{ padding: '6px 8px', border: '1px solid #d0d7de', borderRadius: '4px', width: '100%', background: '#fff' }}
                      value={sheetMapping[sheet]}
                      onChange={(e) => handleMappingChange(sheet, e.target.value)}
                    >
                      <option value="">-- Abaikan Sheet Ini --</option>
                      {LINE_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Pemetaan Kolom */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e1e4e8', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', color: '#1f2328' }}>Pemetaan Kolom</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>Periksa kembali kolom asli mana yang akan dipetakan ke kolom sistem.</p>
                </div>
              </div>

              <div style={{ padding: '0' }}>
                {sheetNames.filter(s => sheetMapping[s]).map(sheet => (
                  <div key={`colmap-${sheet}`} style={{ borderBottom: '1px solid #e1e4e8' }}>
                    <div style={{ background: '#f6f8fa', padding: '8px 24px', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #d0d7de' }}>
                      Mapping untuk Sheet: {sheet} (Target: {LINE_OPTIONS.find(l => l.id === sheetMapping[sheet])?.label})
                    </div>
                    <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {STANDARD_COLUMNS.map(stdCol => (
                        <div key={stdCol} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#5f6368' }}>
                            {stdCol} {['Sub-Machine', 'Category', 'Part', 'Spesification', 'Status', 'Qty', 'Foto'].includes(stdCol) && <span style={{ color: '#cf222e' }}>*</span>}
                          </label>
                          <select
                            className="grid-cell-input"
                            style={{ padding: '6px 8px', border: '1px solid #d0d7de', borderRadius: '4px', background: '#fff', fontSize: '13px' }}
                            value={columnMapping[sheet][stdCol] || ''}
                            onChange={e => handleColMappingChange(sheet, stdCol, e.target.value)}
                          >
                            <option value="">-- Tidak ada --</option>
                            {parsedData[sheet].headers.map((h, i) => (
                              <option key={i} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Mentah */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e1e4e8', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#1f2328', marginRight: 'auto' }}>Preview Data Mentah</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {LINE_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPreviewLine(opt.id)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: previewLine === opt.id ? '#0969da' : 'transparent',
                        color: previewLine === opt.id ? '#fff' : '#5f6368',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: previewLine === opt.id ? 600 : 400
                      }}
                    >
                      {opt.label} ({totalRowsByLine[opt.id]})
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '16px 24px', background: '#f6f8fa', fontSize: '13px', color: '#5f6368' }}>
                Menampilkan maksimal 20 baris pertama dari {combinedRows.length} total baris untuk {LINE_OPTIONS.find(l => l.id === previewLine)?.label}.
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '500px', borderTop: '1px solid #e1e4e8' }}>
                {combinedRows.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#5f6368' }}>
                    Tidak ada data untuk dirender pada Line ini.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', top: 0, background: '#f6f8fa', padding: '8px 12px', borderBottom: '1px solid #d0d7de', borderRight: '1px solid #d0d7de', color: '#5f6368', fontWeight: 600, textAlign: 'center', width: '40px' }}>
                          #
                        </th>
                        {combinedHeaders.map((h, i) => (
                          <th key={i} style={{ position: 'sticky', top: 0, background: '#f6f8fa', padding: '8px 12px', borderBottom: '1px solid #d0d7de', borderRight: '1px solid #d0d7de', color: '#1f2328', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                            {h || `Column ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {combinedRows.slice(0, 20).map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid #e1e4e8' }}>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #e1e4e8', background: '#fafbfc', textAlign: 'center', color: '#5f6368' }}>
                            {rIdx + 1}
                          </td>
                          {combinedHeaders.map((_, cIdx) => (
                            <td key={cIdx} style={{ padding: '8px 12px', borderRight: '1px solid #e1e4e8', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row[cIdx] !== undefined ? String(row[cIdx]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', color: '#1f2328' }}>
                Total keseluruhan data: <strong>{grandTotal} baris</strong>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  onClick={cancelImport}
                  style={{ padding: '8px 16px' }}
                >
                  Batal
                </button>
                <button
                  className="btn-primary"
                  onClick={runValidation}
                  style={{ padding: '8px 16px' }}
                >
                  Lanjut ke Validasi Data
                </button>
              </div>
            </div>

          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Laporan Keseluruhan & Per Line */}
            <div style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e1e4e8', background: '#f6f8fa' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#1f2328' }}>Ringkasan Hasil Validasi</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5f6368' }}>Pemeriksaan kelengkapan dan format data berdasarkan kolom wajib.</p>
              </div>

              <div style={{ padding: '24px', display: 'flex', gap: '24px', borderBottom: '1px solid #e1e4e8' }}>
                <div style={{ flex: 1, padding: '16px', background: '#fafbfc', border: '1px solid #d0d7de', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Format Bersih</div>
                  <div style={{ fontSize: '32px', fontWeight: 600, color: '#1a7f37', margin: '8px 0' }}>{step3ValidTotal}</div>
                  <div style={{ fontSize: '12px', color: '#5f6368' }}>Baris</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: '#fafbfc', border: '1px solid #d0d7de', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ada Kesalahan Format</div>
                  <div style={{ fontSize: '32px', fontWeight: 600, color: step3InvalidTotal > 0 ? '#cf222e' : '#5f6368', margin: '8px 0' }}>{step3InvalidTotal}</div>
                  <div style={{ fontSize: '12px', color: '#5f6368' }}>Baris</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: '#fafbfc', border: '1px solid #d0d7de', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Keseluruhan</div>
                  <div style={{ fontSize: '32px', fontWeight: 600, color: '#1f2328', margin: '8px 0' }}>{step3ValidTotal + step3InvalidTotal}</div>
                  <div style={{ fontSize: '12px', color: '#5f6368' }}>Baris</div>
                </div>
              </div>

              <div style={{ padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #e1e4e8' }}>
                      <th style={{ padding: '10px 24px', textAlign: 'left', fontWeight: 600, color: '#5f6368' }}>Line</th>
                      <th style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 600, color: '#5f6368' }}>Bersih</th>
                      <th style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 600, color: '#5f6368' }}>Error Format</th>
                      <th style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 600, color: '#5f6368' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINE_OPTIONS.map(opt => {
                      const stats = step3ByLine[opt.id]
                      const sum = stats.valid + stats.invalid
                      if (sum === 0) return null
                      return (
                        <tr key={opt.id} style={{ borderBottom: '1px solid #e1e4e8' }}>
                          <td style={{ padding: '10px 24px', fontWeight: 600 }}>{opt.label}</td>
                          <td style={{ padding: '10px 24px', textAlign: 'right', color: '#1a7f37' }}>{stats.valid}</td>
                          <td style={{ padding: '10px 24px', textAlign: 'right', color: stats.invalid > 0 ? '#cf222e' : '#5f6368' }}>{stats.invalid}</td>
                          <td style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 600 }}>{sum}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabel Error Detail */}
            {allInvalidRows.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #cf222e', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e1e4e8', background: '#ffebe9', display: 'flex', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: '#cf222e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Detail Baris dengan Kesalahan Format
                  </h3>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', top: 0, background: '#f6f8fa', padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#5f6368', borderBottom: '1px solid #d0d7de', width: '80px' }}>Brs Excel</th>
                        <th style={{ position: 'sticky', top: 0, background: '#f6f8fa', padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368', borderBottom: '1px solid #d0d7de', width: '100px' }}>Line</th>
                        <th style={{ position: 'sticky', top: 0, background: '#f6f8fa', padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368', borderBottom: '1px solid #d0d7de', width: '180px' }}>Kolom Error</th>
                        <th style={{ position: 'sticky', top: 0, background: '#f6f8fa', padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5f6368', borderBottom: '1px solid #d0d7de' }}>Alasan Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allInvalidRows.map((inv, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e1e4e8', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#cf222e' }}>
                            {inv.originalRowIndex}
                          </td>
                          <td style={{ padding: '10px 16px' }}>{inv.line}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {inv.errors.map((e, i) => (
                                <span key={i} style={{ background: '#ffebe9', color: '#cf222e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-block', width: 'fit-content' }}>
                                  {e.col}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#5f6368' }}>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                              {inv.errors.map((e, i) => (
                                <li key={i}>{e.message}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#fff', border: '1px solid #d0d7de', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', color: '#1f2328', flex: 1 }}>
                Seluruh baris di atas <strong>tetap akan diimpor</strong>, namun disarankan untuk merevisi nilai yang keliru di Excel agar data yang masuk terhindar dari format salah.
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setStep(2)}
                  style={{ padding: '8px 16px' }}
                >
                  Kembali ke Mapping
                </button>
                <button
                  className="btn-primary"
                  onClick={handlePrepareImport}
                  disabled={isImporting}
                  style={{ padding: '8px 16px' }}
                >
                  {isImporting ? 'Menyiapkan...' : 'Import Sekarang'}
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {showConfirm && (
        <ConfirmDeleteModal
          title="Konfirmasi Import & Reset Data"
          itemLabel={`${deleteStats.components} baris data lama dan ${deleteStats.locations} lokasi lama`}
          warningText={`Tindakan ini akan MENGHAPUS PERMANEN ${deleteStats.components} baris data & ${deleteStats.locations} lokasi yang ada sekarang di SEMUA Line (data lama TIDAK masuk Recycle Bin, tidak bisa dipulihkan), lalu menulis ${step3ValidTotal + step3InvalidTotal} baris data baru dari file Excel dan membuat ${w} lokasi baru. Lanjutkan?`}
          confirmText="Ya, Hapus & Import"
          onConfirm={handleCommitImport}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {isImporting && importProgress && (
        <div className="modal-backdrop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #0969da', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <h3 style={{ margin: '0 0 8px', color: '#1f2328' }}>Proses Import Sedang Berjalan</h3>
            <p style={{ margin: 0, color: '#5f6368', fontSize: '14px' }}>{importProgress}</p>
          </div>
        </div>
      )}

    </div>
  )
}
