/**
 * initialSeeds.js
 * Preset konfigurasi kolom dinamis untuk seeding awal Dexie.js.
 *
 * Data ini adalah "starting point" yang sepenuhnya dapat diubah Admin
 * melalui Schema Manager — bukan struktur tetap di kode.
 *
 * Memanggil seedDepartment(departmentId, columns) untuk menulis ke Dexie
 * tabel `columns_config`.
 */

import { db } from '../lib/db'

/* ------------------------------------------------------------------ */
/*  23 Kolom — Department MEKANIK                                      */
/*  Sumber: Data Excel Mekanik (SRS v2.0 §6, §14)                     */
/* ------------------------------------------------------------------ */
export const MEKANIK_COLUMNS = [
  {
    key: 'col_1',
    label: 'Plant',
    type: 'text',
    order: 1,
    is_required: true,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_2',
    label: 'Location',
    type: 'text',
    order: 2,
    is_required: true,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_3',
    label: 'Sub-Machine',
    type: 'text',
    order: 3,
    is_required: true,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_4',
    label: 'Code Material',
    type: 'text',
    order: 4,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: false, // kolom ini diisi oleh sistem/admin
    is_ref_trigger: false,
    is_auto: true,             // nilai dihasilkan oleh Dynamic Item Code Engine
    is_readonly: true,         // PIC tidak dapat mengedit secara langsung
    select_options: [],
  },
  {
    key: 'col_5',
    label: 'Mekanik',
    type: 'text',
    order: 5,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_6',
    label: 'Part std/custome',
    type: 'select',
    order: 6,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    // Opsi awal: tone menentukan warna status-chip (SRS §DESIGN_v2 §4)
    select_options: [
      { value: 'Standard', tone: 'primary' },
      { value: 'Custom', tone: 'neutral' },
    ],
  },
  {
    key: 'col_7',
    label: 'Part',
    type: 'text',
    order: 7,
    is_required: true,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_8',
    label: 'Sub Parts 1',
    type: 'text',
    order: 8,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_9',
    label: 'Sub Part 2',
    type: 'text',
    order: 9,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_10',
    label: 'Sub Part 3',
    type: 'text',
    order: 10,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_11',
    label: 'Spesifikasi',
    type: 'text',
    order: 11,
    is_required: true,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: true,  // perubahan nilai ini memicu Catalog Reference Matching
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_12',
    label: 'Brand 1',
    type: 'text',
    order: 12,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_13',
    label: 'Brand 2',
    type: 'text',
    order: 13,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_14',
    label: 'Qty Terpasang',
    type: 'number',
    order: 14,
    is_required: true,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_15',
    label: 'Drawing',
    type: 'text',
    order: 15,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_16',
    label: 'Foto',
    type: 'gdrive_link',
    order: 16,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_17',
    label: 'Lifetime (hari)',
    type: 'number',
    order: 17,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_18',
    label: 'Lead time kedatangan (hari)',
    type: 'number',
    order: 18,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_19',
    label: 'Safety Stock',
    type: 'number',
    order: 19,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_20',
    label: 'actual stock',
    type: 'number',
    order: 20,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_21',
    label: 'Vendor 1',
    type: 'text',
    order: 21,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_22',
    label: 'Vendor 2',
    type: 'text',
    order: 22,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
  {
    key: 'col_23',
    label: 'Vendor 3',
    type: 'text',
    order: 23,
    is_required: false,
    is_visible: true,
    is_editable_by_pic: true,
    is_ref_trigger: false,
    is_auto: false,
    is_readonly: false,
    select_options: [],
  },
]

/* ------------------------------------------------------------------ */
/*  13 Kolom — Department ELEKTRIK                                     */
/*  Warisan skema v1.0, dikonversi ke format columns_config v2.0      */
/* ------------------------------------------------------------------ */
export const ELEKTRIK_COLUMNS = [
  { key: 'col_e1', label: 'Plant', type: 'text', order: 1, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e2', label: 'Location', type: 'text', order: 2, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e3', label: 'Sub-Machine', type: 'text', order: 3, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e4', label: 'Item Code', type: 'text', order: 4, is_required: false, is_visible: true, is_editable_by_pic: false, is_ref_trigger: false, is_auto: true, is_readonly: true, select_options: [] },
  { key: 'col_e5', label: 'Category', type: 'text', order: 5, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e6', label: 'Part', type: 'text', order: 6, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e7', label: 'Description', type: 'text', order: 7, is_required: false, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e8', label: 'Spesification', type: 'text', order: 8, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: true, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e9', label: 'Warehouse Name', type: 'text', order: 9, is_required: false, is_visible: true, is_editable_by_pic: false, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  {
    key: 'col_e10', label: 'Status', type: 'select', order: 10,
    is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false,
    select_options: [
      { value: 'Existing', tone: 'primary' },
      { value: 'Tidak Aktif', tone: 'neutral' },
    ],
  },
  { key: 'col_e11', label: 'Qty', type: 'number', order: 11, is_required: true, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e12', label: 'Foto', type: 'gdrive_link', order: 12, is_required: false, is_visible: true, is_editable_by_pic: true, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
  { key: 'col_e13', label: 'Qty WH', type: 'number', order: 13, is_required: false, is_visible: true, is_editable_by_pic: false, is_ref_trigger: false, is_auto: false, is_readonly: false, select_options: [] },
]

/* ------------------------------------------------------------------ */
/*  Seed Functions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Seed columns_config untuk satu Department ke Dexie.
 * Idempotent: jika columns untuk department_id sudah ada, tidak dilakukan ulang.
 *
 * @param {string} departmentId - ID Department di Dexie / PocketBase
 * @param {Array}  columnDefs   - array definisi kolom (MEKANIK_COLUMNS / ELEKTRIK_COLUMNS)
 */
async function seedDepartment(departmentId, columnDefs) {
  const existing = await db.columns_config
    .where('department_id')
    .equals(departmentId)
    .count()

  if (existing > 0) {
    console.log(`[seed] columns_config untuk department "${departmentId}" sudah ada (${existing} kolom) — seed dilewati.`)
    return
  }

  const now = new Date().toISOString()
  const records = columnDefs.map(col => ({
    ...col,
    department_id: departmentId,
    created_at: now,
    updated_at: now,
  }))

  await db.columns_config.bulkAdd(records)
  console.log(`[seed] Berhasil seed ${records.length} kolom untuk department "${departmentId}".`)
}

/**
 * Seed columns_config untuk Department MEKANIK.
 * @param {string} departmentId
 */
export async function seedDepartmentMekanik(departmentId) {
  return seedDepartment(departmentId, MEKANIK_COLUMNS)
}

/**
 * Seed columns_config untuk Department ELEKTRIK.
 * @param {string} departmentId
 */
export async function seedDepartmentElektrik(departmentId) {
  return seedDepartment(departmentId, ELEKTRIK_COLUMNS)
}

/**
 * Seed semua department sekaligus dari sebuah mapping { departmentId: columnDefs }.
 * Berguna saat inisialisasi pertama kali setelah login.
 *
 * @param {{ mekanik: string, elektrik: string }} departmentIds
 */
export async function seedAllDepartments({ mekanik, elektrik } = {}) {
  const tasks = []
  if (mekanik) tasks.push(seedDepartmentMekanik(mekanik))
  if (elektrik) tasks.push(seedDepartmentElektrik(elektrik))
  await Promise.all(tasks)
}
