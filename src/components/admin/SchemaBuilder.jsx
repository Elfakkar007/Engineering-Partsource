/**
 * SchemaBuilder.jsx
 *
 * Panel pengelola skema kolom dinamis per Department — SRS v2.0 §6 & DESIGN_v2.md §5
 *
 * Fitur:
 *   - Pilih Department (switcher)
 *   - Tabel kolom: label, key, type, required, visible, editable_by_pic, ref_trigger
 *   - Reorder: tombol ↑ ↓
 *   - Edit kolom: form inline/drawer kecil
 *   - Tambah kolom baru
 *   - Toggle visibility / hapus kolom (dengan proteksi)
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useDynamicSchema, generateColumnKey } from '../../hooks/useDynamicSchema'
import { useToast } from '../../contexts/ToastContext'
import { logActivity } from '../../lib/activityLog'

const TYPE_OPTIONS = [
  { value: 'text',       label: 'Teks' },
  { value: 'number',     label: 'Angka' },
  { value: 'select',     label: 'Pilihan (Select)' },
  { value: 'gdrive_link',label: 'Link Google Drive (Foto)' },
]

/* ------------------------------------------------------------------ */
/*  AddColumnForm — Form tambah kolom baru                              */
/* ------------------------------------------------------------------ */
function AddColumnForm({ departmentId, onSaved, onCancel }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  const [isRequired, setIsRequired] = useState(false)
  const [isRefTrigger, setIsRefTrigger] = useState(false)
  const [isEditableByPic, setIsEditableByPic] = useState(true)
  const [selectOptions, setSelectOptions] = useState([{ value: '', tone: 'neutral' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { addColumn } = useDynamicSchema(departmentId)
  const { addToast } = useToast()

  const previewKey = generateColumnKey(label)

  function addSelectOption() {
    setSelectOptions(prev => [...prev, { value: '', tone: 'neutral' }])
  }
  function removeSelectOption(i) {
    setSelectOptions(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateSelectOption(i, field, val) {
    setSelectOptions(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: val } : o))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!label.trim()) { setError('Label kolom tidak boleh kosong'); return }
    setSaving(true)
    setError('')
    try {
      await addColumn({
        label: label.trim(),
        type,
        is_required: isRequired,
        is_ref_trigger: isRefTrigger,
        is_editable_by_pic: isEditableByPic,
        is_visible: true,
        select_options: type === 'select' ? selectOptions.filter(o => o.value.trim()) : [],
      })
      addToast(`Kolom "${label}" berhasil ditambahkan.`, 'success')
      logActivity('tambah_kolom', '', { label, type, department_id: departmentId }, 'columns_config')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
      <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1f2328' }}>+ Tambah Kolom Baru</h4>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', display: 'block', marginBottom: '4px' }}>Label Kolom *</label>
            <input
              value={label} onChange={e => setLabel(e.target.value)}
              placeholder="mis. Nama Part"
              style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #dadce0', borderRadius: '6px', boxSizing: 'border-box' }}
            />
            {label && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#80868b' }}>Key: <code style={{ background: '#e8eaed', padding: '1px 5px', borderRadius: '3px' }}>{previewKey}</code></p>}
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', display: 'block', marginBottom: '4px' }}>Tipe Data</label>
            <select value={type} onChange={e => setType(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #dadce0', borderRadius: '6px' }}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Select options */}
        {type === 'select' && (
          <div style={{ marginBottom: '12px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e8eaed' }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Opsi Pilihan:</p>
            {selectOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                <input value={opt.value} onChange={e => updateSelectOption(i, 'value', e.target.value)}
                  placeholder={`Opsi ${i + 1}`}
                  style={{ flex: 1, padding: '5px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }} />
                <select value={opt.tone} onChange={e => updateSelectOption(i, 'tone', e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '5px' }}>
                  <option value="primary">Hijau (Positif)</option>
                  <option value="neutral">Abu (Netral)</option>
                  <option value="danger">Merah (Negatif)</option>
                </select>
                {selectOptions.length > 1 && (
                  <button type="button" onClick={() => removeSelectOption(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025', fontSize: '16px', lineHeight: 1 }}>×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addSelectOption}
              style={{ fontSize: '12px', color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>+ Tambah Opsi</button>
          </div>
        )}

        {/* Flags */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[
            { val: isRequired, set: setIsRequired, label: 'Wajib diisi' },
            { val: isRefTrigger, set: setIsRefTrigger, label: 'Pemicu Kode (Ref Trigger)' },
            { val: !isEditableByPic, set: v => setIsEditableByPic(!v), label: 'Hanya Admin (readonly PIC)' },
          ].map(({ val, set, label: lbl }) => (
            <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#1f2328' }}>
              <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: '#188038' }} />
              {lbl}
            </label>
          ))}
        </div>

        {error && <p style={{ color: '#d93025', fontSize: '12px', marginBottom: '10px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" style={{ padding: '6px 16px', fontSize: '13px' }} onClick={onCancel}>Batal</button>
          <button type="submit" className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Kolom'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  EditColumnRow — baris edit inline                                   */
/* ------------------------------------------------------------------ */
function EditColumnRow({ col, onSave, onCancel }) {
  const [label, setLabel] = useState(col.label)
  const [type, setType] = useState(col.type)
  const [isRequired, setIsRequired] = useState(col.is_required || false)
  const [isRefTrigger, setIsRefTrigger] = useState(col.is_ref_trigger || false)
  const [isEditableByPic, setIsEditableByPic] = useState(col.is_editable_by_pic !== false)
  const [selectOptions, setSelectOptions] = useState(
    Array.isArray(col.select_options) ? col.select_options : []
  )

  function handleSave() {
    onSave({
      label: label.trim() || col.label,
      type,
      is_required: isRequired,
      is_ref_trigger: isRefTrigger,
      is_editable_by_pic: isEditableByPic,
      select_options: type === 'select' ? selectOptions : [],
    })
  }

  return (
    <tr style={{ background: '#f0f7ff' }}>
      <td colSpan={7} style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', fontSize: '13px', border: '1px solid #1a73e8', borderRadius: '5px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginBottom: '3px' }}>Tipe</label>
            <select value={type} onChange={e => setType(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', fontSize: '13px', border: '1px solid #dadce0', borderRadius: '5px' }}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {[
            { val: isRequired, set: setIsRequired, label: 'Wajib diisi' },
            { val: isRefTrigger, set: setIsRefTrigger, label: 'Ref Trigger' },
            { val: !isEditableByPic, set: v => setIsEditableByPic(!v), label: 'Hanya Admin' },
          ].map(({ val, set, label: lbl }) => (
            <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: '#188038' }} />
              {lbl}
            </label>
          ))}
        </div>
        {type === 'select' && (
          <div style={{ marginBottom: '10px', padding: '10px', background: '#fff', borderRadius: '6px', border: '1px solid #e8eaed' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#5f6368' }}>Opsi Pilihan:</p>
            {selectOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                <input value={typeof opt === 'string' ? opt : (opt.value || '')}
                  onChange={e => {
                    const val = e.target.value
                    setSelectOptions(prev => prev.map((o, idx) => idx === i
                      ? (typeof o === 'string' ? val : { ...o, value: val }) : o))
                  }}
                  style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #dadce0', borderRadius: '4px' }} />
                <button type="button" onClick={() => setSelectOptions(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025' }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => setSelectOptions(prev => [...prev, { value: '', tone: 'neutral' }])}
              style={{ fontSize: '11px', color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer' }}>+ Opsi</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={handleSave}>Simpan</button>
          <button className="btn-secondary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={onCancel}>Batal</button>
        </div>
      </td>
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/*  SchemaBuilder — Main Component                                      */
/* ------------------------------------------------------------------ */
export default function SchemaBuilder({ userId = '' }) {
  const departments = useLiveQuery(() => db.departments_cache.toArray(), [], [])
  const [activeDeptId, setActiveDeptId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingColId, setEditingColId] = useState(null)
  const { addToast } = useToast()

  const effectiveDeptId = activeDeptId || departments?.[0]?.id || null

  const { allColumns, isLoading, updateColumn, removeColumn, reorderColumns } = useDynamicSchema(effectiveDeptId)

  async function handleToggleVisible(col) {
    await updateColumn(col.id, { is_visible: col.is_visible === false ? true : false })
    addToast(`Kolom "${col.label}" ${col.is_visible === false ? 'ditampilkan' : 'disembunyikan'}.`, 'success')
  }

  async function handleDelete(col) {
    if (col.is_ref_trigger) {
      addToast('Tidak bisa menghapus kolom Ref Trigger. Nonaktifkan flag terlebih dahulu.', 'error')
      return
    }
    if (!confirm(`Hapus permanen kolom "${col.label}"? Data di sel kolom ini akan kehilangan kunci dan tidak bisa dipulihkan.`)) return
    await removeColumn(col.id, { hard: true })
    addToast(`Kolom "${col.label}" dihapus.`, 'success')
    logActivity('hapus_kolom', userId, { label: col.label, key: col.key }, 'columns_config', col.id)
  }

  async function handleSaveEdit(col, changes) {
    await updateColumn(col.id, changes)
    setEditingColId(null)
    addToast(`Kolom "${changes.label || col.label}" diperbarui.`, 'success')
    logActivity('edit_kolom', userId, { key: col.key, changes }, 'columns_config', col.id)
  }

  async function handleMoveUp(col, idx) {
    if (idx === 0) return
    const ids = allColumns.map(c => c.id)
    ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
    await reorderColumns(ids)
  }

  async function handleMoveDown(col, idx) {
    if (idx === allColumns.length - 1) return
    const ids = allColumns.map(c => c.id)
    ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
    await reorderColumns(ids)
  }

  return (
    <div>
      {/* Department Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(departments || []).map(dept => (
          <button key={dept.id}
            onClick={() => { setActiveDeptId(dept.id); setShowAddForm(false); setEditingColId(null) }}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              border: `1.5px solid ${effectiveDeptId === dept.id ? '#188038' : '#dadce0'}`,
              background: effectiveDeptId === dept.id ? '#e6f4ea' : '#fff',
              color: effectiveDeptId === dept.id ? '#188038' : '#5f6368',
            }}>
            {dept.name}
          </button>
        ))}
        {departments?.length === 0 && (
          <p style={{ fontSize: '13px', color: '#80868b' }}>Belum ada Department. Tambahkan di panel Hierarki.</p>
        )}
      </div>

      {effectiveDeptId && (
        <>
          {/* Add Column Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#5f6368' }}>
              {allColumns.length} kolom terdefinisi
            </p>
            <button className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}
              onClick={() => setShowAddForm(v => !v)}>
              {showAddForm ? 'Batal' : '+ Tambah Kolom'}
            </button>
          </div>

          {showAddForm && (
            <AddColumnForm
              departmentId={effectiveDeptId}
              onSaved={() => setShowAddForm(false)}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* Columns Table */}
          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#80868b', padding: '24px' }}>Memuat skema...</p>
          ) : allColumns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#80868b' }}>
              <p>Belum ada kolom untuk Department ini.</p>
              <p style={{ fontSize: '12px' }}>Klik "+ Tambah Kolom" untuk mulai.</p>
            </div>
          ) : (
            <div style={{ border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#80868b', width: '50px' }}>Urut</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Label</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Key</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#5f6368', fontWeight: 600 }}>Tipe</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#5f6368', fontWeight: 600 }}>Wajib</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#5f6368', fontWeight: 600 }}>Tampil</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#5f6368', fontWeight: 600 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {allColumns.map((col, idx) => {
                    if (editingColId === col.id) {
                      return (
                        <EditColumnRow
                          key={col.id}
                          col={col}
                          onSave={changes => handleSaveEdit(col, changes)}
                          onCancel={() => setEditingColId(null)}
                        />
                      )
                    }
                    return (
                      <tr key={col.id} style={{
                        borderBottom: '1px solid #f1f3f4',
                        opacity: col.is_visible === false ? 0.5 : 1,
                        background: col.is_auto ? '#fef7e0' : undefined,
                      }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                            <button onClick={() => handleMoveUp(col, idx)} disabled={idx === 0}
                              style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: '#80868b', fontSize: '12px', opacity: idx === 0 ? 0.3 : 1, padding: '1px 4px' }}>▲</button>
                            <span style={{ fontSize: '10px', color: '#80868b' }}>{idx + 1}</span>
                            <button onClick={() => handleMoveDown(col, idx)} disabled={idx === allColumns.length - 1}
                              style={{ background: 'none', border: 'none', cursor: idx === allColumns.length - 1 ? 'not-allowed' : 'pointer', color: '#80868b', fontSize: '12px', opacity: idx === allColumns.length - 1 ? 0.3 : 1, padding: '1px 4px' }}>▼</button>
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: '#1f2328' }}>
                          {col.label}
                          {col.is_auto && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px', borderRadius: '8px', background: '#fef7e0', color: '#b06000' }}>auto</span>}
                          {col.is_ref_trigger && <span style={{ marginLeft: '4px', fontSize: '10px', padding: '1px 5px', borderRadius: '8px', background: '#e8f0fe', color: '#1a73e8' }}>ref</span>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <code style={{ fontSize: '11px', background: '#f1f3f4', padding: '1px 6px', borderRadius: '3px', color: '#5f6368' }}>{col.key}</code>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#5f6368' }}>
                          {TYPE_OPTIONS.find(t => t.value === col.type)?.label || col.type}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {col.is_required ? <span style={{ color: '#188038', fontSize: '16px' }}>✓</span> : <span style={{ color: '#dadce0' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button onClick={() => handleToggleVisible(col)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                            title={col.is_visible === false ? 'Klik untuk tampilkan' : 'Klik untuk sembunyikan'}>
                            {col.is_visible === false ? '🙈' : '👁'}
                          </button>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="btn-secondary"
                              style={{ padding: '3px 10px', fontSize: '11px' }}
                              onClick={() => setEditingColId(col.id)}>Edit</button>
                            {!col.is_auto && (
                              <button
                                style={{ padding: '3px 10px', fontSize: '11px', background: 'none', border: '1px solid #d93025', color: '#d93025', borderRadius: '5px', cursor: 'pointer' }}
                                onClick={() => handleDelete(col)}>Hapus</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
