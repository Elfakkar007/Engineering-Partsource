 # Progress Migrasi Plant Sourcing App v2.0

## Status Tahapan
- [x] **Tahap 1: Pembersihan Firebase & Setup Infrastruktur (PocketBase + Dexie)**
- [x] **Tahap 2: Dynamic Schema Engine & Local-First Sync Hook**
- [x] **Tahap 3: Hierarki Navigasi 3-Tier & Layout Global**
- [x] **Tahap 4: Refactor Generic Dynamic Grid & Spreadsheet Tools**
- [ ] **Tahap 5: Dynamic Item Code Engine, Google Sheets Sync Queue, & Import/Export**

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