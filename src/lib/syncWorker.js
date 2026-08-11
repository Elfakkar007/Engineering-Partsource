/**
 * syncWorker.js
 *
 * Background Sync Worker — memproses `sync_queue` di Dexie dan mendorong
 * perubahan ke PocketBase REST API ketika browser online.
 *
 * Algoritma per item (FIFO per entity_id, SRS §12.2):
 *  1. Ambil item status='pending' tertua per entity_id
 *  2. Tandai status='syncing'
 *  3. Kirim ke PocketBase (POST/PATCH untuk update, PATCH isDeleted untuk soft-delete)
 *  4. Jika sukses (2xx): hapus dari sync_queue, update pb_id + lastUpdated di components
 *  5. Jika gagal network: kembali 'pending', retry_count++, exponential backoff (cap 5 menit)
 *  6. Jika gagal 4xx (validasi/permission): tandai 'failed', tidak retry otomatis
 *
 * Sync di-trigger saat:
 *  (a) Event 'online' browser
 *  (b) Interval timer 15 detik saat online
 *  (c) Setiap kali useGridData melakukan operasi tulis (via triggerSync())
 */

import { db } from './db'
import { pb } from './pocketbase'

/* ------------------------------------------------------------------ */
/*  Konfigurasi                                                         */
/* ------------------------------------------------------------------ */

const COLLECTION = 'components'   // nama collection di PocketBase
const SYNC_INTERVAL_MS = 15_000   // coba sync tiap 15 detik saat online
const MAX_RETRY_COUNT = 5         // setelah N kali gagal → tandai 'failed'
const MAX_BACKOFF_MS = 5 * 60 * 1000 // backoff maksimum 5 menit

/* ------------------------------------------------------------------ */
/*  State internal                                                      */
/* ------------------------------------------------------------------ */

let _isSyncing = false       // guard agar tidak double-run
let _intervalId = null       // ID setInterval untuk cleanup
let _onStatusChange = null   // callback opsional untuk SyncStatusBar

/**
 * Daftarkan callback yang dipanggil saat status sync berubah.
 * SyncStatusBar dapat memanggil ini untuk mendapat update status.
 *
 * @param {function} cb - menerima { pendingCount, isSyncing, failedCount, lastSyncAt }
 */
export function onSyncStatusChange(cb) {
  _onStatusChange = cb
}

function emitStatus(data) {
  if (typeof _onStatusChange === 'function') {
    _onStatusChange(data)
  }
}

/* ------------------------------------------------------------------ */
/*  Backoff                                                             */
/* ------------------------------------------------------------------ */

function calcBackoffMs(retryCount) {
  // Exponential: 2^retry * 1000 ms, capped at MAX_BACKOFF_MS
  return Math.min(Math.pow(2, retryCount) * 1_000, MAX_BACKOFF_MS)
}

function isReadyToRetry(item) {
  if (!item.last_attempt_at) return true
  const elapsed = Date.now() - new Date(item.last_attempt_at).getTime()
  return elapsed >= calcBackoffMs(item.retry_count || 0)
}

/* ------------------------------------------------------------------ */
/*  Core sync logic                                                     */
/* ------------------------------------------------------------------ */

/**
 * Proses satu item dari sync_queue.
 * Mengembalikan true jika berhasil, false jika gagal.
 *
 * @param {Object} item - record dari tabel sync_queue
 */
async function processQueueItem(item) {
  const { id: queueId, entity_id, pb_id, operation, payload } = item

  try {
    let response

    if (operation === 'create') {
      // POST ke PocketBase
      const { id: localId, ...serverPayload } = payload // eslint-disable-line no-unused-vars
      // Hapus field-field yang hanya ada di Dexie lokal
      delete serverPayload.sync_status
      delete serverPayload.pb_id

      response = await pb.collection(COLLECTION).create(serverPayload)

      // Simpan PocketBase ID ke Dexie
      await db.components.update(entity_id, {
        pb_id: response.id,
        sync_status: 'synced',
        lastUpdated: response.updated || new Date().toISOString(),
      })

      // Update sync_queue item: operasi berikutnya pada entity ini
      // harus menggunakan pb_id, bukan null
      await db.sync_queue
        .where('entity_id').equals(entity_id)
        .and(q => q.status === 'pending')
        .modify(q => { q.pb_id = response.id })

    } else if (operation === 'update') {
      if (!pb_id) {
        // Belum ada PocketBase ID — baris ini belum pernah ter-sync
        // Skip untuk sekarang (akan dicoba lagi setelah 'create' berhasil)
        return false
      }

      // Bersihkan payload dari field lokal
      const { id: _localId, ...serverPayload } = payload // eslint-disable-line no-unused-vars
      delete serverPayload.sync_status
      delete serverPayload.pb_id

      response = await pb.collection(COLLECTION).update(pb_id, serverPayload)

      await db.components.update(entity_id, {
        sync_status: 'synced',
        lastUpdated: response.updated || new Date().toISOString(),
      })

    } else if (operation === 'delete') {
      if (!pb_id) {
        // Belum punya PocketBase ID — tidak perlu delete di server
        // Langsung hapus dari queue
        await db.sync_queue.delete(queueId)
        return true
      }

      await pb.collection(COLLECTION).delete(pb_id)
      // Hard delete dari PocketBase tapi record Dexie tetap ada (isDeleted=true)
    }

    // Sukses: hapus dari queue
    await db.sync_queue.delete(queueId)
    return true

  } catch (err) {
    const is4xx = err?.status >= 400 && err?.status < 500

    await db.sync_queue.update(queueId, {
      retry_count: (item.retry_count || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      error_message: err?.message || String(err),
      // Jika 4xx: tandai failed (tidak retry), jika network error: kembali pending
      status: (is4xx || (item.retry_count || 0) >= MAX_RETRY_COUNT) ? 'failed' : 'pending',
    })

    if (is4xx) {
      console.error(`[syncWorker] Gagal permanen (${err.status}) untuk queue item #${queueId}:`, err.message)
    } else {
      const nextRetry = calcBackoffMs(item.retry_count + 1)
      console.warn(`[syncWorker] Gagal sementara untuk queue item #${queueId}, retry dalam ${nextRetry / 1000}s`)
    }

    return false
  }
}

/**
 * Jalankan satu siklus sync: ambil semua item pending, proses satu per satu.
 * Guard dengan _isSyncing agar tidak berjalan dua kali bersamaan.
 */
async function runSyncCycle() {
  if (_isSyncing || !navigator.onLine) return
  _isSyncing = true

  try {
    // Ambil item pending, diurutkan by created_at (FIFO)
    const pendingItems = await db.sync_queue
      .where('status')
      .equals('pending')
      .sortBy('created_at')

    // Filter: hanya item yang sudah melewati backoff window
    const readyItems = pendingItems.filter(isReadyToRetry)

    if (readyItems.length === 0) {
      _isSyncing = false
      return
    }

    // Emit status: mulai syncing
    const failedCount = await db.sync_queue.where('status').equals('failed').count()
    emitStatus({ pendingCount: readyItems.length, isSyncing: true, failedCount })

    // Proses FIFO: satu per satu per entity_id agar urutan edit terjaga
    // Grup by entity_id, proses item tertua masing-masing entity
    const processedEntities = new Set()
    for (const item of readyItems) {
      if (processedEntities.has(item.entity_id)) continue
      processedEntities.add(item.entity_id)

      await db.sync_queue.update(item.id, { status: 'syncing' })
      await processQueueItem({ ...item, status: 'syncing' })
    }

    // Emit status: selesai
    const remainingPending = await db.sync_queue.where('status').equals('pending').count()
    const remainingFailed = await db.sync_queue.where('status').equals('failed').count()
    emitStatus({
      pendingCount: remainingPending,
      isSyncing: false,
      failedCount: remainingFailed,
      lastSyncAt: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[syncWorker] Error tak terduga saat sync:', err)
  } finally {
    _isSyncing = false
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Trigger sync segera (fire-and-forget).
 * Dipanggil oleh useGridData setiap kali ada operasi tulis.
 */
export function triggerSync() {
  // Jalankan async tanpa await — tidak memblokir UI
  runSyncCycle().catch(err => console.error('[syncWorker] triggerSync error:', err))
}

/**
 * Inisialisasi sync worker:
 *  - Pasang listener event 'online'
 *  - Mulai interval timer
 *  - Jalankan sync segera jika sudah online
 *
 * Dipanggil satu kali di App.jsx (useEffect dengan [] deps).
 */
export function initSyncWorker() {
  // Listener saat browser online kembali
  const handleOnline = () => {
    console.log('[syncWorker] Browser kembali online — mulai sync...')
    triggerSync()
  }
  window.addEventListener('online', handleOnline)

  // Interval timer 15 detik
  _intervalId = setInterval(() => {
    if (navigator.onLine) {
      runSyncCycle().catch(err => console.error('[syncWorker] Interval sync error:', err))
    }
  }, SYNC_INTERVAL_MS)

  // Sync segera saat init (jika sudah online)
  if (navigator.onLine) {
    triggerSync()
  }

  // Return cleanup function untuk dipanggil di useEffect cleanup
  return function cleanupSyncWorker() {
    window.removeEventListener('online', handleOnline)
    if (_intervalId) {
      clearInterval(_intervalId)
      _intervalId = null
    }
  }
}

/**
 * Retry semua item yang berstatus 'failed'.
 * Dipanggil dari SyncStatusBar/SyncDetailPopover tombol "Coba lagi".
 */
export async function retryFailedItems() {
  const failedItems = await db.sync_queue
    .where('status')
    .equals('failed')
    .toArray()

  if (!failedItems.length) return

  // Reset ke pending
  const ids = failedItems.map(i => i.id)
  await db.sync_queue
    .where('id')
    .anyOf(ids)
    .modify({
      status: 'pending',
      retry_count: 0,
      last_attempt_at: null,
      error_message: null,
    })

  triggerSync()
}

/**
 * Ambil snapshot status sync saat ini (untuk SyncDetailPopover).
 * @returns {Promise<{ pendingCount, syncingCount, failedCount }>}
 */
export async function getSyncStatus() {
  const [pendingCount, syncingCount, failedCount] = await Promise.all([
    db.sync_queue.where('status').equals('pending').count(),
    db.sync_queue.where('status').equals('syncing').count(),
    db.sync_queue.where('status').equals('failed').count(),
  ])
  return { pendingCount, syncingCount, failedCount }
}
