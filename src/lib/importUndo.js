/**
 * importUndo.js — STUB untuk Phase 1-2
 *
 * Stub ini menggantikan modul importUndo Firebase yang sudah dihapus.
 * Pada Phase 3, fungsi ini akan diimplementasikan menggunakan PocketBase
 * (soft-delete records berdasarkan import_batch_id, dan update import_batches.status).
 *
 * SRS v2.0 §9.6 — Audit Trail & Import Undo
 */

/**
 * Batalkan (undo) satu import batch dengan menghapus semua record
 * yang terkait batch tersebut.
 *
 * @param {string}   importBatchId  - ID batch yang ingin di-undo
 * @param {function} [onProgress]   - callback(message: string) untuk update UI
 * @returns {Promise<{ rowsDeleted: number, locsDeleted: number }>}
 */
export async function undoImportBatch(importBatchId, onProgress) {
  // Phase 1-2 stub: simulasikan proses undo tanpa benar-benar menghapus data
  // TODO Phase 3: implementasi via PocketBase — soft-delete semua components
  //   dengan import_batch_id yang sesuai, lalu update import_batches.status='undone'

  if (typeof onProgress === 'function') {
    onProgress('Mensimulasikan pembatalan import...')
    await new Promise(resolve => setTimeout(resolve, 800))
    onProgress('Selesai.')
  }

  console.log(`[importUndo] Undo batch "${importBatchId}" — stub Phase 1-2 (tidak ada perubahan data nyata)`)

  return { rowsDeleted: 0, locsDeleted: 0 }
}
