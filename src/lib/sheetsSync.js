/**
 * sheetsSync.js
 *
 * Google Sheets Sync Queue Service — SRS v2.0 §8
 *
 * Arsitektur (sesuai SRS §2.1):
 *   Push ke Google Sheets TIDAK pernah dilakukan langsung dari client.
 *   Client hanya memanggil webhook URL (Google Apps Script Web App / PocketBase hook)
 *   yang kemudian server-side yang mem-push ke Sheets API.
 *
 * URL webhook dikonfigurasi melalui environment variable:
 *   VITE_SHEETS_WEBHOOK_URL — URL Google Apps Script Web App endpoint
 *
 * Jika URL tidak dikonfigurasi, semua panggilan adalah no-op (silent skip).
 *
 * Antrian lokal (Dexie sync_queue) digunakan sebagai buffer:
 *   - Saat online, tiap perubahan langsung di-forward via webhook
 *   - Saat offline, antrean di-hold dan di-forward saat reconnect
 */

/* ------------------------------------------------------------------ */
/*  Config                                                               */
/* ------------------------------------------------------------------ */

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL || null
const BATCH_DEBOUNCE_MS = 5_000  // 5 detik buffer sebelum kirim batch
const MAX_RETRY = 3

let _pendingBatch = []
let _debounceTimer = null
let _lastPushedAt = null

/* ------------------------------------------------------------------ */
/*  Status                                                               */
/* ------------------------------------------------------------------ */

let _onStatusChange = null

/**
 * Daftarkan callback untuk perubahan status Sheets sync.
 * @param {Function} cb - (status: 'idle'|'pushing'|'failed', lastPushedAt: string|null) => void
 */
export function onSheetsSyncStatusChange(cb) {
  _onStatusChange = cb
}

function emit(status) {
  if (typeof _onStatusChange === 'function') {
    _onStatusChange({ status, lastPushedAt: _lastPushedAt })
  }
}

/* ------------------------------------------------------------------ */
/*  Enqueue — panggil setiap kali ada perubahan data                    */
/* ------------------------------------------------------------------ */

/**
 * Tambahkan satu perubahan ke antrian sheets sync.
 * Pengiriman di-debounce 5 detik untuk batching otomatis.
 *
 * @param {Object} change
 * @param {string} change.operation     - 'create' | 'update' | 'delete'
 * @param {number} change.entity_id     - Dexie local ID
 * @param {string} change.department_id
 * @param {string} change.location_id
 * @param {Object} change.components    - data sel { col_key: value }
 */
export function enqueueSheetSync(change) {
  if (!WEBHOOK_URL) return  // Webhook tidak dikonfigurasi → no-op

  _pendingBatch.push({ ...change, queued_at: new Date().toISOString() })

  // Debounce: tunggu 5 detik setelah perubahan terakhir sebelum push
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    flushBatch()
  }, BATCH_DEBOUNCE_MS)
}

/* ------------------------------------------------------------------ */
/*  Flush — kirim seluruh antrian ke webhook                            */
/* ------------------------------------------------------------------ */

/**
 * Kirim semua antrean ke webhook Google Apps Script secara batch.
 * Dapat dipanggil manual (mis. tombol "Push to Sheets" di Admin panel).
 *
 * @returns {Promise<{ pushed: number, failed: number }>}
 */
export async function flushBatch() {
  if (!WEBHOOK_URL) {
    console.info('[sheetsSync] Webhook URL tidak dikonfigurasi — skip push to Sheets.')
    return { pushed: 0, failed: 0 }
  }

  if (_pendingBatch.length === 0) return { pushed: 0, failed: 0 }

  const batch = [..._pendingBatch]
  _pendingBatch = []

  emit('pushing')

  let attempt = 0
  while (attempt < MAX_RETRY) {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: batch, pushed_at: new Date().toISOString() }),
      })

      if (res.ok) {
        _lastPushedAt = new Date().toISOString()
        emit('idle')
        console.info(`[sheetsSync] Berhasil push ${batch.length} perubahan ke Sheets.`)
        return { pushed: batch.length, failed: 0 }
      }

      // HTTP error (4xx/5xx)
      const errText = await res.text().catch(() => res.status)
      console.warn(`[sheetsSync] HTTP ${res.status}: ${errText}`)

      // 4xx → tidak perlu retry (validasi/permission error)
      if (res.status >= 400 && res.status < 500) break

    } catch (networkErr) {
      // Network error → retry dengan backoff
      console.warn(`[sheetsSync] Network error (attempt ${attempt + 1}):`, networkErr.message)
    }

    attempt++
    if (attempt < MAX_RETRY) {
      const backoff = Math.min(1000 * 2 ** attempt, 30_000)
      await new Promise(r => setTimeout(r, backoff))
    }
  }

  // Semua retry gagal → kembalikan batch ke antrian dan emit failed
  _pendingBatch = [...batch, ..._pendingBatch]
  emit('failed')
  console.error('[sheetsSync] Gagal push ke Sheets setelah semua retry.')
  return { pushed: 0, failed: batch.length }
}

/* ------------------------------------------------------------------ */
/*  Manual push (tombol "Push to Sheets Now" di Admin)                  */
/* ------------------------------------------------------------------ */

/**
 * Trigger push segera, bypass debounce timer.
 * @returns {Promise<{ pushed: number, failed: number }>}
 */
export async function pushNow() {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  return flushBatch()
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                       */
/* ------------------------------------------------------------------ */

export function getSheetsSyncStatus() {
  return {
    webhookConfigured: Boolean(WEBHOOK_URL),
    pendingCount: _pendingBatch.length,
    lastPushedAt: _lastPushedAt,
  }
}
