# SRS v2.0 — Plant Sourcing App
### System Requirements Specification — Dynamic Config-Driven Engine

**Versi:** 2.0
**Menggantikan:** SRS v1.0 (`Spesifikasi_App_Plant_Sourcing.md`)
**Status:** Draft siap-review untuk AI coding agent

---

## 0. Ringkasan Perubahan v1.0 → v2.0

| Aspek | v1.0 | v2.0 |
|---|---|---|
| Backend | Firebase (Firestore + Auth) | **PocketBase**, self-hosted di PC server lokal pabrik, port `8090` |
| Local persistence | IndexedDB native / Firestore offline persistence | **Dexie.js** (wrapper IndexedDB) + Background Sync Queue eksplisit (fire-and-forget) |
| Skema data | 13 kolom Elektrik **hardcode di kode & Firestore doc** | **Dynamic Schema Grid Engine** — kolom didefinisikan sebagai data (`columns_config`), bukan kode |
| Navigasi | 2-tier: Line → Location | **3-tier: Line → Department → Location** |
| Cakupan Department | Implisit hanya "sourcing elektrik" | Eksplisit multi-department (Mekanik, Elektrik, Utility, dst — daftar terbuka, admin bisa tambah) |
| Item Code | Tidak ada, kolom "Item Code" diisi manual pihak lain | **Dynamic Item Code Engine**: rule-based generator + catalog matching |
| Sinkronisasi eksternal | Tidak ada (export Excel manual) | **Dynamic Google Sheets Sync Engine** via Service Account, mapping kolom dikonfigurasi, bukan di-hardcode |
| Aturan kelengkapan baris | Hardcode: "jika Status=Tidak Aktif maka Qty boleh kosong" | **Completion Exception Rules** — dikonfigurasi admin per Department, tidak menyebut nama kolom spesifik di kode |
| Data Excel Mekanik 23 kolom | — (tidak ada di v1.0) | Diperlakukan sebagai **Initial Seed Data / Preset Default** untuk Department Mekanik saat instalasi, bukan skema tetap |
| Tren progres harian (line chart) | Ada di dashboard | **Dihapus permanen** (lihat §11.5, keputusan dari decision log lapangan) |

**Prinsip arsitektur wajib (tidak bisa dinegosiasikan):**

> Aplikasi adalah **wadah dinamis** (dynamic config-driven engine). Tidak boleh ada kode program, skema database, maupun komponen UI yang di-hardcode dengan nama kolom tertentu (mis. tidak boleh ada `row.subMachine`, `row.qty`, dsb di kode). Seluruh struktur grid, aturan penomoran, aturan kelengkapan, dan pemetaan sync harus dapat diubah oleh Admin melalui panel konfigurasi tanpa deploy ulang kode.

Konsekuensi langsung: nama-nama kolom seperti "Sub-Machine", "Qty", "Foto" pada dokumen ini **bukan** nama field yang boleh muncul di kode — semua itu hanya *contoh isi data* pada tabel `columns_config`.

---

## 1. Latar Belakang

Tim (1 admin + beberapa anak magang/PIC lapangan) melakukan survei/sourcing komponen di mesin-mesin pabrik yang tersebar di beberapa Line produksi, terbagi lagi menurut Department teknis (Mekanik, Elektrik, Utility, dll). Pengalaman v1.0 (skema 13 kolom Elektrik yang di-hardcode) menunjukkan bahwa setiap Department punya kebutuhan kolom berbeda (Mekanik ternyata butuh 23 kolom), sehingga skema kaku menyulitkan perluasan. v2.0 mengganti pendekatan ini dengan mesin generik yang seluruh strukturnya adalah data, bukan kode — sekaligus memindahkan infrastruktur dari cloud (Firebase) ke server lokal pabrik (PocketBase) agar tidak bergantung pada koneksi internet eksternal untuk operasional harian, hanya untuk sinkron Google Sheets.

**Ruang lingkup tetap:** alat bantu sourcing/pendataan lapangan yang offline-first. Ekspor tetap diperlukan (Excel & Google Sheets) untuk pihak manajemen yang bekerja di luar sistem ini.

---

## 2. Arsitektur Sistem

### 2.1 Diagram Alur Data

```
[PIC lapangan isi/edit sel di grid, di HP/laptop, di lokasi pabrik]
        |
        v
[Ditulis ke Dexie.js (IndexedDB) — SELALU terjadi lebih dulu, online atau offline]
        |
        v
[Entry ditambahkan ke Sync Queue lokal (Dexie table: sync_queue_pb)]
        |
        v
   Ada koneksi ke PocketBase server (LAN pabrik)? --Tidak--> [Tetap di queue, dicoba ulang
        |                                                       otomatis: on reconnect,
        | Ya                                                    interval timer, atau manual]
        v
[Background Sync Worker push queue ke PocketBase REST API — fire-and-forget]
        |
        v
[PocketBase (server lokal, port 8090) — sumber kebenaran (source of truth)]
        |
        +--> [Realtime subscription ke client lain di LAN yang sama (dashboard admin, dsb)]
        |
        v
[PocketBase server-side hook: entry masuk ke sync_queue_sheets]
        |
        v
[Debounce/Batch Push Worker di server PocketBase, setiap N detik ATAU tombol manual
 "Push to Sheets" → Google Sheets API via Service Account credentials.json]
```

Poin kritis: **push ke Google Sheets tidak pernah dilakukan langsung dari client**. Client hanya menulis ke PocketBase; proses ke Google Sheets berjalan sepenuhnya di server PocketBase (karena `credentials.json` hanya boleh ada di server, bukan tersebar ke setiap HP/laptop PIC lapangan).

### 2.2 Stack Teknologi

| Komponen | Teknologi | Alasan |
|---|---|---|
| Frontend | React (PWA — installable), berjalan di browser HP & laptop | App-shell offline, satu basis kode untuk semua device |
| Local storage | **Dexie.js** (wrapper IndexedDB) | API promise-based, mendukung schema versioning, cocok untuk queue eksplisit |
| Sync mechanism | Background Sync Queue kustom (bukan bawaan Firestore) | Karena pindah dari Firestore (auto-sync bawaan) ke PocketBase (REST/realtime biasa), sync harus diimplementasikan eksplisit di client |
| Backend/DB | **PocketBase**, self-hosted di PC server lokal pabrik, port `8090` | Single-binary, embedded SQLite, punya Admin UI, Auth, Realtime subscriptions, dan REST API bawaan — cocok untuk server lokal tanpa tim ops besar |
| Google Sheets sync | Google Sheets API v4 via **Service Account** (`credentials.json`), dijalankan sebagai server-side job di PocketBase | Kredensial tidak boleh bocor ke client; sync harus resilient terhadap rate limit |
| Export/Import Excel | SheetJS (xlsx), client-side | Tetap dipertahankan dari v1.0, tidak tergantung server |
| PWA infra | Service Worker (Workbox atau setara) + manifest.json | App-shell caching, `UpdatePrompt` untuk versi baru |

### 2.3 Batasan

- Koneksi ke PocketBase dibutuhkan hanya untuk sync — pengisian data 100% berjalan offline terhadap Dexie.js.
- Koneksi ke internet publik hanya dibutuhkan oleh **server PocketBase** untuk proses sync ke Google Sheets (bukan oleh device PIC lapangan).
- PocketBase berjalan di jaringan LAN pabrik; PIC lapangan mengakses lewat Wi-Fi lokal pabrik (bukan internet publik) untuk sync data operasional.

### 2.4 Catatan Resolusi Inkonsistensi dari v1.0

Spesifikasi v1.0 memiliki inkonsistensi pada kolom **Foto**: bagian arsitektur menyatakan "hanya teks link Gdrive, Firebase Storage tidak dipakai", namun bagian model input menyisakan alur "ambil foto dari kamera → upload ke Firebase Storage". **v2.0 menegaskan keputusan final**: kolom bertipe `gdrive_link` hanya menyimpan **teks URL**, tidak ada upload file biner ke sistem manapun (bukan ke PocketBase, bukan ke object storage lain). Tidak ada alur kamera/upload file dalam aplikasi.

---

## 3. Role & Hak Akses

| Role | Login? | Hak Akses |
|---|---|---|
| **Admin** | Ya | Full CRUD semua data, semua Line/Department/Location. Kelola akun PIC. Kelola `columns_config`, `item_code_rules`, `column_mappings` (Schema Manager, Rule Builder, Mapping Manager). Import/Export Excel. Konfigurasi Google Sheets sync. Restore recycle bin & hapus permanen. Lihat log aktivitas. |
| **PIC Lapangan** (akun per Line, bisa lebih dari satu Line per akun) | Ya | CRUD (termasuk bulk) hanya pada `records` di Line yang menjadi tanggung jawabnya, lintas semua Department pada Line tersebut. Tidak bisa mengubah kolom yang ditandai `is_editable_by_pic=false` pada `columns_config`. Tidak bisa mengubah `columns_config`, `item_code_rules`, atau `column_mappings`. |
| **Publik** (internal perusahaan, tanpa login) | Tidak | Read-only ke endpoint agregat/ringkasan saja (lihat §12). Tidak ada akses ke `records` mentah maupun ke collection konfigurasi. |

**Wajib diterapkan di level PocketBase API Rules** (server-side, setara Firestore Security Rules pada v1.0) — bukan hanya disembunyikan di UI. Contoh pola rule (bukan hardcode nama kolom, hanya kontrol akses collection & scope Line):

```
# Collection: records
listRule / viewRule  (PIC): @request.auth.id != "" &&
    line_id.id ?= (user_line_assignments dengan user_id = @request.auth.id)
createRule / updateRule (PIC): sama seperti di atas, dan bukan soft-deleted
deleteRule (PIC): "" (PIC tidak boleh hard-delete; soft-delete via updateRule field isDeleted)
Admin: full akses via superuser / role check `@request.auth.role = "admin"`

# Collection: columns_config, item_code_rules, column_mappings
listRule/viewRule: authenticated (semua role login boleh baca, untuk render grid)
createRule/updateRule/deleteRule: `@request.auth.role = "admin"` saja
```

---

## 4. Hierarki Navigasi (3-Tier)

```
Dashboard (pilih Line)
   └── Line (mis. "Line 1")
         └── Tab Department (mis. "Mekanik" | "Elektrik" | "Utility" ...)
               └── Tab Location (mis. "Boiler Room" | "Panel MDP" ...)
                     └── Data Grid (baris = records, kolom = sesuai columns_config Department aktif)
```

- Daftar Line, daftar Department, dan daftar Location **semuanya adalah data**, bukan konstanta di kode. Admin dapat menambah Line baru, Department baru, atau Location baru dari UI tanpa deploy.
- Skema kolom (`columns_config`) terikat ke **Department**, bukan ke Line/Location. Artinya: Department "Mekanik" punya skema kolom yang sama persis di Line 1, Line 2, Line 3, dst — hanya isi datanya (records) yang berbeda per Location.

---

## 5. Data Model (ERD — JSON-Config Driven)

### 5.1 Diagram Relasi (ringkas)

```
lines ──┐
        │
        ├──< locations >── departments ──< columns_config
        │        │                │
        │        │                ├──< item_code_rules
        │        │                ├──< column_mappings
        │        │                └──< completion_exception_rules
        │        │
        │        └──< records (components: JSON, sesuai columns_config Department-nya)
        │
        └──< user_line_assignments >── users

records ──< activity_log
records ──< import_batches (via batch_id)
records ──< reference_catalog (dicek saat is_ref_trigger)
records ──< sync_queue_sheets (server-side, PocketBase)
```

### 5.2 Definisi Collection / Tabel

**`lines`**
| Field | Tipe | Keterangan |
|---|---|---|
| id | string (PB id) | |
| name | text | mis. "Line 1" |
| order | number | urutan tampil di Dashboard |

**`departments`** (daftar global, dipakai bersama oleh semua Line)
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| name | text | mis. "Mekanik", "Elektrik", "Utility" |
| order | number | |

**`locations`**
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| line_id | relation → lines | |
| department_id | relation → departments | |
| name | text | mis. "Boiler Room" |
| order | number | |

**`columns_config`** — jantung dari Dynamic Schema Grid Engine
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| department_id | relation → departments | skema berlaku untuk seluruh Location di Department ini |
| key | text | key JSON di dalam `records.components`, mis. `"col_qty"` — **immutable setelah dipakai data** |
| label | text | label tampilan di header grid, boleh diubah kapan saja |
| type | select | `text` \| `number` \| `select` \| `gdrive_link` |
| select_options | JSON array | dipakai jika `type = select` |
| is_required | boolean | apakah termasuk syarat kelengkapan baris |
| is_visible | boolean | tampil/sembunyi di grid |
| is_editable_by_pic | boolean | jika `false`, hanya Admin yang bisa mengisi (setara "4 kolom milik pihak lain" di v1.0) |
| is_ref_trigger | boolean | jika `true`, perubahan nilai kolom ini memicu Catalog Reference Matching |
| order | number | urutan kolom di grid |

**`records`** — baris data grid (generik, lintas Department)
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| location_id | relation → locations | menentukan Line + Department secara implisit |
| components | **JSON** | key-value bebas sesuai `columns_config` Department terkait, mis. `{"col_submachine": "Conveyor A", "col_qty": 4}` |
| status_completeness | boolean (computed, disimpan agar cepat di-query) | dihitung ulang setiap `components` berubah |
| flag | select, nullable | `null` \| `"perlu_ditanyakan"` \| `"dilewati"` |
| flag_note | text, nullable | catatan opsional untuk flag |
| isDeleted | boolean | soft-delete |
| deletedAt | datetime, nullable | |
| createdBy / lastEditedBy | relation → users | |
| lastUpdated | datetime (auto) | |
| import_batch_id | relation → import_batches, nullable | |

> Catatan: field `components` inilah yang menggantikan seluruh kolom hardcode v1.0 (Sub-Machine, Category, Part, dst.). Data Excel Mekonik 23-kolom hanya dipakai sekali sebagai **seed** untuk mengisi `columns_config` (Department=Mekanik) dan sebagai data awal `records.components` saat instalasi — bukan struktur tetap di kode.

**`item_code_rules`**
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| department_id | relation → departments | |
| template | text | mis. `"{col_plant}{col_main_cat}{col_sub_cat}{seq:3}"` |
| target_column_key | text | key di `components` yang diisi hasil generate, mis. `"col_item_code"` |
| seq_scope | select | `"per_department"` \| `"per_template_prefix"` — menentukan cakupan reset counter |
| next_seq | number | counter berjalan, di-increment atomik di server PocketBase saat generate |

**Rule Parser — Template String:**
- `{col_KEY}` → diganti nilai `components[col_KEY]` dari baris terkait (sanitasi: uppercase, strip spasi, sesuai konvensi kode part).
- `{seq:N}` → nomor urut berjalan, zero-padded sepanjang N digit, sesuai `seq_scope`.
- Karakter literal lain dalam template disalin apa adanya.
- Parser dijalankan di server (PocketBase hook) agar increment `next_seq` atomik dan tidak bentrok antar-device offline yang sync bersamaan.

**`reference_catalog`**
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| department_id | relation → departments | |
| match_signature | JSON | pasangan key-value dari kolom `is_ref_trigger=true` yang dipakai sebagai kunci pencarian, mis. `{"col_specification": "Bearing 6204 ZZ"}` |
| item_code | text | kode yang akan di-auto-fill jika cocok |
| source | select | `"seed"` \| `"generated"` \| `"manual"` |
| created_at | datetime | |

**Dual-Matching Logic (algoritma):**
1. Saat nilai kolom dengan `is_ref_trigger=true` berubah (on blur), client membangun `match_signature` dari seluruh kolom trigger pada baris tersebut, lalu query `reference_catalog` (normalisasi: lowercase + trim sebelum dibandingkan).
2. **Jika cocok** → `target_column_key` (dari `item_code_rules` Department terkait) di-auto-fill dari `reference_catalog.item_code`. Tidak ada pemanggilan formula.
3. **Jika tidak cocok** (item baru) → saat baris disimpan/lengkap, sistem menjalankan Rule Parser dari `item_code_rules.template` untuk generate kode baru.
4. Admin dapat menandai kode hasil generate untuk disimpan sebagai entry baru di `reference_catalog` (`source="generated"`) agar item sejenis berikutnya langsung match di langkah 2.

**`column_mappings`**
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| department_id | relation → departments | |
| db_col_key | text | key di `components`, mis. `"col_qty"` |
| sheet_column_letter | text | mis. `"F"` |
| spreadsheet_id | text | target Google Spreadsheet |
| sheet_tab_name | text | mis. nama tab per Line/Department |

**`sync_queue_sheets`** (server-side, dibaca oleh Debounce/Batch Push Worker)
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| record_id | relation → records | |
| status | select | `pending` \| `processing` \| `pushed` \| `failed` |
| attempt_count | number | |
| last_error | text, nullable | |
| queued_at | datetime | |

**`completion_exception_rules`** — generalisasi aturan "Status=Tidak Aktif → Qty boleh kosong" agar tetap config-driven
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| department_id | relation → departments | |
| condition_column_key | text | mis. `"col_status"` |
| condition_value | text | mis. `"Tidak Aktif"` |
| exempt_column_keys | JSON array | mis. `["col_qty"]` — kolom yang dibebaskan dari syarat wajib saat kondisi terpenuhi |

**`import_batches`**
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| location_id | relation → locations | |
| imported_by | relation → users | |
| imported_at | datetime | |
| row_count | number | |
| status | select | `committed` \| `undone` |
| column_mapping_snapshot | JSON | salinan mapping yang dipakai saat import ini, untuk keperluan undo yang akurat |

**`activity_log`** (immutable — tidak ada updateRule/deleteRule bagi siapapun selain Admin lewat retensi khusus)
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | |
| user_id | relation → users | |
| action | text | mis. `"bulk_delete"`, `"import_commit"`, `"edit_cell"` |
| entity_type | text | mis. `"record"`, `"columns_config"` |
| entity_id | text | |
| detail | JSON | payload ringkas untuk ditampilkan di UI log |
| timestamp | datetime | |

**`users`** (PocketBase Auth collection, diperluas)
| Field | Tipe | Keterangan |
|---|---|---|
| role | select | `admin` \| `pic` |
| (auth bawaan PocketBase: email, password hash, dsb.) | | |

**`user_line_assignments`**
| Field | Tipe | Keterangan |
|---|---|---|
| user_id | relation → users | |
| line_id | relation → lines | many-to-many: satu PIC bisa ditugaskan ke lebih dari satu Line |

**`app_settings`** (key-value global)
| Field | Tipe | Keterangan |
|---|---|---|
| key | text | mis. `"sheets_push_debounce_seconds"` |
| value | text/JSON | mis. `"30"` |

---

## 6. Dynamic Schema Grid Engine (Fitur Utama)

- Komponen `GridHeader` dan `EditableCell` **wajib generik**: keduanya menerima array `columns_config` sebagai props dan me-render UI berdasarkan `type` masing-masing kolom (`text` → input teks, `number` → input numerik, `select` → dropdown dari `select_options`, `gdrive_link` → sel link + preview). Tidak boleh ada percabangan `if (column.key === 'qty')` di kode manapun.
- Fitur Admin **"+ Tambah Kolom"**: membuka form tambah `columns_config` baru untuk Department aktif (key, label, type, required, visible, editable_by_pic, ref_trigger) — efeknya langsung terlihat di grid tanpa reload aplikasi (via realtime subscription PocketBase ke collection `columns_config`).
- **Schema Manager**: tabel pengaturan seluruh kolom per Department, mendukung reorder (drag-drop → update `order`), edit label/tipe, toggle visibility/required/editable/ref_trigger, dan nonaktifkan kolom (soft: `is_visible=false`, key tetap ada di data lama untuk kompatibilitas riwayat).
- **Seed Data saat instalasi**: skrip seed mengisi `columns_config` untuk Department "Mekanik" (23 kolom, dari data Excel Mekanik) dan Department "Elektrik" (13 kolom, warisan skema v1.0) sebagai *starting point*, sepenuhnya dapat diubah admin setelahnya.

---

## 7. Dynamic Item Code Engine

Lihat §5.2 untuk skema `item_code_rules` & `reference_catalog`, serta algoritma Dual-Matching. Kebutuhan UI (Rule Builder) dijelaskan di `DESIGN_v2.md`.

Ketentuan tambahan:
- Formula per Department disimpan sebagai *string template*, sehingga tim non-developer (Admin) dapat menyusun ulang format kode tanpa bantuan programmer.
- Validasi template dilakukan saat disimpan: setiap `{col_X}` harus merujuk `key` yang benar-benar ada di `columns_config` Department tersebut; jika tidak, disimpan sebagai error dan template ditolak.
- Increment `next_seq` **harus** terjadi di server (PocketBase hook), bukan di client, untuk menghindari duplikasi kode saat dua device offline sync hampir bersamaan.

---

## 8. Dynamic Google Sheets Sync Engine

- Autentikasi: Google Service Account, file `credentials.json` disimpan di server PocketBase (bukan di repo/klien), diberi akses "Editor" ke spreadsheet tujuan.
- Pemetaan kolom (`column_mappings`) dikonfigurasi Admin per Department: `db_col_key → sheet_column_letter`, termasuk `spreadsheet_id` dan `sheet_tab_name` tujuan (bisa berbeda tab per Line/Department).
- **Sync Queue & Resiliency:**
  - Setiap perubahan `records` yang sudah tersinkron ke PocketBase memicu entry baru di `sync_queue_sheets` (status `pending`) via server-side hook.
  - **Debounce/Batch Push Worker**: berjalan setiap N detik (dikonfigurasi lewat `app_settings.sheets_push_debounce_seconds`, default disarankan 30–60 detik) — mengumpulkan seluruh entry `pending`, menggabungkan menjadi satu batch `values.batchUpdate` per spreadsheet untuk menghemat kuota Google API.
  - Tombol manual **"Push to Sheets"** di UI Admin memicu worker berjalan segera (bypass timer), berguna sebelum meeting/deadline laporan.
  - Retry dengan backoff eksponensial jika Google API mengembalikan rate-limit (HTTP 429) atau error transient; setelah N percobaan gagal, entry ditandai `failed` dan tampil di panel Admin untuk retry manual.
  - Kegagalan push ke Sheets **tidak pernah** memblokir atau membatalkan data di PocketBase — Sheets adalah salinan turunan (derived), PocketBase tetap source of truth.

---

## 9. Business Rules (dari Progress Notes / Decision Log Lapangan)

### 9.1 Pengecualian Status "Tidak Aktif"
Diimplementasikan sebagai data via `completion_exception_rules` (§5.2), bukan hardcode. Contoh isi default untuk Department Mekanik/Elektrik: `condition_column_key="col_status"`, `condition_value="Tidak Aktif"`, `exempt_column_keys=["col_qty"]`.

### 9.2 Retensi Recycle Bin
Tanpa batas waktu (indefinite). `records.isDeleted=true` hanya menyembunyikan dari tampilan normal grid; data tetap ada di PocketBase. Hapus permanen hanya melalui aksi eksplisit Admin ("Hapus Selamanya") di panel Recycle Bin, tidak pernah otomatis (tidak ada cron purge).

### 9.3 Deviasi Tren Grafik
**Keputusan (final, dari decision log):** chart "Tren progress harian per Line" yang ada di v1.0 §9 poin 4 **di-skip permanen** dari v2.0 — tidak diimplementasikan. Dashboard v2.0 hanya menampilkan snapshot real-time (lihat §12), bukan riwayat historis harian.

### 9.4 Fitur Grid Wajib
- **Filter per kolom** dengan logika AND/OR antar filter aktif, filter menyesuaikan `type` kolom (mis. filter angka: range; filter select: multi-checkbox).
- **Find & Replace** dengan live-preview (menampilkan daftar sel yang akan berubah sebelum commit), berlaku lintas kolom yang dipilih user.
- **Flag baris**: `"Perlu Ditanyakan"` / `"Dilewati"`, disimpan di `records.flag` (fixed field, bukan bagian `columns_config` karena berlaku universal lintas Department).
- **Bulk Actions**: Tambah Sekaligus (generate N baris kosong), Bulk Delete (dengan dialog konfirmasi berisi jumlah & lokasi), Duplikat, Bulk Flag, Bulk Fill (isi satu nilai ke banyak baris pada satu kolom terpilih sekaligus).

### 9.5 Render Foto (Google Drive)
Preview hover (desktop) / tap (mobile) untuk sel bertipe `gdrive_link` **wajib** di-render menggunakan **React Portal**, agar popup tidak terpotong (`overflow: hidden`) oleh container grid yang men-scroll. Syarat file Gdrive tetap: akses "Siapa saja yang punya link bisa lihat".

### 9.6 Audit Trail & Import Undo
- `activity_log` bersifat immutable — tidak ada endpoint update/delete untuk siapapun kecuali Admin lewat retensi/kebijakan data terpisah (di luar aplikasi, mis. backup/restore database, bukan fitur UI).
- **Undo Import lintas halaman**: status "batch import terakhir yang bisa di-undo" disimpan di React Context (`ImportUndoContext`) di level aplikasi (bukan per halaman), sehingga tombol "Batalkan Import Ini" tetap muncul (mis. sebagai toast persisten atau item di header) meskipun user sudah berpindah Line/Department/Location setelah proses import selesai. Undo menghapus (soft-delete) seluruh `records` dengan `import_batch_id` yang sesuai dan mengubah `import_batches.status="undone"`.

---

## 10. Import, Export, & Dashboard Dinamis

### 10.1 Import Wizard (4 Tahap)
1. **Upload file** Excel/CSV.
2. **Deteksi otomatis kolom baru**: sistem membandingkan header file dengan `columns_config` Department tujuan; kolom yang belum ada ditandai "kolom baru", admin memilih: petakan ke kolom existing, buat `columns_config` baru, atau abaikan.
2b. **Konfigurasi tipe data dinamis** untuk kolom baru yang dibuat (pilih `type`, dan jika `select`, sistem **auto-extract unique values** dari kolom tersebut di file sebagai `select_options` awal).
3. **Validasi otomatis per baris** (tipe data sesuai, kolom wajib terisi sesuai `columns_config.is_required` & `completion_exception_rules`), tampilkan laporan error.
4. **Konfirmasi commit** — baru setelah tahap ini data masuk `records` dan `import_batches` tercatat (untuk keperluan undo, lihat §9.6).

### 10.2 Export Modal
- UI **"Checkbox Tree"**: pilih kombinasi Line/Department/Location yang ingin diekspor, plus filter kolom mana saja yang disertakan (berdasarkan `columns_config` Department terkait; kolom berbeda Department tidak dipaksa disatukan dalam satu sheet).
- Preview hasil sebelum download.
- Output tetap file Excel (SheetJS), styling rapi (header bold, lebar kolom pas), dengan opsi 1 sheet per Location/Department atau gabungan sesuai pilihan checkbox tree.

### 10.3 Dashboard Dinamis
- **Filter Department** di bagian atas dashboard.
- **Stat Cards real-time**: total baris, % lengkap, breakdown status (nilai kolom `is_ref_trigger`/status ditentukan dinamis, bukan hardcode "Existing/Tidak Aktif" — diambil dari `columns_config` mana pun yang ditandai admin sebagai "kolom status" via setting Department).
- **Progress per Line** (persentase kelengkapan, gabungan & per Line).
- **Checklist Lokasi**: daftar visual Location yang seluruh baris-nya lengkap (✓) vs masih berjalan.
- **Grafik Breakdown Dinamis**: kolom pengelompokan chart (mis. per Category, per Sub-Machine, dll.) **dipilih Admin via Pengaturan** per Department, bukan hardcode nama kolom "Category". Chart re-render otomatis begitu Admin mengganti kolom pengelompokan.
- Tren progress harian **tidak ada** (lihat §9.3).

---

## 11. Dashboard Publik (Read-Only, Tanpa Login)

Menampilkan versi agregat dari §10.3 saja (Stat Cards, Progress per Line, Checklist Lokasi, Grafik Breakdown) melalui PocketBase API Rule khusus (`listRule` publik hanya pada view/collection agregat, **tidak pernah** langsung ke `records` mentah). Tidak melihat data per baris (Part, Spesifikasi, dll.), tidak bisa mengedit apapun.

---

## 12. API & Sync Queue — Spesifikasi Teknis

### 12.1 Dexie.js — Skema Lokal (Client)

```js
// db.js
const db = new Dexie('plant_sourcing_v2');
db.version(1).stores({
  records: 'id, location_id, isDeleted, lastUpdated, [location_id+isDeleted]',
  sync_queue_pb: '++localId, entity_type, entity_id, operation, status, created_at',
  columns_config_cache: 'id, department_id, order',
  locations_cache: 'id, line_id, department_id',
  lines_cache: 'id',
  departments_cache: 'id',
  app_meta: 'key' // menyimpan last_synced_at, dsb.
});
```

- `records` disimpan penuh secara lokal per Line yang menjadi tanggung jawab user (scoped download saat login/online pertama), agar grid tetap bisa dibuka & diedit walau offline total.
- `sync_queue_pb` menyimpan operasi tertunda: `{entity_type: 'record', entity_id, operation: 'create'|'update'|'delete', payload, status: 'pending'|'syncing'|'failed', retry_count, created_at, last_attempt_at, error_message}`.

### 12.2 Background Sync Worker (Client)

Trigger sync saat: (a) event `online` browser, (b) interval timer (mis. tiap 15 detik saat online), (c) tombol manual di `SyncStatusBar`, (d) setiap kali user melakukan aksi tulis (langsung dicoba, gagal → tetap di queue).

Algoritma per item queue (FIFO per `entity_id` agar urutan edit terjaga):
```
1. Ambil item status='pending' tertua per entity_id
2. Tandai status='syncing'
3. Kirim ke PocketBase REST API (POST/PATCH/DELETE ke /api/collections/records/records/:id)
4. Jika sukses (2xx): hapus dari sync_queue_pb, update lastUpdated lokal dari respons server
5. Jika gagal (network): tandai kembali 'pending', retry_count++, backoff eksponensial (cap mis. 5 menit)
6. Jika gagal (4xx validasi/permission, bukan transient): tandai 'failed', tampilkan di SyncStatusBar
   untuk perhatian Admin — TIDAK retry otomatis tanpa batas
```

**Resolusi konflik:** last-write-wins berbasis `lastUpdated` (timestamp server). Karena tiap baris dikerjakan oleh satu PIC yang bertanggung jawab pada Line tersebut, risiko concurrent-edit pada baris yang sama relatif rendah, namun field `lastEditedBy` tetap dicatat agar konflik (jika terjadi) bisa ditelusuri via `activity_log`.

### 12.3 PocketBase REST API (Server)

Pola endpoint standar bawaan PocketBase, dipakai apa adanya (tanpa custom backend tambahan untuk CRUD dasar):

```
GET    /api/collections/records/records?filter=(location_id='X'&&isDeleted=false)
POST   /api/collections/records/records
PATCH  /api/collections/records/records/:id
DELETE /api/collections/records/records/:id      # hanya dipanggil oleh Admin (hard delete)
GET    /api/collections/columns_config/records?filter=(department_id='Y')
POST   /api/collections/columns_config/records    # Admin only, via API Rule
```

Realtime: client subscribe ke `columns_config` dan `records` (scoped ke Line miliknya) via PocketBase Realtime API agar perubahan skema/kolom oleh Admin, atau data dari PIC lain, langsung terlihat tanpa refresh manual.

**Custom Server-Side Hooks** (PocketBase Go/JS hooks) dibutuhkan untuk:
- Increment atomik `item_code_rules.next_seq` saat generate kode baru.
- Menghitung ulang `records.status_completeness` setiap `components` atau `columns_config`/`completion_exception_rules` terkait berubah.
- Menulis entry baru ke `sync_queue_sheets` setiap `records` berubah (create/update yang relevan dengan `column_mappings` Department terkait).
- Menjalankan Debounce/Batch Push Worker (cron internal PocketBase) untuk proses §8.
- Mencatat setiap operasi ke `activity_log`.

### 12.4 PWA / Service Worker

- App-shell (HTML/JS/CSS) di-cache oleh Service Worker agar aplikasi tetap bisa dibuka meski tanpa koneksi sama sekali (termasuk saat pertama kali tanpa login, jika versi sebelumnya sudah pernah dibuka).
- `UpdatePrompt`: saat Service Worker mendeteksi versi baru ter-deploy, tampilkan notifikasi non-blocking "Versi baru tersedia — Refresh" agar user tidak memakai versi kode yang usang tanpa disadari (penting karena skema/rule bisa berubah sewaktu-waktu oleh Admin).

---

## 13. Non-Functional Requirements

- **Keamanan:** seluruh kontrol akses ditegakkan di PocketBase API Rules (server-side), bukan hanya UI. Kredensial Google Service Account tidak pernah dikirim ke client.
- **Ketahanan offline:** aplikasi harus tetap 100% dapat dipakai (baca & tulis grid) tanpa koneksi LAN/internet sama sekali untuk durasi kerja lapangan sehari penuh.
- **Skalabilitas skema:** menambah Department baru atau kolom baru tidak boleh membutuhkan perubahan kode maupun migrasi database manual — cukup lewat Schema Manager.
- **Kompatibilitas:** browser modern di Android/iOS/desktop yang mendukung PWA & IndexedDB.
- **Performa grid:** rendering tetap responsif untuk skala ratusan–ribuan baris per Location (virtualized rendering pada `data-grid` disarankan, lihat `DESIGN_v2.md`).

---

## 14. Migrasi Data v1.0 → v2.0

1. Export seluruh data Firestore v1.0 (13 kolom Elektrik) ke format tabular.
2. Jalankan seed: buat `departments` "Elektrik", `columns_config` 13 entri sesuai nama kolom v1.0 (dengan `key` baru bergaya `col_*`), lalu import data lama sebagai `records.components` via Import Wizard (§10.1) — bukan migrasi otomatis tanpa validasi.
3. Tambahkan `departments` "Mekanik" dengan seed `columns_config` 23 kolom dari data Excel Mekanik, dan Department lain (mis. "Utility") sesuai kebutuhan lapangan terbaru.
4. Verifikasi `completion_exception_rules` default (§9.1) sudah sesuai sebelum PIC lapangan mulai bekerja di v2.0.

---

## 15. Lampiran — Contoh JSON

**Contoh `columns_config` (2 entri, Department Elektrik):**
```json
[
  { "key": "col_submachine", "label": "Sub-Machine", "type": "text",
    "is_required": true, "is_visible": true, "is_editable_by_pic": true, "is_ref_trigger": false, "order": 1 },
  { "key": "col_qty", "label": "Qty", "type": "number",
    "is_required": true, "is_visible": true, "is_editable_by_pic": true, "is_ref_trigger": false, "order": 6 }
]
```

**Contoh `item_code_rules` (Department Mekanik):**
```json
{
  "department_id": "dept_mekanik",
  "template": "{col_plant}{col_main_cat}{col_sub_cat}{seq:3}",
  "target_column_key": "col_item_code",
  "seq_scope": "per_template_prefix",
  "next_seq": 42
}
```

**Contoh `records.components` (Department Elektrik, satu baris):**
```json
{
  "col_submachine": "Conveyor A",
  "col_category": "Sensor",
  "col_part": "Proximity Switch",
  "col_specification": "PNP NO, 24VDC",
  "col_status": "Existing",
  "col_qty": 2,
  "col_foto": "https://drive.google.com/file/d/xxxx/view"
}
```

**Contoh `column_mappings` (Department Elektrik → Google Sheets):**
```json
[
  { "db_col_key": "col_submachine", "sheet_column_letter": "C" },
  { "db_col_key": "col_qty", "sheet_column_letter": "K" }
]
```

---

*Dokumen ini adalah spesifikasi teknis (SRS). Untuk spesifikasi tata letak UI, komponen visual, dan alur interaksi, lihat `DESIGN_v2.md`.*
