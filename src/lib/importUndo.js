/**
 * importUndo.js
 *
 * Implementasi Undo Import berbasis Dexie.js 鈥?SRS v2.0 搂9.6
 *
 * Prinsip:
 *  - Setiap import mencatat import_batch_id di setiap baris yang diimpor
 *  - Undo = soft-delete seluruh baris dengan import_batch_id tersebut
 *  - Status import_batches diupdate ke 'undone'
 *
 * Undo bersifat lintas halaman: batch terakhir yang bisa di-undo disimpan
 * di module state dan dapat diakses dari context level atas (AppShell).
 */

import { db } from './db'

/* ------------------------------------------------------------------ */
/*  Module state 鈥?batch terakhir yang bisa di-undo                     */
/* ------------------------------------------------------------------ */

let _lastUndoableBatch = null  // { batchId, rowCount, location, importedAt }
let _onUndoStateChange = null  // callback untuk update UI

/**
 * Daftarkan callback yang dipanggil saat state undoable batch berubah.
 * @param {Function} cb - ({ batchId, rowCount, importedAt } | null) => void
 */
export function onImportUndoStateChange(cb) {
  _onUndoStateChange = cb
}

function emitUndoState(state) {
  _lastUndoableBatch = state
  if (typeof _onUndoStateChange === 'function') {
    _onUndoStateChange(state)
  }
}

export function getLastUndoableBatch() {
  return _lastUndoableBatch
}

/* ------------------------------------------------------------------ */
/*  Catat Import Batch ke Dexie                                         */
/* ------------------------------------------------------------------ */

/**
 * Buat record import_batches baru di Dexie.
 * Dipanggil sebelum bulk insert dimulai.
 *
 * @param {Object} opts
 * @param {string} opts.locationId
 * @param {string} opts.departmentId
 * @param {number} opts.rowCount
 * @param {string} [opts.importedBy]
 * @param {Object} [opts.columnMappingSnapshot] - snapshot mapping saat import
 * @returns {Promise<number>} batchId (Dexie auto-increment)
 */
export async function createImportBatch({ locationId, departmentId, rowCount, importedBy = '', columnMappingSnapshot = null }) {
  const now = new Date().toISOString()
  const batchId = await db.import_batches.add({
    location_id: locationId,
    department_id: departmentId,
    row_count: rowCount,
    imported_by: importedBy,
    imported_at: now,
    status: 'committed',
    column_mapping_snapshot: columnMappingSnapshot ? JSON.stringify(columnMappingSnapshot) : null,
  })

  // Update module state agar tombol Undo muncul
  emitUndoState({
    batchId,
    rowCount,
    locationId,
    departmentId,
    importedAt: now,
  })

  return batchId
}

/* ------------------------------------------------------------------ */
/*  Undo Import Batch                                                    */
/* ------------------------------------------------------------------ */

/**
 * Batalkan satu import batch dengan soft-delete seluruh record-nya.
 *
 * @param {number}   batchId     - ID dari import_batches
 * @param {Function} [onProgress] - callback(message: string) untuk update UI
 * @returns {Promise<{ rowsDeleted: number }>}
 */
export async function undoImportBatch(batchId, onProgress) {
  if (!batchId) throw new Error('batchId diperlukan untuk undo import')

  if (typeof onProgress === 'function') onProgress('Memuat daftar baris yang diimpor...')

  // Ambil semua baris dengan import_batch_id ini
  const rows = await db.records
    .where('import_batch_id')
    .equals(batchId)
    .toArray()

  if (typeof onProgress === 'function') onProgress(`Menghapus ${rows.length} baris yang diimpor...`)

  const now = new Date().toISOString()
  let deleted = 0

  // Soft-delete secara atomik dalam satu transaction
  await db.transaction('rw', [db.records, db.import_batches], async () => {
    for (const row of rows) {
      await db.records.update(row.id, {
        isDeleted: true,
        deletedAt: now,
        lastUpdated: now,
        sync_status: 'pending',
      })
      deleted++
    }

    // Update status batch ke 'undone'
    await db.import_batches.update(batchId, { status: 'undone' })
  })

  if (typeof onProgress === 'function') onProgress(`${deleted} baris berhasil dibatalkan.`)

  // Clear undo state (hanya bisa undo sekali)
  emitUndoState(null)

  return { rowsDeleted: deleted }
}

/* ------------------------------------------------------------------ */
/*  Ambil histori import batches                                         */
/* ------------------------------------------------------------------ */

/**
 * Ambil semua import batches untuk lokasi tertentu, urut terbaru dulu.
 *
 * @param {string} locationId
 * @param {string} departmentId
 * @returns {Promise<Object[]>}
 */
export async function getImportBatches(locationId, departmentId) {
  const all = await db.import_batches
    .where('location_id')
    .equals(locationId)
    .and(b => b.department_id === departmentId)
    .toArray()

  return all.sort((a, b) => new Date(b.imported_at) - new Date(a.imported_at))
}
