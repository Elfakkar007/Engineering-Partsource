 # Progress Migrasi Plant Sourcing App v2.0

## Status Tahapan
- [x] **Tahap 1: Pembersihan Firebase & Setup Infrastruktur (PocketBase + Dexie)**
- [x] **Tahap 2: Dynamic Schema Engine & Local-First Sync Hook**
- [ ] **Tahap 3: Hierarki Navigasi 3-Tier & Layout Global**
- [ ] **Tahap 4: Refactor Generic Dynamic Grid & Spreadsheet Tools**
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