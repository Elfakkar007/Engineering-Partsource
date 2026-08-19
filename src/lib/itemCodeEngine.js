/**
 * itemCodeEngine.js
 *
 * Item Code Engine - SRS v2.0 par.7 (Manual-Assisted Matching)
 *
 * Pendekatan: kode item SELALU dibuat manual Admin di reference_catalog.
 * Engine bertugas mencocokkan teks kolom pemicu (is_ref_trigger=true) ke
 * reference_catalog.search_key dan mengisi/mengosongkan kolom Item Code
 * (is_item_code_column=true) secara otomatis -- HANYA jika records.item_code_mode = "auto".
 *
 * API publik:
 *   normalizeTrigger(val)                    - normalize teks (lowercase + collapse whitespace)
 *   applyItemCodeMatching(row, colKey, newVal, allColumns)
 *                                            - fungsi utama; dipanggil dari useGridData.updateCell
 *                                              setelah blur pada kolom pemicu.
 *                                              Returns: patch object { [itemCodeKey]: string|'' }
 *                                              atau null jika tidak ada aksi yang diperlukan.
 *   getSuggestions(partialValue, departmentId, limit?)
 *                                            - substring/mid-string search untuk autocomplete (UI Tahap 8c)
 *   addCatalogEntry(departmentId, components, searchKey, itemCode, source?)
 *                                            - Admin: tambah entry baru ke reference_catalog
 */

import { db } from './db'

// ---------------------------------------------------------------------------
//  Normalisasi teks
// ---------------------------------------------------------------------------

/**
 * Normalize nilai untuk matching: lowercase, trim, collapse whitespace.
 * Diekspor agar komponen UI bisa menggunakannya secara konsisten.
 * @param {*} val
 * @returns {string}
 */
export function normalizeTrigger(val) {
  if (val === null || val === undefined) return ''
  return String(val).toLowerCase().trim().replace(/\s+/g, ' ')
}

// ---------------------------------------------------------------------------
//  Fungsi utama: applyItemCodeMatching
// ---------------------------------------------------------------------------

/**
 * Evaluasi apakah perubahan nilai kolom pemicu pada sebuah baris perlu
 * menyebabkan perubahan pada kolom Item Code.
 *
 * Logika (SRS v2.0 par.7 Manual-Assisted Matching, Mode Auto):
 *   1. Cek apakah kolom yang berubah (colKey) adalah kolom pemicu
 *      (columns_config.is_ref_trigger = true, applies_to = "records").
 *      Jika bukan -> return null (tidak ada aksi).
 *   2. Cek item_code_mode pada baris. Jika "manual" -> return null
 *      (jangan sentuh kolom Item Code sama sekali).
 *   3. Temukan kolom Item Code di allColumns (is_item_code_column = true,
 *      applies_to = "records"). Jika tidak ada -> return null.
 *   4. Exact-match newVal (normalized) terhadap reference_catalog.search_key
 *      milik department yang sama (offline via Dexie).
 *      - Cocok   -> return patch { [itemCodeColKey]: matchedItemCode }
 *      - Tidak cocok -> return patch { [itemCodeColKey]: '' }
 *        (mengosongkan, sesuai SRS: "Tidak cocok -> kolom Item Code dikosongkan (NaN/kosong)")
 *
 * Seluruh query berjalan terhadap Dexie (offline-first), tidak menyentuh PocketBase.
 *
 * @param {Object}   row         - record baris (dari db.records.get)
 * @param {string}   colKey      - key kolom yang baru saja berubah
 * @param {*}        newVal      - nilai baru yang dimasukkan user
 * @param {Array}    allColumns  - semua kolom columns_config untuk department ini
 * @returns {Promise<Object|null>} patch object atau null jika tidak ada aksi
 */
export async function applyItemCodeMatching(row, colKey, newVal, allColumns) {
  // Langkah 1: apakah kolom ini kolom pemicu?
  const triggerCol = (allColumns || []).find(
    c => c.key === colKey && c.is_ref_trigger === true
  )
  if (!triggerCol) return null

  // Langkah 2: cek item_code_mode baris — jika 'manual', tidak ada aksi
  const mode = row.item_code_mode ?? 'auto'
  if (mode === 'manual') return null

  // Langkah 3: temukan kolom Item Code target (is_item_code_column = true)
  const itemCodeCol = (allColumns || []).find(c => c.is_item_code_column === true)
  if (!itemCodeCol) return null
  const itemCodeKey = itemCodeCol.key

  // Langkah 4: exact-match ke reference_catalog
  const normalized = normalizeTrigger(newVal)

  // Jika nilai dikosongkan user -> kosongkan kolom Item Code juga
  if (!normalized) {
    return { [itemCodeKey]: '' }
  }

  try {
    const entries = await db.reference_catalog
      .where('department_id')
      .equals(row.department_id)
      .toArray()

    const match = entries.find(e =>
      e.search_key && normalizeTrigger(e.search_key) === normalized
    )

    if (match) {
      // Cocok -> isi Item Code dari catalog
      return { [itemCodeKey]: match.item_code }
    } else {
      // Tidak cocok -> kosongkan Item Code (SRS: "dikosongkan (NaN/kosong)")
      return { [itemCodeKey]: '' }
    }
  } catch (err) {
    console.warn('[itemCodeEngine] applyItemCodeMatching error:', err)
    return null // error non-blocking: biarkan value kolom pemicu tersimpan
  }
}

// ---------------------------------------------------------------------------
//  Autocomplete Suggestions (substring/mid-string search)
// ---------------------------------------------------------------------------

/**
 * Kembalikan rekomendasi dari reference_catalog berdasarkan teks yang sedang diketik.
 * Pencarian substring/mid-string (bukan hanya prefix) terhadap search_key.
 * Semua query dari Dexie cache (offline-first).
 *
 * Akan dipanggil oleh komponen EditableCell / DataGrid di Tahap 8c (UI autocomplete).
 *
 * @param {string} partialValue   - teks yang sedang diketik user (boleh sebagian)
 * @param {string} departmentId   - ID department aktif
 * @param {number} [limit=10]     - maks jumlah hasil yang dikembalikan
 * @returns {Promise<Array<{ id: number, search_key: string, item_code: string }>>}
 */
export async function getSuggestions(partialValue, departmentId, limit = 10) {
  if (!partialValue || !departmentId) return []
  const normalized = normalizeTrigger(partialValue)
  if (!normalized) return []

  try {
    const entries = await db.reference_catalog
      .where('department_id')
      .equals(departmentId)
      .toArray()

    return entries
      .filter(e => e.search_key && normalizeTrigger(e.search_key).includes(normalized))
      .slice(0, limit)
      .map(e => ({ id: e.id, search_key: e.search_key, item_code: e.item_code }))
  } catch (err) {
    console.warn('[itemCodeEngine] getSuggestions error:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
//  Tambah entry ke Reference Catalog (Admin only)
// ---------------------------------------------------------------------------

/**
 * Tambah entry baru ke reference_catalog (format SRS v2.0 par.7 revisi).
 * search_key dinormalisasi sebelum disimpan agar matching konsisten.
 * Dipanggil dari panel Admin (form satu per satu atau upload bulk).
 *
 * @param {string}  departmentId  - ID department
 * @param {Object}  components    - key-value sesuai columns_config applies_to="reference_catalog"
 * @param {string}  searchKey     - nilai kolom is_search_key=true (SELALU dinormalisasi sebelum simpan)
 * @param {string}  itemCode      - kode item (SELALU diisi manual Admin, tidak pernah auto-generated)
 * @param {string}  [source]      - 'manual' | 'upload' (default 'manual')
 * @returns {Promise<number>}     ID entry baru di Dexie
 */
export async function addCatalogEntry(departmentId, components, searchKey, itemCode, source = 'manual') {
  return db.reference_catalog.add({
    department_id: departmentId,
    components: components || {},
    search_key: normalizeTrigger(searchKey),
    item_code: itemCode,
    source,
    created_at: new Date().toISOString(),
  })
}
