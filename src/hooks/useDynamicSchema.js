/**
 * useDynamicSchema.js
 *
 * Custom hook untuk membaca dan mengelola konfigurasi kolom dinamis (`columns_config`)
 * dari Dexie.js berdasarkan `department_id`.
 *
 * Menggunakan `useLiveQuery` agar komponen grid otomatis re-render
 * ketika Admin mengubah skema kolom — tanpa refresh manual.
 *
 * API yang disediakan:
 *   columns       — array kolom terurut (order asc), filtered is_visible=true
 *   allColumns    — semua kolom tanpa filter
 *   isLoading     — boolean saat query belum selesai
 *   addColumn     — tambah kolom baru
 *   updateColumn  — edit metadata kolom (label, type, flags)
 *   removeColumn  — hapus kolom (soft: set is_visible=false, atau hard delete)
 *   reorderColumns— update urutan kolom via array ID berurutan
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

/**
 * Generate key kolom dari label teks.
 * Contoh: "Sub Machine" → "col_sub_machine"
 *
 * @param {string} label
 * @returns {string}
 */
export function generateColumnKey(label) {
  return 'col_' + label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * @param {string} departmentId
 */
export function useDynamicSchema(departmentId) {
  // Live query — reaktif: update otomatis saat Dexie berubah
  const allColumns = useLiveQuery(
    () => {
      if (!departmentId) return []
      return db.columns_config
        .where('department_id')
        .equals(departmentId)
        .sortBy('order')
    },
    [departmentId],
    [] // default sebelum query selesai
  )

  const isLoading = allColumns === undefined

  // Kolom yang tampil di grid: hanya yang is_visible=true, sudah terurut
  const columns = (allColumns || []).filter(col => col.is_visible !== false)

  /* ------------------------------------------------------------------ */
  /*  CRUD & Reorder                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Tambah kolom baru ke department ini.
   *
   * @param {Object} colDef - definisi kolom
   * @param {string} colDef.label
   * @param {string} colDef.type - 'text' | 'number' | 'select' | 'gdrive_link'
   * @param {boolean} [colDef.is_required]
   * @param {boolean} [colDef.is_visible]
   * @param {boolean} [colDef.is_editable_by_pic]
   * @param {boolean} [colDef.is_ref_trigger]
   * @param {Array}   [colDef.select_options]
   * @returns {Promise<number>} ID baris baru di Dexie
   */
  async function addColumn(colDef) {
    if (!departmentId) throw new Error('departmentId diperlukan')
    if (!colDef.label?.trim()) throw new Error('label kolom tidak boleh kosong')

    // Cek duplikasi key dalam department ini
    const key = colDef.key || generateColumnKey(colDef.label)
    const existingKey = await db.columns_config
      .where('department_id').equals(departmentId)
      .and(col => col.key === key)
      .first()

    if (existingKey) {
      throw new Error(`Key "${key}" sudah ada di department ini. Gunakan label yang berbeda.`)
    }

    // Tentukan order: di belakang kolom terakhir
    const maxOrder = (allColumns || []).reduce((max, col) => Math.max(max, col.order || 0), 0)

    const now = new Date().toISOString()
    return db.columns_config.add({
      department_id: departmentId,
      key,
      label: colDef.label.trim(),
      type: colDef.type || 'text',
      order: maxOrder + 1,
      is_required: colDef.is_required ?? false,
      is_visible: colDef.is_visible ?? true,
      is_editable_by_pic: colDef.is_editable_by_pic ?? true,
      is_ref_trigger: colDef.is_ref_trigger ?? false,
      is_auto: colDef.is_auto ?? false,
      is_readonly: colDef.is_readonly ?? false,
      select_options: colDef.select_options || [],
      created_at: now,
      updated_at: now,
    })
  }

  /**
   * Update metadata kolom: label, type, flags, select_options.
   * Key dan department_id TIDAK bisa diubah setelah kolom dipakai data.
   *
   * @param {number} id - ID di Dexie (++id auto-increment)
   * @param {Object} changes - partial fields yang berubah
   */
  async function updateColumn(id, changes) {
    // Guard: jangan izinkan perubahan key setelah dibuat
    const { key, department_id, ...safeChanges } = changes // eslint-disable-line no-unused-vars

    safeChanges.updated_at = new Date().toISOString()
    return db.columns_config.update(id, safeChanges)
  }

  /**
   * Sembunyikan kolom dari grid (soft hide — data historis tetap ada).
   * Untuk hard delete, gunakan removeColumn(id, { hard: true }).
   *
   * @param {number} id
   * @param {Object} [opts]
   * @param {boolean} [opts.hard] - jika true, hapus record dari Dexie (hanya aman jika belum ada data)
   */
  async function removeColumn(id, { hard = false } = {}) {
    if (hard) {
      return db.columns_config.delete(id)
    }
    // Soft hide: sembunyikan dari grid, key tetap ada untuk kompatibilitas data lama
    return db.columns_config.update(id, {
      is_visible: false,
      updated_at: new Date().toISOString(),
    })
  }

  /**
   * Ubah urutan kolom.
   * Menerima array ID kolom dalam urutan baru yang diinginkan.
   *
   * @param {number[]} orderedIds - array Dexie ID kolom dalam urutan baru
   */
  async function reorderColumns(orderedIds) {
    if (!orderedIds?.length) return

    const now = new Date().toISOString()
    // Batch update order field sesuai posisi di array
    await db.transaction('rw', db.columns_config, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.columns_config.update(orderedIds[i], {
          order: i + 1,
          updated_at: now,
        })
      }
    })
  }

  return {
    columns,
    allColumns: allColumns || [],
    isLoading,
    addColumn,
    updateColumn,
    removeColumn,
    reorderColumns,
  }
}
