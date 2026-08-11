import Dexie from 'dexie'

export const db = new Dexie('plant_sourcing_v2')

// Skema tabel disesuaikan dengan instruksi prompt (dengan hierarchical cache)
db.version(1).stores({
  columns_config: '++id, department_id, key, order',
  components: '++id, location_id, department_id, sync_status',
  sync_queue: '++id, action, payload, timestamp, status',
  item_code_rules: '++id, department_id',
  reference_catalog: '++id, department_id, specification',
  lines_cache: 'id',
  departments_cache: 'id',
  locations_cache: 'id, line_id, department_id',
})
