 # Progress Migrasi Plant Sourcing App v2.0

## Status Tahapan
- [x] **Tahap 1: Pembersihan Firebase & Setup Infrastruktur (PocketBase + Dexie)**
- [x] **Tahap 2: Dynamic Schema Engine & Local-First Sync Hook**
- [x] **Tahap 3: Hierarki Navigasi 3-Tier & Layout Global**
- [x] **Tahap 4: Refactor Generic Dynamic Grid & Spreadsheet Tools**
- [x] **Tahap 5: Dynamic Item Code Engine, Google Sheets Sync Queue, & Import/Export**
- [x] **Tahap 6: Admin Dashboard & Schema Manager**

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