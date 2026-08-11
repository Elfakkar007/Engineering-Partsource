/**
 * activityLog.js — STUB untuk Phase 1-2
 *
 * Stub ini menggantikan modul activityLog Firebase yang sudah dihapus.
 * Pada Phase 3, fungsi ini akan diimplementasikan menggunakan PocketBase
 * (POST ke collection `activity_log`).
 *
 * SRS v2.0 §5.2 — `activity_log` collection (immutable audit trail)
 */

/**
 * Catat aktivitas pengguna ke log.
 * Saat ini: hanya log ke konsol, belum push ke backend.
 *
 * @param {string} action      - mis. 'import_excel', 'edit_cell', 'bulk_delete'
 * @param {string} userId      - user ID / email
 * @param {Object} [detail]    - payload ringkas untuk UI log
 */
export async function logActivity(action, userId, detail = {}) {
  // Phase 1-2 stub: log ke konsol saja
  // TODO Phase 3: POST ke PocketBase collection `activity_log`
  console.log(`[activityLog] action=${action} user=${userId || 'anonymous'}`, detail)
}
