import Dexie from 'dexie'

export const db = new Dexie('plant_sourcing_v2')

/**
 * Schema v2.0 — Dynamic Config-Driven Engine
 *
 * Tabel utama:
 *   columns_config     — definisi kolom dinamis per Department (jantung Schema Engine)
 *   components         — baris data grid, `components` field berisi JSON key-value sesuai columns_config
 *   sync_queue         — antrian operasi offline yang belum ter-push ke PocketBase
 *   item_code_rules    — aturan generate kode material per Department
 *   reference_catalog  — catalog referensi kode untuk Dual-Matching
 *   import_batches     — record setiap import Excel untuk keperluan undo (SRS §9.6)
 *
 * Cache hierarki (untuk kebutuhan offline):
 *   lines_cache        — daftar Line dari PocketBase
 *   departments_cache  — daftar Department dari PocketBase
 *   locations_cache    — daftar Location dari PocketBase
 */
db.version(1).stores({
  // columns_config: definisi kolom per department_id, urut by `order`
  columns_config: '++id, department_id, key, order',

  // components: baris data grid
  // `components` field (JSON) menyimpan data sel sesuai columns_config aktif
  // Contoh: { col_1: "Line 1", col_4: "15A1CPDAC001", col_14: 2 }
  components: '++id, location_id, department_id, sync_status, isDeleted, lastUpdated',

  // sync_queue: operasi CRUD yang antri untuk di-push ke PocketBase
  // operation: 'create' | 'update' | 'delete'
  // status: 'pending' | 'syncing' | 'failed'
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',

  // item_code_rules: aturan generate kode per Department
  item_code_rules: '++id, department_id',

  // reference_catalog: catalog kode untuk matching otomatis
  reference_catalog: '++id, department_id',

  // Cache hierarki untuk kebutuhan offline-first
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
})

// Schema v2 — tambah tabel import_batches untuk undo import (SRS §9.6)
db.version(2).stores({
  // Semua tabel lama tidak berubah (cukup listing ulang untuk migrasi bersih)
  columns_config: '++id, department_id, key, order',
  components: '++id, location_id, department_id, import_batch_id, sync_status, isDeleted, lastUpdated',
  sync_queue: '++id, entity_type, entity_id, operation, status, created_at, retry_count',
  item_code_rules: '++id, department_id',
  reference_catalog: '++id, department_id',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',

  // NEW: tabel import_batches untuk mencatat setiap sesi import Excel
  // status: 'committed' | 'undone'
  import_batches: '++id, location_id, department_id, imported_at, status',
})

// Schema v3 — tambah tabel activity_log untuk audit trail lokal (SRS §5.2)
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

  // NEW: activity_log — immutable audit trail lokal
  // action: 'tambah_baris' | 'edit_sel' | 'hapus_baris' | 'import_excel' | 'ubah_skema' | dll
  activity_log: '++id, user_id, action, entity_type, timestamp',
})

