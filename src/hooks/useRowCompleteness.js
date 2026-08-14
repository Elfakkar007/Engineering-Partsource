/**
 * useRowCompleteness.js
 *
 * Hook dan fungsi untuk evaluasi kelengkapan baris secara dinamis.
 * Menggantikan seluruh logika `isRowComplete()` yang di-hardcode sebelumnya.
 *
 * Algoritma:
 *   1. Ambil semua kolom `is_required: true` dari columns_config Department.
 *   2. Periksa setiap aturan di completion_exception_rules:
 *      - Jika nilai `rowComponents[condition_column_key]` === `condition_value`
 *        → hapus `exempt_column_keys` dari daftar wajib.
 *   3. Baris dinyatakan "Lengkap" jika semua kolom yang tersisa (wajib & tidak dibebaskan)
 *      memiliki nilai non-kosong (bukan null / undefined / '').
 *
 * SRS v2.0 §6 & §8.2 — Dynamic Completeness Engine
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

/* ------------------------------------------------------------------ */
/*  Pure function — dapat dipakai di luar React (mis. importExcel)      */
/* ------------------------------------------------------------------ */

/**
 * Evaluasi apakah satu baris data sudah "Lengkap".
 *
 * @param {Object}   rowComponents   - nilai sel: { col_key: value, ... }
 * @param {Object[]} deptColumns     - array columns_config dari Department aktif
 * @param {Object[]} exceptionRules  - array completion_exception_rules dari Dexie
 * @returns {boolean}
 */
export function evaluateRowCompleteness(rowComponents, deptColumns, exceptionRules) {
  const comps = rowComponents || {}

  // 1. Kumpulkan kunci kolom yang wajib diisi
  const requiredKeys = new Set(
    (deptColumns || [])
      .filter(col => col.is_required === true)
      .map(col => col.key)
  )

  if (requiredKeys.size === 0) return true // tidak ada kolom wajib

  // 2. Terapkan setiap exception rule
  for (const rule of (exceptionRules || [])) {
    const { condition_column_key, condition_value, exempt_column_keys } = rule
    if (!condition_column_key || !condition_value || !Array.isArray(exempt_column_keys)) continue

    const actualVal = String(comps[condition_column_key] ?? '').trim()
    const expectedVal = String(condition_value ?? '').trim()

    if (actualVal.toLowerCase() === expectedVal.toLowerCase()) {
      // Kondisi terpenuhi — hapus kolom yang dibebaskan dari daftar wajib
      for (const exemptKey of exempt_column_keys) {
        requiredKeys.delete(exemptKey)
      }
    }
  }

  // 3. Cek semua kolom wajib yang tersisa
  for (const key of requiredKeys) {
    const val = comps[key]
    if (val === null || val === undefined || val === '') return false
  }

  return true
}

/* ------------------------------------------------------------------ */
/*  React hook — live query exception rules dari Dexie                  */
/* ------------------------------------------------------------------ */

/**
 * Live query exception rules untuk satu Department.
 * Reaktif: komponen otomatis re-render saat Admin mengubah rules.
 *
 * @param {string} departmentId
 * @returns {Object[]} array completion_exception_rules
 */
export function useLiveExceptionRules(departmentId) {
  return useLiveQuery(
    () => {
      if (!departmentId) return []
      return db.completion_exception_rules
        .where('department_id')
        .equals(departmentId)
        .toArray()
    },
    [departmentId],
    [] // fallback aman agar tidak crash sebelum query selesai
  ) ?? []
}
