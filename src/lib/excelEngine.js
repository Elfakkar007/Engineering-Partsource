/**
 * excelEngine.js
 *
 * Excel Export & Import utilities menggunakan SheetJS (xlsx@0.18.5).
 * SRS v2.0 §10.1 (Import) & §10.2 (Export)
 *
 * Export:
 *   exportToExcel(rows, columns, options) → download .xlsx
 *
 * Import:
 *   parseExcelFile(file) → { headers, data, raw }
 *   mapHeadersToColumns(headers, columns) → mapping[]
 *   extractUniqueValues(data, fileHeader) → string[]
 *   validateRows(data, mapping, columns) → { valid, errors }
 *   rowToComponents(row, mapping) → components object
 */

import * as XLSX from 'xlsx'

/* ------------------------------------------------------------------ */
/*  EXPORT                                                               */
/* ------------------------------------------------------------------ */

/**
 * Export data grid ke file .xlsx.
 *
 * @param {Object[]} rows      - array baris (row.components = { col_key: value })
 * @param {Object[]} columns   - definisi kolom dari useDynamicSchema (kolom visible, terurut)
 * @param {Object}  [opts]
 * @param {string}  [opts.sheetName]    - nama sheet (default: nama department atau 'Data')
 * @param {string}  [opts.filename]     - nama file tanpa ekstensi (default: 'export')
 * @param {string}  [opts.locationName] - ditambahkan ke baris info header
 * @param {string}  [opts.deptName]     - ditambahkan ke baris info header
 * @returns {void}  — langsung trigger browser download
 */
export function exportToExcel(rows, columns, opts = {}) {
  const {
    sheetName = opts.deptName || 'Data',
    filename = `export_${new Date().toISOString().slice(0, 10)}`,
    locationName = '',
    deptName = '',
  } = opts

  // 1. Build header row dari labels kolom (100% config-driven, bukan hardcode)
  const headers = columns.map(col => col.label)

  // 2. Build data rows: setiap baris adalah array nilai sesuai urutan kolom
  const dataRows = rows.map(row => {
    const comps = row.components || {}
    return columns.map(col => {
      const v = comps[col.key]
      if (v === null || v === undefined) return ''
      return v
    })
  })

  // 3. Buat workbook
  const wb = XLSX.utils.book_new()

  // Meta info rows (2 baris di atas header)
  const metaRows = [
    [`Plant Sourcing App — Export Data`],
    [`Department: ${deptName}`, `Lokasi: ${locationName}`, `Tanggal: ${new Date().toLocaleDateString('id-ID')}`],
    [], // empty row separator
    headers, // header kolom
    ...dataRows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(metaRows)

  // 4. Styling: bold header (baris ke-4, index 3)
  const headerRowIdx = 3 // 0-indexed
  headers.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIdx })
    if (!ws[cellAddr]) return
    ws[cellAddr].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'F8F9FA' } },
    }
  })

  // 5. Auto column width
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      (col.label || '').length,
      ...dataRows.map(row => String(row[i] ?? '').length)
    )
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
  })
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)) // Excel max 31 chars

  // 6. Write & download
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/* ------------------------------------------------------------------ */
/*  IMPORT — Parse                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse file .xlsx atau .csv yang diupload oleh user.
 *
 * @param {File} file - File object dari <input type="file">
 * @returns {Promise<{ headers: string[], data: Object[], sheetName: string }>}
 *   headers: array nama kolom dari baris pertama
 *   data: array object { [header]: value } per baris data
 *   sheetName: nama sheet pertama yang diparsed
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })

        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]

        // Konversi ke array-of-arrays untuk fleksibilitas parsing
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (aoa.length < 2) {
          reject(new Error('File kosong atau tidak memiliki baris data'))
          return
        }

        // Baris pertama non-kosong = header
        // Cari baris header: cari baris yang punya setidaknya 2 cell terisi
        let headerRowIdx = 0
        for (let i = 0; i < Math.min(aoa.length, 10); i++) {
          const nonEmpty = (aoa[i] || []).filter(v => v !== '' && v !== null && v !== undefined)
          if (nonEmpty.length >= 2) { headerRowIdx = i; break }
        }

        const headers = (aoa[headerRowIdx] || []).map(h => String(h ?? '').trim()).filter(Boolean)

        // Data rows: setelah header row
        const dataRows = aoa.slice(headerRowIdx + 1)
          .filter(row => row.some(v => v !== '' && v !== null && v !== undefined))
          .map(row => {
            const obj = {}
            headers.forEach((h, i) => {
              const val = row[i]
              obj[h] = val === null || val === undefined ? '' : val
            })
            return obj
          })

        resolve({ headers, data: dataRows, sheetName })
      } catch (err) {
        reject(new Error(`Gagal parse file: ${err.message}`))
      }
    }

    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsArrayBuffer(file)
  })
}

/* ------------------------------------------------------------------ */
/*  IMPORT — Header Mapping                                              */
/* ------------------------------------------------------------------ */

/**
 * Sentinel value untuk header yang tidak cocok dengan kolom manapun
 * dan akan dibuat sebagai kolom baru. Nilai ini HARUS di-resolve ke key
 * asli sebelum rowToComponents dipanggil.
 */
export const NEW_COLUMN_SENTINEL = '__NEW__'

/**
 * Petakan header dari file Excel ke key kolom di columns_config.
 * Pencocokan berdasarkan label (case-insensitive, trim).
 *
 * Untuk header yang tidak cocok dengan kolom manapun (unmatched),
 * entry dikembalikan dengan colKey = NEW_COLUMN_SENTINEL dan isNew = true
 * — user kemudian memilih: buat kolom baru, petakan ke existing, atau abaikan.
 *
 * @param {string[]} fileHeaders   - header dari file Excel
 * @param {Object[]} columns       - columns dari useDynamicSchema (applies_to='records')
 * @returns {Object[]} mapping array:
 *   { fileHeader, colKey, label, type, matched, isNew, select_options }
 *   - matched=true: header file cocok dengan kolom existing
 *   - isNew=true: header file tidak ditemukan di columns_config
 *   - colKey=NEW_COLUMN_SENTINEL: perlu dibuat sebagai kolom baru
 *   - colKey=null: diabaikan user
 */
export function mapHeadersToColumns(fileHeaders, columns) {
  return fileHeaders.map(fileHeader => {
    const normalHeader = fileHeader.toLowerCase().trim()
    const match = columns.find(col =>
      col.label.toLowerCase().trim() === normalHeader
    )

    if (match) {
      return {
        fileHeader,
        colKey: match.key,
        label: match.label,
        type: match.type,
        matched: true,
        isNew: false,
        is_required: match.is_required,
        select_options: match.select_options || [],
      }
    }

    // Header tidak cocok → default ke "buat kolom baru" (sentinel)
    return {
      fileHeader,
      colKey: NEW_COLUMN_SENTINEL, // akan di-resolve saat commit
      label: fileHeader,
      type: 'text', // default, user bisa ganti di Step 2
      matched: false,
      isNew: true,
      is_required: false,
      select_options: [], // auto-extract jika type='select' dipilih user
    }
  })
}

/* ------------------------------------------------------------------ */
/*  IMPORT — Extract Unique Values (untuk select_options)              */
/* ------------------------------------------------------------------ */

/**
 * Ekstrak nilai unik dari satu kolom di data import.
 * Digunakan saat user memilih type='select' untuk kolom baru —
 * nilainya otomatis jadi select_options awal (SRS §10.1 §2b).
 *
 * @param {Object[]} data        - hasil parseExcelFile().data
 * @param {string}   fileHeader  - nama header kolom yang ingin diekstrak
 * @returns {string[]} array nilai unik, terurut A-Z, kosong dibuang
 */
export function extractUniqueValues(data, fileHeader) {
  const seen = new Set()
  data.forEach(row => {
    const v = row[fileHeader]
    if (v !== '' && v !== null && v !== undefined) {
      seen.add(String(v).trim())
    }
  })
  return [...seen].filter(Boolean).sort((a, b) => a.localeCompare(b, 'id'))
}

/* ------------------------------------------------------------------ */
/*  IMPORT — Validasi                                                    */
/* ------------------------------------------------------------------ */

/**
 * Validasi setiap baris data import terhadap kolom yang required.
 *
 * @param {Object[]} data      - hasil parseExcelFile().data
 * @param {Object[]} mapping   - hasil mapHeadersToColumns() — colKey bisa berupa key asli,
 *                               NEW_COLUMN_SENTINEL (akan dibuat), atau null (diabaikan)
 * @param {Object[]} columns   - semua kolom dari useDynamicSchema
 * @returns {{ valid: boolean, rows: Object[], errors: Object[] }}
 *   rows: data dengan tambahan field _rowIndex & _errors
 *   errors: { rowIndex, colKey, label, message }[]
 */
export function validateImportRows(data, mapping, columns) {
  const requiredCols = columns.filter(col => col.is_required)
  const allErrors = []

  const annotatedRows = data.map((row, idx) => {
    const rowErrors = []

    // Cek setiap kolom required yang ada di mapping (dan bukan diabaikan/baru)
    requiredCols.forEach(reqCol => {
      const mapEntry = mapping.find(m => m.colKey === reqCol.key)
      if (!mapEntry) return // kolom required tapi tidak ada di file → abaikan

      const val = row[mapEntry.fileHeader]
      if (val === '' || val === null || val === undefined) {
        rowErrors.push({
          rowIndex: idx,
          colKey: reqCol.key,
          label: reqCol.label,
          message: `Kolom wajib "${reqCol.label}" kosong di baris ${idx + 1}`,
        })
      }

      // Validasi type: number
      if (reqCol.type === 'number' && val !== '' && val !== null && val !== undefined) {
        if (isNaN(Number(val))) {
          rowErrors.push({
            rowIndex: idx,
            colKey: reqCol.key,
            label: reqCol.label,
            message: `Kolom "${reqCol.label}" harus berupa angka (baris ${idx + 1})`,
          })
        }
      }
    })

    allErrors.push(...rowErrors)
    return { ...row, _rowIndex: idx, _errors: rowErrors }
  })

  return {
    valid: allErrors.length === 0,
    rows: annotatedRows,
    errors: allErrors,
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: konversi row import → components object                     */
/* ------------------------------------------------------------------ */

/**
 * Konversi satu baris import (keyed by fileHeader) ke format components
 * (keyed by colKey) yang siap disimpan ke Dexie.
 *
 * PENTING: mapping yang diterima di sini harus sudah RESOLVED —
 * artinya colKey NEW_COLUMN_SENTINEL sudah diganti dengan key asli
 * yang baru dibuat, atau null jika diabaikan. Lihat handleCommit di ImportModal.
 *
 * @param {Object}   row      - baris data dari parseExcelFile (key = fileHeader)
 * @param {Object[]} mapping  - mapping yang sudah di-resolve (colKey = key asli atau null)
 * @returns {Object}  components object: { col_key: value }
 */
export function rowToComponents(row, mapping) {
  const components = {}
  mapping.forEach(m => {
    // Skip: diabaikan (null) atau sentinel yang belum ter-resolve
    if (!m.colKey || m.colKey === NEW_COLUMN_SENTINEL) return
    const val = row[m.fileHeader]
    if (val === '' || val === null || val === undefined) {
      components[m.colKey] = null
    } else if (m.type === 'number') {
      components[m.colKey] = Number(val)
    } else {
      components[m.colKey] = String(val)
    }
  })
  return components
}
