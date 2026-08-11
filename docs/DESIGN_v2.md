---
version: 2.0
name: Plant-Sourcing-Design-System
description: >
  Kelanjutan dari design system v1.0 (alpha) — tetap dense, functional, terinspirasi
  Google Sheets, dioptimalkan untuk grid dengan banyak baris/kolom, terbaca cepat, warna
  semantik jelas, nyaman dipakai di desktop maupun HP di lantai pabrik. v2.0 menambahkan
  komponen untuk navigasi 3-tier (Line → Department → Location), rendering grid generik
  berbasis konfigurasi (bukan kolom tetap), serta panel-panel Admin untuk mengatur skema,
  rule kode item, dan mapping Google Sheets — semua tanpa menyentuh kode.
supersedes: DESIGN-plant-sourcing.md (v1.0 alpha)
---

## 0. Apa yang Berubah dari v1.0

- Token warna, tipografi, spacing, shadow, rounded **dipertahankan identik** dari v1.0 — sudah disetujui pemilik proyek dan sudah familiar bagi tim (nuansa Google Sheets). Lihat §1.
- Komponen grid (`data-grid`, `EditableCell`, `GridHeader`) sekarang **wajib generik**: tampilan visual sel tidak berubah secara desain (tetap dense, 40–44px row height, dst.), tapi *sumber kebenaran* tipe & label kolom sekarang `columns_config`, bukan daftar tetap. Ini murni perubahan implementasi, bukan perubahan visual.
- Navigasi bertambah satu tingkat: **Tab Department** disisipkan di antara pemilihan Line dan Tab Location.
- Komponen baru: `SyncStatusBar` (diperluas dari v1.0 dengan state PocketBase), `UpdatePrompt` (baru, untuk PWA), `SchemaManagerPanel`, `ItemCodeRuleBuilder`, `SheetsMappingManager`, `FlagChip`, `ImportWizard` (4 langkah), `ExportCheckboxTree`.
- Fitur dashboard "tren progress harian (line chart)" **dihapus dari desain v2.0** — lihat SRS §9.3.

---

## 1. Design Tokens (dipertahankan dari v1.0 — tidak berubah)

```yaml
colors:
  primary: "#188038"
  primary-hover: "#0F9D58"
  primary-light-bg: "#e6f4ea"
  secondary: "#1a73e8"
  secondary-light-bg: "#e8f0fe"
  warning: "#f9ab00"
  warning-light-bg: "#fef7e0"
  danger: "#d93025"
  danger-hover: "#b3261e"
  danger-light-bg: "#fce8e6"
  ink: "#1f2328"
  ink-muted: "#5f6368"
  ink-faint: "#80868b"
  canvas: "#ffffff"
  surface-subtle: "#f8f9fa"
  surface-panel: "#f1f3f4"
  border: "#dadce0"
  border-strong: "#c4c7ca"
  grid-line: "#e8eaed"
  grid-header-bg: "#f8f9fa"
  grid-row-hover: "#f1f8f3"
  grid-row-selected: "#e6f4ea"
  focus-ring: "#1a73e8"
  offline-indicator: "#f9ab00"
  online-indicator: "#188038"
  syncing-indicator: "#1a73e8"
  # BARU v2.0 — dipakai untuk badge status Department pada Tab Department,
  # dan untuk membedakan state "kolom milik Admin" (is_editable_by_pic=false) di grid.
  department-tab-indicator: "#5f6368"   # netral, department TIDAK punya warna hardcode per nama
  locked-cell-bg: "#f1f3f4"             # background sel yang is_editable_by_pic=false
  locked-cell-icon: "#80868b"
```

```yaml
typography:
  # identik v1.0 — page-title, section-heading, body, body-strong,
  # grid-cell, grid-header-label, caption, mono-code — lihat DESIGN-plant-sourcing.md §typography
```

```yaml
rounded: { none: 0px, sm: 6px, md: 8px, lg: 12px, pill: 999px }
spacing: { xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, section: 32px }
shadow:
  subtle: "rgba(0,0,0,0.06) 0 1px 2px"
  card: "rgba(0,0,0,0.08) 0 1px 3px, rgba(0,0,0,0.04) 0 1px 2px"
  popover: "rgba(0,0,0,0.12) 0 4px 16px"
```

> **Catatan penting:** karena department dan status kini adalah data dinamis (bukan enum tetap seperti "Existing"/"Tidak Aktif"), **jangan** memberi warna semantik hardcode per nilai (mis. "Existing selalu hijau"). Warna semantik (`primary`/`warning`/`danger`) dipetakan berdasarkan **posisi/urutan opsi** pada `columns_config.select_options` atau berdasarkan flag konseptual netral ("nilai pertama = status positif" dikonfigurasi admin), bukan string yang di-hardcode di komponen. Lihat §6 `status-chip`.

---

## 2. Navigasi 3-Tier — Layout & Alur

```
┌───────────────────────────────────────────────────────────┐
│ Header (logo, nama user, logout)                           │
├───────────────────────────────────────────────────────────┤
│ SyncStatusBar (selalu terlihat)                             │
├───────────────────────────────────────────────────────────┤
│ Dashboard: kartu pilih Line  [Line 1] [Line 2] [Line 3] ... │  ← Tier 1
└───────────────────────────────────────────────────────────┘
                        │ klik Line
                        v
┌───────────────────────────────────────────────────────────┐
│ SyncStatusBar                                                │
├───────────────────────────────────────────────────────────┤
│ Breadcrumb: Dashboard > Line 1                               │
│ Tab Department: [Mekanik] [Elektrik] [Utility] [+ ...]       │  ← Tier 2
├───────────────────────────────────────────────────────────┤
│ Tab Location:  [Boiler Room] [Panel MDP] [Genset] ...        │  ← Tier 3
├───────────────────────────────────────────────────────────┤
│ Toolbar (Tambah Baris, Hapus Terpilih, Filter, Export, ...)  │
├───────────────────────────────────────────────────────────┤
│ Data Grid (kolom sesuai columns_config Department aktif)     │
└───────────────────────────────────────────────────────────┘
```

### `line-selector-card` (Tier 1, di Dashboard)
- Grid kartu (`{component.card}`), satu kartu per Line, menampilkan nama Line + progress bar ringkas (% kelengkapan Line tsb, lihat `{component.progress-bar}`).
- Klik kartu → masuk ke Tier 2 untuk Line tersebut, default membuka Department pertama (`order` terkecil) dan Location pertamanya.

### `department-tabs` (Tier 2 — BARU)
Visual identik pola `location-tabs` v1.0 (agar konsisten), diberi nama komponen sendiri karena punya elemen tambahan:
```
tab-default:  text {typography.body}, color {colors.ink-muted}, padding 8px 16px,
              border-bottom 2px solid transparent
tab-active:   color {colors.ink}, border-bottom 2px solid {colors.primary}, font-weight 600
tab-progress-dot: titik kecil 6px di sisi kanan label tab, warna {colors.primary} jika
              Department itu 100% lengkap di Line aktif, {colors.border-strong} jika belum
admin-add-tab: tab terakhir berupa tombol "+ " (hanya terlihat oleh Admin) yang membuka
              form cepat "Tambah Department baru" — nama saja, skema kolom diatur belakangan
              lewat Schema Manager (§5)
```

### `location-tabs` (Tier 3 — dari v1.0, dipertahankan)
Sama seperti v1.0, dengan tambahan: daftar tab **difilter otomatis** sesuai `department_id` yang sedang aktif (satu Line bisa punya Location berbeda per Department, mis. Location "Boiler Room" hanya relevan untuk Mekanik/Utility, bukan Elektrik) — perilaku data, tidak mengubah visual komponen.

---

## 3. Data Grid — Generic Rendering Engine

Visual tetap 1:1 dengan spesifikasi v1.0 `{component.data-grid}` (header sticky 36px, row 40/44px, cell padding 6px 10px, autosave-indicator checkmark, incomplete-indicator dashed warning border, empty-cell placeholder "—"). Yang berubah adalah **bagaimana** sel dan header dihasilkan:

### `GridHeader` (generik)
- Menerima `columns_config[]` (sudah terurut oleh `order`, difilter `is_visible=true`) sebagai satu-satunya sumber label & lebar kolom.
- Tidak ada nama kolom yang ditulis literal di komponen ini — seluruhnya di-map dari `label`.
- Kolom dengan `is_editable_by_pic=false` mendapat ikon kunci kecil (16px, `{colors.locked-cell-icon}`) di header, sebagai penanda visual "kolom ini diisi pihak lain/Admin".

### `EditableCell` (generik)
Rendering berdasarkan `columns_config[i].type`:

| `type` | Tampilan saat tidak aktif | Tampilan saat diedit |
|---|---|---|
| `text` | teks biasa, `{typography.grid-cell}` | `<input type="text">` inline, outline `{colors.focus-ring}` 2px |
| `number` | teks rata kanan | `<input type="number">` inline, rata kanan, validasi non-negatif jika relevan |
| `select` | `{component.status-chip}`-style pill kecil (lihat §6) menggunakan `select_options` | dropdown native/custom dari `select_options` |
| `gdrive_link` | sesuai `{component.photo-link-cell}` v1.0 (link biru + hover/tap preview via React Portal) | mode edit menampilkan input teks URL biasa |

- Jika `is_editable_by_pic=false` dan user login sebagai role `pic`: sel dirender **read-only**, background `{colors.locked-cell-bg}`, cursor `not-allowed`, tanpa outline fokus saat diklik (tetap bisa diklik untuk *melihat* isi penuh via tooltip jika terpotong, tapi tidak bisa masuk mode edit).
- `incomplete-indicator` (dashed warning border kiri) sekarang dihitung dari kombinasi `columns_config.is_required` **dan** `completion_exception_rules` aktif pada baris tersebut (lihat SRS §9.1) — bukan pengecekan `if key==='qty'` di komponen.

---

## 4. `status-chip` (diperluas — generik terhadap `select_options`)

```
status-chip:
  description: >
    Pill kecil untuk kolom bertipe `select` (bukan hanya kolom "Status"). Warna
    ditentukan oleh urutan/posisi opsi pada select_options, bukan string ter-hardcode.
  variant-primary (opsi pertama dalam select_options, konvensi "kondisi baik/aktif"):
    background {colors.primary-light-bg}, text {colors.primary}
  variant-neutral (opsi ke-2 dst, konvensi "kondisi netral/nonaktif"):
    background {colors.surface-panel}, text {colors.ink-muted}
  variant-danger (opsi ditandai admin sebagai "kondisi bermasalah", field terpisah
    di columns_config.select_options: [{value, tone: "primary"|"neutral"|"danger"}]):
    background {colors.danger-light-bg}, text {colors.danger}
  typography: {typography.caption}
  rounded: {rounded.pill}
  padding: 2px 10px
```

Admin mengatur `tone` per opsi saat membuat/mengedit kolom bertipe `select` di Schema Manager (§5), sehingga pill "Existing" bisa hijau dan "Tidak Aktif" abu-abu untuk Department Elektrik, sementara Department lain bisa punya set opsi & warna berbeda sepenuhnya — tanpa kode berbeda.

---

## 5. Panel Admin — Konfigurasi (BARU di v2.0)

### `SchemaManagerPanel`
- Diakses dari toolbar (ikon gear, hanya terlihat Admin) saat berada di Tab Department tertentu.
- Tabel pengaturan seluruh `columns_config` Department aktif: kolom tabel = Label, Key (readonly setelah dipakai), Type, Wajib?, Tampil?, Bisa diisi PIC?, Ref Trigger?, urutan (drag handle di kiri, ikon `⠿`, `{colors.ink-faint}`).
- Tombol **"+ Tambah Kolom"** (`{component.button-primary}`) membuka `AddColumnDrawer` (panel geser dari kanan, bukan modal penuh — agar grid tetap terlihat sebagai konteks):
  - Field: Label (text), Key (auto-generate dari label, mis. "Sub Machine" → `col_sub_machine`, bisa diedit sebelum disimpan pertama kali, terkunci setelahnya), Type (dropdown 4 opsi), Wajib untuk kelengkapan (toggle), Tampil di grid (toggle), Bisa diisi PIC (toggle), Ref Trigger (toggle, hanya relevan jika Department punya `item_code_rules`).
  - Jika Type = `select`: field tambahan "Opsi" — daftar dinamis (tambah/hapus baris), tiap opsi punya Value + Tone (primary/neutral/danger) untuk `status-chip`.
- Perubahan tersimpan langsung ke `columns_config` via PocketBase, grid ter-update realtime untuk seluruh PIC yang sedang online di Department tsb (indikator toast kecil "Skema diperbarui oleh Admin").

### `ItemCodeRuleBuilder`
- Panel Admin per Department, dua bagian:
  1. **Template Builder**: input teks dengan *chip-insert* — Admin klik nama kolom dari daftar (`columns_config` Department) untuk menyisipkan `{col_key}` ke template, plus tombol "Sisipkan nomor urut" untuk `{seq:N}` (N dipilih via stepper 1–6 digit). Preview live di bawah input menampilkan contoh hasil, mis. `PLNMEK001`.
  2. **Reference Catalog Viewer**: tabel read-mostly menampilkan isi `reference_catalog` Department tsb (match_signature → item_code, source), dengan search box dan tombol hapus per baris (untuk catalog yang keliru).
- Validasi inline: jika template menyertakan `{col_x}` yang key-nya tidak ada di `columns_config` Department, tampilkan pesan error merah di bawah input, tombol simpan disabled.

### `SheetsMappingManager`
- Panel Admin per Department: form pemetaan `db_col_key → sheet_column_letter`, ditampilkan sebagai dua kolom bersebelahan (kiri: daftar label kolom app; kanan: input huruf kolom sheet), plus field `spreadsheet_id` & `sheet_tab_name` di atas.
- Indikator status koneksi Google API (terhubung / error credentials) di bagian atas panel.
- Tombol `{component.button-secondary}` **"Push to Sheets Sekarang"** untuk trigger manual (lihat SRS §8), menampilkan `{component.toast-notification}` hasil ("32 baris berhasil didorong ke Sheets" / "Gagal: rate limit, dicoba lagi otomatis").
- Setting global (bukan per Department): interval debounce (`app_settings.sheets_push_debounce_seconds`) — input angka detik dengan penjelasan singkat di caption.

---

## 6. `SyncStatusBar` (diperluas dari v1.0)

Posisi, tinggi (32px), dan pola warna tetap dari v1.0. Tambahan state untuk mencerminkan dua lapis sync (PocketBase lokal-LAN, dan Sheets di server):

```
online-state:      bg {colors.primary-light-bg}, {colors.online-indicator}
                    label: "Tersimpan • Terhubung ke Server Pabrik"
offline-state:      bg {colors.warning-light-bg}, {colors.offline-indicator}
                    label: "Mode Offline • Tersimpan di perangkat, akan sinkron otomatis"
syncing-state:      bg {colors.secondary-light-bg}, {colors.syncing-indicator}, spinner kecil
                    label: "Menyinkronkan N perubahan ke server..."
sync-failed-state:  bg {colors.danger-light-bg}, {colors.danger}
                    label: "N perubahan gagal sinkron — ketuk untuk detail" (klik →
                    buka daftar item gagal dari sync_queue_pb, dengan tombol "Coba lagi")
```

Tap/klik pada bar ini (di semua state) membuka `SyncDetailPopover` kecil (pola `{shadow.popover}`) berisi: jumlah item pending, waktu sync terakhir sukses, dan (khusus Admin) status Sheets Sync Queue (`sync_queue_sheets`) secara ringkas.

---

## 7. `UpdatePrompt` (BARU — PWA)

```
UpdatePrompt:
  description: >
    Notifikasi non-blocking saat Service Worker mendeteksi versi aplikasi baru.
    Penting karena skema/rule bisa berubah sewaktu-waktu oleh Admin — user tidak boleh
    memakai kode lama tanpa sadar dalam waktu lama.
  position: bottom-center, di atas toast-notification jika keduanya muncul bersamaan
  panel: {colors.ink} background, text {colors.canvas}, {typography.body},
         rounded {rounded.md}, padding 10px 16px, {shadow.popover}
  content: "Versi baru tersedia" + tombol text-link "Refresh" ({colors.secondary-on-dark: #8ab4f8})
  behavior: tidak auto-dismiss (beda dari toast-notification biasa yang 4s) — tetap
            tampil sampai user menekan Refresh atau menutup manual (ikon X kecil),
            karena ini bukan info sepintas, tapi ajakan aksi penting
```

---

## 8. `FlagChip` (BARU)

```
FlagChip:
  description: Penanda baris "Perlu Ditanyakan" atau "Dilewati", tampil di kolom
    checkbox-selection grid (ikon kecil di samping checkbox) dan sebagai filter cepat
    di toolbar.
  perlu-ditanyakan: icon tanda tanya, {colors.warning}, background {colors.warning-light-bg}
  dilewati: icon garis putus, {colors.ink-muted}, background {colors.surface-panel}
  size: 20px lingkaran, ditempatkan tepat di kiri checkbox row-selection
  interaction: klik ikon flag membuka popover kecil untuk set/ubah flag + flag_note
    (textarea singkat, opsional)
```

---

## 9. `ImportWizard` (4 Langkah — BARU, menggantikan alur import sederhana v1.0)

Ditampilkan sebagai `full-panel` (bukan modal kecil, karena berisi tabel preview) dengan stepper header di atas (pola mirip breadcrumb tapi menampilkan progres 1–4).

1. **Upload** — dropzone besar + tombol "Pilih File", area ini satu-satunya yang boleh terasa "lapang" (whitespace lebih besar) karena bukan bagian grid data.
2. **Deteksi & Pemetaan Kolom** — tabel dua kolom: "Kolom di File" vs "Petakan ke". Kolom baru yang tidak dikenali diberi badge kuning "Baru" + dropdown aksi (Petakan ke kolom existing / Buat kolom baru / Abaikan). Jika "Buat kolom baru" dipilih, muncul mini-form sama seperti `AddColumnDrawer` (§5) tapi inline di baris tabel.
3. **Validasi** — tabel hasil dengan baris bermasalah ditandai `{colors.danger}` di kiri (mirip `incomplete-indicator` tapi solid, bukan dashed, untuk membedakan "error" dari "belum lengkap"), ringkasan jumlah baris valid/error di atas tabel, filter "tampilkan hanya error".
4. **Konfirmasi** — ringkasan akhir (jumlah baris akan ditambahkan, Department & Location tujuan), tombol `{component.button-primary}` "Commit Import" dan `{component.button-secondary}` "Batal". Setelah commit, toast dengan aksi "Undo" muncul (lihat `{component.toast-notification}` v1.0, dan `ImportUndoContext` di SRS §9.6) — undo tetap dapat diakses meski user pindah halaman (badge kecil menempel di header, bukan hanya di toast yang hilang 4 detik).

---

## 10. `ExportCheckboxTree` (BARU — menggantikan pilihan sederhana v1.0)

```
ExportCheckboxTree:
  description: >
    Pohon checkbox 3 tingkat (Line > Department > Location) di sisi kiri modal export,
    preview hasil di sisi kanan. Mencentang node induk otomatis mencentang seluruh anak
    (indeterminate state saat sebagian anak tercentang).
  tree-node: {typography.body}, indent 20px per level, checkbox {colors.secondary}
  column-filter: di bawah tree, daftar checkbox kolom (dari columns_config Department
    yang ter-include dalam seleksi) untuk memilih kolom mana yang disertakan di export
  preview-pane: kanan, menampilkan tabel preview hasil export (read-only, scroll),
    update setiap perubahan seleksi di tree/kolom
  footer: {component.button-secondary} "Batal", {component.button-primary} "Download Excel"
```

---

## 11. Dashboard (Admin & Publik)

Layout kartu (`{component.card}`) tetap dari v1.0, dengan penyesuaian:
- **Filter Department** berupa dropdown/tab kecil di atas grid kartu.
- **Stat Cards** tidak lagi menyebut "% Existing / % Tidak Aktif" secara literal di komponen — label diambil dari `select_options` kolom yang ditunjuk Admin sebagai "kolom status" untuk Department tsb (setting per Department).
- **Grafik Breakdown Dinamis**: dropdown "Kelompokkan berdasarkan" di header kartu chart, berisi daftar kolom `select`/`text` dari `columns_config` Department aktif — Admin (dan hanya Admin) yang mengubah default-nya lewat Pengaturan, tapi dropdown ini sendiri terlihat oleh siapapun yang melihat dashboard (Admin & Publik) sebagai kontrol tampilan sementara, bukan permanen (tidak menyimpan ke DB kecuali Admin menekan "Jadikan Default").
- **Tidak ada** chart tren harian (dihapus, lihat §0 dan SRS §9.3).
- Publik melihat kartu & chart yang sama persis secara visual dengan Admin, hanya API sumber datanya dibatasi ke endpoint agregat (lihat SRS §11) — **tidak ada** perbedaan visual/komponen antara mode Admin-view dan Publik-view pada dashboard, kecuali toolbar aksi (Admin punya tombol "Pengaturan Chart", Publik tidak).

---

## 12. Do's and Don'ts (v1.0 dipertahankan + tambahan v2.0)

### Do
- (semua poin v1.0 tetap berlaku: density grid 40–44px, warna semantik untuk makna, sync bar selalu terlihat, inline cell editing, progress % selalu dengan angka, dialog destruktif menyebut jumlah & lokasi pasti, touch target 44×44px)
- **Baru:** setiap komponen yang menampilkan nama/label kolom **wajib** mengambilnya dari `columns_config.label` saat render — jangan pernah menulis label kolom sebagai string literal di JSX/komponen.
- **Baru:** beri afordansi visual jelas (ikon kunci, background berbeda) untuk sel yang `is_editable_by_pic=false`, agar PIC tidak bingung kenapa sel tidak bisa diklik-edit.
- **Baru:** setiap panel Admin (Schema Manager, Rule Builder, Mapping Manager) menampilkan validasi inline sebelum simpan — jangan biarkan Admin menyimpan konfigurasi yang akan merusak rendering grid (mis. template code merujuk key yang tidak ada).

### Don't
- (semua poin v1.0 tetap berlaku: no marketing hero, no loose line-height di grid cell, no single-accent-color, no generic "OK" untuk aksi destruktif, no gradient/shadow dekoratif, no icon-only toolbar button)
- **Baru:** jangan memberi warna semantik tetap ke *nilai* tertentu (mis. "Existing = hijau selalu") di kode komponen — warna berasal dari `tone` yang dikonfigurasi Admin per opsi.
- **Baru:** jangan membuat Tab Department terlihat "lebih penting secara visual" dari Tab Location atau sebaliknya dengan warna berbeda — keduanya memakai pola tab yang identik (§2) agar hierarki dipahami dari *posisi*, bukan dari gaya warna yang bersaing.

---

## 13. Responsive Behavior (dipertahankan v1.0, disesuaikan untuk 1 tingkat navigasi tambahan)

| Breakpoint | Perubahan tambahan v2.0 |
|---|---|
| Mobile (≤640px) | `department-tabs` dan `location-tabs` **keduanya** menjadi horizontal-scroll strip, ditumpuk (Department di atas, Location di bawahnya) — bukan disembunyikan, karena keduanya tetap perlu terlihat sebagai konteks aktif. Grid tetap menjadi stacked card-per-row seperti v1.0 (judul kartu = kolom pertama yang `is_visible=true` menurut `order`, bukan hardcode "Sub-Machine"). |
| Tablet (641–1024px) | Sama seperti v1.0 (grid tabular, kolom prioritas rendah disembunyikan di balik toggle) — kolom mana yang "prioritas rendah" ditentukan oleh `order` terbesar pada `columns_config`, bukan nama kolom tertentu. |
| Desktop (≥1025px) | Full grid + kedua baris tab (Department, Location) + toolbar, semuanya tanpa scroll tambahan, seperti v1.0. |

---

## 14. State Management — Dexie + PocketBase (Ringkas Arsitektur, untuk konteks desain interaksi)

Bagian ini melengkapi SRS §12 dari sisi *bagaimana state memengaruhi apa yang dilihat/dilakukan user*, bukan detail implementasi kode:

- **Sumber tampilan grid** = query reaktif ke Dexie (`records` lokal), **bukan** langsung ke PocketBase — sehingga UI selalu terasa instan (offline-first), tidak pernah menampilkan spinner loading untuk aksi tulis biasa.
- **`autosave-indicator`** (checkmark, dari v1.0) muncul segera setelah tulis ke Dexie berhasil — **bukan** menunggu konfirmasi PocketBase. Ini penting secara UX: PIC harus merasa data "aman" begitu Dexie menyimpan, walau sync ke server masih tertunda (itulah gunanya `SyncStatusBar` terpisah, untuk status sync, bukan status simpan-lokal).
- **Realtime dari PocketBase** (perubahan `columns_config` oleh Admin, atau `records` dari PIC lain di Line yang sama) masuk sebagai *patch* ke Dexie lokal di background, memicu re-render reaktif — user tidak perlu refresh manual, konsisten dengan prinsip "wadah dinamis" yang bisa berubah kapan saja tanpa deploy.
- **Konflik/gagal sync** hanya memengaruhi `SyncStatusBar` dan `SyncDetailPopover` (§6) — tidak pernah memblokir interaksi grid lain yang sedang berjalan.

---

## 15. Iteration Guide (v2.0)

1. Style ulang & validasi `data-grid`, `GridHeader`, `EditableCell` dalam mode generik terlebih dahulu (uji dengan minimal 2 skema Department berbeda — Mekanik 23 kolom & Elektrik 13 kolom — untuk memastikan tidak ada asumsi hardcode yang lolos).
2. Baru lanjut ke `SchemaManagerPanel`, karena seluruh komponen lain bergantung pada bentuk `columns_config` yang dihasilkan panel ini.
3. `SyncStatusBar` & `UpdatePrompt` diprioritaskan setelah grid — keduanya adalah mekanisme kepercayaan inti produk offline-first ini (lanjutan prinsip v1.0).
4. Uji setiap komponen baru di breakpoint Mobile sebelum dianggap selesai (lanjutan prinsip v1.0), termasuk memastikan `department-tabs` + `location-tabs` bertumpuk tidak memakan terlalu banyak tinggi layar pada HP kecil.
5. Referensikan key komponen langsung saat meminta perubahan (mis. "sesuaikan `{component.ItemCodeRuleBuilder}` bagian preview", bukan "rapikan bagian kode item").

## Known Gaps (dibawa dari v1.0 + tambahan)
- Palet warna chart breakdown dinamis: sama seperti v1.0, ambil dari `{colors.secondary}`, `{colors.primary}`, `{colors.warning}`, tambah hue senada jika kategori > 4 — perlu diuji ulang karena sekarang kolom pengelompokan bisa berganti-ganti (Admin bisa pilih kolom apapun), bukan tetap "Category".
- Dark mode tetap di luar cakupan v2.0.
- Belum ada spesifikasi visual untuk kondisi "Department baru dibuat tapi belum ada `columns_config` sama sekali" (grid kosong total) — perlu empty-state khusus, belum dirancang di dokumen ini.
