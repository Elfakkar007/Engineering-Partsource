/**
 * activityLog.js
 *
 * Implementasi audit trail lokal berbasis Dexie.js — SRS v2.0 §5.2
 *
 * Log bersifat append-only (immutable): tidak ada updateRule/deleteRule.
 * Data disimpan di tabel `activity_log` Dexie, sehingga tersedia offline.
 * Maks 500 entri lokal; entri lama otomatis dipangkas saat threshold dicapai.
 */

import { db } from './db'

const MAX_LOG_ENTRIES = 500
const PRUNE_TO = 400  // setelah pruning, sisakan N entri terbaru

/**
 * Catat aktivitas pengguna ke activity_log Dexie.
 *
 * @param {string} action       - mis. 'tambah_baris', 'import_excel', 'ubah_skema'
 * @param {string} userId       - user ID atau email
 * @param {Object} [detail]     - payload ringkas { location, dept, count, ... }
 * @param {string} [entityType] - 'record' | 'columns_config' | 'import_batch' | dll
 * @param {string} [entityId]   - ID entitas yang terlibat (opsional)
 */
export async function logActivity(action, userId, detail = {}, entityType = 'record', entityId = null) {
  try {
    await db.activity_log.add({
      user_id: userId || 'anonymous',
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      detail: JSON.stringify(detail),
      timestamp: new Date().toISOString(),
    })

    // Pruning: jika terlalu banyak entri, hapus yang paling lama
    const total = await db.activity_log.count()
    if (total > MAX_LOG_ENTRIES) {
      const oldest = await db.activity_log
        .orderBy('id')
        .limit(total - PRUNE_TO)
        .primaryKeys()
      await db.activity_log.bulkDelete(oldest)
    }
  } catch (err) {
    // Gagal log tidak boleh menghentikan operasi utama
    console.warn('[activityLog] gagal catat log:', err)
  }
}

/**
 * Ambil entri log terbaru, urut dari terbaru.
 *
 * @param {Object} [filters]
 * @param {string} [filters.action]      - filter by action
 * @param {string} [filters.entityType]  - filter by entity_type
 * @param {number} [limit]               - maks entri (default 200)
 * @returns {Promise<Object[]>}
 */
export async function getActivityLogs(filters = {}, limit = 200) {
  let query = db.activity_log.orderBy('id').reverse()

  const results = await query.limit(limit * 3).toArray()  // ambil lebih, lalu filter

  let filtered = results
  if (filters.action) {
    filtered = filtered.filter(e => e.action === filters.action)
  }
  if (filters.entityType) {
    filtered = filtered.filter(e => e.entity_type === filters.entityType)
  }

  return filtered.slice(0, limit).map(entry => ({
    ...entry,
    detail: (() => {
      try { return JSON.parse(entry.detail || '{}') } catch { return {} }
    })(),
  }))
}

/**
 * Hapus semua entri log (hanya untuk Admin — tidak dipanggil dari UI normal).
 */
export async function clearActivityLog() {
  return db.activity_log.clear()
}
