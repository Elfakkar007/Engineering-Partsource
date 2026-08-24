# INSTRUMEN PENGUJIAN MANUAL (MANUAL TEST SUITE & PROTOCOL)
## Sistem Plant Sourcing v2.0 (Engineer PartSource)

**Dokumen Acuan:** `SRS_v2.md`, `DESIGN_v2.md`, `PROGRESS.md`  
**Versi Sistem:** v2.0 (Phase 8e - Manual-Assisted Matching & Offline PWA)  
**Target Pengguna Penguji:** QA Tester, UAT Team, Developer, Lead Engineer  

---

## 1. Panduan & Petunjuk Pengujian

### 1.1 Skala Prioritas Pengujian (Severity / Priority)
* **[P0 - Blocker / Kritis]:** Fungsi inti mati, kehilangan data, crash aplikasi, atau gagal sync permanen.
* **[P1 - Major]:** Fitur utama tidak bekerja sesuai spesifikasi SRS, ada deviasi logika bisnis penting.
* **[P2 - Medium]:** Fitur sekunder ada kendala, UI glitch yang tidak merusak data, error handling kurang ramah.
* **[P3 - Minor / Trivial]:** Kosmetik, typo, alignment, atau perbaikan estetika non-fungsional.

### 1.2 Status Hasil Uji
* `[PASS]` : Lolos uji 100% sesuai ekspektasi.
* `[FAIL]` : Gagal, hasil aktual tidak sesuai ekspektasi (wajib buat Bug Ticket).
* `[BLOCKED]` : Tidak dapat diuji karena dependensi fitur lain bermasalah.
* `[SKIPPED]` : Dilewati atas persetujuan Lead.

---

## 2. Persiapan Lingkungan Uji (Test Environment Setup)

### 2.1 Kebutuhan Perangkat & Browser
1. **Desktop:** Google Chrome / MS Edge / Firefox (Versi modern terbaru).
2. **Mobile / Tablet:** Android (Chrome) / iOS (Safari) untuk uji responsive & PWA.
3. **Jaringan:**
   - Mode Online (Koneksi WiFi / LAN aktif).
   - Mode Simulasi Offline (DevTools > Network > Offline atau matikan adaptor jaringan).
   - Mode Slow Network (Slow 3G / Fast 3G).

### 2.2 Akun Pengujian (Test Accounts)
| Role | Email / Username | Password | Deskripsi Kewenangan |
|---|---|---|---|
| **Admin** | `admin@plant.com` (atau akun admin PB) | *(password)* | Akses penuh: Grid, Admin Settings, Schema, Catalog, Recycle Bin, Log |
| **Staff (PIC)** | `staff@plant.com` | *(password)* | Akses Grid, Isi Data, Import/Export, Flag, Undo (Readonly pada kolom Admin) |
| **Viewer** | `viewer@plant.com` | *(password)* | Akses Read-Only ke Grid & Dashboard, tidak dapat mengedit data |

---

## 3. Matriks Test Cases Per Modul

---

### MODUL 01: Otentikasi, Sesi, & Role-Based Access Control (RBAC)

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-AUTH-01** | Login Valid (Online) | 1. Buka `/login`<br>2. Masukkan email & password Admin<br>3. Klik tombol "Masuk" | Akun Admin terdaftar | Berhasil login, diarahkan ke Dashboard `/`, nama user & tombol admin muncul di header | [ ] |
| **TC-AUTH-02** | Login Invalid | 1. Buka `/login`<br>2. Masukkan password salah<br>3. Klik tombol "Masuk" | Email valid, Password: `salah123` | Muncul alert error deskriptif, tetap di `/login`, tidak crash | [ ] |
| **TC-AUTH-03** | Route Protection (Guest) | 1. Logout/buka tab Incognito<br>2. Akses URL langsung ke `/admin/settings` atau `/line/L1` | URL langsung | Redirect otomatis ke `/login` tanpa flash konten privat | [ ] |
| **TC-AUTH-04** | RBAC Staff Access Control | 1. Login sebagai Staff/PIC<br>2. Coba akses `/admin/settings` lewat URL browser | Akun Staff | Otomatis diredirect ke `/` (Dashboard), menu Admin tidak ada di header | [ ] |
| **TC-AUTH-05** | Offline Session Persistence | 1. Login saat online<br>2. Matikan koneksi internet (DevTools Offline)<br>3. Refresh halaman (F5) | Mode Offline | Aplikasi tetap terbuka, sesi tidak hilang (fallback localStorage), tidak redirect ke `/login` | [ ] |
| **TC-AUTH-06** | Logout | 1. Klik tombol "Logout" di header | Sesi aktif | Token dihapus, redirect ke `/login`, tombol back browser tidak mengembalikan sesi | [ ] |

---

### MODUL 02: Navigasi Hierarki 3-Tier & Breadcrumb

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-NAV-01** | Tier-1: Pilih Line | 1. Buka Dashboard `/`<br>2. Klik salah satu Card Line (mis. "Line 1") | Line 1 | URL berpindah ke `/line/line_1`, halaman memuat data Line 1 | [ ] |
| **TC-NAV-02** | Tier-2: Ganti Department | 1. Di halaman Line, klik tab Department "Elektrik"<br>2. Klik tab "Mekanik" | Dept ID berbeda | URL update `/line/line_1/dept_elektrik`, skema kolom & data tabel berganti sesuai department terpilih | [ ] |
| **TC-NAV-03** | Tier-3: Ganti Lokasi | 1. Klik sub-tab Location (mis. "Conveyor A" ke "Feeder 1") | Location ID | Data Grid merender baris milik lokasi terpilih, indikator tab aktif berubah | [ ] |
| **TC-NAV-04** | Direct URL Deep Link | 1. Buka URL `/line/line_1/dept_mekanik/loc_conveyor_1` langsung | URL lengkap | Navigasi langsung memilih Line 1, Tab Mekanik, dan Lokasi Conveyor 1 secara akurat | [ ] |
| **TC-NAV-05** | Fallback Invalid Params | 1. Buka URL dengan ID asal `/line/line_invalid/dept_xyz` | ID tidak ada | Sistem auto-fallback ke Line dan Department pertama yang tersedia di cache tanpa error putih | [ ] |

---

### MODUL 03: Dynamic Data Grid & Inline Editing

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-GRID-01** | Render Skema Dinamis | 1. Bandingkan kolom di Department Mekanik (23 kolom) vs Elektrik (13 kolom) | Data seed | Header kolom, tipe input, dan urutan tepat sesuai konfigurasi `columns_config` di Dexie | [ ] |
| **TC-GRID-02** | Edit Tipe Text & Auto-Resize | 1. Klik sel bertipe `text`<br>2. Ketik teks panjang multi-baris<br>3. Klik di luar sel (blur) | Teks 3 baris | Textarea auto-expand tingginya, saat blur data tersimpan (muncul centang hijau sebentar) | [ ] |
| **TC-GRID-03** | Edit Tipe Number | 1. Klik sel `number` (mis. Qty)<br>2. Masukkan angka `15`<br>3. Tekan Enter | `15` | Tersimpan sebagai integer `15`, bukan string `"15"` | [ ] |
| **TC-GRID-04** | Edit Tipe Select (Chip Color) | 1. Klik sel `select` (mis. Status)<br>2. Pilih "Existing" lalu ganti ke "Tidak Aktif" | Opsi dropdown | Nilai tersimpan dan warna badge chip berubah sesuai tone (hijau/merah/kuning) | [ ] |
| **TC-GRID-05** | Edit Tipe GDrive Link & Hover Preview | 1. Masukkan URL Google Drive gambar valid<br>2. Hover mouse di atas icon link | URL GDrive valid | Muncul popover preview gambar via React Portal (tidak terpotong container scroll) | [ ] |
| **TC-GRID-06** | Readonly Protection | 1. Login sebagai Staff/PIC<br>2. Coba klik sel kolom bertanda Admin Only / `is_readonly` | Kolom admin | Sel tidak masuk mode edit, cursor default, data tidak dapat diubah | [ ] |
| **TC-GRID-07** | Tambah Baris Baru | 1. Klik tombol "+ Tambah Baris" di toolbar | Klik tombol | Baris baru kosong bertambah di baris paling bawah, ID terdaftar di Dexie & sync queue | [ ] |

---

### MODUL 04: Spreadsheet Tools (Filter, Search, Replace, Bulk, Undo)

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-TOOL-01** | Filter Per Kolom | 1. Klik icon filter di header kolom "Status"<br>2. Centang hanya "Existing"<br>3. Klik "Terapkan" | Filter value | Grid hanya menampilkan baris berstatus "Existing", icon filter berubah aktif, tombol "Hapus Filter" muncul | [ ] |
| **TC-TOOL-02** | Global Search | 1. Ketik kata kunci di box "Cari di lokasi ini..." | Mis. "Omron" | Grid memfilter instan seluruh baris yang mengandung substring "Omron" di kolom mana saja | [ ] |
| **TC-TOOL-03** | Find & Replace Modal | 1. Klik "Cari & Ganti"<br>2. Cari: `Sensor A`, Ganti: `Sensor B`<br>3. Cek live preview daftar sel yang terdampak<br>4. Klik "Ganti Semua" | `Sensor A` -> `Sensor B` | Seluruh sel yang cocok terupdate, ada konfirmasi jumlah sel yang berubah | [ ] |
| **TC-TOOL-04** | Row Flag (Tandai Baris) | 1. Klik icon bendera di baris ke-2<br>2. Pilih "Perlu Ditanyakan"<br>3. Cek baris ke-3, pilih "Dilewati" | Flag enum | Baris 2 berlatar kuning/oranye (question), baris 3 berlatar abu-abu (skip), tersimpan ke DB | [ ] |
| **TC-TOOL-05** | Bulk Add Rows | 1. Klik "Tambah Sekaligus"<br>2. Masukkan jumlah `5`<br>3. Klik Tambah | Jumlah: 5 | 5 baris baru kosong bertambah serentak dalam 1 batch transaksi | [ ] |
| **TC-TOOL-06** | Bulk Fill Column | 1. Centang 3 baris checkbox<br>2. Klik "Isi Kolom Massal"<br>3. Pilih Kolom "Sub-Machine", Nilai: `Line Conveyor 01`<br>4. Konfirmasi | 3 baris terpilih | Ketiga baris terisi nilai yang sama secara instan dan masuk antrian sync | [ ] |
| **TC-TOOL-07** | Bulk Delete Rows | 1. Centang 2 baris<br>2. Klik "Hapus Dipilih"<br>3. Konfirmasi di modal | 2 baris | 2 baris di-soft delete (`isDeleted: true`), hilang dari grid aktif, masuk Recycle Bin | [ ] |
| **TC-TOOL-08** | Client-Side Undo (Ctrl+Z) | 1. Edit suatu sel dari `A` ke `B`<br>2. Tekan tombol "↩ Undo" di toolbar atau `Ctrl+Z` | Undo action | Nilai sel kembali ke `A`, perubahan tercatat kembali ke Dexie & sync queue | [ ] |

---

### MODUL 05: Aturan Kelengkapan Baris (Completion & Exception Rules)

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-RULE-01** | Indikator Baris Tidak Lengkap | 1. Buat baris baru, isi hanya sebagian kolom wajib (`is_required=true`) | Sebagian kolom | Nomor baris (#) memiliki strip/tanda merah (*incomplete row*), status kelengkapan = false | [ ] |
| **TC-RULE-02** | Indikator Baris Lengkap | 1. Lengkapi seluruh kolom yang berstatus wajib pada baris tersebut | Semua kolom wajib | Strip merah pada nomor baris hilang, baris berstatus valid/lengkap | [ ] |
| **TC-RULE-03** | Exception Rule "Tidak Aktif" | 1. Buat baris dengan kolom `Status` = "Tidak Aktif"<br>2. Kosongkan kolom `Qty` (yang aslinya wajib) | Status: "Tidak Aktif", Qty: kosong | Baris **tetap dihitung lengkap (valid)** karena masuk dalam pengecualian `completion_exception_rules` | [ ] |
| **TC-RULE-04** | Dinamika Rule Exception | 1. Buka Admin > Exception Rules<br>2. Ubah kondisi exception<br>3. Kembali ke Grid | Modifikasi rule | Status kelengkapan baris di grid terhitung ulang secara reaktif tanpa reload | [ ] |

---

### MODUL 06: Item Code Engine & Manual-Assisted Matching (Tahap 8a–8e)

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-CODE-01** | Autocomplete Substring Search | 1. Pada baris baru, klik sel kolom pemicu (`is_ref_trigger`)<br>2. Ketik substring (mis. `prox` atau `24v`) | Substring input | Muncul dropdown rekomendasi berisi item katalog yang cocok beserta Item Code-nya | [ ] |
| **TC-CODE-02** | Klik Rekomendasi Autocomplete | 1. Dari dropdown autocomplete, klik salah satu rekomendasi | Pilih item | Teks pemicu otomatis terisi lengkap, dropdown menutup, kolom Item Code langsung terisi kode terkait | [ ] |
| **TC-CODE-03** | Exact-Match Manual Input (On Blur) | 1. Ketik manual teks pemicu yang ada di katalog (beda kapitalisasi/spasi)<br>2. Klik di luar sel (on blur) | `  proximity SWITCH pnp  ` | Engine menormalisasi string, mencocokkan ke catalog, kolom Item Code terisi otomatis | [ ] |
| **TC-CODE-04** | Unmatched Keyword (NaN/Kosong) | 1. Ketik nilai pemicu yang **tidak ada** di katalog<br>2. Blur sel | `Barang Abal-Abal 999` | Kolom Item Code menjadi kosong (`— belum cocok —`), background sel oranye muda | [ ] |
| **TC-CODE-05** | Toggle Mode Manual (MNL) | 1. Pada sel Item Code bertuliskan badge `[AUTO]`, klik badge tersebut | Klik badge | Badge berganti menjadi `[MNL]` (oranye), sel sekarang dapat diklik dan diedit bebas secara manual | [ ] |
| **TC-CODE-06** | Proteksi Mode Manual saat Pemicu Berubah | 1. Pada baris Mode `[MNL]`, ubah nilai kolom pemicu | Nilai pemicu baru | Kolom Item Code **TIDAK berubah/tidak ditimpa**, nilai manual tetap bertahan | [ ] |
| **TC-CODE-07** | Toggle Kembali ke Auto | 1. Klik badge `[MNL]` menjadi `[AUTO]`<br>2. Edit kolom pemicu | Mode Auto | Sel Item Code kembali terkunci (read-only) dan matching engine aktif kembali | [ ] |
| **TC-CODE-08** | Laporan "Belum Ketemu Kode" | 1. Buat baris Mode Auto yang belum punya kode item<br>2. Buka Admin > Belum Ketemu Kode | Data unmatched | Baris tersebut muncul di tabel laporan per Department dengan status "Nilai ada, tidak cocok di katalog" | [ ] |

---

### MODUL 07: Admin Panel — Schema Builder & Hierarchy Manager

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-ADM-01** | Tab Schema Records vs Ref Catalog | 1. Buka Admin > Skema Kolom<br>2. Klik Tab "📋 Records" lalu "📖 Ref Catalog" | Navigasi tab | Daftar kolom terpisah bersih antara struktur tabel records dan struktur reference catalog | [ ] |
| **TC-ADM-02** | Tambah Kolom Records Baru | 1. Klik "+ Tambah Kolom"<br>2. Pilih applies_to: "Records"<br>3. Isi Label, Tipe `select`, opsi list<br>4. Simpan | Kolom: "Kondisi Part" | Kolom baru muncul di tabel dan langsung tersedia di Data Grid department terkait | [ ] |
| **TC-ADM-03** | Reorder Kolom (↑ / ↓) | 1. Klik tombol panah atas/bawah pada suatu kolom | Urutan kolom | Urutan kolom (`order`) berubah di DB dan urutan header di DataGrid langsung bergeser | [ ] |
| **TC-ADM-04** | Toggle Visibility Kolom | 1. Klik icon mata (sembunyikan) pada satu kolom | Toggle hide | Kolom hilang dari tampilan DataGrid pengguna, tetapi data tidak terhapus | [ ] |
| **TC-ADM-05** | Proteksi Hapus Kolom Pemicu | 1. Coba hapus kolom yang ditandai `is_ref_trigger` atau `is_auto` | Kolom pemicu | Sistem mencegah penghapusan dengan notifikasi peringatan | [ ] |
| **TC-ADM-06** | Hierarchy Manager (Line/Dept/Loc) | 1. Buka Admin > Hierarki<br>2. Tambah Line baru, Department baru, dan Location baru | Data master | Entri baru tersimpan dan langsung muncul di dropdown/tab navigasi aplikasi | [ ] |

---

### MODUL 08: Admin Panel — Reference Catalog Manager

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-CAT-01** | Konfigurasi Kolom Peran | 1. Buka Admin > Aturan Kode<br>2. Klik "Jadikan Pemicu" pada salah satu kolom<br>3. Klik "Jadikan Kolom Kode"<br>4. Klik "Jadikan Kunci Pencarian" | Flag setting | Hanya 1 kolom per flag yang aktif (otomatis clear kolom lain), ringkasan konfigurasi update | [ ] |
| **TC-CAT-02** | Form Tambah Entri Katalog Dinamis | 1. Klik "+ Tambah Entri"<br>2. Isi field komponen dinamis + Item Code manual (mis. `ELK-SNS-0101`)<br>3. Klik Simpan | Entri baru | Entri tersimpan di `reference_catalog` Dexie dengan `search_key` otomatis dinormalisasi | [ ] |
| **TC-CAT-03** | Pencarian Katalog | 1. Ketik di kolom search catalog referensi | Keyword pencarian | Tabel katalog menyaring entri berdasarkan `search_key` dan `item_code` secara instan | [ ] |
| **TC-CAT-04** | Hapus Entri Katalog | 1. Klik tombol hapus (x/merah) pada entri katalog<br>2. Konfirmasi | Hapus entri | Entri terhapus dari katalog Dexie | [ ] |

---

### MODUL 09: Excel Import Wizard & Global Batch Undo

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-IMP-01** | Wizard Step 1: Upload File | 1. Buka Import Excel<br>2. Upload file `.xlsx` / `.csv` valid | File Excel sample | File terbaca, lanjut ke Step 2 (Mapping Kolom) | [ ] |
| **TC-IMP-02** | Wizard Step 2: Auto Column Mapping | 1. Cek pemetaan otomatis header Excel ke `columns_config`<br>2. Buat kolom baru dari header yang belum ada | Header baru | Header terpetakan otomatis, kolom baru dapat didefinisikan tipenya (text/number/select) | [ ] |
| **TC-IMP-03** | Wizard Step 3: Validasi Baris | 1. Review tabel validasi yang mendeteksi baris valid vs invalid (mis. tipe data salah) | File dengan 1 error | Sistem menampilkan preview error per baris sebelum data di-commit | [ ] |
| **TC-IMP-04** | Wizard Step 4: Commit Import | 1. Klik tombol "Commit Import" | Konfirmasi | Seluruh baris masuk ke Dexie `records` dengan `import_batch_id` yang sama, masuk sync queue | [ ] |
| **TC-IMP-05** | Global Import Undo Toast | 1. Setelah import berhasil, berpindah ke halaman lain (mis. Admin atau Line lain)<br>2. Klik tombol "Batalkan Import Ini" pada toast persisten | Undo batch | Seluruh baris dari batch import tersebut di-soft delete secara menyeluruh lintas halaman | [ ] |
| **TC-IMP-06** | Preview Stage Collision | 1. Import file dengan ≥2 header baru (mis. `Col A`, `Col B`)<br>2. Petakan keduanya ke "✦ Buat kolom baru" | File > 2 header baru | Step 3 (Preview) merender kolom baru secara terpisah tanpa saling menimpa data | [ ] |
| **TC-IMP-07** | RBAC Non-Admin Import | 1. Login sebagai Staff/PIC<br>2. Import file dengan header baru | Akun Non-Admin | Opsi "✦ Buat kolom baru" disembunyikan, muncul warning kuning (Akses Admin diperlukan) | [ ] |
| **TC-IMP-08** | Auto-Extract Select Options | 1. Import file (sebagai Admin)<br>2. Pilih tipe "Pilihan (Select)" untuk kolom baru | Data dengan teks berulang | Opsi langsung terekstrak dari isi Excel, unik & urut (muncul sebagai badge/chip yang bisa diedit) | [ ] |
| **TC-IMP-09** | Collision Key Handling | 1. Buat kolom berlabel `Qty`<br>2. Import file dengan header `qty` dan `Qty (pcs)` | Label mirip | Sistem otomatis meresolve key yang bentrok menjadi `col_qty_2`, `col_qty_3` tanpa konflik | [ ] |

---

### MODUL 10: Excel Export Engine & Checkbox Tree

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-EXP-01** | Checkbox Tree Selector | 1. Buka Export Modal / Halaman Export<br>2. Pilih kombinasi Line 1 > Dept Elektrik > Lokasi A & B | Tree selection | Pilihan tercentang rapi dan ringkasan total baris terestimasi akurat | [ ] |
| **TC-EXP-02** | Kolom Selector Export | 1. Uncheck beberapa kolom yang tidak ingin diekspor | Filter kolom | Hanya kolom yang dipilih yang akan disertakan dalam file Excel hasil download | [ ] |
| **TC-EXP-03** | Download & Validasi File Excel | 1. Klik "Download Excel (.xlsx)"<br>2. Buka file hasil di MS Excel / LibreOffice | File output | File terbuka tanpa corrupt, styling header rapi/bold, format data text/angka tepat | [ ] |

---

### MODUL 11: Recycle Bin & Activity Log (Audit Trail)

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-REC-01** | Daftar Item Terhapus | 1. Hapus 1 baris dari DataGrid<br>2. Buka Admin > Recycle Bin | Baris terhapus | Baris muncul di Recycle Bin dengan timestamp penghapusan dan nama user penghapus | [ ] |
| **TC-REC-02** | Restore Baris | 1. Klik tombol "Pulihkan" pada item di Recycle Bin | Restore item | Baris kembali ke DataGrid aktif (`isDeleted: false`), masuk `sync_queue` update | [ ] |
| **TC-REC-03** | Hard Delete (Hapus Permanen) | 1. Klik "Hapus Selamanya" (Admin only)<br>2. Konfirmasi modal | Hard delete | Baris terhapus permanen dari IndexedDB lokal dan PocketBase | [ ] |
| **TC-LOG-01** | Pencatatan Audit Trail | 1. Lakukan aksi Create, Update, Delete, Import<br>2. Buka Admin > Activity Log | Aktivitas user | Seluruh aktivitas tercatat urut waktu dengan badge aksi (hijau=create, biru=update, merah=delete) | [ ] |
| **TC-LOG-02** | Filter & Pagination Log | 1. Filter log berdasarkan tipe "delete"<br>2. Navigasi halaman log | Filter query | Hanya aksi delete yang tampil, paginasi bekerja lancar | [ ] |

---

### MODUL 12: Dashboard Dinamis & Visualisasi

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-DASH-01** | Stat Cards Real-Time | 1. Tambah 5 baris data di grid<br>2. Kembali ke Dashboard `/` | Penambahan data | Stat cards (Total Baris, Persentase Lengkap, Baris Valid) terupdate otomatis | [ ] |
| **TC-DASH-02** | Filter Department Dashboard | 1. Di Dashboard, klik dropdown filter Department (mis. "Mekanik") | Filter dept | Semua statistik, checklist lokasi, dan grafik berubah memfilter hanya Department Mekanik | [ ] |
| **TC-DASH-03** | Checklist Lokasi Selesai | 1. Lengkapi seluruh baris di Lokasi "Conveyor A" (100% valid)<br>2. Cek Checklist Lokasi di Dashboard | 100% valid | Lokasi "Conveyor A" mendapat tanda centang hijau (✓ Selesai) | [ ] |
| **TC-DASH-04** | Grafik Breakdown Dinamis | 1. Cek visual chart breakdown status/kategori | Chart canvas/SVG | Diagram batang/donat me-render proporsi data secara responsif | [ ] |

---

### MODUL 13: Offline-First, Dexie Local Storage, & Sync Worker

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-SYNC-01** | Indikator SyncStatusBar 4-State | 1. Cek status saat online & idle<br>2. Matikan internet<br>3. Edit data saat offline<br>4. Nyalakan internet | Perubahan jaringan | Status bar bertransisi: **Online (Hijau)** -> **Offline (Abu)** -> **Syncing (Biru Berputar)** -> **Online (Hijau)** | [ ] |
| **TC-SYNC-02** | Pengeditan Full Offline | 1. Putus koneksi internet total<br>2. Lakukan CRUD baris data, tambah flag, edit item code | Mode offline | Aplikasi 100% lancar tanpa error network, data tersimpan di Dexie, antrian bertambah di `sync_queue` | [ ] |
| **TC-SYNC-03** | Auto Flush Antrian saat Online | 1. Sambungkan kembali internet | Event `online` | Worker otomatis memproses antrian FIFO, push ke PocketBase, antrian berkurang hingga 0 | [ ] |
| **TC-SYNC-04** | Manual Trigger "Sync Sekarang" | 1. Buka Admin > Sync Monitor (atau klik popover status bar)<br>2. Klik tombol "Sync Sekarang" | Trigger manual | Antrian langsung diproses paksa tanpa menunggu interval background timer | [ ] |
| **TC-SYNC-05** | Error Handling & Retry Backoff | 1. Simulasikan error server 500 saat sync | Server fail | Item antrian ditandai `failed` dengan pesan error, tombol "Retry Gagal" muncul | [ ] |

---

### MODUL 14: PWA, Service Worker, & Update Prompt

| ID Test | Kategori | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Status |
|---|---|---|---|---|---|
| **TC-PWA-01** | Installability (PWA Manifest) | 1. Buka aplikasi di Chrome Desktop / Android<br>2. Cek icon install di address bar | Browser PWA | Muncul opsi "Install Plant Sourcing App", aplikasi dapat diinstal sebagai standalone app | [ ] |
| **TC-PWA-02** | App Launch Offline (No Internet) | 1. Tutup browser<br>2. Matikan koneksi internet total<br>3. Buka aplikasi / PWA terinstall | Cold start offline | App shell (HTML/JS/CSS) terbuka dari Service Worker cache tanpa dinosaurus Chrome | [ ] |
| **TC-PWA-03** | Update Prompt Detection | 1. Simulasikan rilis build baru (Service Worker update detected) | Versi baru | Muncul banner/toast non-blocking di bagian bawah: *"Versi baru tersedia — Refresh"* | [ ] |
| **TC-PWA-04** | Klik Refresh Update Prompt | 1. Klik tombol "Refresh" pada Update Prompt | Klik aksi | Halaman reload, Service Worker baru aktif mengambil alih (*skipWaiting*) | [ ] |

---

## 4. Skenario Pengujian End-to-End (E2E) Lapangan

Berikut adalah skenario simulasi kerja nyata teknisi lapangan dari awal hingga sinkronisasi data:

```
[SKENARIO E2E 01: Siklus Kerja Lapangan Lengkap PIC Elektrik]

1. [Persiapan Online]
   - PIC Login di kantor (Koneksi WiFi kantor aktif).
   - Membuka Line 1 > Department Elektrik > Lokasi "Panel Utama".
   - Memastikan SyncStatusBar berwarna Hijau (Semua data tersinkron).

2. [Masuk Area Pabrik / Offline Total]
   - PIC berjalan ke area mesin bawah tanah (Koneksi internet hilang total / Offline).
   - SyncStatusBar berubah menjadi Abu-abu "Offline".
   - PIC menambah 3 baris komponen baru:
     * Baris 1: Submachine="Conveyor A", Status="Existing", Qty=2, Ketik pemicu "proximity switch pnp".
     * Baris 2: Submachine="Conveyor B", Status="Tidak Aktif", Qty=(kosong), Ketik pemicu "thermal overload 5a".
     * Baris 3: Submachine="Feeder", Status="Existing", Qty=1, Ketik pemicu "part custom buatan sendiri".
   
3. [Verifikasi Matching & Status saat Offline]
   - Baris 1: Kolom Item Code terisi otomatis "ELK-SNS-0142" (Mode Auto). Baris valid/lengkap.
   - Baris 2: Qty kosong tapi baris tetap valid karena ada exception rule "Tidak Aktif".
   - Baris 3: Item Code kosong "— belum cocok —". PIC mengubah toggle ke [MNL] dan mengetik kode manual "CUSTOM-001".
   - PIC memberi flag bendera kuning "Perlu Ditanyakan" pada Baris 3.

4. [Keluar Area Pabrik / Re-Koneksi Online]
   - PIC kembali ke area dengan sinyal WiFi.
   - Browser mendeteksi event online: SyncStatusBar berubah Biru (Syncing) lalu Hijau (Tersinkron).
   - Admin di kantor membuka web: data 3 baris dari PIC sudah masuk lengkap tanpa ada konflik.
```

---

## 5. Lembar Rekapitulasi & Formulir Laporan Bug (Bug Report Form)

### 5.1 Rekapitulasi Hasil Pengujian
* **Tanggal Pengujian:** ____________________
* **Nama Penguji (Tester):** ____________________
* **Lingkungan Uji (OS / Browser / Device):** ____________________
* **Total Test Cases:** 64 Kasus Uji
* **Hasil:**
  - `[PASS]` : _____ Kasus
  - `[FAIL]` : _____ Kasus
  - `[BLOCKED]` : _____ Kasus

---

### 5.2 Format Pencatatan Bug / Temuan (Bila Ditemukan Fail)
Gunakan format berikut jika menemukan kegagalan uji:

```markdown
### [BUG REPORT] - <ID_TEST>: <Judul Masalah Singkat>
- **Severity:** [P0-Blocker / P1-Major / P2-Medium / P3-Minor]
- **Modul:** <Nama Modul>
- **Perangkat / Browser:** <mis. Chrome 125 Windows 11 / Android Chrome>
- **Langkah Reproduksi:**
  1. ...
  2. ...
  3. ...
- **Ekspektasi (Expected Result):** ...
- **Hasil Aktual (Actual Result):** ...
- **Tangkapan Layar / Log Console:** [Lampirkan screenshot atau error console]
```

---
*Dokumen ini merupakan instrumen resmi pengujian jaminan kualitas (QA) sistem Engineer PartSource v2.0.*
