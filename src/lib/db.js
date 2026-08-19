import Dexie from 'dexie'

export const db = new Dexie('plant_sourcing_v2')

/**
 * Schema v4.0 — Unified Records Architecture
 *
 * Migration Note: 
 * - 'components' data migrated to 'records'
 * - Added 'app_settings' for local preference storage
 * - Added 'completion_exception_rules' for workflow validation
 */
db.version(1).stores({
  columns_config: '++id, department_id, key, order',
  components: '++id, location_id, department_id, sync_status, isDeleted, lastUpdated',
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',
  item_code_rules: '++id, department_id',
  reference_catalog: '++id, department_id',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
})

db.version(2).stores({
  columns_config: '++id, department_id, key, order',
  components: '++id, location_id, department_id, import_batch_id, sync_status, isDeleted, lastUpdated',
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',
  item_code_rules: '++id, department_id',
  reference_catalog: '++id, department_id',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
  import_batches: '++id, location_id, department_id, imported_at, status',
})

db.version(3).stores({
  columns_config: '++id, department_id, key, order',
  components: '++id, location_id, department_id, import_batch_id, sync_status, isDeleted, lastUpdated',
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',
  item_code_rules: '++id, department_id',
  reference_catalog: '++id, department_id',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
  import_batches: '++id, location_id, department_id, imported_at, status',
  activity_log: '++id, user_id, action, entity_type, timestamp',
})

db.version(4).stores({
  columns_config: '++id, department_id, key, order',
  records: '++id, location_id, department_id, import_batch_id, sync_status, isDeleted, lastUpdated',
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',
  item_code_rules: '++id, department_id',
  reference_catalog: '++id, department_id',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
  import_batches: '++id, location_id, department_id, imported_at, status',
  activity_log: '++id, user_id, action, entity_type, timestamp',
  completion_exception_rules: '++id, department_id, condition_column_key',
  app_settings: 'key',
}).upgrade(async tx => {
  // Migrasikan data dari tabel lama 'components' ke 'records'
  try {
    const oldComponents = await tx.table('components').toArray()
    if (oldComponents.length > 0) {
      await tx.table('records').bulkAdd(oldComponents)
      console.log(`[db v4 upgrade] Migrasi ${oldComponents.length} baris components → records berhasil.`)
    }
  } catch {
    // Fresh install: tabel components tidak ada, lewati
    console.log('[db v4 upgrade] Tidak ada data components untuk dimigrasikan (fresh install).')
  }
})

/**
 * Schema v5.0 — Item Code Revisi: Manual-Assisted Matching
 *
 * Perubahan (SRS v2.0 §7 revisi):
 * - `item_code_rules` DIHAPUS (deprecated) — tidak ada lagi template auto-generate
 * - `reference_catalog` diperbarui: tambah index `search_key` untuk pencarian cepat
 * - `records` diperbarui: tambah `item_code_mode` (auto|manual) per baris
 * - `columns_config` diperbarui: field baru applies_to, is_search_key, is_item_code_column
 *   (disimpan sebagai data JSON di record, tidak perlu index tambahan di Dexie)
 *
 * Data lama di `reference_catalog` (format match_signature lama) di-clear karena
 * formatnya tidak kompatibel dan isinya hanya data buatan engine (bukan data asli).
 */
db.version(5).stores({
  columns_config: '++id, department_id, key, order',
  records: '++id, location_id, department_id, import_batch_id, sync_status, isDeleted, item_code_mode, lastUpdated',
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',
  // item_code_rules: null — dihapus dari schema (Dexie: store yang tidak disebut tetap ada,
  // tapi menghilangkan dari definenya di versi baru tidak menghapus data secara otomatis;
  // kita biarkan store lama ada tapi tidak lagi dipakai secara eksplisit)
  reference_catalog: '++id, department_id, search_key',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
  import_batches: '++id, location_id, department_id, imported_at, status',
  activity_log: '++id, user_id, action, entity_type, timestamp',
  completion_exception_rules: '++id, department_id, condition_column_key',
  app_settings: 'key',
}).upgrade(async tx => {
  // Reset reference_catalog: format lama (match_signature) tidak kompatibel dengan format baru (search_key + components JSON)
  // Data ini hanya berisi entry buatan engine, bukan data asli penting
  try {
    await tx.table('reference_catalog').clear()
    console.log('[db v5 upgrade] reference_catalog di-reset (format skema berubah dari match_signature → search_key).')
  } catch {
    console.log('[db v5 upgrade] reference_catalog clear gagal (mungkin tabel kosong), lanjut.')
  }
})
