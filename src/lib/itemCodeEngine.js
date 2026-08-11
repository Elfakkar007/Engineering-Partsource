/**
 * itemCodeEngine.js
 *
 * Dynamic Item Code Engine — SRS v2.0 §7
 *
 * Dua fungsi utama:
 *   1. matchReferenceCode(colKey, value, departmentId)
 *      — Cari di `reference_catalog` saat kolom is_ref_trigger=true berubah.
 *        Jika ada match → kembalikan { matched: true, item_code, ... }
 *
 *   2. generateItemCode(row, columns, departmentId)
 *      — Parse template dari `item_code_rules` dan generate kode baru
 *        untuk baris yang belum punya kode dan tidak ada catalog match.
 *
 * Catatan arsitektur (SRS §7):
 *   Increment `next_seq` yang atomic HARUS di server (PocketBase hook) untuk
 *   menghindari duplikasi saat dua device sync bersamaan. Client-side engine ini
 *   hanya men-generate kode berbasis data lokal untuk preview/offline; saat sync
 *   ke PocketBase, server akan re-generate dengan seq resmi jika diperlukan.
 */

import { db } from './db'

/* ------------------------------------------------------------------ */
/*  Normalisasi teks untuk matching                                     */
/* ------------------------------------------------------------------ */

/**
 * Normalisasi value untuk key matching: lowercase, trim, collapse spaces.
 * @param {*} val
 * @returns {string}
 */
function normalize(val) {
  if (val === null || val === undefined) return ''
  return String(val).toLowerCase().trim().replace(/\s+/g, ' ')
}

/* ------------------------------------------------------------------ */
/*  1. Reference Catalog Matching                                        */
/* ------------------------------------------------------------------ */

/**
 * Cari match di reference_catalog berdasarkan nilai kolom trigger.
 *
 * Algoritma (SRS §5.2 Dual-Matching):
 *   - Bangun match_signature dari colKey + value (normalized)
 *   - Query semua catalog entries untuk department ini
 *   - Bandingkan normalized value
 *
 * @param {string} colKey         - key kolom yang memicu (is_ref_trigger=true), e.g. 'col_11'
 * @param {string} value          - nilai baru yang dimasukkan user
 * @param {string} departmentId   - ID department aktif
 * @returns {Promise<{ matched: boolean, item_code?: string, catalog_id?: number } | null>}
 */
export async function matchReferenceCode(colKey, value, departmentId) {
  if (!colKey || !value || !departmentId) return { matched: false }

  const normalizedVal = normalize(value)
  if (!normalizedVal) return { matched: false }

  try {
    // Query semua catalog entries untuk department ini
    const entries = await db.reference_catalog
      .where('department_id')
      .equals(departmentId)
      .toArray()

    // Cari entry yang match_signature-nya mengandung colKey dengan nilai yang sama
    const match = entries.find(entry => {
      if (!entry.match_signature) return false
      let sig = entry.match_signature
      // match_signature bisa berupa JSON string atau object
      if (typeof sig === 'string') {
        try { sig = JSON.parse(sig) } catch { return false }
      }
      const sigVal = sig[colKey]
      return sigVal !== undefined && normalize(sigVal) === normalizedVal
    })

    if (match) {
      return {
        matched: true,
        item_code: match.item_code,
        catalog_id: match.id,
        source: match.source,
      }
    }
  } catch (err) {
    console.warn('[itemCodeEngine] matchReferenceCode error:', err)
  }

  return { matched: false }
}

/* ------------------------------------------------------------------ */
/*  2. Template Parser & Item Code Generator                            */
/* ------------------------------------------------------------------ */

/**
 * Sanitasi nilai komponen kode: uppercase, hapus spasi & karakter non-alfanumerik
 * (disesuaikan dengan konvensi kode part pabrik).
 *
 * @param {string} val
 * @returns {string}
 */
function sanitizeCodePart(val) {
  if (!val) return ''
  return String(val)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) // batasi maks 8 karakter per segmen
}

/**
 * Parse template string dan generate kode berdasarkan nilai baris + counter lokal.
 *
 * Template format (SRS §5.2):
 *   {col_KEY}   → nilai row.components[col_KEY] (sanitized)
 *   {seq:N}     → nomor urut, zero-padded N digit (dari item_code_rules.next_seq)
 *   karakter lain → disalin apa adanya
 *
 * @param {string}   template    - mis. "{col_1}{col_3}{seq:3}"
 * @param {Object}   components  - row.components (key-value)
 * @param {number}   seqNum      - nomor urut (next_seq dari rule atau counter lokal)
 * @returns {string}
 */
export function parseItemCodeTemplate(template, components, seqNum = 1) {
  if (!template) return ''

  return template.replace(/\{([^}]+)\}/g, (_, token) => {
    // {seq:N} → zero-padded sequence
    const seqMatch = token.match(/^seq:(\d+)$/)
    if (seqMatch) {
      const digits = parseInt(seqMatch[1], 10) || 3
      return String(seqNum).padStart(digits, '0')
    }

    // {col_KEY} → sanitized component value
    const val = (components || {})[token]
    return sanitizeCodePart(val)
  })
}

/**
 * Generate item code untuk satu baris, dengan fallback lokal (tidak atomik).
 *
 * Urutan:
 *   1. Ambil item_code_rules untuk department ini
 *   2. Hitung local seq (jumlah components dengan dept ini + 1) — approx untuk offline
 *   3. Parse template → return generated code (sebagai preview; server akan re-generate resmi)
 *
 * @param {Object}   row           - baris component (row.components = {...})
 * @param {string}   departmentId
 * @returns {Promise<string | null>}  kode yang digenerate, atau null jika tidak ada rule
 */
export async function generateItemCode(row, departmentId) {
  if (!departmentId) return null

  try {
    // Ambil rule pertama untuk department ini
    const rule = await db.item_code_rules
      .where('department_id')
      .equals(departmentId)
      .first()

    if (!rule || !rule.template) return null

    // Approx local seq: jumlah records existing + 1 (offline estimate)
    const existingCount = await db.components
      .where('department_id')
      .equals(departmentId)
      .count()
    const localSeq = (rule.next_seq || existingCount || 0) + 1

    return parseItemCodeTemplate(rule.template, row.components || {}, localSeq)
  } catch (err) {
    console.warn('[itemCodeEngine] generateItemCode error:', err)
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  3. Simpan ke Reference Catalog (setelah generate berhasil)          */
/* ------------------------------------------------------------------ */

/**
 * Daftarkan entry baru ke reference_catalog (source='generated').
 * Dipanggil saat kode baru berhasil di-generate dan Admin memilih untuk menyimpannya.
 *
 * @param {string}   departmentId
 * @param {string}   triggerColKey   - key kolom is_ref_trigger
 * @param {string}   triggerValue    - nilai kolom trigger (kunci pencarian berikutnya)
 * @param {string}   itemCode        - kode yang digenerate
 * @returns {Promise<number>}  ID entry baru di Dexie
 */
export async function saveToCatalog(departmentId, triggerColKey, triggerValue, itemCode) {
  const matchSignature = { [triggerColKey]: triggerValue }
  return db.reference_catalog.add({
    department_id: departmentId,
    match_signature: JSON.stringify(matchSignature),
    item_code: itemCode,
    source: 'generated',
    created_at: new Date().toISOString(),
  })
}
