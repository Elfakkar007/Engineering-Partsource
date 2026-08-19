/**
 * ItemCodeRuleManager.jsx
 *
 * Panel Konfigurasi Item Code per Department — SRS v2.0 par.7
 *
 * Bagian 1: Konfigurasi Item Code
 *   - Pilih kolom records mana yang jadi kolom pemicu (is_ref_trigger)
 *   - Pilih kolom records mana yang jadi kolom Item Code (is_item_code_column)
 *   - Pilih kolom reference_catalog mana yang jadi kunci pencarian (is_search_key)
 *   Semua disimpan ke columns_config di Dexie.
 *
 * Bagian 2: Reference Catalog Manager
 *   - Tambah/hapus/cari entri katalog per Department
 *   - Form input mengikuti columns_config applies_to=reference_catalog secara dinamis
 *   - item_code selalu diisi manual Admin; source hanya manual|upload
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useToast } from '../../contexts/ToastContext'
import { addCatalogEntry } from '../../lib/itemCodeEngine'

/* ------------------------------------------------------------------ */
/*  Badge helper                                                         */
/* ------------------------------------------------------------------ */
function Badge({ label, color = '#1a73e8', bg = '#e8f0fe' }) {
  return (
    <span style={{
      fontSize: '10px', padding: '1px 7px', borderRadius: '10px',
      background: bg, color, fontWeight: 600, marginLeft: '5px',
    }}>{label}</span>
  )
}

/* ------------------------------------------------------------------ */
/*  Panel 1: Konfigurasi Item Code                                       */
/* ------------------------------------------------------------------ */
function ItemCodeConfig({ deptId }) {
  const { addToast } = useToast()

  // Kolom records untuk department ini
  const recordsCols = useLiveQuery(() =>
    deptId
      ? db.columns_config
          .where('department_id').equals(deptId)
          .filter(c => !c.applies_to || c.applies_to === 'records')
          .sortBy('order')
      : [],
    [deptId], []
  )

  // Kolom reference_catalog untuk department ini
  const refCols = useLiveQuery(() =>
    deptId
      ? db.columns_config
          .where('department_id').equals(deptId)
          .filter(c => c.applies_to === 'reference_catalog')
          .sortBy('order')
      : [],
    [deptId], []
  )

  const triggerCol  = (recordsCols || []).find(c => c.is_ref_trigger)
  const itemCodeCol = (recordsCols || []).find(c => c.is_item_code_column)
  const searchKeyCol = (refCols || []).find(c => c.is_search_key)

  async function setFlag(col, flagName, newValue) {
    // Pastikan hanya satu kolom per flag (clear yang lama dulu jika perlu)
    if (newValue) {
      // Matikan flag di kolom lain terlebih dahulu
      const siblings = flagName === 'is_search_key' ? (refCols || []) : (recordsCols || [])
      await Promise.all(
        siblings
          .filter(c => c.id !== col.id && c[flagName])
          .map(c => db.columns_config.update(c.id, { [flagName]: false }))
      )
    }
    await db.columns_config.update(col.id, { [flagName]: newValue })
    addToast(`Flag ${flagName} pada "${col.label}" diperbarui.`, 'success')
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', borderRadius: '6px', marginBottom: '4px', background: '#fff',
    border: '1px solid #e8eaed',
  }
  const flagBtn = (active, onClick) => ({
    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', fontWeight: 500,
    border: `1px solid ${active ? '#188038' : '#dadce0'}`,
    background: active ? '#e6f4ea' : '#fff',
    color: active ? '#188038' : '#80868b',
  })

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* --- Kolom Pemicu --- */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#1f2328' }}>
          Kolom Pemicu (is_ref_trigger)
          <Badge label="1 kolom" bg="#fff3e0" color="#e37400" />
        </h5>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#80868b' }}>
          Saat nilai kolom ini berubah (on blur), sistem mencocokkan ke search_key katalog dan mengisi Item Code secara otomatis.
        </p>
        {(recordsCols || []).length === 0 && (
          <p style={{ fontSize: '12px', color: '#80868b', fontStyle: 'italic' }}>Belum ada kolom Records. Tambahkan di Schema Builder.</p>
        )}
        {(recordsCols || []).map(col => (
          <div key={col.id} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ fontSize: '11px', background: '#f1f3f4', padding: '1px 6px', borderRadius: '3px', color: '#5f6368' }}>{col.key}</code>
              <span style={{ fontSize: '13px', color: '#1f2328' }}>{col.label}</span>
              {col.is_ref_trigger && <Badge label="pemicu" bg="#e8f0fe" color="#1a73e8" />}
            </div>
            <button
              style={flagBtn(!!col.is_ref_trigger, null)}
              onClick={() => setFlag(col, 'is_ref_trigger', !col.is_ref_trigger)}
            >
              {col.is_ref_trigger ? '✓ Aktif' : 'Jadikan Pemicu'}
            </button>
          </div>
        ))}
      </div>

      {/* --- Kolom Item Code --- */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#1f2328' }}>
          Kolom Item Code (is_item_code_column)
          <Badge label="1 kolom" bg="#fff3e0" color="#e37400" />
        </h5>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#80868b' }}>
          Kolom Records yang akan diisi otomatis (Mode Auto) atau diisi bebas (Mode Manual) dengan kode item.
        </p>
        {(recordsCols || []).map(col => (
          <div key={col.id} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ fontSize: '11px', background: '#f1f3f4', padding: '1px 6px', borderRadius: '3px', color: '#5f6368' }}>{col.key}</code>
              <span style={{ fontSize: '13px', color: '#1f2328' }}>{col.label}</span>
              {col.is_item_code_column && <Badge label="item code" bg="#e6f4ea" color="#188038" />}
            </div>
            <button
              style={flagBtn(!!col.is_item_code_column, null)}
              onClick={() => setFlag(col, 'is_item_code_column', !col.is_item_code_column)}
            >
              {col.is_item_code_column ? '✓ Aktif' : 'Jadikan Kolom Kode'}
            </button>
          </div>
        ))}
      </div>

      {/* --- Kolom Kunci Pencarian (Reference Catalog) --- */}
      <div>
        <h5 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#1f2328' }}>
          Kunci Pencarian Katalog (is_search_key)
          <Badge label="1 kolom" bg="#fff3e0" color="#e37400" />
        </h5>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#80868b' }}>
          Kolom Reference Catalog yang nilainya disalin ke <code>search_key</code> dan dipakai untuk pencocokan saat user mengetik.
          Buat kolom reference_catalog-nya dulu di Schema Builder jika belum ada.
        </p>
        {(refCols || []).length === 0 && (
          <p style={{ fontSize: '12px', color: '#80868b', fontStyle: 'italic' }}>
            Belum ada kolom Reference Catalog. Tambahkan di Schema Builder (pilih "Reference Catalog" saat tambah kolom).
          </p>
        )}
        {(refCols || []).map(col => (
          <div key={col.id} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ fontSize: '11px', background: '#f1f3f4', padding: '1px 6px', borderRadius: '3px', color: '#5f6368' }}>{col.key}</code>
              <span style={{ fontSize: '13px', color: '#1f2328' }}>{col.label}</span>
              {col.is_search_key && <Badge label="search_key" bg="#fef7e0" color="#b06000" />}
            </div>
            <button
              style={flagBtn(!!col.is_search_key, null)}
              onClick={() => setFlag(col, 'is_search_key', !col.is_search_key)}
            >
              {col.is_search_key ? '✓ Aktif' : 'Jadikan Kunci Pencarian'}
            </button>
          </div>
        ))}
      </div>

      {/* Ringkasan konfigurasi aktif */}
      <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f6f8fa', borderRadius: '8px', border: '1px solid #d0d7de', fontSize: '12px', color: '#5f6368' }}>
        <strong>Konfigurasi aktif:</strong>{' '}
        {triggerCol ? <span>Pemicu: <strong>{triggerCol.label}</strong></span> : <span style={{ color: '#d93025' }}>❌ Belum ada kolom pemicu</span>}
        {' · '}
        {itemCodeCol ? <span>Item Code: <strong>{itemCodeCol.label}</strong></span> : <span style={{ color: '#d93025' }}>❌ Belum ada kolom Item Code</span>}
        {' · '}
        {searchKeyCol ? <span>Search Key: <strong>{searchKeyCol.label}</strong></span> : <span style={{ color: '#d93025' }}>❌ Belum ada kunci pencarian</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Panel 2: Reference Catalog Manager                                  */
/* ------------------------------------------------------------------ */
function ReferenceCatalog({ deptId }) {
  const { addToast } = useToast()

  const catalog = useLiveQuery(() =>
    deptId ? db.reference_catalog.where('department_id').equals(deptId).toArray() : [],
    [deptId], []
  )

  // Kolom reference_catalog untuk form input dinamis
  const refCols = useLiveQuery(() =>
    deptId
      ? db.columns_config
          .where('department_id').equals(deptId)
          .filter(c => c.applies_to === 'reference_catalog')
          .sortBy('order')
      : [],
    [deptId], []
  )

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newComponents, setNewComponents] = useState({})
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = (catalog || []).filter(entry =>
    (entry.search_key || '').toLowerCase().includes(search.toLowerCase()) ||
    (entry.item_code || '').toLowerCase().includes(search.toLowerCase())
  )

  const searchKeyCol = (refCols || []).find(c => c.is_search_key)

  function resetForm() {
    setNewComponents({})
    setNewCode('')
    setShowAdd(false)
  }

  async function handleDelete(entry) {
    if (!confirm('Hapus entri katalog ini?')) return
    await db.reference_catalog.delete(entry.id)
    addToast('Entri katalog dihapus.', 'success')
  }

  async function handleAdd() {
    if (!newCode.trim()) {
      addToast('Item Code tidak boleh kosong.', 'error'); return
    }
    const sk = searchKeyCol ? (newComponents[searchKeyCol.key] || '').trim() : ''
    if (!sk) {
      addToast(`Field "${searchKeyCol?.label || 'Kunci Pencarian'}" tidak boleh kosong.`, 'error'); return
    }
    setSaving(true)
    try {
      await addCatalogEntry(deptId, newComponents, sk, newCode.trim(), 'manual')
      addToast('Entri katalog ditambahkan.', 'success')
      resetForm()
    } catch (err) {
      addToast('Gagal menyimpan: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
          Reference Catalog{' '}
          <span style={{ fontSize: '12px', color: '#80868b', fontWeight: 400 }}>({catalog?.length || 0} entri)</span>
        </h4>
        <button className="btn-secondary" style={{ padding: '5px 14px', fontSize: '12px' }}
          onClick={() => setShowAdd(v => !v)}>
          {showAdd ? 'Batal' : '+ Tambah Entri'}
        </button>
      </div>

      {/* Form tambah entri */}
      {showAdd && (
        <div style={{ marginBottom: '14px', padding: '14px', background: '#e8f0fe', borderRadius: '8px', border: '1px solid #c2d7f7' }}>
          {(refCols || []).length === 0 && (
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#b06000' }}>
              ⚠ Belum ada kolom Reference Catalog untuk Department ini. Tambahkan dulu di Schema Builder.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
            {/* Input dinamis per kolom reference_catalog */}
            {(refCols || []).map(col => (
              <div key={col.key}>
                <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>
                  {col.label}{col.is_search_key && <Badge label="search_key" bg="#fef7e0" color="#b06000" />}
                </label>
                {col.type === 'select' ? (
                  <select
                    value={newComponents[col.key] || ''}
                    onChange={e => setNewComponents(prev => ({ ...prev, [col.key]: e.target.value }))}
                    style={{ width: '100%', padding: '5px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px' }}
                  >
                    <option value="">-- Pilih --</option>
                    {(col.select_options || []).map(opt => {
                      const val = typeof opt === 'string' ? opt : opt.value
                      return <option key={val} value={val}>{val}</option>
                    })}
                  </select>
                ) : (
                  <input
                    value={newComponents[col.key] || ''}
                    onChange={e => setNewComponents(prev => ({ ...prev, [col.key]: e.target.value }))}
                    placeholder={col.is_search_key ? 'mis. Bearing 6204 ZZ' : ''}
                    style={{ width: '100%', padding: '5px 6px', fontSize: '12px', border: `1px solid ${col.is_search_key ? '#f9ab00' : '#dadce0'}`, borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {/* Item Code — selalu ada */}
            <div>
              <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>
                Item Code <span style={{ color: '#d93025' }}>*</span>
              </label>
              <input
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="mis. ELK-SNS-0142"
                style={{ width: '100%', padding: '5px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button className="btn-primary" style={{ padding: '5px 14px', fontSize: '12px' }}
            onClick={handleAdd} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Entri'}
          </button>
        </div>
      )}

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kunci pencarian atau item code..."
          style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '6px', boxSizing: 'border-box' }} />
        <svg style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#80868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Tabel katalog */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#80868b', fontSize: '12px', padding: '20px 0' }}>
          {catalog?.length === 0 ? 'Belum ada entri katalog.' : 'Tidak ada hasil yang cocok.'}
        </p>
      ) : (
        <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>
                  Kunci Pencarian (search_key)
                </th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Item Code</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Sumber</th>
                <th style={{ padding: '7px 10px', textAlign: 'center', color: '#5f6368', fontWeight: 600, width: '50px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '7px 10px', color: '#1f2328' }}>{entry.search_key || '-'}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <code style={{ fontFamily: 'monospace', fontWeight: 600, color: '#188038' }}>{entry.item_code}</code>
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{
                      fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
                      background: entry.source === 'upload' ? '#e8f0fe' : '#e6f4ea',
                      color: entry.source === 'upload' ? '#1a73e8' : '#188038',
                    }}>{entry.source || 'manual'}</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    <button onClick={() => handleDelete(entry)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025', fontSize: '14px' }}
                      title="Hapus entri">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                       */
/* ------------------------------------------------------------------ */
export default function ItemCodeRuleManager() {
  const departments = useLiveQuery(
    () => db.departments_cache.toArray().then(r => r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))),
    [], []
  )
  const [activeDeptId, setActiveDeptId] = useState(null)
  const effectiveDeptId = activeDeptId || departments?.[0]?.id || null

  return (
    <div>
      {/* Department Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(departments || []).map(dept => (
          <button key={dept.id} onClick={() => setActiveDeptId(dept.id)}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              border: `1.5px solid ${effectiveDeptId === dept.id ? '#1a73e8' : '#dadce0'}`,
              background: effectiveDeptId === dept.id ? '#e8f0fe' : '#fff',
              color: effectiveDeptId === dept.id ? '#1a73e8' : '#5f6368',
            }}>
            {dept.name}
          </button>
        ))}
      </div>

      {effectiveDeptId ? (
        <>
          {/* Panel 1: Konfigurasi */}
          <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #dadce0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>
              ⚙️ Konfigurasi Item Code
            </h4>
            <ItemCodeConfig deptId={effectiveDeptId} />
          </div>

          {/* Panel 2: Reference Catalog */}
          <div style={{ padding: '16px', border: '1px solid #dadce0', borderRadius: '10px' }}>
            <ReferenceCatalog deptId={effectiveDeptId} />
          </div>
        </>
      ) : (
        <p style={{ color: '#80868b', textAlign: 'center', padding: '40px 0' }}>
          Pilih Department di atas untuk mengelola konfigurasi Item Code.
        </p>
      )}
    </div>
  )
}
