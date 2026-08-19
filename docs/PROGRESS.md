 # Progress Migrasi Plant Sourcing App v2.0

## Status Tahapan
- [x] **Tahap 1: Pembersihan Firebase & Setup Infrastruktur (PocketBase + Dexie)**
- [x] **Tahap 2: Dynamic Schema Engine & Local-First Sync Hook**
- [x] **Tahap 3: Hierarki Navigasi 3-Tier & Layout Global**
- [x] **Tahap 4: Refactor Generic Dynamic Grid & Spreadsheet Tools**
- [x] **Tahap 5: Dynamic Item Code Engine, Google Sheets Sync Queue, & Import/Export**
- [x] **Tahap 6: Admin Dashboard & Schema Manager**
- [x] **Tahap 7 (Final): PocketBase Auth, RBAC, PWA Offline, & Production Polish**
- [x] **Tahap 8a: Migrasi Skema Item Code (Manual-Assisted Matching)**
- [x] **Tahap 8b: Refactor Item Code Matching Logic**
- [x] **Tahap 8c: UI Admin Konfigurasi Item Code**
- [x] **Tahap 8d: UI Grid — Toggle Auto/Manual, Autocomplete, Laporan Belum Ketemu Kode**
  - ✅ **Migrasi Item Code Engine SELESAI** (Tahap 8a–8d)
- [x] **Tahap 8e: QA & Fix Sync Path Item Code** — Verifikasi 3 jalur kritis (tidak ada bug ditemukan)

---

## Log Catatan Tahap 1
- **Status**: Selesai & Build Validated.
- **Perubahan Utama**:
  - Dependensi `firebase` dihapus total.
  - Instance `pocketbase.js` dan skema IndexedDB `db.js` (Dexie) berhasil dibuat.
  - Context `AuthContext.jsx` diubah sementara menjadi Mock Admin Provider.
  - Query Firestore di-mock/comment out agar `npm run build` sukses.

## Log Catatan Tahap 2
- **Status**: Selesai & Build Validated.
- **Perubahan Utama**:
  - Skema `db.js` Dexie diperbarui dengan nama tabel `components` (bukan records) dan `sync_queue`.
  - File `src/data/initialSeeds.js` dibuat untuk 23 kolom Mekanik & 13 kolom Elektrik.
  - Hook reaktif `useDynamicSchema.js` dibuat untuk render & kelola struktur kolom dinamis dari Dexie.
  - Hook data baris `useGridData.js` dibuat. Operasi tulis lokal kini *atomik* bersama penambahan antrian di `sync_queue`.
  - Background worker `syncWorker.js` dibuat untuk membaca `sync_queue` lalu mem-push ke PocketBase (dengan logic retry & backoff).
  - Stub `activityLog.js` dan `importUndo.js` dibuat agar import tidak error, siap untuk Phase 3.

## Log Catatan Tahap 3
- **Status**: Selesai & Build Validated (618 modules, 0 errors).
- **Perubahan Utama**:
  - `src/components/common/SyncStatusBar.jsx` dibuat — indikator 4-state (online/offline/syncing/failed) terhubung ke `syncWorker.js`.
  - `src/components/common/UpdatePrompt.jsx` dipindah dari root components ke `common/`, posisi bottom-center sesuai DESIGN_v2.
  - `src/contexts/NavigationContext.jsx` dibuat — global state 3-tier (lineId/departmentId/locationId) dengan auto-fallback ke item pertama dari Dexie cache.
  - `src/components/navigation/DepartmentTabs.jsx` dibuat — Tab Tier-2 dengan progress dot dan tombol admin.
  - `src/components/navigation/LocationTabs.jsx` dibuat — Sub-tab Tier-3 difilter per department aktif.
  - `src/components/navigation/ThreeTierNav.jsx` dibuat — wrapper breadcrumb + DepartmentTabs + LocationTabs.
  - `src/components/layout/MainLayout.jsx` dibuat — shell global (header hijau, SyncStatusBar, konten, UpdatePrompt).
  - `src/App.jsx` diperbarui: wiring `initSyncWorker()` & `seedAllDepartments()` async di AppShell, route 3-tier `/line/:lineId/:departmentId?/:locationId?`, NavigationProvider scoped ke LinePage.
  - `src/pages/LinePage.jsx` diperbarui: inline header & SyncStatusBar lama dihapus, diganti `MainLayout` + `ThreeTierNav`.

## Log Catatan Tahap 4
- **Status**: Selesai & Build Validated (623 modules, 0 errors).
- **Perubahan Utama**:
  - `src/components/grid/GdrivePreview.jsx` dibuat — implementasi UI tipe kolom `gdrive_link` (foto) dengan *React Portal* (hover popover desktop & modal mobile).
  - `src/components/grid/EditableCell.jsx` dibuat — type handler generik yang secara otomatis me-render *input*, *select*, *textarea*, atau *readonly* berdasarkan definisi `columns_config`.
  - `src/components/grid/DataGrid.jsx` dibuat — Data table core engine yang *100% config-driven* dari hook `useDynamicSchema` dan `useGridData`. Termasuk fitur internal lengkap (*Find & Replace*, filter per kolom, row flag, undo).
  - Implementasi aturan bisnis "Tidak Aktif" pada DataGrid: Pengecualian field wajib (seperti `qty`) untuk baris dengan status tidak aktif.
  - `src/pages/LinePage.jsx` berhasil disederhanakan drastis dengan me-remove state table internal dan mengoper `locationName` & `canEdit` secara clean ke `<DataGrid />`.
  - Fix stub import `COLUMNS` pada `AdminSettings.jsx` yang rusak akibat pembersihan data *hardcoded* di `LinePage`.

## Log Catatan Tahap 5
- **Status**: Selesai & Build Validated (628 modules, 0 errors).
- **Perubahan Utama**:
  - Tabel `import_batches` ditambahkan ke `db.js` (Schema v2) untuk menyimpan jejak data impor Excel.
  - `itemCodeEngine.js` dibuat untuk logika *Reference Catalog Matching* otomatis dan pemformatan *Item Code* berdasarkan *Rule/Template* (SRS §7). Hook `useGridData.js` terhubung dengan mulus untuk menjalankan auto-fill.
  - `sheetsSync.js` diimplementasikan dengan *debounce queue* untuk pengiriman data secara asynchronous via *webhook Google Apps Script* tanpa menyentuh *client API* Google Sheets (SRS §8).
  - Integrasi pustaka *SheetJS* (xlsx) untuk engine *Import/Export* (`excelEngine.js`).
  - *ExportModal* dibuat dengan format dan header 100% dinamis bersumber dari `columns_config`.
  - *ImportModal* 4-tahap (Wizard) ditambahkan, beserta auto-mapping *header-to-column* dan pratinjau data invalid.
  - `importUndo.js` diselesaikan melalui *transaction* Dexie yang mendelete (soft-delete) data pada `components` berdasarkan *Batch ID* (SRS §9.6).
  - Toolbar `DataGrid.jsx` diperbarui dengan menyematkan komponen modal Export & Import.

## Log Catatan Tahap 6
- **Status**: Selesai & Build Validated (632 modules, 0 errors).
- **Perubahan Utama**:
  - `src/lib/db.js` diperbarui ke Schema v3 dengan tabel `activity_log` (audit trail lokal, append-only).
  - `src/lib/activityLog.js` diimplementasikan penuh: menyimpan log ke Dexie dengan pruning otomatis di 500 entri.
  - `src/components/admin/SchemaBuilder.jsx` dibuat — panel kelola skema kolom per Department (switcher, tabel kolom, edit inline, reorder ↑↓, toggle visibility, hapus dengan proteksi `is_ref_trigger`).
  - `src/components/admin/HierarchyManager.jsx` dibuat — CRUD Line, Department, dan Location langsung ke Dexie cache.
  - `src/components/admin/ItemCodeRuleManager.jsx` dibuat — Template Builder (chip insert kolom, preview live) dan Reference Catalog manager (cari, tambah, hapus entri).
  - `src/components/admin/SyncMonitor.jsx` dibuat — statistik antrian sync, daftar entri, tombol "Sync Sekarang" & "Retry Gagal".
  - `src/pages/AdminSettings.jsx` di-refactor total: sidebar tab nav (Skema Kolom, Hierarki, Aturan Kode, Sync Monitor), header hijau branded, tanpa kode hardcode v1.0.
  - `src/pages/ActivityLog.jsx` di-refactor: baca dari `activity_log` Dexie via `useLiveQuery`, filter aksi/tipe, color badge per jenis aksi, paginasi.

## Log Catatan Tahap 7 (Final)
- **Status**: SELESAI — Build Production Validated. 0 errors. Code splitting aktif.
- **Perubahan Utama**:
  - `AuthContext.jsx` di-refactor total dari Mock ke PocketBase riil:
    - Login via `pb.collection('users').authWithPassword()`.
    - Auto-login dari `localStorage` token (`pb.authStore.isValid`) + auto-refresh saat online.
    - *Fallback Offline Auth*: jika offline, gunakan cached profile dari `localStorage`.
    - Role dibaca dari field `role` di PocketBase record user (`admin` | `staff` | `viewer`).
    - Helper `isAdmin`, `canEdit`, `canAdmin` tersedia di semua komponen.
  - `Login.jsx` diperbarui: error handling dikembalikan dari `AuthContext.login()` langsung.
  - `App.jsx` diperbarui:
    - Route guards (`AdminRoute`, `PrivateRoute`, `PublicRoute`) kini menunggu `loading` selesai sebelum redirect (mencegah flash).
    - `AuthLoadingScreen` ditambahkan untuk animasi saat verifikasi token sesi.
    - `UpdatePrompt` dipasang di `AppShell` agar tampil global di semua halaman.
    - Admin routes di-*lazy-load* dengan `React.lazy()` + `<Suspense>` untuk code splitting.
  - `MainLayout.jsx` diperbarui: gunakan `isAdmin` dari AuthContext, tampilkan `name` user (bukan email).
  - `LinePage.jsx` diperbarui: RBAC `effectiveCanEdit` dari AuthContext (bukan hardcode role string).
  - `vite.config.js` dikonfigurasi *manual chunk splitting*:
    - `vendor-xlsx` (421 KB) — SheetJS, dimuat on-demand.
    - `vendor-dexie` (104 KB) — IndexedDB ORM.
    - `vendor-pocketbase` (38 KB) — PocketBase SDK.
    - `vendor-react` (226 KB) — React + ReactDOM.
    - `vendor-router` — React Router.
    - `vendor-pwa` — Workbox runtime.
    - Halaman admin terpisah: `AdminSettings`, `ActivityLog`, `RecycleBin`, `ImportExcel`, `ExportExcel`.
  - Peringatan chunk > 500KB **sudah dieliminasi** sepenuhnya melalui `manualChunks`.
  - PWA Workbox dikonfigurasi `runtimeCaching` untuk Google Fonts (CacheFirst strategy).

---

## Catatan Deployment (PocketBase Setup)
# Jalankan PocketBase:
pocketbase serve --http="0.0.0.0:8090"

# Collection yang dibutuhkan di PocketBase:
# - users (bawaan) → tambah field `role` (select: admin, staff, viewer)
#                  → tambah field `name` (text)

# .env untuk produksi:
VITE_POCKETBASE_URL=http://[IP_SERVER_LOKAL]:8090

## Log Catatan Tahap 8a: Migrasi Skema Item Code
- **Status**: Selesai & Build Validated (0 errors, built in 6.40s).
- **Konteks**: Revisi SRS v2.0 §7 — pendekatan dari *Dual-Matching Logic* (auto-generate kode via template) diganti total menjadi **Manual-Assisted Matching** (kode hanya dibuat manual Admin di katalog Reference).
- **Perubahan Utama**:
  - `src/lib/db.js` diperbarui ke **Schema v5**: tambah index `search_key` di `reference_catalog`, tambah `item_code_mode` di `records`. Blok `upgrade()` v5 otomatis mereset `reference_catalog` (data lama format `match_signature` tidak kompatibel dengan format baru). `item_code_rules` tidak disebut lagi di v5 (deprecated; store lama tidak dihapus otomatis Dexie, tapi tidak dipakai).
  - `src/lib/itemCodeEngine.js` ditulis ulang total: hapus `generateItemCode`, `parseItemCodeTemplate`, `saveToCatalog`, `sanitizeCodePart`. Fungsi baru: `matchReferenceCode` (kini pakai `search_key` bukan `match_signature`), `getSuggestions` (substring match untuk autocomplete Tahap 8b), `addCatalogEntry` (simpan entry format baru), `normalizeTrigger` (diekspor untuk konsistensi).
  - `src/hooks/useGridData.js`: hapus blok item code engine lama (lookup `item_code_rules` + `generateItemCode`). Import `generateItemCode` dihapus. Placeholder komentar Tahap 8b ditambahkan.
  - `src/components/admin/ItemCodeRuleManager.jsx`: `TemplateBuilder` (sub-komponen template builder + chip `{col_X}{seq:N}`) dihapus seluruhnya. `ReferenceCatalog` diperbarui: form "Tambah Entri" kini hanya meminta *search_key* + *item_code* (tanpa kolom trigger selector); tabel hasil pakai `search_key`; badge sumber diperbarui (`upload` | `manual`). Import `parseItemCodeTemplate` diganti `addCatalogEntry`.
- **Yang Belum (Tahap 8b)**: UI autocomplete/suggestions saat mengetik di kolom pemicu, toggle Auto/Manual per baris di grid, laporan "Belum Ketemu Kode" untuk Admin.

> **Catatan PocketBase (Manual)**: Perbarui collection `reference_catalog` di Admin UI PocketBase: hapus field `match_signature` (jika ada), tambah field `search_key` (text), `components` (JSON), pastikan `source` options adalah `upload` | `manual`. Tambah field `item_code_mode` (select: `auto`|`manual`, default `auto`) ke collection `records`. Tambah field `applies_to`, `is_search_key`, `is_item_code_column` ke collection `columns_config`.

## Log Catatan Tahap 8b: Refactor Item Code Matching Logic
- **Status**: Selesai & Build Validated (0 errors, built in 4.14s).
- **Konteks**: Implementasi penuh logika Manual-Assisted Matching (SRS v2.0 §7) di layer kode — setelah Tahap 8a menyiapkan skema data, Tahap 8b mengisi otasi fungsionalnya.
- **Perubahan Utama**:
  - `src/lib/itemCodeEngine.js` direfactor total:
    - Fungsi `applyItemCodeMatching(row, colKey, newVal, allColumns)` ditambahkan sebagai **entry point utama** yang dipanggil dari `useGridData.updateCell`. Fungsi ini mengurus seluruh alur: cek `is_ref_trigger`, cek `item_code_mode` (skip jika `'manual'`), temukan kolom `is_item_code_column`, exact-match ke `reference_catalog.search_key` via Dexie, kembalikan patch `{ [itemCodeKey]: value|'' }`.
    - `getSuggestions(partialValue, departmentId, limit?)` diperkuat: substring/mid-string search (bukan prefix), semua query via Dexie (offline-first), siap dipanggil oleh UI autocomplete di Tahap 8c.
    - `addCatalogEntry(...)` tetap tersedia untuk Admin panel.
    - `normalizeTrigger(val)` diekspor untuk konsistensi normalisasi di seluruh codebase.
  - `src/hooks/useGridData.js`:
    - Import berubah dari `matchReferenceCode` ke `applyItemCodeMatching`.
    - Placeholder `void matchReferenceCode` diganti dengan pemanggilan nyata: load `allColumns` dari Dexie, panggil `applyItemCodeMatching`, merge patch ke `updatedComponents`.
    - Error handling non-blocking dipertahankan (matching error tidak menghentikan save).
    - Docstring `updateCell` diperbarui.
- **Yang Belum (Tahap 8c)**: UI autocomplete/dropdown suggestions saat mengetik di kolom pemicu, toggle Auto/Manual per baris yang terlihat di grid.

## Log Catatan Tahap 8c: UI Admin Konfigurasi Item Code
- **Status**: Selesai & Build Validated (0 errors, built in 850ms).
- **Perubahan Utama**:
  - `src/components/admin/ItemCodeRuleManager.jsx` ditulis ulang total:
    - **Panel 1 — Konfigurasi Item Code**: daftar kolom Records dengan toggle button per kolom untuk flag `is_ref_trigger`, `is_item_code_column`; dan daftar kolom Reference Catalog dengan toggle untuk `is_search_key`. Satu klik otomatis menonaktifkan flag pada kolom lain (hanya boleh 1 kolom per flag per Department). Ringkasan "Konfigurasi aktif" tampil di bawah.
    - **Panel 2 — Reference Catalog Manager**: form tambah entri sepenuhnya dinamis mengikuti `columns_config applies_to=reference_catalog`; input dirender per kolom (text/number/select); kolom `is_search_key` diberi highlight border oranye; kolom `item_code` selalu ada dan diisi manual Admin. Source hanya `manual|upload` (tidak ada lagi `generated`).
  - `src/components/admin/SchemaBuilder.jsx` diperbarui:
    - **Tab dua tampilan**: tombol tab "📋 Records (N)" vs "📖 Ref Catalog (N)" di atas tabel kolom, list kolom difilter per tab.
    - **AddColumnForm**: radio selector "Kolom ini dipakai untuk" (Records vs Reference Catalog); flag yang tampil menyesuaikan pilihan (`is_required`, `is_ref_trigger`, `is_item_code_column`, `Hanya Admin` hanya untuk Records; `is_search_key` hanya untuk Reference Catalog). Field `applies_to` disimpan ke `columns_config`.
    - **Badge tabel kolom**: tambah badge `item code` (hijau) dan `search_key` (oranye) di samping badge `pemicu` (biru).
    - Reorder (move up/down) beroperasi dalam scope tab aktif (tidak mencampur urutan Records dan Ref Catalog).
- **Yang Belum (Tahap 8d, opsional)**: Toggle Auto/Manual per baris di grid UI, autocomplete dropdown saat mengetik di kolom pemicu.

## Log Catatan Tahap 8d: UI Grid — Toggle Auto/Manual, Autocomplete, Laporan Belum Ketemu Kode
- **Status**: Selesai & Build Validated (0 errors, built in 696ms). **✅ Migrasi Item Code Engine SELESAI (Tahap 8a–8d).**
- **Perubahan Utama**:
  - `src/hooks/useGridData.js`: tambah fungsi `updateItemCodeMode(rowId, mode, editedBy)` — persist field `item_code_mode` (top-level record, bukan di `components`), masukkan ke `sync_queue`. Diekspor dari return hook.
  - `src/components/grid/EditableCell.jsx` ditulis ulang total:
    - **Kolom `is_item_code_column=true`**: Tampilkan badge toggle **AUTO/MNL** di sudut kiri atas sel. Mode Auto (hijau) → sel read-only dengan visual berbeda (background hijau muda jika ada kode, oranye muda jika kosong), teks "— belum cocok —". Mode Manual (oranye) → sel bisa diedit bebas. Toggle klik update `item_code_mode` via `onToggleMode` prop.
    - **Kolom `is_ref_trigger=true`**: Saat editing (textarea aktif), tampilkan **dropdown autocomplete** di bawah input — memanggil `getSuggestions()` dari `itemCodeEngine.js` (substring/mid-string search, offline Dexie). Klik rekomendasi → commit nilai + tutup dropdown. Blur dengan delay 150ms agar click suggestion tidak terpotong.
    - Import baru: `getSuggestions` dari `itemCodeEngine.js`. Subkomponen baru: `AutocompleteDropdown`, `ItemCodeModeToggle`.
  - `src/components/grid/DataGrid.jsx`: Destructure `updateItemCodeMode` dari hook. Pass props ke `EditableCell`: `itemCodeMode` (dari `row.item_code_mode ?? 'auto'`), `onToggleMode` callback (hanya untuk `is_item_code_column`), `departmentId` (untuk autocomplete).
  - `src/components/admin/UnmatchedReport.jsx` [NEW]: Laporan Admin "Belum Ketemu Kode". Query Dexie semua records `item_code_mode='auto'` yang kolom Item Code-nya kosong, kelompokkan per Department. Tampilkan tabel per Department dengan: nilai kolom pemicu, status (kosong / nilai ada tapi tidak cocok), kolom Item Code. Ringkasan total di atas. Tips tambah ke katalog di bawah tabel.
  - `src/pages/AdminSettings.jsx`: Tab baru **"Belum Ketemu Kode"** (ikon info-circle) daftarkan `UnmatchedReport`. Tab "Aturan Kode" deskripsinya diperbarui.

## Log Catatan Tahap 8e: QA & Fix Sync Path Item Code
- **Status**: Selesai & Build Validated (0 errors, built in 813ms). **Tidak ada bug ditemukan — tidak ada perubahan kode.**
- **Metode Verifikasi**: Baca langsung kode aktual `src/hooks/useGridData.js` (baris 195–259) dan `src/lib/itemCodeEngine.js` (seluruh file, 181 baris).

- **Poin 1 — Sync Queue untuk Hasil Auto-Match**: ✅ **SUDAH BENAR, tidak ada fix.**
  - Temuan: `updateCell()` menggunakan satu variabel `updatedComponents` yang di-merge secara berurutan: pertama nilai kolom pemicu (`{ ...row.components, [colKey]: value }`), lalu patch hasil `applyItemCodeMatching()` (`{ ...updatedComponents, ...itemCodePatch }`). Setelah itu baru ada satu `db.records.update()` dan satu `db.sync_queue.add()` dengan `payload.components = updatedComponents` yang sudah mengandung item code hasil matching. Tidak ada write terpisah yang melewati sync_queue.

- **Poin 2 — Atomisitas Dua Write**: ✅ **SUDAH BENAR, tidak ada fix.**
  - Temuan: Seluruh blok (fetch row, merge components + patch, `db.records.update`, `db.sync_queue.add`) berada dalam **satu** `db.transaction('rw', [db.records, db.sync_queue], async () => { ... })`. Row di-fetch dengan `await db.records.get(rowId)` di dalam transaksi (baris 200), sebelum merge — sehingga data yang dipakai adalah state paling baru. Kedua syarat (satu transaksi, fetch fresh di dalam transaksi) terpenuhi.

- **Poin 3 — Normalisasi search_key Saat Simpan**: ✅ **SUDAH BENAR, tidak ada fix.**
  - Temuan: `addCatalogEntry()` (baris 175) menyimpan `search_key: normalizeTrigger(searchKey)` — normalisasi sudah dilakukan di titik simpan. `applyItemCodeMatching()` juga memanggil `normalizeTrigger(e.search_key)` saat compare — ini redundan tapi idempoten (double-normalize aman) dan justru membuat matching lebih robust terhadap data lama yang mungkin belum dinormalisasi.
  - Satu catatan minor: `getSuggestions()` dan `applyItemCodeMatching()` selalu re-normalize `search_key` dari katalog saat compare. Ini 

- **Verifikasi Lanjutan — Sumber Nilai untuk `itemCodePatch`**: ✅ **SUDAH BENAR, tidak ada fix.**
  - Pertanyaan: apakah `itemCodePatch` dihitung dari `value` (parameter baru dari user) atau dari `db.records.get(rowId)` yang di-fetch ulang?
  - Temuan verbatim (baris 215–220): `applyItemCodeMatching({ ...row, ... }, colKey, value, allColumns)` — parameter ke-3 adalah `value` (parameter fungsi `updateCell` langsung), **bukan** nilai dari DB fetch ulang.
  - Di dalam `applyItemCodeMatching` (baris 88): `const normalized = normalizeTrigger(newVal)` — `newVal` adalah `value` tadi. Matching dilakukan terhadap nilai baru yang baru diketik user.
  - `row` dari `db.records.get(rowId)` (baris 200) hanya dipakai untuk `row.item_code_mode` (cek Auto/Manual) dan `row.department_id` (filter katalog). Keduanya tidak berubah selama satu `updateCell` call — tidak menimbulkan masalah.
  - Urutan di dalam transaksi: (1) fetch row → (2) hitung `itemCodePatch` dari `value` langsung → (3) merge → (4) baru tulis ke DB dengan `updatedComponents` final. Tidak ada risiko "satu langkah tertinggal".

- **Verifikasi Lanjutan — Gate di dalam `applyItemCodeMatching`**: ✅ **SEMUA GATE ADA, tidak ada fix.**
  - Pertanyaan: apakah gate "bukan kolom pemicu" dipindah ke dalam fungsi? apakah edit kolom bukan pemicu tidak memicu query katalog? apakah mode manual skip total?
  - **Gate 1 (bukan kolom pemicu) — baris 73–76:**
    ```js
    const triggerCol = (allColumns || []).find(
      c => c.key === colKey && c.is_ref_trigger === true
    )
    if (!triggerCol) return null
    ```
    Kalau `colKey` bukan kolom pemicu → `triggerCol = undefined` → `return null` di baris 76. Baris 88–111 (termasuk query `db.reference_catalog`) tidak pernah tercapai.
  - **Gate 2 (mode manual) — baris 79–80:**
    ```js
    const mode = row.item_code_mode ?? 'auto'
    if (mode === 'manual') return null
    ```
    Kalau `item_code_mode = 'manual'` → `return null` sebelum query katalog maupun modify Item Code. Item Code tidak disentuh sama sekali.
  - **Gate 3 (tidak ada kolom item code dikonfigurasi) — baris 83–84:**
    ```js
    const itemCodeCol = (allColumns || []).find(c => c.is_item_code_column === true)
    if (!itemCodeCol) return null
    ```
  - Urutan gate: L76 (bukan pemicu) → L80 (manual) → L84 (tidak ada kolom item code) → L91 (nilai kosong) → baru L96 eksekusi query katalog. Tidak ada jalur yang melewati query tanpa melewati semua gate.

- **Verifikasi Lanjutan — `normalizeTrigger` implementasi**: ✅ **SESUAI SPEC SRS §5.2, tidak ada fix.**
  - Baris 36–39 verbatim:
    ```js
    export function normalizeTrigger(val) {
      if (val === null || val === undefined) return ''
      return String(val).toLowerCase().trim().replace(/\s+/g, ' ')
    }
    ```
  - `.toLowerCase()` → lowercase ✓ | `.trim()` → hapus spasi awal/akhir ✓ | `.replace(/\s+/g, ' ')` → collapse whitespace berlebih (spasi, tab, newline) menjadi satu spasi ✓. Memenuhi SRS §5.2 "lowercase + rapikan spasi berlebih".

- **Verifikasi Lanjutan — Timing "on blur"**: ⚠️ **BUG DITEMUKAN & DIPERBAIKI.**
  - Temuan: `onBlur` textarea (tipe text, termasuk kolom pemicu `is_ref_trigger`) di [`EditableCell.jsx`](file:///d:/Hammam/Projek/engineer-partsource/src/components/grid/EditableCell.jsx) baris 319–322 hanya memanggil `setIsEditing(false)` — **tidak memanggil `commit()`**. Ini berarti jika user mengetik di kolom pemicu lalu klik sel lain (blur tanpa Enter), nilai tidak disimpan dan `updateCell`/`applyItemCodeMatching` tidak dieksekusi.
  - Bandingkan: `type='number'` (baris 274: `onBlur={commit}`) dan `type='gdrive_link'` (baris 291: `onBlur={commit}`) sudah benar.
  - **Fix** di [`src/components/grid/EditableCell.jsx`](file:///d:/Hammam/Projek/engineer-partsource/src/components/grid/EditableCell.jsx):
    ```js
    // SEBELUM (bug):
    onBlur={() => {
      setTimeout(() => { setIsEditing(false); setSuggestions([]) }, 150)
    }}

    // SESUDAH (fix):
    onBlur={() => {
      // Delay blur agar onMouseDown suggestion sempat fired dulu,
      // baru commit() dipanggil — sama seperti number/gdrive_link onBlur={commit}
      setTimeout(() => { commit(); setSuggestions([]) }, 150)
    }}
    ```
  - `commit()` sudah mengandung `setIsEditing(false)` di baris 205, jadi tidak ada duplikasi. Delay 150ms dipertahankan agar `onMouseDown` suggestion sempat fired sebelum blur commit. Build validated: 0 errors, built in 665ms.