/**
 * useGridData.js
 *
 * Custom hook untuk mengelola data baris (`components`) secara local-first.
 *
 * Prinsip kerja:
 *  1. Setiap operasi CRUD ditulis ke Dexie.js DAHULU (offline-first)
 *  2. Setiap operasi CRUD secara ATOMIK juga mendaftarkan entry ke `sync_queue`
 *     menggunakan db.transaction('rw', [db.components, db.sync_queue], ...)
 *  3. Background sync worker (syncWorker.js) yang kemudian push antrian ke PocketBase
 *
 * Setiap item sync_queue menyimpan:
 *   entity_type   : 'component'
 *   entity_id     : ID lokal Dexie (sebelum dapat PocketBase ID)
 *   pb_id         : PocketBase ID (opsional, diisi setelah create berhasil sync)
 *   operation     : 'create' | 'update' | 'delete'
 *   payload       : snapshot data yang perlu di-push
 *   status        : 'pending' | 'syncing' | 'failed'
 *   retry_count   : 0
 *   created_at    : ISO string
 *   last_attempt_at: null
 *   error_message : null
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { triggerSync } from '../lib/syncWorker'
import { matchReferenceCode, generateItemCode } from '../lib/itemCodeEngine'
import { enqueueSheetSync } from '../lib/sheetsSync'

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function nowISO() {
  return new Date().toISOString()
}

/**
 * Buat entry sync_queue standar.
 * @param {'create'|'update'|'delete'} operation
 * @param {number} entityId - Dexie local id
 * @param {Object} payload  - data yang di-push ke server
 * @param {string} [pbId]   - PocketBase ID jika sudah diketahui
 */
function makeSyncEntry(operation, entityId, payload, pbId = null) {
  return {
    entity_type: 'component',
    entity_id: entityId,
    pb_id: pbId,
    operation,
    payload,
    status: 'pending',
    retry_count: 0,
    created_at: nowISO(),
    last_attempt_at: null,
    error_message: null,
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                                */
/* ------------------------------------------------------------------ */

/**
 * @param {string} locationId    - ID lokasi aktif
 * @param {string} departmentId  - ID department aktif
 */
export function useGridData(locationId, departmentId) {
  // Reactive query — hanya baris aktif (isDeleted=false) untuk lokasi ini
  const rows = useLiveQuery(
    () => {
      if (!locationId || !departmentId) return []
      return db.components
        .where('[location_id+isDeleted]')
        // Compound index belum tersedia di schema v1 — gunakan filter manual
        .filter(row =>
          row.location_id === locationId &&
          row.department_id === departmentId &&
          row.isDeleted !== true
        )
        // Workaround: query semua dari location_id lalu filter
        // (compound index dapat ditambahkan di db versi berikutnya)
        .toArray()
        .then(all =>
          all
            .filter(r => r.department_id === departmentId && !r.isDeleted)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        )
    },
    [locationId, departmentId],
    []
  )

  /* ------------------------------------------------------------------ */
  /*  CREATE — tambah satu baris kosong                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Tambah satu baris kosong ke lokasi + department aktif.
   * Atomik: tulis ke `components` dan daftarkan ke `sync_queue` bersamaan.
   *
   * @param {string} [createdBy] - user ID atau email untuk audit trail
   * @returns {Promise<number>} Dexie ID baris baru
   */
  async function addRow(createdBy = '') {
    if (!locationId || !departmentId) throw new Error('locationId dan departmentId diperlukan')

    const now = nowISO()
    const newRow = {
      location_id: locationId,
      department_id: departmentId,
      pb_id: null,        // diisi setelah berhasil sync ke PocketBase
      components: {},     // key-value sesuai columns_config Department
      status_completeness: false,
      flag: null,
      flag_note: null,
      isDeleted: false,
      deletedAt: null,
      created_by: createdBy,
      last_edited_by: createdBy,
      created_at: now,
      lastUpdated: now,
      sync_status: 'pending',
    }

    let newId
    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      newId = await db.components.add(newRow)
      await db.sync_queue.add(makeSyncEntry('create', newId, { ...newRow, id: newId }))
    })

    // Coba sync segera (fire-and-forget)
    triggerSync()

    return newId
  }

  /* ------------------------------------------------------------------ */
  /*  BULK CREATE — tambah N baris kosong sekaligus                      */
  /* ------------------------------------------------------------------ */

  /**
   * @param {number} count       - jumlah baris yang ditambahkan (max 100)
   * @param {string} [createdBy]
   * @returns {Promise<number[]>} array Dexie ID baris baru
   */
  async function bulkAddRows(count, createdBy = '') {
    if (!locationId || !departmentId) throw new Error('locationId dan departmentId diperlukan')
    const safeCount = Math.max(1, Math.min(100, Math.floor(count)))

    const now = nowISO()
    const newIds = []

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      for (let i = 0; i < safeCount; i++) {
        const row = {
          location_id: locationId,
          department_id: departmentId,
          pb_id: null,
          components: {},
          status_completeness: false,
          flag: null,
          flag_note: null,
          isDeleted: false,
          deletedAt: null,
          created_by: createdBy,
          last_edited_by: createdBy,
          created_at: now,
          lastUpdated: now,
          sync_status: 'pending',
        }
        const id = await db.components.add(row)
        newIds.push(id)
        await db.sync_queue.add(makeSyncEntry('create', id, { ...row, id }))
      }
    })

    triggerSync()
    return newIds
  }

  /* ------------------------------------------------------------------ */
  /*  UPDATE — simpan perubahan satu sel                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Update nilai satu sel (satu key dalam `components` JSON).
   * Jika kolom memiliki is_ref_trigger=true, jalankan Reference Catalog Matching.
   * Jika tidak ada match di catalog, generate item code dari template rule.
   * Atomik: update Dexie + daftarkan ke sync_queue bersamaan.
   *
   * @param {number} rowId       - Dexie local ID baris
   * @param {string} colKey      - key kolom (mis. 'col_11')
   * @param {*}      value       - nilai baru
   * @param {string} [editedBy]  - user ID/email
   * @param {Object} [colMeta]   - metadata kolom dari columns_config (opsional, untuk ref_trigger check)
   */
  async function updateCell(rowId, colKey, value, editedBy = '', colMeta = null) {
    const now = nowISO()

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      // Ambil baris saat ini untuk dapat snapshot payload lengkap
      const row = await db.components.get(rowId)
      if (!row) throw new Error(`Baris dengan ID ${rowId} tidak ditemukan`)

      let updatedComponents = { ...row.components, [colKey]: value }

      // ---- Item Code Engine: ref_trigger check ----
      // Jalankan matching jika kolom ini bertanda is_ref_trigger=true
      const isRefTrigger = colMeta?.is_ref_trigger === true
      if (isRefTrigger && value) {
        try {
          const matchResult = await matchReferenceCode(colKey, value, row.department_id)
          if (matchResult.matched && matchResult.item_code) {
            // Temukan target_column_key dari item_code_rules department ini
            const rule = await db.item_code_rules
              .where('department_id').equals(row.department_id).first()
            const targetKey = rule?.target_column_key
            if (targetKey && targetKey !== colKey) {
              // Auto-fill kolom kode material (is_auto: true)
              updatedComponents = { ...updatedComponents, [targetKey]: matchResult.item_code }
            }
          } else if (!matchResult.matched) {
            // Tidak ada match di catalog → generate kode baru dari template
            const generatedCode = await generateItemCode(
              { ...row, components: updatedComponents },
              row.department_id
            )
            if (generatedCode) {
              const rule = await db.item_code_rules
                .where('department_id').equals(row.department_id).first()
              const targetKey = rule?.target_column_key
              if (targetKey && !updatedComponents[targetKey]) {
                updatedComponents = { ...updatedComponents, [targetKey]: generatedCode }
              }
            }
          }
        } catch (engineErr) {
          // Engine error tidak boleh menghentikan save
          console.warn('[useGridData] itemCodeEngine error (non-blocking):', engineErr)
        }
      }

      // Update Dexie
      await db.components.update(rowId, {
        components: updatedComponents,
        last_edited_by: editedBy,
        lastUpdated: now,
        sync_status: 'pending',
      })

      // Daftarkan ke sync_queue
      const payload = {
        id: rowId,
        pb_id: row.pb_id,
        location_id: row.location_id,
        department_id: row.department_id,
        components: updatedComponents,
        last_edited_by: editedBy,
        lastUpdated: now,
      }
      await db.sync_queue.add(makeSyncEntry('update', rowId, payload, row.pb_id))
    })

    // Enqueue ke Sheets sync (fire-and-forget)
    enqueueSheetSync({
      operation: 'update',
      entity_id: rowId,
      department_id: departmentId,
      location_id: locationId,
    })

    triggerSync()
  }

  /* ------------------------------------------------------------------ */
  /*  UPDATE FLAG — set flag & flag_note pada satu baris                 */
  /* ------------------------------------------------------------------ */

  /**
   * @param {number} rowId
   * @param {'perlu_ditanyakan'|'dilewati'|null} flag
   * @param {string} [flagNote]
   * @param {string} [editedBy]
   */
  async function updateFlag(rowId, flag, flagNote = null, editedBy = '') {
    const now = nowISO()

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      const row = await db.components.get(rowId)
      if (!row) throw new Error(`Baris dengan ID ${rowId} tidak ditemukan`)

      await db.components.update(rowId, {
        flag,
        flag_note: flagNote,
        last_edited_by: editedBy,
        lastUpdated: now,
        sync_status: 'pending',
      })

      const payload = {
        id: rowId,
        pb_id: row.pb_id,
        flag,
        flag_note: flagNote,
        lastUpdated: now,
      }
      await db.sync_queue.add(makeSyncEntry('update', rowId, payload, row.pb_id))
    })

    triggerSync()
  }

  /* ------------------------------------------------------------------ */
  /*  DELETE (soft) — set isDeleted=true                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Soft delete satu baris.
   *
   * @param {number} rowId
   * @param {string} [deletedBy]
   */
  async function deleteRow(rowId, deletedBy = '') {
    const now = nowISO()

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      const row = await db.components.get(rowId)
      if (!row) throw new Error(`Baris dengan ID ${rowId} tidak ditemukan`)

      await db.components.update(rowId, {
        isDeleted: true,
        deletedAt: now,
        last_edited_by: deletedBy,
        lastUpdated: now,
        sync_status: 'pending',
      })

      const payload = {
        id: rowId,
        pb_id: row.pb_id,
        isDeleted: true,
        deletedAt: now,
      }
      await db.sync_queue.add(makeSyncEntry('update', rowId, payload, row.pb_id))
    })

    triggerSync()
  }

  /* ------------------------------------------------------------------ */
  /*  BULK DELETE (soft)                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * @param {number[]} rowIds
   * @param {string}   [deletedBy]
   */
  async function bulkDeleteRows(rowIds, deletedBy = '') {
    if (!rowIds?.length) return
    const now = nowISO()

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      for (const rowId of rowIds) {
        const row = await db.components.get(rowId)
        if (!row) continue

        await db.components.update(rowId, {
          isDeleted: true,
          deletedAt: now,
          last_edited_by: deletedBy,
          lastUpdated: now,
          sync_status: 'pending',
        })

        await db.sync_queue.add(
          makeSyncEntry('update', rowId, { id: rowId, pb_id: row.pb_id, isDeleted: true, deletedAt: now }, row.pb_id)
        )
      }
    })

    triggerSync()
  }

  /* ------------------------------------------------------------------ */
  /*  BULK FILL — isi satu kolom ke banyak baris sekaligus               */
  /* ------------------------------------------------------------------ */

  /**
   * @param {number[]} rowIds
   * @param {string}   colKey
   * @param {*}        value
   * @param {string}   [editedBy]
   */
  async function bulkFillColumn(rowIds, colKey, value, editedBy = '') {
    if (!rowIds?.length) return
    const now = nowISO()

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      for (const rowId of rowIds) {
        const row = await db.components.get(rowId)
        if (!row) continue

        const updatedComponents = { ...row.components, [colKey]: value }
        await db.components.update(rowId, {
          components: updatedComponents,
          last_edited_by: editedBy,
          lastUpdated: now,
          sync_status: 'pending',
        })

        const payload = {
          id: rowId,
          pb_id: row.pb_id,
          components: updatedComponents,
          lastUpdated: now,
        }
        await db.sync_queue.add(makeSyncEntry('update', rowId, payload, row.pb_id))
      }
    })

    triggerSync()
  }

  /* ------------------------------------------------------------------ */
  /*  BULK INSERT — import dari Excel (dengan batch tracking)             */
  /* ------------------------------------------------------------------ */

  /**
   * Insert banyak baris sekaligus dari hasil import Excel.
   * Setiap baris ditandai dengan import_batch_id untuk keperluan undo.
   *
   * @param {Object[]} componentsList  - array of components objects { col_key: value }
   * @param {number}   importBatchId   - ID dari import_batches
   * @param {string}   [createdBy]
   * @returns {Promise<number[]>}  array Dexie ID baris baru
   */
  async function bulkInsertRows(componentsList, importBatchId, createdBy = '') {
    if (!locationId || !departmentId) throw new Error('locationId dan departmentId diperlukan')
    if (!componentsList?.length) return []

    const now = nowISO()
    const newIds = []

    await db.transaction('rw', [db.components, db.sync_queue], async () => {
      for (const comps of componentsList) {
        const row = {
          location_id: locationId,
          department_id: departmentId,
          pb_id: null,
          components: comps || {},
          status_completeness: false,
          flag: null,
          flag_note: null,
          isDeleted: false,
          deletedAt: null,
          import_batch_id: importBatchId,
          created_by: createdBy,
          last_edited_by: createdBy,
          created_at: now,
          lastUpdated: now,
          sync_status: 'pending',
        }
        const id = await db.components.add(row)
        newIds.push(id)
        await db.sync_queue.add(makeSyncEntry('create', id, { ...row, id }))
      }
    })

    triggerSync()
    return newIds
  }

  return {
    rows: rows || [],
    isLoading: rows === undefined,
    addRow,
    bulkAddRows,
    updateCell,
    updateFlag,
    deleteRow,
    bulkDeleteRows,
    bulkFillColumn,
    bulkInsertRows,
  }
}
